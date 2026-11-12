// Pure helpers for the gallery home page. The build script does the file and process work.

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// A piece is served at /<slug>/, so its folder name has to be safe in a URL.
export function isSlug(name) {
  return SLUG.test(name);
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Title and description as a piece declares them in its own index.html.
export function readMeta(html) {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const tag = /<meta\b[^>]*\bname=["']description["'][^>]*>/i.exec(html)?.[0] ?? "";
  const description = /\bcontent=(["'])([\s\S]*?)\1/i.exec(tag)?.[2] ?? "";
  return { title: decode(title), description: decode(description) };
}

function decode(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Pieces named in the manifest come first, in its order and with its wording. Any other piece
// that was built follows by slug, described by its own index.html, so a new piece appears on the
// home page without anyone editing the manifest.
export function arrangePieces(built, manifest = []) {
  const bySlug = new Map(built.map((piece) => [piece.slug, piece]));
  const listed = manifest
    .filter((entry) => bySlug.has(entry.slug))
    .map((entry) => ({
      slug: entry.slug,
      title: entry.title || bySlug.get(entry.slug).title || entry.slug,
      summary: entry.summary || bySlug.get(entry.slug).description || "",
      data: entry.data || "",
    }));
  const named = new Set(listed.map((piece) => piece.slug));
  const rest = built
    .filter((piece) => !named.has(piece.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((piece) => ({ slug: piece.slug, title: piece.title || piece.slug, summary: piece.description || "", data: "" }));
  return [...listed, ...rest];
}

export function renderPiece(piece, index) {
  const number = String(index + 1).padStart(2, "0");
  const data = piece.data ? `\n            <span class="piece-data">${escapeHtml(piece.data)}</span>` : "";
  return `        <li class="piece">
          <a href="/${piece.slug}/">
            <span class="piece-index" aria-hidden="true">${number}</span>
            <span class="piece-body">
              <span class="piece-title">${escapeHtml(piece.title)}</span>
              <span class="piece-summary">${escapeHtml(piece.summary)}</span>
            </span>${data}
            <span class="piece-arrow" aria-hidden="true">→</span>
          </a>
        </li>`;
}

// The template marks where the list and the count go with two HTML comments.
export function renderGallery(template, pieces) {
  for (const marker of ["<!-- pieces -->", "<!-- count -->"]) {
    if (!template.includes(marker)) throw new Error(`Gallery template is missing ${marker}`);
  }
  const count = `${pieces.length} ${pieces.length === 1 ? "work" : "works"}`;
  return template
    .replace("<!-- pieces -->", () => pieces.map(renderPiece).join("\n"))
    .replaceAll("<!-- count -->", () => count);
}
