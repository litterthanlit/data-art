import { test } from "node:test";
import assert from "node:assert/strict";
import { lookbackGyr } from "../scripts/lib/cosmology.mjs";

const near = (actual, expected, tol = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} not within ${tol} of ${expected}`);

test("lookback time matches flat ΛCDM (H0 67.7, Ωm 0.31)", () => {
  assert.equal(lookbackGyr(0), 0);
  near(lookbackGyr(0.1), 1.345);
  near(lookbackGyr(1), 7.936);
  near(lookbackGyr(2), 10.513);
  near(lookbackGyr(3), 11.648);
});

test("lookback time rises with redshift and stays under the age of the universe", () => {
  let prev = -1;
  for (let z = 0; z <= 4; z += 0.05) {
    const t = lookbackGyr(z);
    assert.ok(t > prev, `not increasing at z=${z}`);
    prev = t;
  }
  assert.ok(lookbackGyr(1e9) < 13.8);
});
