import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTunnel } from '../scripts/lib/encode.mjs';
import { decodeTunnel } from '../src/data/loadTunnel.js';
import { COLUMNS, TRACERS } from '../src/data/layout.js';

const fixture = {
  z: [0.1, 0.8, 2.05, 1.25],
  lookback: [1.345, 6.9, 10.6, 8.9],
  ra: [0.5, 120.25, 359.75, 45],
  dec: [-10.5, 0, 89.5, 33.3],
  tracer: [0, 1, 3, 2],
};

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

test('layout lists the four tracers and five columns', () => {
  assert.deepEqual(TRACERS, ['BGS', 'LRG', 'ELG', 'QSO']);
  assert.deepEqual(COLUMNS.map((c) => c.name), ['z', 'lookback', 'ra', 'dec', 'tracer']);
});

test('encode -> decode round-trips values at f32 precision', () => {
  const { bin, meta } = encodeTunnel(fixture);
  const data = decodeTunnel(toArrayBuffer(bin), meta);
  assert.equal(data.count, 4);
  for (const key of ['z', 'lookback', 'ra', 'dec']) {
    assert.ok(data[key] instanceof Float32Array, key);
    fixture[key].forEach((v, i) => assert.equal(data[key][i], Math.fround(v), `${key}[${i}]`));
  }
  assert.ok(data.tracer instanceof Uint8Array);
  assert.deepEqual(Array.from(data.tracer), fixture.tracer);
});

test('meta carries count, ranges and 4-byte aligned column offsets', () => {
  const { bin, meta } = encodeTunnel(fixture);
  assert.equal(meta.count, 4);
  assert.equal(meta.zMin, 0.1);
  assert.equal(meta.zMax, 2.05);
  assert.equal(meta.lookbackMin, 1.345);
  assert.equal(meta.lookbackMax, 10.6);
  assert.deepEqual(meta.columns.map((c) => c.name), COLUMNS.map((c) => c.name));
  for (const col of meta.columns) assert.equal(col.offset % 4, 0, `${col.name} offset`);
  assert.ok(bin.length >= 4 * 17);
});

test('odd counts keep every column aligned and decodable', () => {
  const odd = {
    z: [0.3, 0.4, 0.5],
    lookback: [3, 4, 5],
    ra: [1, 2, 3],
    dec: [4, 5, 6],
    tracer: [1, 2, 3],
  };
  const { bin, meta } = encodeTunnel(odd);
  for (const col of meta.columns) assert.equal(col.offset % 4, 0);
  const data = decodeTunnel(toArrayBuffer(bin), meta);
  assert.deepEqual(Array.from(data.tracer), [1, 2, 3]);
  assert.deepEqual(Array.from(data.dec), [4, 5, 6]);
});
