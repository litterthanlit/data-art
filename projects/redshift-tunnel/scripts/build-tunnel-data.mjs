// Builds public/data/redshift-tunnel.{bin,json} from DESI DR1 LSS clustering catalogues.
// Usage: npm run data            (uses scripts/cache/, downloads only what is missing)
//        npm run data -- --refresh   (re-download everything)
// Env:   TUNNEL_SAMPLE=<n>       number of objects to keep (default 600000)
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { lookbackGyr } from './lib/cosmology.mjs';
import { readFitsColumns } from './lib/fits.mjs';
import { encodeTunnel } from './lib/encode.mjs';
import { TRACERS } from '../src/data/layout.js';

export const DEFAULT_SAMPLE = 600_000;
export const SEED = 1998;
export const SOURCE_BASE =
  'https://data.desi.lbl.gov/public/dr1/survey/catalogs/dr1/LSS/iron/LSScats/v1.5/';

// Order matters: when an object is in several catalogues the first one wins.
export const FILES = [
  { prefix: 'BGS_ANY', tracer: 'BGS' },
  { prefix: 'LRG', tracer: 'LRG' },
  { prefix: 'ELG_LOPnotqso', tracer: 'ELG' },
  { prefix: 'QSO', tracer: 'QSO' },
].flatMap(({ prefix, tracer }) =>
  ['NGC', 'SGC'].map((cap) => ({ name: `${prefix}_${cap}_clustering.dat.fits`, tracer })),
);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, 'cache');
const OUT_DIR = path.join(HERE, '..', 'public', 'data');

// ---------------------------------------------------------------- pure helpers

/** 1 for the first occurrence of each id, 0 for later repeats. Memory-lean: sorts a copy, tracks only repeated ids. */
export function firstOccurrenceMask(ids) {
  const sorted = ids.slice().sort();
  const repeated = new Set();
  for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) repeated.add(sorted[i]);
  const keep = new Uint8Array(ids.length).fill(1);
  if (repeated.size === 0) return keep;
  const seen = new Set();
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!repeated.has(id)) continue;
    if (seen.has(id)) keep[i] = 0;
    else seen.add(id);
  }
  return keep;
}

/** Records are `{ targetId: bigint, ... }`. Keeps the first occurrence of each targetId. */
export function dedupeByTargetId(records) {
  const keep = firstOccurrenceMask(BigInt64Array.from(records, (r) => r.targetId));
  return records.filter((_, i) => keep[i]);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` unique indices from [0, n), sorted ascending. All indices when count >= n. */
export function sampleUniform(n, count, seed) {
  const pool = new Uint32Array(n);
  for (let i = 0; i < n; i++) pool[i] = i;
  if (count >= n) return pool;
  const rand = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rand() * (n - i));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  return pool.slice(0, count).sort();
}

// ---------------------------------------------------------------- download

async function remoteSize(url) {
  const res = await fetch(url, { method: 'HEAD' });
  if (!res.ok) throw new Error(`HEAD ${url}: HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length'));
  if (!Number.isFinite(len) || len <= 0) throw new Error(`HEAD ${url}: no Content-Length`);
  return len;
}

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return -1;
  }
}

