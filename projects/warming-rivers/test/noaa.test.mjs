import { test } from "node:test";
import assert from "node:assert/strict";
import { REGIONS, parseSeries } from "../scripts/lib/noaa.mjs";

const sample = (from, to, skip) => ({
  description: { units: "Degrees Celsius", base_period: "1901-2000" },
  data: Object.fromEntries(
    Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .filter((y) => y !== skip)
      .map((y) => [String(y), { departure: (y - 1900) / 100 }]),
  ),
});

test("parseSeries returns one departure per year, in order", () => {
  const values = parseSeries(sample(1850, 2025), 1850, 2025);
  assert.equal(values.length, 176);
  assert.equal(values[0], -0.5);
  assert.equal(values[175], 1.25);
});

test("parseSeries refuses a series with a missing year", () => {
  assert.throws(() => parseSeries(sample(1850, 2025, 1999), 1850, 2025), /1999/);
});

test("parseSeries refuses a non-numeric departure", () => {
  const bad = sample(1850, 2025);
  bad.data["1900"].departure = "-999";
  assert.throws(() => parseSeries(bad, 1850, 2025), /1900/);
});

test("nine regions, each with a NOAA path and a display name", () => {
  assert.equal(REGIONS.length, 9);
  for (const r of REGIONS) {
    assert.match(r.path, /^[a-zA-Z]+\/(land_ocean|ocean)$/);
    assert.ok(r.name.length > 0);
  }
});
