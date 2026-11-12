// Usage: npm run data            (uses scripts/cache/ when present)
//        npm run data -- --refresh   (download every series again)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { REGIONS, parseSeries, seriesUrl } from "./lib/noaa.mjs";

const START = 1850;
const END = 2025;
const root = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = `${root}scripts/cache/`;
const outFile = `${root}public/data/warming-rivers.json`;

async function loadSeries(region, refresh) {
  const cached = `${cacheDir}${region.id}.json`;
  if (!refresh) {
    try {
      return JSON.parse(await readFile(cached, "utf8"));
    } catch {
      // Not cached yet.
    }
  }
  const url = seriesUrl(region, START, END);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${region.name}: HTTP ${res.status} from ${url}`);
  const json = await res.json();
  await writeFile(cached, JSON.stringify(json));
  return json;
}

const refresh = process.argv.includes("--refresh");
await mkdir(cacheDir, { recursive: true });
const regions = [];
for (const region of REGIONS) {
  const values = parseSeries(await loadSeries(region, refresh), START, END);
  regions.push({ id: region.id, name: region.name, values });
  const last = values.at(-1);
  console.log(`${region.name.padEnd(14)} ${START}–${END}  ${END}: ${last >= 0 ? "+" : ""}${last.toFixed(2)} °C  range ${Math.min(...values).toFixed(2)} … ${Math.max(...values).toFixed(2)}`);
}

const out = {
  start: START,
  end: END,
  units: "°C departure from the 1901–2000 average",
  source: "NOAA NCEI Climate at a Glance, global time series",
  sourceUrl: "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series",
  builtAt: new Date().toISOString(),
  regions,
};
await mkdir(`${root}public/data`, { recursive: true });
await writeFile(outFile, JSON.stringify(out));
console.log(`wrote ${outFile} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB, ${regions.length} regions)`);
