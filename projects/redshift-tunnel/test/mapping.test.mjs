import { test } from "node:test";
import assert from "node:assert/strict";
import { TUNNEL, depthFor, colorFor, buildAnchors } from "../src/tunnel/mapping.js";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const closeRgb = (actual, expected) =>
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1 / 255, `${actual} vs ${expected}`));

test("depth runs from the camera (oldest light) to the far end (youngest light)", () => {
  assert.equal(depthFor(10, 1, 10), 0);
  assert.equal(depthFor(1, 1, 10), -TUNNEL.length);
  let prev = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const d = depthFor(1 + (9 * i) / 200, 1, 10);
    assert.ok(d > prev, `depth not strictly increasing at sample ${i}`);
    prev = d;
  }
});

test("colour ramp hits blue-white at the youngest light and deep red at the oldest", () => {
  closeRgb(colorFor(0.1, 0.1, 2.1), hex("#d6e4ff"));
  closeRgb(colorFor(2.1, 0.1, 2.1), hex("#7a0d1c"));
});

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

test("hue moves monotonically from blue toward red as z rises", () => {
  let prev = Infinity;
  for (let i = 0; i <= 200; i++) {
    const h = hue(colorFor(0.1 + (2 * i) / 200, 0.1, 2.1));
    if (h === null) continue;
    assert.ok(h <= prev + 1e-6, `hue rose at sample ${i}: ${h} after ${prev}`);
    prev = h;
  }
});

test("buildAnchors lays out positions, colours, seeds and sizes", () => {
  const data = {
    count: 3,
    z: new Float32Array([0.2, 1.0, 2.0]),
    lookback: new Float32Array([2.4, 7.9, 10.5]),
    ra: new Float32Array([10, 120, 300]),
    dec: new Float32Array([-20, 0, 45]),
    tracer: new Uint8Array([0, 2, 3]),
  };
  const meta = { zMin: 0.2, zMax: 2.0, lookbackMin: 2.4, lookbackMax: 10.5 };
  const a = buildAnchors(data, meta);
  assert.equal(a.positions.length, 9);
  assert.equal(a.colors.length, 9);
  assert.equal(a.seeds.length, 3);
  assert.equal(a.sizes.length, 3);
  assert.equal(a.sizes[2], Math.fround(1.6));
  assert.equal(a.sizes[0], 1.0);
  for (let i = 0; i < 3; i++) {
    const r = Math.hypot(a.positions[i * 3], a.positions[i * 3 + 1]);
    assert.ok(r >= TUNNEL.radius - TUNNEL.radiusJitter - 1 && r <= TUNNEL.radius + TUNNEL.radiusJitter + 1, `radius ${r}`);
  }
  assert.ok(Math.abs(a.positions[2 * 3 + 2]) < 1e-3, "oldest object sits nearest the camera");
  assert.ok(Math.abs(a.positions[0 * 3 + 2] + TUNNEL.length) < 1e-3, "youngest object sits at the far end");
});

test("angles fill the whole circle even when the survey covers a narrow band of sky", () => {
  const count = 2000;
  const data = {
    count,
    z: new Float32Array(count).fill(1),
    lookback: new Float32Array(count).fill(5),
    ra: Float32Array.from({ length: count }, (_, i) => 100 + (10 * i) / count),
    dec: new Float32Array(count),
    tracer: new Uint8Array(count),
  };
  const a = buildAnchors(data, { zMin: 0.5, zMax: 1.5, lookbackMin: 1, lookbackMax: 10 });
  const bins = new Array(12).fill(0);
  for (let i = 0; i < count; i++) {
    const angle = Math.atan2(a.positions[i * 3 + 1], a.positions[i * 3]) + Math.PI;
    bins[Math.min(11, Math.floor((angle / (2 * Math.PI)) * 12))]++;
  }
  for (const n of bins) assert.ok(n > count / 24, `angular gap: ${bins}`);
});

test("colour follows lookback time, so it stays monotonic in z", () => {
  const data = {
    count: 2,
    z: new Float32Array([0.54, 0.56]),
    lookback: new Float32Array([1, 10]),
    ra: new Float32Array(2),
    dec: new Float32Array(2),
    tracer: new Uint8Array(2),
  };
  const a = buildAnchors(data, { zMin: 0.5, zMax: 0.6, lookbackMin: 1, lookbackMax: 10 });
  closeRgb(Array.from(a.colors.subarray(0, 3)), hex("#d6e4ff"));
  closeRgb(Array.from(a.colors.subarray(3, 6)), hex("#7a0d1c"));
});
