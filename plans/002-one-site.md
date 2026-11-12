# Plan 002: One build serves every piece under one domain, with a gallery home page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 66fdf0a..HEAD -- README.md projects/trade-organism projects/varna-weather-galaxy package.json vercel.json scripts site`
> If it prints anything other than changes under `plans/`, compare the
> "Current state" facts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (it changes how the repository is deployed)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `66fdf0a`, 2026-11-12

## Why this matters

This repository holds several independent web artworks under `projects/`. Today each one is
deployed by its own Vercel project that is told to build one folder. Every Vercel project
connected to the repository builds on every push to every branch, so a project whose folder is
missing on a branch fails, and its check on the pull request goes red. That is happening now:
two Vercel projects point at folders that exist only on another branch, and they fail on every
other branch with `The specified Root Directory "projects/…" does not exist`. There is also no
home page: each piece has its own address and nothing links them.

After this plan, one command at the repository root builds every piece into one static site:
a gallery home page at `/` and each piece at `/<folder name>/`. One Vercel project can then
serve everything under one domain, adding a piece needs no Vercel setup, and a pull request gets
one deployment check. The plan also repairs two lockfiles that make a clean install fail, because
the site build installs every piece with `npm ci`.

Everything below was built and run in a scratch copy of the repository at the planned commit:
the tests pass, the build takes about 11 seconds, and all four pieces load at their sub-paths
with no failed requests.

## Current state

- The repository root has no `package.json`, no `vercel.json`, no `scripts/` and no `site/`
  directory. Confirm with `ls`: the root holds `README.md`, `.gitignore`, `docs/`, `plans/`
  and `projects/`.
- `.gitignore` already ignores `node_modules/` and `dist/`.
- `projects/` holds four pieces: `latent-archive`, `solar-wind-breath`, `trade-organism`,
  `varna-weather-galaxy`. Each is a Vite app with its own `package.json`, its own
  `package-lock.json`, a `build` script that runs `vite build` and writes to its own `dist/`.
- Every piece already loads its data through `import.meta.env.BASE_URL` (for example
  `projects/trade-organism/src/main.js:6`:
  `const DATA_URL = \`${import.meta.env.BASE_URL}data/trade-organism.json\`;`), so each one
  works when built with `vite build --base /<folder name>/`. No piece's source needs to change.
- `npm ci` fails in `projects/trade-organism` and `projects/varna-weather-galaxy` with
  `npm ci can only install packages when your package.json and package-lock.json … are in sync`
  and `Missing: @emnapi/core@… from lock file`. Their lockfiles lack some optional entries.
  `npm install` adds them without changing any installed version (Vite stays at 8.0.11 in
  `trade-organism` and 8.0.10 in `varna-weather-galaxy`) and without touching `package.json`. `npm ci` passes in the other two pieces.
- The root `README.md` is ten lines. Its third line is `Interactive data visualization artworks.`
  and the rest is a "Projects" list. Another unmerged branch appends to that list, so this plan
  must NOT edit the list or add anything after it.

Conventions to match (see `projects/latent-archive/scripts/build-archive-data.mjs`): plain
JavaScript ES modules, two-space indent, double quotes, semicolons, trailing commas in multi-line
literals, comments that state a reason in one or two lines, British spelling in prose. Tests use
Node's built-in `node:test` runner. Commit messages are one imperative sentence, for example
"Balance the Latent Archive sample by department and colour".

## Commands you will need

Run from the repository root unless a step says otherwise.

| Purpose | Command | Expected on success |
|---|---|---|
| Tests (exists after step 2) | `npm test` | `# pass 9`, `# fail 0` |
| Site build (exists after step 3) | `npm run build` | ends with `site: 4 pieces → …/dist` and four `/<slug>/` lines, exit 0 |
| Clean install of one piece | `npm ci --no-audit --no-fund` in that piece's folder | exit 0 |

The site build needs network access to the npm registry, because it clean-installs each piece.

## Scope

**In scope** (the only files you may create or modify):

- `package.json` (create, repository root)
- `vercel.json` (create)
- `scripts/build-site.mjs` (create)
- `scripts/lib/gallery.mjs` (create)
- `scripts/gallery.test.mjs` (create)
- `site/index.html` (create)
- `site/pieces.json` (create)
- `site/README.md` (create)
- `README.md` (one added paragraph)
- `projects/trade-organism/package-lock.json` (regenerated by npm, never hand-edited)
- `projects/varna-weather-galaxy/package-lock.json` (regenerated by npm, never hand-edited)

