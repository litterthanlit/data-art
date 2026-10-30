import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeByTargetId, sampleUniform } from '../scripts/build-tunnel-data.mjs';

test('dedupeByTargetId keeps the first occurrence', () => {
  const out = dedupeByTargetId([
    { targetId: 5n, z: 0.5 },
    { targetId: 7n, z: 0.7 },
    { targetId: 5n, z: 0.9 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].z, 0.5);
  assert.equal(out[1].targetId, 7n);
});

test('sampleUniform is deterministic, sorted and unique', () => {
  const a = sampleUniform(3, 10, 1998);
  const b = sampleUniform(3, 10, 1998);
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.equal(a.length, 3);
  assert.deepEqual(Array.from(a), [0, 1, 2]);
});

test('sampleUniform draws exactly count unique sorted indices below n', () => {
  const s = sampleUniform(20, 10, 1998);
  assert.equal(s.length, 10);
  assert.equal(new Set(s).size, 10);
  for (let i = 0; i < s.length; i++) {
    assert.ok(s[i] < 20);
    if (i) assert.ok(s[i] > s[i - 1]);
  }
  assert.deepEqual(Array.from(sampleUniform(20, 10, 1998)), Array.from(s));
  assert.notDeepEqual(Array.from(sampleUniform(20, 10, 7)), Array.from(s));
});

test('sampleUniform is roughly uniform over the index range', () => {
  const s = sampleUniform(100000, 10000, 1998);
  const upperHalf = Array.from(s).filter((i) => i >= 50000).length;
  assert.ok(upperHalf > 4700 && upperHalf < 5300, `upperHalf=${upperHalf}`);
});
