import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { UMAP } from "umap-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, "scripts", "cache");
const CACHE_FILE = process.env.ARCHIVE_CACHE
  ? resolve(process.env.ARCHIVE_CACHE)
  : join(CACHE_DIR, "cma-artworks.json");
const GRID_CACHE = join(CACHE_DIR, "cma-grids.json");
const OUT_DIR = join(ROOT, "public", "data");
const OUT_BIN = join(OUT_DIR, "latent-archive.bin");
const OUT_META = join(OUT_DIR, "latent-archive.json");

const API = "https://openaccess-api.clevelandart.org/api/artworks/";
const IMAGE_HOST = "https://openaccess-cdn.clevelandart.org/";
const USER_AGENT = "data-art/latent-archive (https://github.com/litterthanlit/data-art)";
const FIELDS = [
  "id",
  "accession_number",
  "title",
  "creators",
  "creation_date",
  "creation_date_earliest",
  "culture",
  "type",
  "department",
  "images",
];
const PAGE_SIZE = 1000;
const DOWNLOADS_IN_FLIGHT = 8;
const TARGET = Number(process.env.ARCHIVE_TARGET || 20000);
const GRID = 4;
const CELLS = GRID * GRID;
const SEED = 1917;
const YEAR_RANGE = [-8000, 2030];

async function main() {
  const refresh = process.argv.includes("--refresh");
  const works = !refresh && existsSync(CACHE_FILE)
    ? JSON.parse(await readFile(CACHE_FILE, "utf8"))
    : await fetchCollection();

  console.log(`cache: ${works.length.toLocaleString()} CC0 artworks with images`);
  const sample = await sampleWorks(works, TARGET);
  console.log(`sample: ${sample.length.toLocaleString()} artworks → ${(sample.length * CELLS).toLocaleString()} pigment particles`);

  const latent = await embed(sample);
  const helix = timeHelix(sample);
  const islands = nameIslands(sample, latent);
  await writeOutputs(sample, latent, helix, islands);
}

/* ------------------------------------------------------------------ fetch */

async function fetchCollection() {
  const works = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const body = await getJson(
      `${API}?cc0=1&has_image=1&limit=${PAGE_SIZE}&skip=${skip}&fields=${FIELDS.join(",")}`,
    );
    for (const item of body.data ?? []) {
      const work = compactWork(item);
      if (work) works.push(work);
    }
    console.log(`  ${skip + (body.data?.length ?? 0)} / ${body.info?.total ?? "?"} records, ${works.length} usable`);
    if (!body.data?.length || skip + PAGE_SIZE >= (body.info?.total ?? 0)) break;
  }
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(works));
  return works;
}

async function getJson(url, attempt = 0) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 5) throw new Error(`CMA API ${response.status} after retries`);
    await sleep(2000 * 2 ** attempt);
    return getJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`CMA API ${response.status}: ${await response.text()}`);
  return response.json();
}

function compactWork(item) {
  const image = item.images?.web?.url;
  const year = item.creation_date_earliest;
  if (!image?.startsWith(IMAGE_HOST) || !item.accession_number || !plausibleYear(year)) return null;

  return {
    id: item.id,
    accession: item.accession_number,
    title: clean(item.title) || "Untitled",
    artist: makerName(item.creators) || clean(item.culture?.[0]) || "Unknown maker",
    year,
    date: clean(item.creation_date) || String(year),
    place: clean(item.culture?.[0]?.split(",")[0]),
    department: clean(item.department) || "Collection",
    classification: clean(item.type),
    image: image.slice(IMAGE_HOST.length),
  };
}

