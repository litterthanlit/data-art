// Shared by the Node encoder (scripts/lib/encode.mjs) and the browser decoder (loadTunnel.js).
export const TRACERS = ['BGS', 'LRG', 'ELG', 'QSO'];

export const COLUMNS = [
  { name: 'z', type: 'f32' },
  { name: 'lookback', type: 'f32' },
  { name: 'ra', type: 'f32' },
  { name: 'dec', type: 'f32' },
  { name: 'tracer', type: 'u8' },
];

export const TYPE_BYTES = { f32: 4, u8: 1 };

/** Byte offsets for a columnar layout of `count` rows; every column starts 4-byte aligned. */
export function columnOffsets(count) {
  let offset = 0;
  const columns = [];
  for (const col of COLUMNS) {
    columns.push({ name: col.name, type: col.type, offset });
    offset += count * TYPE_BYTES[col.type];
    offset = Math.ceil(offset / 4) * 4;
  }
  return { columns, byteLength: offset };
}
