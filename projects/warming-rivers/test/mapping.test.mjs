import { test } from "node:test";
import assert from "node:assert/strict";
import { RIVERS, heatColor, yearIndexAt, buildPalette, buildSources, riverStep, viewFit } from "../src/rivers/mapping.js";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= 1 / 255, `${a} vs ${b}`));
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test("heat runs from deep violet (coolest) to white (hottest) and only brightens", () => {
  close(heatColor(0), hex("#1e1450"));
  close(heatColor(1), hex("#ffffff"));
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const l = luminance(heatColor(i / 100));
    assert.ok(l >= prev - 1e-9, `heat got darker at ${i}`);
    prev = l;
  }
});

test("distance from the centre is the year: rim 1850, centre 2025", () => {
  assert.equal(yearIndexAt(RIVERS.centre + 1, 176), 0);
  assert.equal(yearIndexAt(RIVERS.rim, 176), 0);
  assert.equal(yearIndexAt(RIVERS.centre, 176), 175);
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const y = yearIndexAt(RIVERS.centre + 1 - i / 100, 176);
    assert.ok(y >= prev, "years must advance toward the centre");
    prev = y;
  }
});

const regions = [
  { name: "Hot", values: [-1, 0, 3] },
  { name: "Mild", values: [0, 0.25, 0.5] },
];

test("per-region scale: every region reaches white in its own hottest year", () => {
  const p = buildPalette(regions, "region");
  assert.equal(p.length, 2 * 3 * 4);
  const px = (k, y) => Array.from(p.slice((k * 3 + y) * 4, (k * 3 + y) * 4 + 3)).map((v) => v / 255);
  close(px(0, 2), hex("#ffffff"));
  close(px(1, 2), hex("#ffffff"));
  close(px(1, 0), hex("#1e1450"));
});

test("shared scale: a mildly warming region stays far from white", () => {
  const p = buildPalette(regions, "shared");
  const px = (k, y) => Array.from(p.slice((k * 3 + y) * 4, (k * 3 + y) * 4 + 3)).map((v) => v / 255);
  close(px(0, 2), hex("#ffffff"));
  assert.ok(luminance(px(1, 2)) < 0.5, "0.5 °C on a −1…3 range should not glow white");
});

test("buildSources gives each region its own entry angle and seeded speeds", () => {
  const a = buildSources(9, 900, 2025);
  const b = buildSources(9, 900, 2025);
  assert.deepEqual(a.speed, b.speed);
  const angles = new Set();
  for (let i = 0; i < 900; i++) {
    assert.equal(a.region[i], i % 9);
    angles.add(a.home[i].toFixed(4));
  }
  assert.equal(angles.size, 9);
});

test("riverStep carries light inward and restarts it at the rim near its region", () => {
  const p = { r: 0.8, theta: 1, home: 1, speed: 1 };
  riverStep(p, 0.5, 3);
  assert.ok(p.r < 0.8);
  const q = { r: RIVERS.centre + 0.001, theta: 2, home: 0.5, speed: 1.4 };
  riverStep(q, 0.5, 3, () => 0.5);
  assert.ok(q.r > 1 && Math.abs(q.theta - 0.5) < 0.2);
});

test("viewFit keeps circles round and the rim past every corner", () => {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { fitX, fitY, reach } = viewFit(w, h);
    assert.ok(Math.abs((fitX * w) / (fitY * h) - 1) < 1e-9);
    assert.ok(reach * fitX >= 1 - 1e-9 && reach * fitY >= 1 - 1e-9);
  }
});