**Out of scope** (do NOT touch):

- Any file under a piece's `src/`, any piece's `package.json`, `vite.config.js` or `index.html`.
- `projects/latent-archive/package-lock.json` and `projects/solar-wind-breath/package-lock.json`. They are in sync.
- The "Projects" list in the root `README.md`.
- `.gitignore`. It already covers `dist/` and `node_modules/`.
- Anything under `plans/` or `docs/`.
- Do not add a root `package-lock.json`, npm workspaces, or any dependency to the root `package.json`.
- Do not run any Vercel command or change any Vercel setting. The operator does that.

## Git workflow

- Branch: `advisor/002-one-site`, or the branch your worktree is already on.
- Three commits: after step 1 ("Bring the Trade Organism and Varna lockfiles back in sync"),
  after step 2 ("Add gallery helpers for the site home page"), after step 5
  ("Build every piece into one site with a gallery home page").
- Do NOT push or open a pull request unless the operator told you to.

## Steps

### Step 1: Repair the two lockfiles

In `projects/trade-organism`, run `npm install --no-audit --no-fund`. Then do the same in
`projects/varna-weather-galaxy`.

**Verify**, for each of the two folders:

- `git status --short .` (run inside the folder) lists exactly one line: ` M package-lock.json`.
  If `package.json` is listed, STOP.
- `grep -A1 '"node_modules/vite": {' package-lock.json` shows the same version as before the install
  (`8.0.11` in `trade-organism`, `8.0.10` in `varna-weather-galaxy`).
- `rm -rf node_modules && npm ci --no-audit --no-fund` exits 0.

Commit both lockfiles: `Bring the Trade Organism and Varna lockfiles back in sync`.

### Step 2: Add the gallery helpers and their tests

These are pure functions: they read a piece's title and description, order the pieces, and render
the home page list. Keeping them apart from the file and process work is what makes them testable.

Create `scripts/lib/gallery.mjs` with exactly this content:

````js
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
````

Create `scripts/gallery.test.mjs` with exactly this content:

````js
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
````

Create `package.json` with exactly this content:

````json
{
  "name": "data-art",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-site.mjs",
    "test": "node --test scripts/gallery.test.mjs"
  }
}
````

**Verify**: `npm test` prints `# pass 9` and `# fail 0`.

Commit the three files: `Add gallery helpers for the site home page`.

### Step 3: Add the home page template, the piece manifest and the build script

