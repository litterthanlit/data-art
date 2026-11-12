// Shared by the GPU simulation (uniforms) and the labels that ride the rivers (JS).
export const RIVERS = {
  channels: 6,
  swirl: 0.32,
  pull: 0.11,
  bunch: 1.6,
  rim: 1.15,
  centre: 0.05,
  // Colour (and the lookback clock) reaches the oldest light at r = 1 / colourScale.
  colourScale: 1.3,
};

// Blue-white (now) → white → amber → red-orange → deep red (oldest light).
const RAMP = [
  [0, "#d6e4ff"],
  [0.15, "#ffffff"],
  [0.3, "#fff3e0"],
  [0.55, "#ffb257"],
  [0.8, "#ff4f2e"],
  [1, "#7a0d1c"],
].map(([t, h]) => [t, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)]);

export const RAMP_STOPS = RAMP;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function colorFor(t) {
  const u = clamp01(t);
  let i = 1;
  while (i < RAMP.length - 1 && u > RAMP[i][0]) i++;
  const [t0, c0] = RAMP[i - 1];
  const [t1, c1] = RAMP[i];
  const f = (u - t0) / (t1 - t0);
  return c0.map((v, k) => v + (c1[k] - v) * f);
}

// Distance from the centre is the clock: the centre is now, the red rim is the oldest light.
export function lookbackAtRadius(r, meta) {
  const t = clamp01(r * RIVERS.colourScale);
  return meta.lookbackMin + t * (meta.lookbackMax - meta.lookbackMin);
}

// DESI sees two patches of sky. Mapping RA through its own cumulative
// distribution closes the circle while keeping neighbours together.
export function raToAngle(ra) {
  const count = ra.length;
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

// Clip-space scale that keeps circles round, and the radius that reaches the far corners.
export function viewFit(width, height) {
  const aspect = width / height;
  const fitX = aspect >= 1 ? 1 / aspect : 1;
  const fitY = aspect >= 1 ? 1 : aspect;
  return { fitX, fitY, reach: Math.hypot(1 / fitX, 1 / fitY) };
}

// Mirrors the GLSL in riverShaders.js so labels can ride the same currents.
export function riverStep(p, dt, time, random = Math.random) {
  const { channels, swirl, pull, bunch, rim, centre } = RIVERS;
  const field =
    Math.sin(channels * p.theta + p.r * 7 + time * 0.21) + 0.5 * Math.sin(3 * p.theta - p.r * 11 - time * 0.13);
  p.theta += dt * (swirl / (p.r + 0.25) - bunch * field * 0.35);
  p.r -= dt * pull * p.speed * (0.55 + 0.45 * p.r);
  if (p.r < centre) {
    p.r = rim * (0.97 + 0.06 * random());
    p.theta = p.home + (random() - 0.5) * 0.25;
  }
  return p;
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

const QSO = 3;

// One river particle per sampled galaxy: where in the sky its light enters, how fast, how bright.
export function buildSources(data, count, seed = 1998) {
  const random = mulberry32(seed);
  const angles = raToAngle(data.ra);
  const home = new Float32Array(count);
  const speed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const j = Math.floor(random() * data.count);
    home[i] = angles[j];
    speed[i] = 0.6 + random() * 0.8;
    size[i] = data.tracer[j] === QSO ? 1.6 : 1;
  }
  return { home, speed, size };
}
