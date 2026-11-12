import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFitsColumns } from '../scripts/lib/fits.mjs';

const BLOCK = 2880;

function card(text) {
  return text.padEnd(80, ' ').slice(0, 80);
}

function kv(key, value, comment = '') {
  const v = typeof value === 'string' ? `'${value}'`.padEnd(20, ' ') : String(value).padStart(20, ' ');
  return card(`${key.padEnd(8, ' ')}= ${v}${comment ? ' / ' + comment : ''}`);
}

function headerBlocks(cards) {
  const text = cards.concat([card('END')]).join('');
  const size = Math.ceil(text.length / BLOCK) * BLOCK;
  return Buffer.from(text.padEnd(size, ' '), 'latin1');
}

// Columns: TARGETID K, PHOTSYS 1A, RA D, DEC D, Z D  => NAXIS1 = 8+1+8+8+8 = 33
function makeFits(rows, { extraCards = 40, photsysForm = '1A', naxis1Header = 33 } = {}) {
  const primary = headerBlocks([
    card(`SIMPLE  = ${'T'.padStart(20)}`),
    kv('BITPIX', 8),
    kv('NAXIS', 0),
    card(`EXTEND  = ${'T'.padStart(20)}`),
  ]);

  const naxis1 = 33;
  const cards = [
    kv('XTENSION', 'BINTABLE'),
    kv('BITPIX', 8),
    kv('NAXIS', 2),
    kv('NAXIS1', naxis1Header),
    kv('NAXIS2', rows.length),
    kv('PCOUNT', 0),
    kv('GCOUNT', 1),
    kv('TFIELDS', 5),
    kv('TTYPE1', 'TARGETID'),
    kv('TFORM1', 'K'),
    kv('TTYPE2', 'PHOTSYS'),
    kv('TFORM2', photsysForm),
    kv('TTYPE3', 'RA'),
    kv('TFORM3', 'D'),
    kv('TTYPE4', 'DEC'),
    kv('TFORM4', 'D'),
    kv('TTYPE5', 'Z'),
    kv('TFORM5', 'D'),
  ];
  for (let i = 0; i < extraCards; i++) cards.push(kv(`COMMENT${i}`.slice(0, 8), i));
  const header = headerBlocks(cards);
  assert.ok(header.length > BLOCK, 'test header must span multiple blocks');

  const dataBytes = rows.length * naxis1;
  const data = Buffer.alloc(Math.ceil(dataBytes / BLOCK) * BLOCK);
  rows.forEach((r, i) => {
    const o = i * naxis1;
    data.writeBigInt64BE(r.id, o);
    data.write(r.photsys, o + 8, 'latin1');
    data.writeDoubleBE(r.ra, o + 9);
    data.writeDoubleBE(r.dec, o + 17);
    data.writeDoubleBE(r.z, o + 25);
  });
  return Buffer.concat([primary, header, data]);
}

const ROWS = [
  { id: 39627000000000001n, photsys: 'N', ra: 10.5, dec: -3.25, z: 0.123456789 },
  { id: 1n, photsys: 'S', ra: 359.999, dec: 89.5, z: 1.987654321 },
  { id: -5n, photsys: 'N', ra: 0, dec: 0, z: 0.5 },
];

test('round-trips three rows across a multi-block header', () => {
  const { rows, columns } = readFitsColumns(makeFits(ROWS), ['TARGETID', 'RA', 'DEC', 'Z']);
  assert.equal(rows, 3);
  assert.ok(columns.TARGETID instanceof BigInt64Array);
  assert.ok(columns.Z instanceof Float64Array);
  assert.deepEqual(Array.from(columns.TARGETID), ROWS.map((r) => r.id));
  assert.deepEqual(Array.from(columns.RA), ROWS.map((r) => r.ra));
  assert.deepEqual(Array.from(columns.DEC), ROWS.map((r) => r.dec));
  assert.deepEqual(Array.from(columns.Z), ROWS.map((r) => r.z));
});

test('reads a single column alone', () => {
  const { rows, columns } = readFitsColumns(makeFits(ROWS), ['Z']);
  assert.equal(rows, 3);
  assert.deepEqual(Object.keys(columns), ['Z']);
  assert.equal(columns.Z[1], 1.987654321);
});

test('throws a descriptive error for a missing column', () => {
  assert.throws(() => readFitsColumns(makeFits(ROWS), ['NOPE']), /NOPE/);
});

test('throws for an unsupported TFORM in a requested column', () => {
  assert.throws(() => readFitsColumns(makeFits(ROWS), ['PHOTSYS']), /PHOTSYS/);
});

test('steps past bit-flag columns it does not decode', () => {
  const { columns } = readFitsColumns(makeFits(ROWS, { photsysForm: '8X' }), ['Z']);
  assert.deepEqual(Array.from(columns.Z), ROWS.map((r) => r.z));
});

test('throws when the column widths disagree with NAXIS1', () => {
  assert.throws(() => readFitsColumns(makeFits(ROWS, { naxis1Header: 41 }), ['Z']), /NAXIS1/);
});
