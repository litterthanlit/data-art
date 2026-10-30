export const TUNNEL = { length: 120, radius: 9, radiusJitter: 2.2 };

const SEED_JITTER = 0.6;
const DEPTH_EASE = 0.8;
const QSO = 3;

// Blue-white (youngest light) → white → amber → red-orange → deep red (oldest light).
const RAMP = [
  [0, "#d6e4ff"],
  [0.15, "#ffffff"],
  [0.3, "#fff3e0"],
  [0.55, "#ffb257"],
  [0.8, "#ff4f2e"],
  [1, "#7a0d1c"],
].map(([t, h]) => [t, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)]);

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function depthFor(lookback, min, max) {
  const u = clamp01((lookback - min) / (max - min));
  return TUNNEL.length * (u ** DEPTH_EASE - 1);
}

// Coloured by lookback time rather than raw z: it rises strictly with z, but
// spreads the survey's crowd of nearby galaxies across the ramp.
export function colorFor(lookback, min, max) {
  const t = clamp01((lookback - min) / (max - min));
  let i = 1;
  while (i < RAMP.length - 1 && t > RAMP[i][0]) i++;
  const [t0, c0] = RAMP[i - 1];
  const [t1, c1] = RAMP[i];
  const f = (t - t0) / (t1 - t0);
  return c0.map((v, k) => v + (c1[k] - v) * f);
}

// Deterministic per-object value in [0, 1).
function hash01(i) {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// DESI sees two patches of sky. Mapping RA through its own cumulative
// distribution closes the tunnel wall while keeping neighbours together.
function raToAngle(ra, count) {
  const BINS = 720;
  const cdf = new Float64Array(BINS + 1);
  for (let i = 0; i < count; i++) cdf[1 + Math.min(BINS - 1, Math.floor((ra[i] / 360) * BINS))]++;
  for (let b = 1; b <= BINS; b++) cdf[b] += cdf[b - 1];
  const angles = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const x = (ra[i] / 360) * BINS;
    const b = Math.min(BINS - 1, Math.floor(x));
    const f = cdf[b] + (cdf[b + 1] - cdf[b]) * (x - b);
    angles[i] = (f / count) * Math.PI * 2;
  }
  return angles;
}

export function buildAnchors(data, meta) {
  const { count } = data;
  const angles = raToAngle(data.ra, count);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const DEG = Math.PI / 180;
  for (let i = 0; i < count; i++) {
    const seed = hash01(i);
    const angle = angles[i];
    const radius =
      TUNNEL.radius + TUNNEL.radiusJitter * Math.sin(data.dec[i] * DEG) + SEED_JITTER * (seed * 2 - 1);
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = depthFor(data.lookback[i], meta.lookbackMin, meta.lookbackMax);
    colors.set(colorFor(data.lookback[i], meta.lookbackMin, meta.lookbackMax), i * 3);
    seeds[i] = seed;
    sizes[i] = data.tracer[i] === QSO ? 1.6 : 1.0;
  }
  return { positions, colors, seeds, sizes };
}
