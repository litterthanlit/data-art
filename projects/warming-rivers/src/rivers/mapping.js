// Shared by the GPU simulation (uniforms) and the tracers that place names and labels (JS).
export const RIVERS = {
  channels: 9,
  swirl: 0.32,
  pull: 0.11,
  bunch: 1.6,
  rim: 1.15,
  centre: 0.05,
};

// Heat, like glowing metal: a region's coolest years deep violet, its hottest white.
const HEAT = [
  [0, "#1e1450"],
  [0.3, "#7a0d1c"],
  [0.55, "#ff4f2e"],
  [0.75, "#ffb257"],
  [0.9, "#fff3e0"],
  [1, "#ffffff"],
].map(([t, h]) => [t, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)]);

export const HEAT_STOPS = HEAT;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function heatColor(t) {
  const u = clamp01(t);
  let i = 1;
  while (i < HEAT.length - 1 && u > HEAT[i][0]) i++;
  const [t0, c0] = HEAT[i - 1];
  const [t1, c1] = HEAT[i];
  const f = (u - t0) / (t1 - t0);
  return c0.map((v, k) => v + (c1[k] - v) * f);
}

// Distance from the centre is the year: the rim is the first year, the centre the last.
export function yearIndexAt(r, years) {
  const u = clamp01(r - RIVERS.centre);
  return Math.round((1 - u) * (years - 1));
}

// RGBA bytes, one row per region, one pixel per year. "region" stretches each
// region over its own coolest-to-hottest range; "shared" uses one range for all.
export function buildPalette(regions, mode) {
  const years = regions[0].values.length;
  const all = regions.flatMap((r) => r.values);
  const out = new Uint8Array(regions.length * years * 4);
  regions.forEach((region, k) => {
    const lo = mode === "region" ? Math.min(...region.values) : Math.min(...all);
    const hi = mode === "region" ? Math.max(...region.values) : Math.max(...all);
    region.values.forEach((v, y) => {
      const c = heatColor((v - lo) / (hi - lo));
      const o = (k * years + y) * 4;
      out[o] = Math.round(c[0] * 255);
      out[o + 1] = Math.round(c[1] * 255);
      out[o + 2] = Math.round(c[2] * 255);
      out[o + 3] = 255;
    });
  });
  return out;
}

export function viewFit(width, height) {
  const aspect = width / height;
  const fitX = aspect >= 1 ? 1 / aspect : 1;
  const fitY = aspect >= 1 ? 1 : aspect;
  return { fitX, fitY, reach: Math.hypot(1 / fitX, 1 / fitY) };
}

// Mirrors the GLSL in riverShaders.js so names and labels ride the same currents.
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

export function regionAngle(k, count) {
  return (k / count) * Math.PI * 2 + Math.PI / 2;
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

// Particle i belongs to region i % regionCount and enters at that region's place on the rim.
export function buildSources(regionCount, count, seed = 2025) {
  const random = mulberry32(seed);
  const home = new Float32Array(count);
  const speed = new Float32Array(count);
  const region = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    region[i] = i % regionCount;
    home[i] = regionAngle(region[i], regionCount);
    speed[i] = 0.6 + random() * 0.8;
  }
  return { home, speed, region };
}
