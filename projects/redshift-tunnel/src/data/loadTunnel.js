// Browser-safe: no Node imports.
const ARRAYS = { f32: Float32Array, u8: Uint8Array };

export function decodeTunnel(arrayBuffer, meta) {
  const out = { count: meta.count };
  for (const col of meta.columns) {
    const Ctor = ARRAYS[col.type];
    if (!Ctor) throw new Error(`Unknown column type '${col.type}'`);
    out[col.name] = new Ctor(arrayBuffer, col.offset, meta.count);
  }
  return out;
}

/** Fetches the bundled sample. Resolves to the decoded columns plus `meta`. */
export async function loadTunnel(baseUrl) {
  const [metaRes, binRes] = await Promise.all([
    fetch(`${baseUrl}redshift-tunnel.json`),
    fetch(`${baseUrl}redshift-tunnel.bin`),
  ]);
  if (!metaRes.ok) throw new Error(`redshift-tunnel.json: HTTP ${metaRes.status}`);
  if (!binRes.ok) throw new Error(`redshift-tunnel.bin: HTTP ${binRes.status}`);
  const meta = await metaRes.json();
  return { ...decodeTunnel(await binRes.arrayBuffer(), meta), meta };
}
