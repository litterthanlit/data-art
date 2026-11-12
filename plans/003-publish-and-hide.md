# Plan 003: The site lists Warming Rivers and Redshift Tunnel and hides three unfinished pieces

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 40e1c33..HEAD -- scripts site README.md projects/redshift-tunnel/README.md projects/warming-rivers/README.md .claude/skills/making-data-art/build-notes.md`
> It must print nothing. If it prints anything, compare the "Find this text"
> blocks against the live files before proceeding. On a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-one-site.md (DONE)
- **Category**: direction
- **Planned at**: commit `40e1c33`, 2026-11-12

## Why this matters

The repository builds every artwork under `projects/` into one website: a gallery home page at
`/` and each piece at `/<folder name>/`. Two finished pieces, Warming Rivers and Redshift Tunnel,
were just merged in. They already build, but the home page describes them with fallback text and
lists them last. The owner has also decided that three older pieces (Varna Weather Galaxy, Solar
Wind Breath, Trade Organism) are not up to standard and must not be on the public site for now.
Today the build has no way to leave a piece out.

After this plan, a piece can be marked `"hidden": true` in `site/pieces.json`. A hidden piece is
not built, not listed and has no address; it stays in the repository and still runs locally. The
three older pieces are hidden, the two new ones are placed and worded on the home page, the home
page copy matches the three pieces that remain, and every "live" link and deployment note points
at the one site instead of the old per-piece addresses.

Every edit below was applied to a scratch copy at the planned commit and run: the tests pass, the
build prints three "hidden" lines and "site: 3 pieces", all three pieces load at their paths with
no failed requests, and `/trade-organism/` returns 404.

## Current state

- Plain JavaScript ES modules, no TypeScript, no linter. Tests use Node's built-in `node:test`.
- `scripts/build-site.mjs`: the site build. It finds every folder under `projects/` that has a
  `build` script, clean-installs and builds each one with its base path set to `/<folder>/`,
  copies the output to `dist/<folder>/`, then renders `dist/index.html`.
- `scripts/lib/gallery.mjs`: pure helpers (`isSlug`, `escapeHtml`, `readMeta`, `arrangePieces`,
  `renderPiece`, `renderGallery`). `scripts/gallery.test.mjs` tests them: 9 tests today.
- `site/pieces.json`: an array of `{ slug, title, summary, data }` entries that sets the order and
  wording on the home page. It lists four pieces today. A built piece that is not listed is
  appended with the title and description from its own `index.html`.
- `site/index.html`: the home page template. `site/README.md`: how the site works.
- `projects/` holds six pieces: `latent-archive`, `redshift-tunnel`, `solar-wind-breath`,
  `trade-organism`, `varna-weather-galaxy`, `warming-rivers`.
- The production site is `https://data-art-three.vercel.app`. The older addresses
  `https://redshift-tunnel.vercel.app` and `https://warming-rivers.vercel.app` belong to two
  separate deployment projects that are about to be removed.
- `.claude/skills/making-data-art/build-notes.md` is a project note for future work. Its
  "Live links (Vercel)" section still says each piece gets its own deployment project. That
  instruction is what caused failing checks on every branch, and it is now wrong.

Conventions to match: two-space indent, double quotes, semicolons, trailing commas in multi-line
literals, comments that state a reason in one or two lines, British spelling in prose. Commit
messages are one imperative sentence, for example "Add gallery helpers for the site home page".

## Commands you will need

Run from the repository root.

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | `# pass 9`, `# fail 0` before step 1; `# pass 10`, `# fail 0` after it |
| Site build | `npm run build` | exit 0, ends with `site: 3 pieces → …/dist` after step 2 |

The site build needs network access to the npm registry, because it clean-installs each piece.

## Scope

**In scope** (the only files you may modify):

- `scripts/lib/gallery.mjs`
- `scripts/build-site.mjs`
- `scripts/gallery.test.mjs`
- `site/pieces.json`
- `site/index.html` (two text edits)
- `site/README.md`
- `README.md` (two links)
- `projects/redshift-tunnel/README.md` (one link)
- `projects/warming-rivers/README.md` (one link)
- `.claude/skills/making-data-art/build-notes.md` (one section)

**Out of scope** (do NOT touch):

- Any piece's source, `package.json`, lockfile, `index.html` or data. The three hidden pieces
  stay in the repository exactly as they are.
- `vercel.json`, the root `package.json`, `.gitignore`.
- The other files under `.claude/skills/making-data-art/`.
- Anything under `plans/` or `docs/`.
- Do not run any Vercel command or change any Vercel setting.

## Git workflow