// "John Singleton Copley (American, 1738–1815)" → "John Singleton Copley"
function makerName(creators) {
  return clean(creators?.[0]?.description).replace(/\s*\(.*$/, "");
}

/* ----------------------------------------------------------------- grids */

// Each sampled work's web image is downloaded once and area-averaged into 16 cells.
// Grids are cached by id, so an interrupted build resumes where it stopped. The kept
// works are the first `target` candidates with a grid, in shuffle order, however the
// downloads happened to interleave.
async function attachGrids(candidates, target) {
  const cache = existsSync(GRID_CACHE) ? JSON.parse(await readFile(GRID_CACHE, "utf8")) : {};
  let next = 0;
  let kept = 0;
  let fetched = 0;
  let lastSave = Date.now();

  async function worker() {
    while (kept < target && next < candidates.length) {
      const work = candidates[next++];
      if (!(work.id in cache)) {
        cache[work.id] = await downloadGrid(work.image);
        fetched += 1;
        if (fetched % 250 === 0) console.log(`  images: ${fetched} fetched, ${kept} / ${target} kept`);
        if (Date.now() - lastSave > 30_000) {
          lastSave = Date.now();
          await writeFile(GRID_CACHE, JSON.stringify(cache));
        }
      }
      if (cache[work.id]) kept += 1;
    }
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await Promise.all(Array.from({ length: DOWNLOADS_IN_FLIGHT }, worker));
  await writeFile(GRID_CACHE, JSON.stringify(cache));
  return candidates
    .filter((work) => cache[work.id])
    .slice(0, target)
    .map((work) => ({ ...work, grid: cache[work.id] }));
}

async function downloadGrid(path, attempt = 0) {
  try {
    const response = await fetch(IMAGE_HOST + path, { headers: { "user-agent": USER_AGENT } });
    if (response.status === 429 || response.status >= 500) throw new Error(String(response.status));
    if (!response.ok) return null;
    const { width, height, data } = jpeg.decode(Buffer.from(await response.arrayBuffer()), {
      useTArray: true,
      formatAsRGBA: true,
      maxMemoryUsageInMB: 1024,
    });
    return averageGrid(data, width, height);
  } catch (error) {
    if (attempt >= 3) {
      console.warn(`  skipped ${path}: ${error.message}`);
      return null;
    }
    await sleep(1000 * 2 ** attempt);
    return downloadGrid(path, attempt + 1);
  }
}

// Area-average an RGBA bitmap into a 4×4 grid, as one hex string of 16 RGB cells.
function averageGrid(rgba, width, height) {
  let hex = "";
  for (let gy = 0; gy < GRID; gy += 1) {
    for (let gx = 0; gx < GRID; gx += 1) {
      const x0 = (gx / GRID) * width;
      const x1 = ((gx + 1) / GRID) * width;
      const y0 = (gy / GRID) * height;
      const y1 = ((gy + 1) / GRID) * height;
      const sum = [0, 0, 0];
      let weight = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y1); y += 1) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.ceil(x1); x += 1) {
          const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          const i = (y * width + x) * 4;
          sum[0] += rgba[i] * w;
          sum[1] += rgba[i + 1] * w;
          sum[2] += rgba[i + 2] * w;
          weight += w;
        }
      }
      for (const channel of sum) {
        hex += Math.round(channel / weight).toString(16).padStart(2, "0");
      }
    }
  }
  return hex;
}

/* ---------------------------------------------------------------- shaping */

async function sampleWorks(works, target) {
  const random = mulberry32(SEED);
  const shuffled = works
    .filter((work) => plausibleYear(work.year))
    .map((work) => ({ work, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ work }) => work);
  const sample = await attachGrids(shuffled, target);
  return sample.sort((a, b) => a.year - b.year || a.id - b.id);
}

function meanLightness(work) {
  const rgb = gridRgb(work);
  let sum = 0;
  for (let c = 0; c < CELLS; c += 1) sum += rgbToLab(rgb[c * 3], rgb[c * 3 + 1], rgb[c * 3 + 2])[0];
  return sum / CELLS / 100;
}

function gridRgb(work) {
  const rgb = new Uint8Array(CELLS * 3);
  for (let i = 0; i < CELLS * 3; i += 1) {
    rgb[i] = parseInt(work.grid.slice(i * 2, i * 2 + 2), 16);
  }
  return rgb;
}