async function download(url, dest, expected) {
  const part = `${dest}.part`;
  await rm(part, { force: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`GET ${url}: HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length')) || expected;
  let received = 0;
  let nextLog = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    if (received >= nextLog) {
      process.stdout.write(`\r  ${(received / 1e6).toFixed(0)} / ${(declared / 1e6).toFixed(0)} MB`);
      nextLog = received + 20e6;
    }
  });
  await pipeline(body, createWriteStream(part));
  process.stdout.write('\n');
  if (received !== declared) {
    await rm(part, { force: true });
    throw new Error(`${url}: received ${received} bytes, expected ${declared}`);
  }
  await rename(part, dest);
}

async function ensureCached(file, refresh) {
  const url = SOURCE_BASE + file.name;
  const dest = path.join(CACHE_DIR, file.name);
  const have = await fileSize(dest);
  let expected;
  try {
    expected = await remoteSize(url);
  } catch (err) {
    if (have > 0 && !refresh) {
      console.warn(`  ${file.name}: cannot verify size (${err.message}); trusting cached file`);
      return dest;
    }
    throw err;
  }
  if (!refresh && have === expected) {
    console.log(`cached   ${file.name} (${(have / 1e6).toFixed(0)} MB)`);
    return dest;
  }
  console.log(`download ${file.name}`);
  for (let attempt = 1; ; attempt++) {
    try {
      await download(url, dest, expected);
      return dest;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`  retry ${attempt}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const refresh = process.argv.includes('--refresh');
  const sample = Number(process.env.TUNNEL_SAMPLE ?? DEFAULT_SAMPLE);
  if (!Number.isInteger(sample) || sample <= 0) throw new Error(`Bad TUNNEL_SAMPLE '${process.env.TUNNEL_SAMPLE}'`);
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const parts = [];
  for (const file of FILES) {
    const dest = await ensureCached(file, refresh);
    const buf = await readFile(dest);
    const { rows, columns } = readFitsColumns(buf, ['TARGETID', 'RA', 'DEC', 'Z']);
    parts.push({ tracer: TRACERS.indexOf(file.tracer), rows, ...columns });
    console.log(`parsed   ${file.name}: ${rows.toLocaleString()} rows`);
  }

  // concatenate, dropping non-finite or non-positive redshifts (stars / failures)
  const total = parts.reduce((s, p) => s + p.rows, 0);
  const ids = new BigInt64Array(total);
  const ra = new Float64Array(total);
  const dec = new Float64Array(total);
  const z = new Float64Array(total);
  const tracer = new Uint8Array(total);
  let n = 0;
  let dropped = 0;
  for (const p of parts) {
    for (let i = 0; i < p.rows; i++) {
      const zi = p.Z[i];
      if (!(zi > 0) || !Number.isFinite(zi)) {
        dropped++;
        continue;
      }
      ids[n] = p.TARGETID[i];
      ra[n] = p.RA[i];
      dec[n] = p.DEC[i];
      z[n] = zi;
      tracer[n] = p.tracer;
      n++;
    }
  }
  parts.length = 0;
  console.log(`rows: ${total.toLocaleString()} read, ${dropped.toLocaleString()} dropped (z <= 0)`);

  const keep = firstOccurrenceMask(ids.subarray(0, n));
  let unique = 0;
  for (let i = 0; i < n; i++) unique += keep[i];
  console.log(`dedupe by TARGETID: ${n.toLocaleString()} -> ${unique.toLocaleString()} (${(n - unique).toLocaleString()} repeats)`);

  const uniqueIdx = new Uint32Array(unique);
  for (let i = 0, k = 0; i < n; i++) if (keep[i]) uniqueIdx[k++] = i;

  const pick = sampleUniform(unique, sample, SEED);
  const out = {
    z: new Float32Array(pick.length),
    lookback: new Float32Array(pick.length),
    ra: new Float32Array(pick.length),
    dec: new Float32Array(pick.length),
    tracer: new Uint8Array(pick.length),
  };
  const tracerCounts = Object.fromEntries(TRACERS.map((t) => [t, 0]));
  for (let k = 0; k < pick.length; k++) {
    const i = uniqueIdx[pick[k]];
    out.z[k] = z[i];
    out.lookback[k] = lookbackGyr(z[i]);
    out.ra[k] = ra[i];
    out.dec[k] = dec[i];
    out.tracer[k] = tracer[i];
    tracerCounts[TRACERS[tracer[i]]]++;
  }

  const { bin, meta } = encodeTunnel(out);
  const fullMeta = {
    ...meta,
    tracerCounts,
    catalogCount: unique,
    source: 'DESI Data Release 1, LSS clustering catalogues v1.5 (iron)',
    sourceUrl: SOURCE_BASE,
    builtAt: new Date().toISOString(),
    seed: SEED,
  };
  const binPath = path.join(OUT_DIR, 'redshift-tunnel.bin');
  const jsonPath = path.join(OUT_DIR, 'redshift-tunnel.json');
  await writeFile(binPath, bin);
  await writeFile(jsonPath, JSON.stringify(fullMeta, null, 2) + '\n');

  console.log('');
  console.log(`objects:   ${meta.count.toLocaleString()} of ${unique.toLocaleString()}`);
  for (const t of TRACERS) console.log(`  ${t}: ${tracerCounts[t].toLocaleString()}`);
  console.log(`z range:        ${meta.zMin.toFixed(4)} .. ${meta.zMax.toFixed(4)}`);
  console.log(`lookback (Gyr): ${meta.lookbackMin.toFixed(3)} .. ${meta.lookbackMax.toFixed(3)}`);
  console.log(`bin:  ${(await stat(binPath)).size.toLocaleString()} bytes`);
  console.log(`json: ${(await stat(jsonPath)).size.toLocaleString()} bytes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