- Branch: the branch your worktree is already on.
- Two commits: after step 1 ("Let the site manifest hide a piece"), and after step 4
  ("List Warming Rivers and Redshift Tunnel and hide three unfinished pieces").
- Do NOT push or open a pull request unless the operator told you to.

## Steps

Every edit is an exact find-and-replace. Each "Find" block occurs exactly once in its file. If a
block does not match, that is a STOP condition.

### Step 1: Add the hide switch

First run `npm test` and confirm `# pass 9`, `# fail 0`.

**Edit 1 of `scripts/lib/gallery.mjs`.** Find this text (it occurs exactly once):

````js
// Title and description as a piece declares them in its own index.html.
````

Replace it with:

````js
// A manifest entry marked hidden keeps its piece out of the site: it is neither built nor listed.
export function hiddenSlugs(manifest = []) {
  return new Set(manifest.filter((entry) => entry.hidden === true).map((entry) => entry.slug));
}

// Title and description as a piece declares them in its own index.html.
````

**Edit 1 of `scripts/gallery.test.mjs`.** Find this text (it occurs exactly once):

````js
import { arrangePieces, escapeHtml, isSlug, readMeta, renderGallery, renderPiece } from "./lib/gallery.mjs";
````

Replace it with:

````js
import { arrangePieces, escapeHtml, hiddenSlugs, isSlug, readMeta, renderGallery, renderPiece } from "./lib/gallery.mjs";
````

**Edit 2 of `scripts/gallery.test.mjs`.** Find this text (it occurs exactly once):