// Visual similarity first (the 16-cell Lab miniature), time and medium as gentle pulls.
function features(sample) {
  const years = rankMap(sample.map((work) => work.year));
  return sample.map((work, index) => {
    const rgb = gridRgb(work);
    const vector = [];
    const mean = [0, 0, 0];
    for (let c = 0; c < CELLS; c += 1) {
      const [L, a, b] = rgbToLab(rgb[c * 3], rgb[c * 3 + 1], rgb[c * 3 + 2]);
      vector.push(L / 100, a / 110, b / 110);
      mean[0] += L / 100 / CELLS;
      mean[1] += a / 110 / CELLS;
      mean[2] += b / 110 / CELLS;
    }
    vector.push(...mean.map((value) => value * 2));
    vector.push(years[index] * 0.9);
    const bucket = hash(work.classification || work.department) % 6;
    for (let i = 0; i < 6; i += 1) vector.push(i === bucket ? 0.35 : 0);
    return vector;
  });
}

async function embed(sample) {
  const data = features(sample);
  const umap = new UMAP({
    nComponents: 3,
    nNeighbors: 18,
    minDist: 0.22,
    spread: 1.2,
    random: mulberry32(SEED),
  });
  const epochs = umap.initializeFit(data);
  const started = Date.now();
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    umap.step();
    if (epoch % 50 === 0) process.stdout.write(`\r  umap ${epoch}/${epochs}`);
  }
  process.stdout.write(`\r  umap ${epochs}/${epochs} in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  return normalizeCloud(umap.getEmbedding(), 34);
}

function normalizeCloud(points, radius) {
  const center = [0, 1, 2].map((axis) => median(points.map((p) => p[axis])));
  const centered = points.map((p) => p.map((value, axis) => value - center[axis]));
  const distances = centered.map((p) => Math.hypot(...p)).sort((a, b) => a - b);
  const scale = radius / (distances[Math.floor(distances.length * 0.95)] || 1);
  return centered.map((p) => p.map((value) => value * scale));
}

// Chronology as a rising spiral: rank of year → height and turn, lightness → radius.
function timeHelix(sample) {
  const random = mulberry32(SEED + 1);
  const ranks = rankMap(sample.map((work) => work.year));
  const departments = [...new Set(sample.map((work) => work.department))].sort();
  const turns = 6.5;

  return sample.map((work, index) => {
    const t = ranks[index];
    const dept = departments.indexOf(work.department) / Math.max(1, departments.length);
    const lightness = meanLightness(work);
    const angle = t * turns * Math.PI * 2 + dept * 0.9 + gaussian(random) * 0.08;
    const radius = 17 + (lightness - 0.5) * 12 + gaussian(random) * 2.2;
    const y = (t - 0.5) * 56 + gaussian(random) * 0.9;
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
  });
}

/* ---------------------------------------------------------------- islands */

const ISLAND_VOXEL = 2.2; // flood-fill cell size for finding separated islands
const ISLAND_WORKS_PER_LABEL = 1800;
const ISLAND_MIN_SHARE = 0.015;
const UNCOUNTABLE = new Set([
  "chalk", "graphite", "earthenware", "porcelain", "stoneware", "glass", "silver",
  "metalwork", "photography", "ceramics", "furniture", "jewelry", "lace", "pastel",
  "watercolor", "ink", "charcoal", "gouache", "sculpture",
]);
const RENAME = new Map([["ink or chalk wash", "ink washes"]]);

// Separated islands come from a voxel flood fill; large islands are then split
// with seeded k-means so each label can be specific. Every region is named by its
// most over-represented classification ("lift" against the whole sample).
function nameIslands(sample, latent) {
  const n = latent.length;
  const globalClass = shares(sample.map((work) => work.classification));
  const regions = [];

  connectedIslands(latent).forEach((members, island) => {
    if (members.length < n * ISLAND_MIN_SHARE) return;
    const k = Math.max(1, Math.round(members.length / ISLAND_WORKS_PER_LABEL));
    const groups = kmeans(members, latent, k, SEED + 2 + island);
    const named = groups
      .filter((group) => group.length >= n * ISLAND_MIN_SHARE)
      .map((group) => ({ members: group, title: titleFor(group.map((i) => sample[i]), globalClass) }));

    // Neighbouring clusters with the same name read as one region.
    const merged = new Map();
    for (const region of named) {
      const existing = merged.get(region.title);
      if (existing) existing.members.push(...region.members);
      else merged.set(region.title, region);
    }
    regions.push(...merged.values());
  });

  const islands = regions.map(({ members, title }) => {
    const works = members.map((i) => sample[i]);
    const center = [0, 1, 2].map((axis) => members.reduce((sum, i) => sum + latent[i][axis], 0) / members.length);
    const [place, placeShare] = topEntry(shares(works.map((work) => work.place)));
    const years = works.map((work) => work.year).sort((a, b) => a - b);
    const span = `${formatYear(roundDecade(years[Math.floor(years.length * 0.1)]))} – ${formatYear(roundDecade(years[Math.floor(years.length * 0.9)]))}`;
    const radius = Math.sqrt(members.reduce((sum, i) => sum + sqDist(latent[i], center), 0) / members.length);
    return {
      center: center.map((value) => Number(value.toFixed(2))),
      radius: Number(radius.toFixed(2)),
      count: members.length,
      title,
      detail: placeShare >= 0.3 ? `${place} · ${span}` : span,
    };
  });

  islands.sort((a, b) => b.count - a.count);
  for (const island of islands) {
    console.log(`  island ${String(island.count).padStart(5)}  ${island.title} — ${island.detail}`);
  }
  return islands;
}

function titleFor(works, globalClass) {
  const ranked = [...shares(works.map((work) => work.classification))]
    .map(([name, share]) => ({ name, share, lift: share / (globalClass.get(name) || 1) }))
    .filter((entry) => entry.share >= 0.1)
    .sort((a, b) => b.lift * Math.sqrt(b.share) - a.lift * Math.sqrt(a.share));
  if (!ranked.length) return topEntry(shares(works.map((work) => work.department)))[0];
  if (ranked[0].share >= 0.2 || ranked.length === 1) return plural(ranked[0].name);
  return `${plural(ranked[0].name)} & ${plural(ranked[1].name).toLowerCase()}`;
}

function connectedIslands(latent) {
  const cells = new Map();
  latent.forEach((point, i) => {
    const key = point.map((value) => Math.floor(value / ISLAND_VOXEL)).join(",");
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  });

  const seen = new Set();
  const islands = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    seen.add(start);
    const stack = [start];
    const members = [];
    while (stack.length) {
      const key = stack.pop();
      members.push(...cells.get(key));
      const [x, y, z] = key.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dz = -1; dz <= 1; dz += 1) {
            const next = `${x + dx},${y + dy},${z + dz}`;
            if (cells.has(next) && !seen.has(next)) {
              seen.add(next);
              stack.push(next);
            }
          }
        }
      }
    }
    islands.push(members);
  }
  return islands.sort((a, b) => b.length - a.length);
}

// Seeded k-means++ over a subset of points; returns member index lists.
function kmeans(members, latent, k, seed) {
  if (k <= 1) return [members];
  const random = mulberry32(seed);
  const centers = [latent[members[Math.floor(random() * members.length)]].slice()];
  const dist = new Float64Array(members.length).fill(Infinity);
  while (centers.length < k) {
    const last = centers[centers.length - 1];
    let total = 0;
    members.forEach((i, j) => {
      dist[j] = Math.min(dist[j], sqDist(latent[i], last));
      total += dist[j];
    });
    let pick = random() * total;
    let chosen = members.length - 1;
    for (let j = 0; j < members.length; j += 1) {
      pick -= dist[j];
      if (pick <= 0) {
        chosen = j;
        break;
      }
    }
    centers.push(latent[members[chosen]].slice());
  }

  let groups = [];
  for (let iter = 0; iter < 30; iter += 1) {
    groups = centers.map(() => []);
    for (const i of members) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((center, c) => {
        const d = sqDist(latent[i], center);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      groups[best].push(i);
    }
    groups.forEach((group, c) => {
      if (!group.length) return;
      centers[c] = [0, 1, 2].map((axis) => group.reduce((sum, i) => sum + latent[i][axis], 0) / group.length);
    });
  }
  return groups.filter((group) => group.length);
}

function shares(values) {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  const total = values.length || 1;
  return new Map([...counts].map(([key, count]) => [key, count / total]).sort((a, b) => b[1] - a[1]));
}

function topEntry(map) {
  return map.entries().next().value ?? ["", 0];
}

function plural(term) {
  const lower = RENAME.get(term.toLowerCase()) ?? term.toLowerCase();
  const text = UNCOUNTABLE.has(lower) || /s$/.test(lower) ? lower : lower.replace(/y$/, "ie") + "s";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function roundDecade(year) {
  return Math.round(year / 10) * 10;
}

function formatYear(year) {
  if (year === 0) return "1 CE";
  return year < 0 ? `${Math.abs(year)} BCE` : String(year);
}

function sqDist(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/* ---------------------------------------------------------------- outputs */

async function writeOutputs(sample, latent, helix, islands) {
  await mkdir(OUT_DIR, { recursive: true });
  const count = sample.length;
  const header = 16;
  const size = header + count * 12 * 2 + count * CELLS * 3 + count * 2;
  const buffer = Buffer.alloc(size + ((4 - (size % 4)) % 4));
  let offset = 0;

  buffer.write("LARC", offset, "ascii");
  buffer.writeUInt32LE(1, 4);
  buffer.writeUInt32LE(count, 8);
  buffer.writeUInt32LE(GRID, 12);
  offset = header;

  for (const layout of [latent, helix]) {
    for (const point of layout) {
      for (const value of point) {
        buffer.writeFloatLE(value, offset);
        offset += 4;
      }
    }
  }
  for (const work of sample) {
    Buffer.from(gridRgb(work)).copy(buffer, offset);
    offset += CELLS * 3;
  }
  for (const work of sample) {
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, work.year)), offset);
    offset += 2;
  }

  const departments = [...new Set(sample.map((work) => work.department))].sort();
  const meta = {
    version: 2,
    source: "Cleveland Museum of Art Open Access API — CC0 works and images",
    sourceUrl: "https://openaccess-api.clevelandart.org/",
    imageHost: IMAGE_HOST,
    generatedAt: new Date().toISOString(),
    count,
    grid: GRID,
    years: [sample[0].year, sample[count - 1].year],
    departments,
    islands,
    works: {
      accession: sample.map((work) => work.accession),
      title: sample.map((work) => work.title),
      artist: sample.map((work) => work.artist),
      date: sample.map((work) => work.date),
      place: sample.map((work) => work.place || ""),
      department: sample.map((work) => departments.indexOf(work.department)),
      image: sample.map((work) => work.image),
    },
  };

  await writeFile(OUT_BIN, buffer);
  await writeFile(OUT_META, JSON.stringify(meta));
  const [bin, json] = await Promise.all([stat(OUT_BIN), stat(OUT_META)]);
  console.log(`wrote ${OUT_BIN} (${(bin.size / 1e6).toFixed(2)} MB)`);
  console.log(`wrote ${OUT_META} (${(json.size / 1e6).toFixed(2)} MB)`);
}

/* ---------------------------------------------------------------- helpers */

function rgbToLab(r, g, b) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function rankMap(values) {
  const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(values.length);
  order.forEach(([, index], rank) => {
    ranks[index] = values.length > 1 ? rank / (values.length - 1) : 0.5;
  });
  return ranks;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function hash(text = "") {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

function plausibleYear(year) {
  return Number.isFinite(year) && year >= YEAR_RANGE[0] && year <= YEAR_RANGE[1];
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
