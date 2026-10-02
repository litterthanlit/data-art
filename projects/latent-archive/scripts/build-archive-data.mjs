import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GifReader } from "omggif";
import { UMAP } from "umap-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, "scripts", "cache");
const RANGE_DIR = join(CACHE_DIR, ".ranges");
const CACHE_FILE = process.env.ARCHIVE_CACHE
  ? resolve(process.env.ARCHIVE_CACHE)
  : join(CACHE_DIR, "aic-artworks.json");
const OUT_DIR = join(ROOT, "public", "data");
const OUT_BIN = join(OUT_DIR, "latent-archive.bin");
const OUT_META = join(OUT_DIR, "latent-archive.json");

const API = "https://api.artic.edu/api/v1/artworks/search";
const USER_AGENT = "data-art/latent-archive (https://github.com/litterthanlit/data-art)";
const FIELDS = [
  "id",
  "title",
  "artist_title",
  "date_start",
  "date_display",
  "place_of_origin",
  "classification_title",
  "department_title",
  "color",
  "thumbnail",
  "image_id",
];
const PAGE_SIZE = 100;
const SEARCH_WINDOW = 1000; // AIC search refuses offset + limit beyond 1,000
const MAX_ID = 1_000_000;
const REQUEST_GAP_MS = 1100; // anonymous rate limit is 60 requests / minute
const TARGET = Number(process.env.ARCHIVE_TARGET || 20000);
const GRID = 4;
const CELLS = GRID * GRID;
const SEED = 1917;
const YEAR_RANGE = [-8000, 2030]; // AIC has a few corrupt date_start values (e.g. 1486490)

async function main() {
  const refresh = process.argv.includes("--refresh");
  const works = !refresh && existsSync(CACHE_FILE)
    ? JSON.parse(await readFile(CACHE_FILE, "utf8"))
    : await fetchCollection();

  console.log(`cache: ${works.length.toLocaleString()} artworks with miniatures`);
  const sample = sampleWorks(works, TARGET);
  console.log(`sample: ${sample.length.toLocaleString()} artworks → ${(sample.length * CELLS).toLocaleString()} pigment particles`);

  const latent = await embed(sample);
  const helix = timeHelix(sample);
  const islands = nameIslands(sample, latent);
  await writeOutputs(sample, latent, helix, islands);
}

/* ------------------------------------------------------------------ fetch */

async function fetchCollection() {
  await mkdir(RANGE_DIR, { recursive: true });
  const ranges = await partitionIds(0, MAX_ID);
  const records = [];

  for (const [lo, hi] of ranges) {
    const file = join(RANGE_DIR, `${lo}_${hi}.json`);
    let rows;
    if (existsSync(file)) {
      rows = JSON.parse(await readFile(file, "utf8"));
    } else {
      rows = await fetchRange(lo, hi);
      await writeFile(file, JSON.stringify(rows));
    }
    records.push(...rows);
    console.log(`  ${lo}…${hi}: ${rows.length} usable (total ${records.length})`);
  }

  const seen = new Set();
  const works = records.filter((work) => !seen.has(work.id) && seen.add(work.id));
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(works));
  return works;
}

// Split the id axis until every slice fits inside the search window.
async function partitionIds(lo, hi) {
  const total = await countRange(lo, hi);
  if (total === 0) return [];
  if (total <= SEARCH_WINDOW || hi - lo <= 1) {
    if (total > SEARCH_WINDOW) {
      console.warn(`  ${lo}…${hi} holds ${total} works; keeping the first ${SEARCH_WINDOW}`);
    }
    return [[lo, hi]];
  }
  const mid = Math.floor((lo + hi) / 2);
  return [...(await partitionIds(lo, mid)), ...(await partitionIds(mid, hi))];
}

async function countRange(lo, hi) {
  const body = await search({ query: rangeQuery(lo, hi), limit: 0, fields: ["id"] });
  return body.pagination?.total ?? 0;
}

async function fetchRange(lo, hi) {
  const rows = [];
  for (let page = 1; page * PAGE_SIZE <= SEARCH_WINDOW; page += 1) {
    const body = await search({
      query: rangeQuery(lo, hi),
      fields: FIELDS,
      limit: PAGE_SIZE,
      page,
      sort: [{ id: "asc" }],
    });
    for (const item of body.data ?? []) {
      const work = compactWork(item);
      if (work) rows.push(work);
    }
    if (page >= (body.pagination?.total_pages ?? 0)) break;
  }
  return rows;
}

function rangeQuery(lo, hi) {
  return {
    bool: {
      filter: [
        { term: { is_public_domain: true } },
        { exists: { field: "image_id" } },
        { exists: { field: "date_start" } },
        { range: { id: { gte: lo, lt: hi } } },
      ],
    },
  };
}

let lastRequest = 0;
async function search(payload, attempt = 0) {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();

  const response = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "AIC-User-Agent": USER_AGENT,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 5) throw new Error(`AIC API ${response.status} after retries`);
    await sleep(2000 * 2 ** attempt);
    return search(payload, attempt + 1);
  }
  if (!response.ok) throw new Error(`AIC API ${response.status}: ${await response.text()}`);
  return response.json();
}

function compactWork(item) {
  const lqip = item.thumbnail?.lqip;
  if (!lqip || !item.image_id || !plausibleYear(item.date_start)) return null;

  const grid = decodeMiniature(lqip);
  if (!grid) return null;

  return {
    id: item.id,
    title: clean(item.title) || "Untitled",
    artist: clean(item.artist_title) || "Unknown maker",
    year: item.date_start,
    date: clean(item.date_display) || String(item.date_start),
    place: clean(item.place_of_origin),
    department: clean(item.department_title) || "Collection",
    classification: clean(item.classification_title),
    color: item.color ? [item.color.h, item.color.s, item.color.l] : null,
    image: item.image_id,
    grid,
  };
}

// LQIP is a tiny base64 GIF of the artwork. Area-average it into a 4×4 RGB grid.
export function decodeMiniature(dataUri) {
  try {
    const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
    const reader = new GifReader(new Uint8Array(Buffer.from(base64, "base64")));
    const { width, height } = reader;
    const rgba = new Uint8Array(width * height * 4);
    reader.decodeAndBlitFrameRGBA(0, rgba);

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
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- shaping */

function sampleWorks(works, target) {
  const random = mulberry32(SEED);
  const shuffled = works
    .filter((work) => work.grid?.length === CELLS * 6 && plausibleYear(work.year))
    .map((work) => ({ work, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, target)
    .map(({ work }) => work);
  return shuffled.sort((a, b) => a.year - b.year || a.id - b.id);
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
    const lightness = work.color ? work.color[2] / 100 : 0.5;
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
    version: 1,
    source: "Art Institute of Chicago API — public-domain works, CC0 metadata",
    sourceUrl: "https://api.artic.edu/docs/",
    generatedAt: new Date().toISOString(),
    count,
    grid: GRID,
    years: [sample[0].year, sample[count - 1].year],
    departments,
    islands,
    works: {
      id: sample.map((work) => work.id),
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
