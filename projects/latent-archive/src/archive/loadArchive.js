const BASE = import.meta.env.BASE_URL;

export class MissingArchiveError extends Error {
  constructor() {
    super("No archive yet — run npm run data");
    this.name = "MissingArchiveError";
  }
}

export async function loadArchive({ signal } = {}) {
  const [binResponse, metaResponse] = await Promise.all([
    fetch(`${BASE}data/latent-archive.bin`, { signal }),
    fetch(`${BASE}data/latent-archive.json`, { signal }),
  ]);

  if (binResponse.status === 404 || metaResponse.status === 404) {
    throw new MissingArchiveError();
  }
  if (!binResponse.ok || !metaResponse.ok) {
    throw new Error(`Archive load failed: ${binResponse.status}/${metaResponse.status}`);
  }

  const [buffer, meta] = await Promise.all([binResponse.arrayBuffer(), metaResponse.json()]);
  return parseArchive(buffer, meta);
}

export function parseArchive(buffer, meta) {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "LARC") throw new Error("Archive file is not a Latent Archive binary");

  const count = view.getUint32(8, true);
  const grid = view.getUint32(12, true);
  const cells = grid * grid;
  if (count !== meta.count) throw new Error("Archive binary and metadata disagree");

  let offset = 16;
  const latent = new Float32Array(buffer, offset, count * 3);
  offset += count * 12;
  const helix = new Float32Array(buffer, offset, count * 3);
  offset += count * 12;
  const colors = new Uint8Array(buffer, offset, count * cells * 3);
  offset += count * cells * 3;
  const years = new Int16Array(buffer.slice(offset, offset + count * 2));

  return { count, grid, cells, latent, helix, colors, years, meta };
}

export function describeWork(archive, index) {
  const { works, departments } = archive.meta;
  return {
    index,
    id: works.id[index],
    title: works.title[index],
    artist: works.artist[index],
    date: works.date[index],
    place: works.place[index],
    department: departments[works.department[index]] ?? "",
    image: works.image[index],
    year: archive.years[index],
  };
}