Create `site/index.html` with exactly this content:

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Data Art: interactive sculptures made from real data. Museum collections, weather, solar storms and trade, each running live in the browser." />
    <meta name="theme-color" content="#050506" />
    <meta property="og:title" content="Data Art" />
    <meta property="og:description" content="Interactive sculptures made from real data, each running live in the browser." />
    <meta property="og:type" content="website" />
    <title>Data Art</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #050506;
        --ink: #ededed;
        --muted: #a1a1a1;
        --faint: #8a8a8a;
        --line: rgba(255, 255, 255, 0.1);
        --accent: #f2c48d;
        --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
        --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        --gutter: clamp(20px, 4vw, 56px);
        --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: var(--sans);
        font-size: 16px;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 4px;
      }

      .label {
        font-family: var(--mono);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--faint);
      }

      .page {
        max-width: 1320px;
        margin: 0 auto;
        padding: 0 var(--gutter);
      }

      .masthead {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 24px;
        padding: 28px 0;
        border-bottom: 1px solid var(--line);
      }

      .masthead .label:first-child {
        color: var(--ink);
      }

      /* Asymmetric: the statement sits on the left two thirds, the right third stays empty. */
      .intro {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        column-gap: 24px;
        padding: clamp(72px, 14vh, 168px) 0 clamp(56px, 10vh, 120px);
      }

      .intro h1 {
        grid-column: 1 / span 8;
        margin: 0;
        font-family: var(--serif);
        font-weight: 400;
        font-size: clamp(40px, 5.6vw, 76px);
        line-height: 1.04;
        letter-spacing: -0.015em;
      }

      .intro p {
        grid-column: 1 / span 5;
        margin: 32px 0 0;
        max-width: 46ch;
        font-size: 17px;
        color: var(--muted);
      }

      .pieces {
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid var(--line);
      }

      .piece {
        border-bottom: 1px solid var(--line);
      }

      .piece a {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        column-gap: 24px;
        align-items: baseline;
        padding: 40px 0;
      }

      .piece-index {
        grid-column: 1 / span 1;
        font-family: var(--mono);
        font-size: 12px;
        letter-spacing: 0.08em;
        color: var(--faint);
      }

      .piece-body {
        grid-column: 2 / span 6;
        display: block;
      }

      .piece-title {
        display: block;
        font-family: var(--serif);
        font-size: clamp(28px, 3vw, 40px);
        line-height: 1.1;
        letter-spacing: -0.01em;
        transition: transform 320ms var(--ease), color 320ms var(--ease);
      }

      .piece-summary {
        display: block;
        margin-top: 12px;
        max-width: 52ch;
        color: var(--muted);
      }

      .piece-data {
        grid-column: 9 / span 3;
        font-family: var(--mono);
        font-size: 12px;
        line-height: 1.6;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--faint);
      }

      .piece-arrow {
        grid-column: 12 / span 1;
        justify-self: end;
        font-size: 20px;
        color: var(--faint);
        transition: transform 320ms var(--ease), color 320ms var(--ease);
      }

      .piece a:hover .piece-title,
      .piece a:focus-visible .piece-title {
        color: var(--accent);
        transform: translateX(8px);
      }

      .piece a:hover .piece-arrow,
      .piece a:focus-visible .piece-arrow {
        color: var(--accent);
        transform: translateX(6px);
      }

      .colophon {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
        padding: 40px 0 56px;
      }

      @media (max-width: 760px) {
        .intro h1,
        .intro p {
          grid-column: 1 / -1;
        }

        .piece a {
          row-gap: 16px;
          padding: 32px 0;
        }

        .piece-index {
          grid-column: 1 / span 2;
        }

        .piece-body {
          grid-column: 3 / span 9;
        }

        .piece-arrow {
          grid-column: 12 / span 1;
          grid-row: 1;
        }

        .piece-data {
          grid-column: 3 / -1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .piece-title,
        .piece-arrow {
          transition: none;
        }

        .piece a:hover .piece-title,
        .piece a:focus-visible .piece-title,
        .piece a:hover .piece-arrow,
        .piece a:focus-visible .piece-arrow {
          transform: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="masthead">
        <span class="label">Data Art</span>
        <span class="label"><!-- count --></span>
      </header>

      <main>
        <section class="intro" aria-labelledby="statement">
          <h1 id="statement">Sculptures made of data.</h1>
          <p>
            Each piece takes one real dataset and gives it a body: a museum's collection, a city's weather, a week of
            solar storms. They run live in your browser. Open one, then drag, scroll and wait.
          </p>
        </section>

        <ol class="pieces" aria-label="Works">
<!-- pieces -->
        </ol>
      </main>

      <footer class="colophon">
        <span class="label"><!-- count --> · built with Three.js</span>
        <span class="label">Best on a large screen</span>
      </footer>
    </div>
  </body>
</html>
````

Create `site/pieces.json` with exactly this content:

````json
[
  {
    "slug": "latent-archive",
    "title": "Latent Archive",
    "summary": "20,000 museum artworks become 320,000 points of pigment that sort themselves by date, regroup by likeness, then dissolve into flowing colour.",
    "data": "Art Institute of Chicago · public-domain collection"
  },
  {
    "slug": "varna-weather-galaxy",
    "title": "Varna Weather Galaxy",
    "summary": "Eleven years of hourly weather over Varna, on the Black Sea, drawn as one slow galaxy.",
    "data": "Open-Meteo archive · 96,432 hours · 2015–2025"
  },
  {
    "slug": "solar-wind-breath",
    "title": "Solar Wind Breath",
    "summary": "The Sun's plasma stream past Earth during the storms of May 2024.",
    "data": "NASA DONKI eruption and storm catalogues · plasma values reconstructed"
  },
  {
    "slug": "trade-organism",
    "title": "Trade Organism",
    "summary": "Global trade drawn as a living system of hubs and flows.",
    "data": "Illustrative · scaled from public port and trade references"
  }
]
````

Create `scripts/build-site.mjs` with exactly this content:

````js
// Builds every piece under projects/ into one static site:
//   dist/index.html      the gallery home page
//   dist/<piece>/        each piece, built with its base path set to /<piece>/
// One Vercel project serves dist/, so every piece lives under one domain.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arrangePieces, isSlug, readMeta, renderGallery } from "./lib/gallery.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = join(ROOT, "projects");
const SITE = join(ROOT, "site");
const OUT = join(ROOT, "dist");
const INSTALL = !process.argv.includes("--no-install"); // reruns can skip the clean installs

async function main() {
  const slugs = await findPieces();
  if (!slugs.length) throw new Error("No buildable pieces under projects/");

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const built = [];
  for (const slug of slugs) {
    const dir = join(PROJECTS, slug);
    console.log(`\n── ${slug}`);
    if (INSTALL) run("npm", ["ci", "--no-audit", "--no-fund"], dir);
    run("npm", ["run", "build", "--", "--base", `/${slug}/`], dir);
    await cp(join(dir, "dist"), join(OUT, slug), { recursive: true });
    if (!existsSync(join(OUT, slug, "index.html"))) throw new Error(`${slug} built no index.html`);
    built.push({ slug, ...readMeta(await readFile(join(dir, "index.html"), "utf8")) });
  }

  const manifest = JSON.parse(await readFile(join(SITE, "pieces.json"), "utf8"));
  const pieces = arrangePieces(built, manifest);
  const template = await readFile(join(SITE, "index.html"), "utf8");
  await writeFile(join(OUT, "index.html"), renderGallery(template, pieces));

  console.log(`\nsite: ${pieces.length} pieces → ${OUT}`);
  for (const piece of pieces) console.log(`  /${piece.slug}/  ${piece.title}`);
}

// A piece is a folder under projects/ with a URL-safe name and a build script.
async function findPieces() {
  const entries = await readdir(PROJECTS, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = join(PROJECTS, entry.name, "package.json");
    if (!existsSync(manifest)) continue;
    if (!isSlug(entry.name)) {
      console.warn(`skipping projects/${entry.name}: the folder name is not URL-safe`);
      continue;
    }
    const scripts = JSON.parse(await readFile(manifest, "utf8")).scripts ?? {};
    if (scripts.build) slugs.push(entry.name);
  }
  return slugs.sort();
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
````

**Verify**: `npm run build` exits 0 and its last five lines are:

````text
site: 4 pieces → <absolute path>/dist
  /latent-archive/  Latent Archive
  /varna-weather-galaxy/  Varna Weather Galaxy
  /solar-wind-breath/  Solar Wind Breath
  /trade-organism/  Trade Organism
````

Then check the output:

- `grep -c '<li class="piece">' dist/index.html` prints `4`.
- `grep -c '<!-- ' dist/index.html` prints `0` (both markers were filled).
- `for p in latent-archive solar-wind-breath trade-organism varna-weather-galaxy; do grep -c "/$p/assets/" dist/$p/index.html; done`
  prints four numbers, each `1` or more (every piece was built with its own base path).
- `ls dist/latent-archive/data` lists `latent-archive.bin` and `latent-archive.json`.
- `git status --short` does not list `dist/` or any `node_modules/`.

### Step 4: Add the Vercel configuration

Create `vercel.json` with exactly this content:

````json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "trailingSlash": true
}
````

`trailingSlash` makes `/latent-archive` redirect to `/latent-archive/`. `framework: null` stops
Vercel from guessing a framework at the repository root.

**Verify**: `node -e 'const c=require("./vercel.json"); console.log(c.buildCommand, c.outputDirectory, c.framework, c.trailingSlash)'`
prints `npm run build dist null true`.

### Step 5: Document it

Create `site/README.md` with exactly this content:

````markdown
# The site

Every piece in this repository is built into one static site and served under one domain: the gallery home page at `/`, and each piece at `/<folder name>/`.

From the repository root:

```sh
npm run build   # clean-installs and builds every piece into dist/
npm test        # checks the gallery helpers
```

`npm run build -- --no-install` skips the clean installs on a rerun. To look at the result, serve `dist/` with any static file server, for example `npx serve dist`.

## How it works

- `scripts/build-site.mjs` finds every folder under `projects/` that has a `build` script, builds it with its base path set to `/<folder name>/`, and copies its output to `dist/<folder name>/`.
- `site/index.html` is the home page template. The build fills in the list of pieces and the count.
- `site/pieces.json` sets the order and the wording on the home page. A piece that is not listed there still appears, after the listed ones, with the title and description from its own `index.html`.

## Adding a piece

1. Put it in `projects/<folder name>/` with a `build` script that writes to `dist/`. The folder name becomes the URL, so use lowercase letters, digits and hyphens.
2. Load its data through `import.meta.env.BASE_URL` (for example `` `${import.meta.env.BASE_URL}data/file.json` ``), never from an absolute path like `/data/file.json`. The site build serves the piece from a sub-path.
3. Commit its `package-lock.json`. The site build installs with `npm ci`, which fails when the lockfile is missing or out of date.
4. Optionally add an entry to `site/pieces.json` to place it and word it.

## Deployment

One Vercel project serves the whole site. Its Root Directory is the repository root, and `vercel.json` holds the build command and output directory. Adding a piece needs no change in Vercel.
````

Then make one edit to the root `README.md`. Find this line (it occurs exactly once):

````markdown
Interactive data visualization artworks.
````

Replace it with:

````markdown
Interactive data visualization artworks.

All pieces build into one site, served under one domain: see [site/README.md](site/README.md).
````

Do not change anything else in that file.

**Verify**: `git diff --stat -- README.md` shows `1 file changed, 2 insertions(+)`, and
`tail -1 README.md` still prints `- [Latent Archive](projects/latent-archive)`.

Commit everything from steps 3, 4 and 5: `Build every piece into one site with a gallery home page`.

### Step 6: Final gate

From the repository root: `npm test`, then `npm run build -- --no-install`.

**Verify**: `# pass 9`, `# fail 0`, and the build ends with `site: 4 pieces`. `git status --short`
prints nothing.

## Test plan

- New file `scripts/gallery.test.mjs` (Node's built-in runner, no dependency), nine tests of
  `scripts/lib/gallery.mjs`: what counts as a URL-safe folder name; reading a title and a
  multi-line description with an entity; attribute order and an apostrophe entity; a page that
  declares nothing; manifest order first, unlisted pieces after by slug, manifest entries with no
  built piece skipped; fallback to the slug; link path, numbering and HTML escaping; both count
  markers filled, singular and plural, and replacement text containing `$&` kept literal; a
  template without markers rejected.
- The build script itself is exercised by running it (step 3). It has no unit test: it is file
  and process orchestration.
- Verification: `npm test` → `# pass 9`, `# fail 0`.

## Done criteria

ALL must hold:

- [ ] `npm test` at the repository root prints `# pass 9` and `# fail 0`
- [ ] `npm run build` at the repository root exits 0 and ends with `site: 4 pieces` and the four paths
- [ ] `grep -c '<li class="piece">' dist/index.html` prints `4`
- [ ] `npm ci --no-audit --no-fund` exits 0 in all four folders under `projects/`
- [ ] `git diff --stat 66fdf0a..HEAD` lists only in-scope files (plus `plans/` if you were given a newer base)
- [ ] No piece's `package.json`, `src/`, `index.html` or `vite.config.js` appears in that diff
- [ ] `git status --short` prints nothing
- [ ] `plans/README.md` status row updated (skip if a reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- Any file this plan creates already exists.
- `npm install` in step 1 changes `package.json`, changes the Vite version, or `npm ci` still fails afterwards.
- The npm registry cannot be reached.
- `npm run build` fails for any piece, or reports a number of pieces other than 4.
- A piece's built `index.html` does not reference `/<folder name>/assets/`. That means the base path was not applied.
- A verification fails twice after one reasonable fix attempt.
- A fix appears to need a change inside a piece's source, a new dependency, or a file outside the in-scope list.

## Maintenance notes

- **The Vercel project must build from the repository root.** Its Root Directory setting is not
  in `vercel.json`; it is a project setting. The operator changes it. A branch without this plan
  will then fail that project's check until it contains these files.
- **New pieces join automatically.** Any folder under `projects/` with a `build` script is built
  and listed. Two more pieces (`redshift-tunnel`, `warming-rivers`) live on an unmerged branch;
  they already use `import.meta.env.BASE_URL`, so they will appear once merged. Add them to
  `site/pieces.json` then if their order or wording should be curated.
- **A piece that fetches from an absolute path breaks under a sub-path.** That is the one rule a
  new piece has to follow; `site/README.md` states it.
- **The site build uses `npm ci`,** so a piece with a stale lockfile fails the whole deployment.
  That is deliberate: it fails loudly at build time instead of shipping an unpinned install.
- **The home page wording lives in `site/pieces.json` and `site/index.html`.** It is the owner's
  voice; a reviewer should read it as copy, not as code.
- **Deferred**: poster images and a share image for the home page, and per-piece "back to
  gallery" links. Both touch the pieces' own UI and belong with the UI plan.