````js
test("readMeta reads the title and description a piece declares", () => {
````

Replace it with:

````js
test("only entries marked hidden: true are hidden", () => {
  const manifest = [
    { slug: "shown" },
    { slug: "off", hidden: true },
    { slug: "explicit", hidden: false },
    { slug: "stringly", hidden: "true" },
  ];
  assert.deepEqual([...hiddenSlugs(manifest)], ["off"]);
  assert.equal(hiddenSlugs().size, 0);
});

test("readMeta reads the title and description a piece declares", () => {
````

**Edit 1 of `scripts/build-site.mjs`.** Find this text (it occurs exactly once):

````js
import { arrangePieces, isSlug, readMeta, renderGallery } from "./lib/gallery.mjs";
````

Replace it with:

````js
import { arrangePieces, hiddenSlugs, isSlug, readMeta, renderGallery } from "./lib/gallery.mjs";
````

**Edit 2 of `scripts/build-site.mjs`.** Find this text (it occurs exactly once):

````js
  const slugs = await findPieces();
  if (!slugs.length) throw new Error("No buildable pieces under projects/");
````

Replace it with:

````js
  const manifest = JSON.parse(await readFile(join(SITE, "pieces.json"), "utf8"));
  const hidden = hiddenSlugs(manifest);
  const found = await findPieces();
  const slugs = found.filter((slug) => !hidden.has(slug));
  for (const slug of found.filter((name) => hidden.has(name))) {
    console.log(`hidden: ${slug} (marked in site/pieces.json)`);
  }
  if (!slugs.length) throw new Error("No visible pieces to build under projects/");
````

**Edit 3 of `scripts/build-site.mjs`.** Find this text (it occurs exactly once):

````js
  const manifest = JSON.parse(await readFile(join(SITE, "pieces.json"), "utf8"));
  const pieces = arrangePieces(built, manifest);
````

Replace it with:

````js
  const pieces = arrangePieces(built, manifest);
````

The build now reads the manifest before it builds anything, leaves out every piece the manifest
marks hidden, and says so in the log.

**Verify**: `npm test` prints `# pass 10` and `# fail 0`. `node --check scripts/build-site.mjs`
exits 0 with no output. `grep -c "pieces.json" scripts/build-site.mjs` prints `2` (one read, one
log message).

Commit the three files: `Let the site manifest hide a piece`.

### Step 2: Place the new pieces and hide the three older ones

Replace the whole content of `site/pieces.json` with exactly this:

````json
[
  {
    "slug": "latent-archive",
    "title": "Latent Archive",
    "summary": "20,000 museum artworks become 320,000 points of pigment that sort themselves by date, regroup by likeness, then dissolve into flowing colour.",
    "data": "Art Institute of Chicago · public-domain collection"
  },
  {
    "slug": "warming-rivers",
    "title": "Warming Rivers",
    "summary": "Nine rivers of light, one for each region of the world, flow from 1850 to 2025 and take the colour of each year's real temperature.",
    "data": "NOAA Climate at a Glance · nine regions · 1850–2025"
  },
  {
    "slug": "redshift-tunnel",
    "title": "Redshift Tunnel",
    "summary": "Light from real galaxies and quasars streams inward. The red rim left about 12 billion years ago, and the centre is now.",
    "data": "DESI Data Release 1 · 600,000 galaxies and quasars"
  },
  {
    "slug": "varna-weather-galaxy",
    "title": "Varna Weather Galaxy",
    "summary": "Eleven years of hourly weather over Varna, on the Black Sea, drawn as one slow galaxy.",
    "data": "Open-Meteo archive · 96,432 hours · 2015–2025",
    "hidden": true
  },
  {
    "slug": "solar-wind-breath",
    "title": "Solar Wind Breath",
    "summary": "The Sun's plasma stream past Earth during the storms of May 2024.",
    "data": "NASA DONKI eruption and storm catalogues · plasma values reconstructed",
    "hidden": true
  },
  {
    "slug": "trade-organism",
    "title": "Trade Organism",
    "summary": "Global trade drawn as a living system of hubs and flows.",
    "data": "Illustrative · scaled from public port and trade references",
    "hidden": true
  }
]
````

**Verify**: `npm run build` exits 0. Its output contains these three lines:

````text
hidden: solar-wind-breath (marked in site/pieces.json)
hidden: trade-organism (marked in site/pieces.json)
hidden: varna-weather-galaxy (marked in site/pieces.json)
````

and ends with:

````text
site: 3 pieces → <absolute path>/dist
  /latent-archive/  Latent Archive
  /warming-rivers/  Warming Rivers
  /redshift-tunnel/  Redshift Tunnel
````

Then:

- `ls dist` prints exactly `index.html`, `latent-archive`, `redshift-tunnel`, `warming-rivers`.
- `grep -c '<li class="piece">' dist/index.html` prints `3`.
- `grep -c "Varna\|Solar Wind\|Trade Organism" dist/index.html` prints `0`.

### Step 3: Make the home page copy match the three pieces

**Edit 1 of `site/index.html`.** Find this text (it occurs exactly once):

````html
    <meta name="description" content="Data Art: interactive sculptures made from real data. Museum collections, weather, solar storms and trade, each running live in the browser." />
````

Replace it with:

````html
    <meta name="description" content="Data Art: interactive sculptures made from real data. A museum's collection, a survey of the sky and 175 years of temperature, each running live in the browser." />
````

**Edit 2 of `site/index.html`.** Find this text (it occurs exactly once):

````html
            Each piece takes one real dataset and gives it a body: a museum's collection, a city's weather, a week of
            solar storms. They run live in your browser. Open one, then drag, scroll and wait.
````

Replace it with:

````html
            Each piece takes one real dataset and gives it a body: a museum's collection, a survey of the sky, 175
            years of temperature. They run live in your browser. Open one and let it play.
````

**Verify**: `grep -c "city's weather\|solar storms\|trade" site/index.html` prints `0`, and
`grep -c "175" site/index.html` prints `2`.

### Step 4: Point links and notes at the one site

**Edit 1 of `site/README.md`.** Find this text (it occurs exactly once):

````markdown
- `site/pieces.json` sets the order and the wording on the home page. A piece that is not listed there still appears, after the listed ones, with the title and description from its own `index.html`.
````

Replace it with:

````markdown
- `site/pieces.json` sets the order and the wording on the home page. A piece that is not listed there still appears, after the listed ones, with the title and description from its own `index.html`.
- An entry with `"hidden": true` keeps its piece out of the site: it is not built, not listed and has no address. The piece stays in the repository and still runs locally. Remove the flag to publish it again.
````

**Edit 1 of `README.md`.** Find this text (it occurs exactly once):

````markdown
- [Redshift Tunnel](projects/redshift-tunnel): [live](https://redshift-tunnel.vercel.app)
- [Warming Rivers](projects/warming-rivers): [live](https://warming-rivers.vercel.app)
````

Replace it with:

````markdown
- [Redshift Tunnel](projects/redshift-tunnel): [live](https://data-art-three.vercel.app/redshift-tunnel/)
- [Warming Rivers](projects/warming-rivers): [live](https://data-art-three.vercel.app/warming-rivers/)
````

**Edit 1 of `projects/redshift-tunnel/README.md`.** Find this text (it occurs exactly once):

````markdown
**Live:** <https://redshift-tunnel.vercel.app>
````

Replace it with:

````markdown
**Live:** <https://data-art-three.vercel.app/redshift-tunnel/>
````

**Edit 1 of `projects/warming-rivers/README.md`.** Find this text (it occurs exactly once):

````markdown
**Live:** <https://warming-rivers.vercel.app>
````

Replace it with:

````markdown
**Live:** <https://data-art-three.vercel.app/warming-rivers/>
````

**Edit 1 of `.claude/skills/making-data-art/build-notes.md`.** Find this text (it occurs exactly once):

````markdown
- Each piece gets its own Vercel project in the team `nicks-projects-14b58bdc`. Create it with `framework: "vite"`, `rootDirectory: "projects/<name>"`, `gitRepository: litterthanlit/data-art`, `enableAffectedProjectsDeployments: true`, and `ssoProtection: null`. Without that last setting, the links ask visitors to log in to Vercel.
- Deploy from Git with `create_deployment` using `gitSource {type: "github", org: "litterthanlit", repo: "data-art", ref, sha}` and `target: "production"`. Vercel builds from the repo, so the committed `public/data/` ships as-is, including binaries. Production lives at `https://<name>.vercel.app`.
- Projects build one at a time, so a second deployment may sit in `QUEUED` for a while.
- Verify from outside: `curl` the page, the data file and the JS bundle, and check the bundle contains the expected code.
````

Replace it with:

````markdown
- One Vercel project, `data-art` in the team `nicks-projects-14b58bdc`, serves every piece from the repository root. Do not create a Vercel project for a new piece: a project that points at one folder fails on every branch that does not have that folder.
- A piece goes live when its folder is merged into `main`. The site build (`npm run build` at the repository root) finds every folder under `projects/` with a `build` script and serves it at `https://data-art-three.vercel.app/<name>/`. See `site/README.md`.
- Load data through `import.meta.env.BASE_URL`, because the piece is served from a sub-path. Vercel builds from the repo, so the committed `public/data/` ships as-is, including binaries.
- Add an entry to `site/pieces.json` to place and word the piece on the home page, or set `"hidden": true` there to keep it out of the site.
- Verify from outside: `curl` the page, the data file and the JS bundle, and check the bundle contains the expected code.
````

**Verify** (from the repository root):

- `grep -rn "redshift-tunnel.vercel.app\|warming-rivers.vercel.app" README.md projects .claude site scripts --include="*.md" --include="*.mjs" --include="*.html" --include="*.json" | grep -v node_modules` prints nothing.
- `grep -c "data-art-three.vercel.app" README.md` prints `2`.
- `grep -c "gets its own Vercel project" .claude/skills/making-data-art/build-notes.md` prints `0`.
- `grep -c '"hidden": true' site/README.md` prints `1`.

Commit everything from steps 2, 3 and 4:
`List Warming Rivers and Redshift Tunnel and hide three unfinished pieces`.

### Step 5: Final gate

`npm test`, then `npm run build -- --no-install`.

**Verify**: `# pass 10`, `# fail 0`; the build ends with `site: 3 pieces` and the three paths;
`git status --short` prints nothing.

## Test plan

- One new test in `scripts/gallery.test.mjs`: only entries whose `hidden` is exactly `true` are
  hidden (not `false`, not the string `"true"`, not a missing field), and an absent manifest hides
  nothing.
- The build's use of the switch is checked by running it (step 2): three "hidden" lines, three
  pieces built, no folder for a hidden piece in `dist/`.
- Verification: `npm test` → `# pass 10`, `# fail 0`.

## Done criteria

ALL must hold:

- [ ] `npm test` prints `# pass 10` and `# fail 0`
- [ ] `npm run build` exits 0 and ends with `site: 3 pieces` and the three paths in the order above
- [ ] `ls dist` prints exactly `index.html`, `latent-archive`, `redshift-tunnel`, `warming-rivers`
- [ ] No file in the repository outside `plans/` mentions `redshift-tunnel.vercel.app` or `warming-rivers.vercel.app`
- [ ] `git diff --stat 40e1c33..HEAD` lists only in-scope files (plus `plans/` if you were given a newer base)
- [ ] `git status --short` prints nothing
- [ ] `plans/README.md` status row updated (skip if a reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Find this text" block does not occur exactly once in its file.
- `projects/` does not hold exactly the six folders named in "Current state".
- `npm run build` fails for any piece, or reports a number of pieces other than 3.
- A verification fails twice after one reasonable fix attempt.
- A fix appears to need a change inside a piece, a new dependency, or a file outside the in-scope list.

## Maintenance notes

- **To publish a hidden piece again**, delete its `"hidden": true` line in `site/pieces.json`. The
  home page intro and meta description in `site/index.html` name the kinds of data on show, so
  reword them when the set of visible pieces changes.
- **Hidden means absent, not unlisted.** A hidden piece has no address on the site. If a private
  preview link is ever wanted, that is a different feature.
- **The summaries and data lines in `site/pieces.json` are the owner's public copy.** A reviewer
  should read them as wording, not code.
- **`build-notes.md` now tells future work not to create a deployment project per piece.** If the
  production address changes (for example a custom domain), update it there, in `README.md` and in
  the two piece READMEs.
