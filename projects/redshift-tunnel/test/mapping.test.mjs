import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RIVERS,
  colorFor,
  raToAngle,
  viewFit,
  lookbackAtRadius,
  riverStep,
  buildSources,
} from "../src/tunnel/mapping.js";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const closeRgb = (actual, expected) =>
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1 / 255, `${actual} vs ${expected}`));

// Hue in degrees, with reds just past 0° unwrapped to negative so blue → red is one descending run.
function hue([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.05) return null;
  let h;
  if (max === r) h = 60 * ((g - b) / (max - min));
  else if (max === g) h = 60 * (2 + (b - r) / (max - min));
  else h = 60 * (4 + (r - g) / (max - min));
  return h > 300 ? h - 360 : h;
}

test("colour ramp runs from blue-white (now) to deep red (oldest light)", () => {
  closeRgb(colorFor(0), hex("#d6e4ff"));
  closeRgb(colorFor(1), hex("#7a0d1c"));
  let prev = Infinity;
  for (let i = 0; i <= 200; i++) {
    const h = hue(colorFor(i / 200));
    if (h === null) continue;
    assert.ok(h <= prev + 1e-6, `hue rose at sample ${i}`);
    prev = h;
  }
});

test("distance from the centre is lookback time, the same scale the colour uses", () => {
  const meta = { lookbackMin: 0.14, lookbackMax: 12 };
  assert.ok(Math.abs(lookbackAtRadius(0, meta) - 0.14) < 1e-9);
  assert.ok(Math.abs(lookbackAtRadius(1 / RIVERS.colourScale, meta) - 12) < 1e-9);
  assert.equal(lookbackAtRadius(1.1, meta), 12, "beyond the red rim the clock stops at the oldest light");
  let prev = -Infinity;
  for (let i = 0; i <= 100; i++) {
    const v = lookbackAtRadius(i / 100 / RIVERS.colourScale, meta);
    assert.ok(v > prev, "lookback must rise with distance");
    prev = v;
  }
});

test("angles fill the whole circle even when the survey covers a narrow band of sky", () => {
  const count = 2000;
  const ra = Float32Array.from({ length: count }, (_, i) => 100 + (10 * i) / count);
  const angles = raToAngle(ra);
  const bins = new Array(12).fill(0);
  for (const a of angles) bins[Math.min(11, Math.floor((a / (2 * Math.PI)) * 12))]++;
  for (const n of bins) assert.ok(n > count / 24, `angular gap: ${bins}`);
});

test("viewFit keeps the rivers circular and reaching past every screen corner", () => {
  for (const [w, h] of [[1440, 900], [390, 844], [800, 800]]) {
    const { fitX, fitY, reach } = viewFit(w, h);
    assert.ok(Math.abs((fitX * w) / (fitY * h) - 1) < 1e-9, `not circular at ${w}x${h}`);
    assert.ok(reach * fitX >= 1 - 1e-9 && reach * fitY >= 1 - 1e-9, `rim inside the screen at ${w}x${h}`);
  }
});

test("riverStep carries light inward and returns it to the rim near its home angle", () => {
  const p = { r: 0.8, theta: 1, home: 1, speed: 1 };
  riverStep(p, 0.5, 3);
  assert.ok(p.r < 0.8, "light should move toward the centre");
  const q = { r: 0.051, theta: 2, home: 0.5, speed: 1.4 };
  riverStep(q, 0.5, 3, () => 0.5);
  assert.ok(q.r > 1, "light that reaches the centre restarts at the rim");
  assert.ok(Math.abs(q.theta - 0.5) < 0.2, "restarts near its home angle");
});

test("buildSources samples real galaxies with seeded, repeatable speeds and brighter quasars", () => {
  const n = 1000;
  const data = {
    count: n,
    ra: Float32Array.from({ length: n }, (_, i) => (i * 0.36) % 360),
    tracer: Uint8Array.from({ length: n }, (_, i) => (i % 10 === 0 ? 3 : 0)),
  };
  const a = buildSources(data, 256, 1998);
  const b = buildSources(data, 256, 1998);
  assert.equal(a.home.length, 256);
  assert.deepEqual(a.speed, b.speed);
  assert.ok(a.speed.every((s) => s >= 0.6 && s <= 1.4));
  assert.ok(a.size.some((s) => s === Math.fround(1.6)) && a.size.some((s) => s === 1));
  assert.ok(a.home.every((t) => t >= 0 && t <= Math.PI * 2));
});
