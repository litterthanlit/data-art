import assert from "node:assert/strict";
import { test } from "node:test";
import { arrangePieces, escapeHtml, isSlug, readMeta, renderGallery, renderPiece } from "./lib/gallery.mjs";

test("a slug is lowercase letters, digits and hyphens, and does not start with a hyphen", () => {
  assert.equal(isSlug("latent-archive"), true);
  assert.equal(isSlug("piece2"), true);
  for (const name of ["Latent Archive", "-draft", "a/b", "", "über", "a_b"]) assert.equal(isSlug(name), false, name);
});

test("readMeta reads the title and description a piece declares", () => {
  const html = `<head>
    <meta
      name="description"
      content="Solar Wind Breath, a sculpture of plasma &amp; storms."
    />
    <title>Solar Wind Breath</title>
  </head>`;
  assert.deepEqual(readMeta(html), {
    title: "Solar Wind Breath",
    description: "Solar Wind Breath, a sculpture of plasma & storms.",
  });
});

test("readMeta accepts content before name and decodes an apostrophe", () => {
  const html = `<meta content="Varna&#39;s weather" name="description"><title>Varna's Weather</title>`;
  assert.deepEqual(readMeta(html), { title: "Varna's Weather", description: "Varna's weather" });
});

test("readMeta returns empty strings when a page declares nothing", () => {
  assert.deepEqual(readMeta("<html></html>"), { title: "", description: "" });
});

test("pieces in the manifest come first in its order, the rest follow by slug", () => {
  const built = [
    { slug: "zeta", title: "Zeta", description: "From its page." },
    { slug: "alpha", title: "Alpha", description: "Alpha page." },
    { slug: "beta", title: "Beta page title", description: "Beta page." },
  ];
  const manifest = [
    { slug: "beta", title: "Beta", summary: "Curated.", data: "Source" },
    { slug: "missing", title: "Not built", summary: "Skipped.", data: "" },
  ];
  assert.deepEqual(arrangePieces(built, manifest), [
    { slug: "beta", title: "Beta", summary: "Curated.", data: "Source" },
    { slug: "alpha", title: "Alpha", summary: "Alpha page.", data: "" },
    { slug: "zeta", title: "Zeta", summary: "From its page.", data: "" },
  ]);
});

test("a piece with no title anywhere falls back to its slug", () => {
  assert.deepEqual(arrangePieces([{ slug: "bare", title: "", description: "" }], []), [
    { slug: "bare", title: "bare", summary: "", data: "" },
  ]);
});

test("renderPiece links to the piece's path and escapes its text", () => {
  const html = renderPiece({ slug: "a-b", title: "Rock & <Roll>", summary: 'Say "hi"', data: "" }, 2);
  assert.match(html, /<a href="\/a-b\/">/);
  assert.match(html, />03</);
  assert.match(html, /Rock &amp; &lt;Roll&gt;/);
  assert.match(html, /Say &quot;hi&quot;/);
  assert.doesNotMatch(html, /piece-data/);
  assert.equal(escapeHtml("a < b"), "a &lt; b");
});

test("renderGallery fills the list and every count marker", () => {
  const template = "<p><!-- count --></p><ol>\n<!-- pieces -->\n</ol><p><!-- count --></p>";
  const one = renderGallery(template, [{ slug: "a", title: "A", summary: "", data: "Src" }]);
  assert.equal(one.match(/1 work(?!s)/g).length, 2);
  assert.match(one, /class="piece-data">Src</);
  const two = renderGallery(template, [
    { slug: "a", title: "A", summary: "", data: "" },
    { slug: "b", title: "B $& $1", summary: "", data: "" },
  ]);
  assert.equal(two.match(/2 works/g).length, 2);
  assert.equal(two.match(/<li class="piece">/g).length, 2);
  assert.match(two, /B \$&amp; \$1/);
  assert.doesNotMatch(two, /<!-- (pieces|count) -->/);
});

test("renderGallery refuses a template without its markers", () => {
  assert.throws(() => renderGallery("<ol></ol>", []), /missing <!-- pieces -->/);
});
