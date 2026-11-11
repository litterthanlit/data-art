import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleWorks } from "./build-archive-data.mjs";

const GREY = "808080".repeat(16);
const RED = "c02020".repeat(16);
const BLUE = "2040c0".repeat(16);

function work(id, department, grid, year = 1800) {
  return { id, department, grid, year };
}

// 1,000 prints (900 grey, 100 red) and 100 textiles (half red, half blue).
function collection() {
  const works = [];
  let id = 1;
  for (let i = 0; i < 900; i += 1) works.push(work(id++, "Prints", GREY, 1500 + (i % 400)));
  for (let i = 0; i < 100; i += 1) works.push(work(id++, "Prints", RED, 1500 + (i % 400)));
  for (let i = 0; i < 100; i += 1) works.push(work(id++, "Textiles", i % 2 ? RED : BLUE, 1600 + i));
  return works;
}

const share = (sample, test) => sample.filter(test).length / sample.length;

test("returns exactly the target, without duplicates, sorted by year then id", () => {
  const sample = sampleWorks(collection(), 200);
  assert.equal(sample.length, 200);
  assert.equal(new Set(sample.map((w) => w.id)).size, 200);
  for (let i = 1; i < sample.length; i += 1) {
    const [a, b] = [sample[i - 1], sample[i]];
    assert.ok(a.year < b.year || (a.year === b.year && a.id < b.id));
  }
});

test("draws the same works every time, whatever order the cache is in", () => {
  const first = sampleWorks(collection(), 200).map((w) => w.id);
  const second = sampleWorks(collection().reverse(), 200).map((w) => w.id);
  assert.deepEqual(first, second);
});

test("a small department gets more than its proportional share", () => {
  const sample = sampleWorks(collection(), 200);
  const textiles = share(sample, (w) => w.department === "Textiles");
  assert.ok(textiles > 0.15, `textiles are 9% of the pool, got ${textiles}`);
  assert.ok(textiles < 0.5, `prints must stay the majority, got ${textiles}`);
});

test("colourful works are preferred inside a department", () => {
  const prints = sampleWorks(collection(), 200).filter((w) => w.department === "Prints");
  const red = share(prints, (w) => w.grid === RED);
  assert.ok(red > 0.25, `red prints are 10% of the pool's prints, got ${red}`);
});

test("a rare hue is preferred over a common one of similar chroma", () => {
  const textiles = sampleWorks(collection(), 200).filter((w) => w.department === "Textiles");
  const blue = share(textiles, (w) => w.grid === BLUE);
  assert.ok(blue > 0.5, `blue is half of the textiles, got ${blue}`);
});

test("returns the whole pool when the target is larger than it", () => {
  const works = collection();
  const sample = sampleWorks(works, 5000);
  assert.equal(sample.length, works.length);
  assert.equal(new Set(sample.map((w) => w.id)).size, works.length);
});

test("skips works with a broken miniature or an implausible year", () => {
  const works = [work(1, "Prints", GREY), work(2, "Prints", "80"), work(3, "Prints", RED, 1486490)];
  assert.deepEqual(sampleWorks(works, 10).map((w) => w.id), [1]);
});
