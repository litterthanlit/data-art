// Minimal FITS binary-table reader. Big-endian, 2880-byte blocks, 80-byte cards.
const BLOCK = 2880;
const CARD = 80;

const WIDTHS = { K: 8, D: 8, E: 4, J: 4, I: 2, B: 1, L: 1, C: 8, M: 16, P: 8, Q: 16 };

function parseCardValue(raw) {
  const v = raw.trim();
  if (v.startsWith("'")) {
    // quoted string; '' is an escaped quote
    let out = '';
    for (let i = 1; i < v.length; i++) {
      if (v[i] === "'") {
        if (v[i + 1] === "'") { out += "'"; i++; continue; }
        break;
      }
      out += v[i];
    }
    return out.trimEnd();
  }
  const slash = v.indexOf('/');
  const body = (slash >= 0 ? v.slice(0, slash) : v).trim();
  if (body === 'T') return true;
  if (body === 'F') return false;
  const n = Number(body);
  return Number.isNaN(n) ? body : n;
}

/** Parses one header starting at `offset`. Returns { cards, end } where end is the first byte after the padded header. */
function parseHeader(buf, offset) {
  const cards = new Map();
  let pos = offset;
  while (pos + CARD <= buf.length) {
    const text = buf.toString('latin1', pos, pos + CARD);
    pos += CARD;
    const key = text.slice(0, 8).trim();
    if (key === 'END') {
      const end = offset + Math.ceil((pos - offset) / BLOCK) * BLOCK;
      return { cards, end };
    }
    if (text[8] === '=' && !cards.has(key)) cards.set(key, parseCardValue(text.slice(10)));
  }
  throw new Error('FITS header has no END card (truncated buffer?)');
}

function parseTform(tform) {
  const m = /^(\d*)([A-Z])/.exec(String(tform).trim());
  if (!m) throw new Error(`Unparseable TFORM '${tform}'`);
  const repeat = m[1] === '' ? 1 : Number(m[1]);
  const code = m[2];
  if (code === 'A') return { code, repeat, width: repeat };
  if (code === 'X') return { code, repeat, width: Math.ceil(repeat / 8) };
  if (WIDTHS[code]) return { code, repeat, width: WIDTHS[code] * repeat };
  throw new Error(`Unsupported TFORM '${tform}'`);
}

/**
 * Reads the BINTABLE header of a FITS buffer (data not required).
 * Returns { rows, rowBytes, dataOffset, fields: [{ name, tform, code, repeat, width, offset }] }.
 */
export function readBinTableHeader(buf) {
  let pos = 0;
  while (pos < buf.length) {
    const { cards, end } = parseHeader(buf, pos);
    if (cards.get('XTENSION') === 'BINTABLE') {
      const rowBytes = cards.get('NAXIS1');
      const rows = cards.get('NAXIS2');
      const nfields = cards.get('TFIELDS');
      const fields = [];
      let offset = 0;
      for (let i = 1; i <= nfields; i++) {
        const name = cards.get(`TTYPE${i}`);
        const tform = cards.get(`TFORM${i}`);
        let parsed;
        try {
          parsed = parseTform(tform);
        } catch (err) {
          parsed = { code: null, repeat: 1, width: 0, error: err.message };
        }
        fields.push({ name, tform, ...parsed, offset });
        offset += parsed.width;
      }
      // An unknown column width would silently shift every column after it.
      if (offset !== rowBytes) {
        throw new Error(`FITS column widths sum to ${offset} bytes but NAXIS1 is ${rowBytes}`);
      }
      return { rows, rowBytes, dataOffset: end, fields };
    }
    // skip this HDU's data: |BITPIX| / 8 * GCOUNT * (PCOUNT + prod(NAXISn))
    const naxis = cards.get('NAXIS') ?? 0;
    let size = 0;
    if (naxis > 0) {
      size = 1;
      for (let i = 1; i <= naxis; i++) size *= cards.get(`NAXIS${i}`);
      size = (Math.abs(cards.get('BITPIX')) / 8) * (cards.get('GCOUNT') ?? 1) * ((cards.get('PCOUNT') ?? 0) + size);
    }
    pos = end + Math.ceil(size / BLOCK) * BLOCK;
  }
  throw new Error('No BINTABLE extension found in FITS buffer');
}

export function readFitsColumns(buf, names) {
  const { rows, rowBytes, dataOffset, fields } = readBinTableHeader(buf);
  if (buf.length < dataOffset + rows * rowBytes) {
    throw new Error(`FITS buffer truncated: need ${dataOffset + rows * rowBytes} bytes, have ${buf.length}`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const columns = {};
  for (const name of names) {
    const f = fields.find((x) => x.name === name);
    if (!f) {
      throw new Error(`FITS column '${name}' not found (have: ${fields.map((x) => x.name).join(', ')})`);
    }
    if (f.error || f.repeat !== 1 || !['K', 'D', 'E', 'J', 'I'].includes(f.code)) {
      throw new Error(`FITS column '${name}' has unsupported TFORM '${f.tform}'`);
    }
    const out = f.code === 'K' ? new BigInt64Array(rows) : new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const o = dataOffset + r * rowBytes + f.offset;
      switch (f.code) {
        case 'K': out[r] = view.getBigInt64(o, false); break;
        case 'D': out[r] = view.getFloat64(o, false); break;
        case 'E': out[r] = view.getFloat32(o, false); break;
        case 'J': out[r] = view.getInt32(o, false); break;
        case 'I': out[r] = view.getInt16(o, false); break;
      }
    }
    columns[name] = out;
  }
  return { rows, columns };
}
