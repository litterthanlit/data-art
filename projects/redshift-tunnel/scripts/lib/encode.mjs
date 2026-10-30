import { COLUMNS, columnOffsets } from '../../src/data/layout.js';

const ARRAYS = { f32: Float32Array, u8: Uint8Array };

function range(values) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Columnar encoding. Input columns are equal-length arrays; returns { bin: Buffer, meta }. */
export function encodeTunnel(objects) {
  const count = objects[COLUMNS[0].name]?.length ?? 0;
  for (const col of COLUMNS) {
    if (!objects[col.name] || objects[col.name].length !== count) {
      throw new Error(`encodeTunnel: column '${col.name}' missing or length != ${count}`);
    }
  }
  const { columns, byteLength } = columnOffsets(count);
  const bin = Buffer.alloc(byteLength);
  for (const col of columns) {
    new ARRAYS[col.type](bin.buffer, bin.byteOffset + col.offset, count).set(objects[col.name]);
  }
  const [zMin, zMax] = range(objects.z);
  const [lookbackMin, lookbackMax] = range(objects.lookback);
  return { bin, meta: { count, columns, zMin, zMax, lookbackMin, lookbackMax } };
}
