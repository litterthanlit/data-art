# Plan 001: Latent Archive renders the collection's real colour as opaque pigment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a98e0cf..HEAD -- projects/latent-archive docs/superpowers/specs/2026-09-25-latent-archive-design.md`
> If any in-scope file changed since this plan was written, compare the
> "Find this text" blocks against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (it changes the look of the whole piece and regenerates the committed data files)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a98e0cf`, 2026-11-11

## Why this matters

Latent Archive is a WebGL artwork in which 20,000 museum artworks become 320,000 points of
"pigment". On screen it is almost colourless: measured on rendered frames, the lit pixels average
about 8% saturation, the background that should be near-black (`#020206`) comes out navy
(about `rgb(22,22,42)`), and on a phone 83% of the frame is lit and 6.75% is pure white. A piece
about pigment that renders as grey fog fails at its one job.

There are four causes, and this plan fixes all of them:

1. **Colours are gamma-encoded twice.** The cells are stored as sRGB bytes, used in the shader as
   if they were linear, then encoded to sRGB again by the output pass. That lifts and desaturates
   every colour.
2. **Additive blending sums overlapping points to white**, and there is no tone mapping.
3. **The clear colour skips colour-space conversion.** `renderer.setClearColor` hands raw sRGB
   values to a linear render target, so the output pass brightens the background to navy.
4. **The sample is a uniform shuffle.** It reproduces the collection's own proportions: 43.5% of
   the 20,000 works are prints and drawings, mostly the colour of paper.

After this plan, pigment is drawn opaque with depth, in its true colour with a fixed chroma lift,
on a true near-black ground, and the sample is balanced across departments and weighted toward
colourful works. Every edit below was applied to a scratch copy of the repo and measured: lit-pixel
saturation rises from about 0.08 to 0.41–0.48 in all three states, no pixels clip to white, the
largest department falls from 43.5% to 27.7%, and stored cell saturation rises from 0.172 to 0.212.

## Current state

The repo holds four independent Vite + Three.js artworks under `projects/`. This plan touches
only `projects/latent-archive`. It is plain JavaScript (ES modules), no TypeScript, no linter, no CI, and until this
plan no tests. Three.js is version 0.164.1.

Files and their roles:

- `projects/latent-archive/src/dream/shaders.js`: the vertex and fragment shaders for the single point system.
- `projects/latent-archive/src/dream/DreamField.js`: builds the `THREE.Points` object, its material and uniforms.
- `projects/latent-archive/src/scene/ArchiveScene.js`: renderer, camera, bloom, input, the animation loop.
- `projects/latent-archive/scripts/build-archive-data.mjs`: the build script behind `npm run data`. It reads a
  cache of the Art Institute of Chicago's public-domain works, picks 20,000 with `sampleWorks`,
  lays them out with UMAP, and writes `public/data/latent-archive.bin` and
  `public/data/latent-archive.json`. Both output files are committed.
- `projects/latent-archive/README.md` and `docs/superpowers/specs/2026-09-25-latent-archive-design.md`: the living
  description and the design spec. Both currently describe the old behaviour.

Facts you need:

- The cache file `projects/latent-archive/scripts/cache/aic-artworks.json` (about 22 MB, 58,805 works) is
  gitignored, so a fresh checkout does not have it. Without it, `npm run data` fetches the whole
  collection from `api.artic.edu`, which takes about 15 minutes at the API's rate limit. If the
  person who dispatched you gave you a path to an existing cache, pass it as
  `ARCHIVE_CACHE=<absolute path>` and the build takes under a minute.
- The build is seeded. With the same cache and the same code it writes a byte-identical `.bin`.
- Each artwork's 16 colours come from `thumbnail.lqip`, a 4×5 or 8×5 pixel GIF. That is already
  an average, so more saturated per-cell colours cannot be recovered from it. Do not try.
- The spec says "Colour comes only from the artworks." This plan keeps that true for hue. It adds
  one fixed saturation multiplier (`uChroma`), which the README must state.

Conventions to match (see any file in `projects/latent-archive/src`): two-space indent, double quotes, semicolons,
trailing commas in multi-line literals, `for (let i = 0; i < n; i += 1)` loops, and comments that
state a constraint or a reason in one or two lines. British spelling in prose and comments
("colour"). Commit messages are one imperative sentence, for example
"Name the latent islands and polish the Latent Archive UI".

## Commands you will need

Run all of these from `projects/latent-archive`.

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Build | `npm run build` | exit 0, prints `✓ built in`. A "chunks are larger than 500 kB" warning is expected. |
| Tests (exists after step 5) | `npm test` | `# pass 7`, `# fail 0` |
| Syntax check | `node --check scripts/build-archive-data.mjs` | exit 0, no output |
| Data build | `npm run data` (or `ARCHIVE_CACHE=<path> npm run data`) | prints `wrote …latent-archive.bin` and `wrote …latent-archive.json` |

## Scope

**In scope** (the only files you may modify or create):

- `projects/latent-archive/src/dream/shaders.js`
- `projects/latent-archive/src/dream/DreamField.js`
- `projects/latent-archive/src/scene/ArchiveScene.js`
- `projects/latent-archive/scripts/build-archive-data.mjs`
- `projects/latent-archive/scripts/build-archive-data.test.mjs` (create)
- `projects/latent-archive/package.json` (one added script line)
- `projects/latent-archive/public/data/latent-archive.bin` and `projects/latent-archive/public/data/latent-archive.json` (regenerated by the build, never hand-edited)
- `projects/latent-archive/README.md`
- `docs/superpowers/specs/2026-09-25-latent-archive-design.md` (one bullet)

**Out of scope** (do NOT touch, even though they look related):

- `projects/latent-archive/package-lock.json`. No dependency changes. If `npm ci` modifies it, restore it with `git checkout`.
- `projects/latent-archive/src/main.js`, `src/styles.css`, `src/ui/*`, `src/archive/*`, `index.html`. The UI is a separate plan.
- The vertex shader's motion code (the `curl`, `snoise`, "breathing" and "Hallucination" blocks). Only the lines named below change.
- The other three projects under `projects/`.
- `projects/latent-archive/scripts/cache/`. Never commit anything from it.
- The `USER_AGENT` constant and the fetch code in the build script.

## Git workflow

- Branch: `advisor/001-latent-archive-pigment`, or the branch your worktree is already on.
- One commit per part: after step 4 ("Render Latent Archive pigment as opaque colour"), after
  step 6 ("Balance the Latent Archive sample by department and colour"), after step 7
  ("Describe the opaque pigment and the weighted sample").
- Do NOT push or open a pull request unless the operator told you to.

## Steps

Every edit is an exact find-and-replace. Each "Find" block occurs exactly once in its file. If a
block does not match, that is a STOP condition, not something to adapt.

### Step 1: Install and confirm the baseline builds

From `projects/latent-archive`, run `npm ci` then `npm run build`.

**Verify**: `npm run build` exits 0 and prints `✓ built in`.

### Step 2: Decode, lift and shade the pigment in the shaders

Edit `projects/latent-archive/src/dream/shaders.js`. The first three edits are in `vertexShader`, the fourth
replaces the whole `fragmentShader` body. What they do: pass view depth to the fragment stage;
give works outside the era filter the farthest depth and the hovered work the nearest, so opaque
pigment never hides what the viewer asked to see; soften the per-work twinkle, which reads as
flicker once pigment is opaque; decode sRGB, lift chroma, and shade each grain as a soft dome that
darkens with distance.

**Edit 1 of `projects/latent-archive/src/dream/shaders.js`.** Find this text (it occurs exactly once):

````js
varying float vGlow;

${noise}
````

Replace it with:

````js
varying float vGlow;
varying float vDepth;

${noise}
````

**Edit 2 of `projects/latent-archive/src/dream/shaders.js`.** Find this text (it occurs exactly once):

````js
  gl_Position = projectionMatrix * mv;
````

Replace it with:

````js
  gl_Position = projectionMatrix * mv;
  // Opaque pigment needs depth priority: works outside the era fall to the back and the
  // recalled work comes to the front, so nothing hides what the viewer asked to see.
  gl_Position.z = mix(gl_Position.z, gl_Position.w * 0.999, (1.0 - inEra) * (1.0 - isHover));
  gl_Position.z = mix(gl_Position.z, -gl_Position.w * 0.999, isHover);
````

**Edit 3 of `projects/latent-archive/src/dream/shaders.js`.** Find this text (it occurs exactly once):

````js
  vAlpha = mix(0.035, 1.0, inEra) * (0.72 + 0.28 * sin(uTime * 0.6 + aSeed * 40.0));
````

Replace it with:

````js
  vDepth = -mv.z;
  vAlpha = mix(0.035, 1.0, inEra) * (0.86 + 0.14 * sin(uTime * 0.6 + aSeed * 40.0));
````

**Edit 4 of `projects/latent-archive/src/dream/shaders.js`.** Find this text (it occurs exactly once):

````js
uniform float uIntensity;
uniform float uHasHover;

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float falloff = core * core;

  // Lift dark pigments (multiplicatively) so near-black paintings still read as embers.
  vec3 color = pow(vColor, vec3(0.8)) * 1.1;
  color = mix(color, vec3(1.0), vGlow * 0.35);

  float dim = mix(1.0, mix(0.35, 1.8, vGlow), uHasHover);
  gl_FragColor = vec4(color * falloff * uIntensity * vAlpha * dim, 1.0);
}
````

Replace it with:

````js
uniform float uIntensity;
uniform float uHasHover;
uniform float uChroma;    // 1 = the stored colour, above 1 pushes each pigment away from its own grey
uniform float uCameraZ;   // camera distance, the centre of the depth fade
uniform float uDepthFloor; // brightness of the farthest pigment

varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
varying float vDepth;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);

  // The cells are sRGB bytes. Decode them so the output pass does not encode them twice,
  // which washed every pigment toward white.
  vec3 color = srgbToLinear(vColor);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = max(vec3(0.0), mix(vec3(luma), color, uChroma));
  color = mix(color, vec3(1.0), vGlow * 0.35);

  // Pigment is matter, not light: each grain is an opaque soft dome that darkens with distance.
  float dome = 0.55 + 0.45 * core;
  float depthFade = mix(uDepthFloor, 1.0, smoothstep(uCameraZ + 46.0, uCameraZ - 30.0, vDepth));
  float dim = mix(1.0, mix(0.35, 1.8, vGlow), uHasHover);
  gl_FragColor = vec4(color * dome * depthFade * uIntensity * vAlpha * dim, 1.0);
}
````

**Verify**: `grep -c "srgbToLinear\|uChroma\|uCameraZ\|uDepthFloor\|vDepth" src/dream/shaders.js` prints `10`,
and `grep -c "falloff" src/dream/shaders.js` prints `0`.

### Step 3: Make the point material opaque

Edit `projects/latent-archive/src/dream/DreamField.js`. The material stops blending and starts writing depth, and
gains the three uniforms the new fragment shader reads. `uIntensity` rises from 0.3 to 1.05
because a grain now shows its own colour once instead of being one of many summed layers.

**Edit 1 of `projects/latent-archive/src/dream/DreamField.js`.** Find this text (it occurs exactly once):

````js
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
````

Replace it with:

````js
      transparent: false,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NoBlending,
````

**Edit 2 of `projects/latent-archive/src/dream/DreamField.js`.** Find this text (it occurs exactly once):

````js
        uPointSize: { value: 3.2 },
````

Replace it with:

````js
        uPointSize: { value: 3.4 },
````

**Edit 3 of `projects/latent-archive/src/dream/DreamField.js`.** Find this text (it occurs exactly once):

````js
        uIntensity: { value: 0.3 },
````

Replace it with:

````js
        uIntensity: { value: 1.05 },
        uChroma: { value: 1.6 },
        uCameraZ: { value: 92 },
        uDepthFloor: { value: 0.4 },
````

**Verify**: `grep -c "AdditiveBlending" src/dream/DreamField.js` prints `0`, and
`grep -c "NoBlending\|uChroma\|uCameraZ\|uDepthFloor" src/dream/DreamField.js` prints `4`.

### Step 4: Fix the background, tone map, retune bloom, fit the camera

Edit `projects/latent-archive/src/scene/ArchiveScene.js`. What these do: replace the raw clear colour with a scene
background, which Three.js converts to the working colour space on every render; turn on neutral
tone mapping; lower bloom strength from 0.7 to 0.35 and raise its threshold from 0.16 to 0.8 so
only the lightest pigment glows; feed the camera distance to the shader; and pull the camera back
on portrait screens until the cloud fits across the width.

**Edit 1 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
const PICK_RADIUS_PX = 16;
````

Replace it with:

````js
const PICK_RADIUS_PX = 16;
const HOME_Z = 92; // camera distance on a landscape screen
const FIT_RADIUS = 34; // the latent cloud's 95th-percentile radius, set by the data build
````

**Edit 2 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
    this.zoomLimits = { min: 18, max: 150 };
````

Replace it with:

````js
    this.zoomLimits = { min: 18, max: 150 };
    this.homeZ = HOME_Z;
````

**Edit 3 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
    this.renderer.setClearColor(0x020206, 1);
````

Replace it with:

````js
    // A scene background is converted to the working colour space on every render. A raw clear
    // colour is not, and came out as navy once the output pass encoded it.
    this.scene.background = new THREE.Color(0x020206);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
````

**Edit 4 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.42, 0.16);
````

Replace it with:

````js
new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.42, 0.8);
````

**Edit 5 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
    u.uDream.value = this.dream;
````

Replace it with:

````js
    u.uDream.value = this.dream;
    u.uCameraZ.value = this.camera.position.z;
````

**Edit 6 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
    this.camera.position.set(0, 0, 92);
````

Replace it with:

````js
    this.camera.position.set(0, 0, this.homeZ);
````

**Edit 7 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
````

Replace it with:

````js
    this.camera.updateProjectionMatrix();
    this.fitHome();
    this.renderer.setSize(width, height, false);
````

**Edit 8 of `projects/latent-archive/src/scene/ArchiveScene.js`.** Find this text (it occurs exactly once):

````js
  render() {
    this.composer.render();
  }
````

Replace it with:

````js
  // Pull the camera back on narrow screens until the whole cloud fits across the width.
  fitHome() {
    const atHome = Math.abs(this.camera.position.z - this.homeZ) < 0.01;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const fitZ = FIT_RADIUS / (Math.tan(halfFov) * Math.min(1, this.camera.aspect));
    this.homeZ = Math.max(HOME_Z, fitZ);
    this.zoomLimits.max = Math.max(150, this.homeZ * 1.4);
    if (atHome) this.camera.position.z = this.homeZ;
  }

  render() {
    this.composer.render();
  }
````

**Verify**: `npm run build` exits 0. `grep -c "setClearColor" src/scene/ArchiveScene.js` prints `0`.
`grep -c "NeutralToneMapping\|scene.background\|fitHome\|uCameraZ" src/scene/ArchiveScene.js` prints `6`.

Commit: `Render Latent Archive pigment as opaque colour`.

### Step 5: Replace the uniform shuffle with a balanced, colour-weighted draw

Edit `projects/latent-archive/scripts/build-archive-data.mjs`. `sampleWorks` becomes an exported function that
gives each department a quota growing as its size to the power 0.6, and inside a department draws
works with probability weighted by their colour (CIELAB chroma, with rare hues counting for more).
It uses the existing helpers `gridRgb`, `rgbToLab`, `mulberry32` and `plausibleYear`, which are
already defined in the file. Do not redefine them.

**Edit 1 of `projects/latent-archive/scripts/build-archive-data.mjs`.** Find this text (it occurs exactly once):

````js
const YEAR_RANGE = [-8000, 2030]; // AIC has a few corrupt date_start values (e.g. 1486490)
````

Replace it with:

````js
const YEAR_RANGE = [-8000, 2030]; // AIC has a few corrupt date_start values (e.g. 1486490)
const SAMPLE_DEPT_POWER = 0.6; // a department's quota grows as size^0.6, so large ones shrink
const SAMPLE_COLOUR_POWER = 2; // how strongly colourful works are preferred inside a department
const SAMPLE_HUE_POWER = 0.5; // how strongly rare hues (blues, greens) are preferred
const HUE_BINS = 12;
````

**Edit 2 of `projects/latent-archive/scripts/build-archive-data.mjs`.** Find this text (it occurs exactly once):

````js
  console.log(`sample: ${sample.length.toLocaleString()} artworks → ${(sample.length * CELLS).toLocaleString()} pigment particles`);
````

Replace it with:

````js
  console.log(`sample: ${sample.length.toLocaleString()} artworks → ${(sample.length * CELLS).toLocaleString()} pigment particles`);
  console.log(sampleSummary(sample));
````

**Edit 3 of `projects/latent-archive/scripts/build-archive-data.mjs`.** Find this text (it occurs exactly once):

````js
function sampleWorks(works, target) {
  const random = mulberry32(SEED);
  const shuffled = works
    .filter((work) => work.grid?.length === CELLS * 6 && plausibleYear(work.year))
    .map((work) => ({ work, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, target)
    .map(({ work }) => work);
  return shuffled.sort((a, b) => a.year - b.year || a.id - b.id);
}
````

Replace it with:

````js
// A department-balanced, colour-weighted draw. A uniform shuffle returns the collection's own
// proportions, which are two-fifths prints and drawings and mostly the colour of paper. Here each
// department gets a quota that grows slower than its size, and inside a department colourful
// works are more likely to be drawn (weighted sampling without replacement, Efraimidis–Spirakis).
export function sampleWorks(works, target) {
  const random = mulberry32(SEED);
  const pool = works
    .filter((work) => work.grid?.length === CELLS * 6 && plausibleYear(work.year))
    .sort((a, b) => a.id - b.id);
  const labs = pool.map(cellLab);

  // How much of the pool's chroma each hue holds. Hues that hold little count for more.
  const hueMass = new Array(HUE_BINS).fill(0);
  for (const cells of labs) {
    for (const [, a, b] of cells) hueMass[hueBin(a, b)] += Math.hypot(a, b);
  }
  const mass = hueMass.reduce((sum, value) => sum + value, 0) || 1;
  const rarity = hueMass.map((value) => (1 / Math.max(value / mass, 0.005)) ** SAMPLE_HUE_POWER);
  const rarityMean = hueMass.reduce((sum, value, bin) => sum + (value / mass) * rarity[bin], 0) || 1;

  const groups = new Map();
  pool.forEach((work, index) => {
    let colour = 0;
    for (const [, a, b] of labs[index]) {
      colour += (Math.hypot(a, b) * rarity[hueBin(a, b)]) / rarityMean / CELLS;
    }
    const weight = (1 + colour) ** SAMPLE_COLOUR_POWER;
    const entry = { work, key: random() ** (1 / weight) }; // a larger key is drawn first
    if (!groups.has(work.department)) groups.set(work.department, []);
    groups.get(work.department).push(entry);
  });

  const departments = [...groups.keys()].sort();
  for (const department of departments) {
    groups.get(department).sort((a, b) => b.key - a.key || a.work.id - b.work.id);
  }

  // Deal the target out in rounds. A department that runs out of works drops out and its
  // share is dealt again to the ones that still have room.
  const quota = new Map(departments.map((department) => [department, 0]));
  let remaining = Math.min(target, pool.length);
  let open = departments;
  while (remaining > 0 && open.length) {
    const total = open.reduce((sum, department) => sum + groups.get(department).length ** SAMPLE_DEPT_POWER, 0);
    let dealt = 0;
    for (const department of open) {
      const size = groups.get(department).length;
      const share = Math.max(1, Math.floor((remaining * size ** SAMPLE_DEPT_POWER) / total));
      const give = Math.min(size - quota.get(department), remaining - dealt, share);
      quota.set(department, quota.get(department) + give);
      dealt += give;
    }
    if (dealt === 0) break;
    remaining -= dealt;
    open = open.filter((department) => quota.get(department) < groups.get(department).length);
  }

  return departments
    .flatMap((department) => groups.get(department).slice(0, quota.get(department)).map(({ work }) => work))
    .sort((a, b) => a.year - b.year || a.id - b.id);
}

function cellLab(work) {
  const rgb = gridRgb(work);
  const cells = [];
  for (let c = 0; c < CELLS; c += 1) {
    cells.push(rgbToLab(rgb[c * 3], rgb[c * 3 + 1], rgb[c * 3 + 2]));
  }
  return cells;
}

function hueBin(a, b) {
  const turn = (Math.atan2(b, a) / (Math.PI * 2) + 1) % 1;
  return Math.floor(turn * HUE_BINS) % HUE_BINS;
}

// One line for the build log: mean CIELAB chroma and the three largest departments.
export function sampleSummary(sample) {
  let chroma = 0;
  const counts = new Map();
  for (const work of sample) {
    for (const [, a, b] of cellLab(work)) chroma += Math.hypot(a, b) / CELLS;
    counts.set(work.department, (counts.get(work.department) || 0) + 1);
  }
  const top = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([department, count]) => `${department} ${Math.round((count / sample.length) * 100)}%`);
  return `  mean chroma ${(chroma / Math.max(1, sample.length)).toFixed(1)} · ${top.join(", ")}`;
}
````

Then add the test script to `projects/latent-archive/package.json`:

**Edit 1 of `projects/latent-archive/package.json`.** Find this text (it occurs exactly once):

````json
    "data": "node scripts/build-archive-data.mjs"
````

Replace it with:

````json
    "data": "node scripts/build-archive-data.mjs",
    "test": "node --test scripts/build-archive-data.test.mjs"
````

Then create `projects/latent-archive/scripts/build-archive-data.test.mjs` with exactly this content:

````js
import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleWorks } from "./build-archive-data.mjs";

const GREY = "808080".repeat(16);
const RED = "c02020".repeat(16);
const BLUE = "2040c0".repeat(16);

function work(id, department, grid, year = 1800) {
  return { id, department, grid, year };
}

// 1,000 prints (900 grey, 100 red) and 100 textiles (half red, half blue).
function collection() {
  const works = [];
  let id = 1;
  for (let i = 0; i < 900; i += 1) works.push(work(id++, "Prints", GREY, 1500 + (i % 400)));
  for (let i = 0; i < 100; i += 1) works.push(work(id++, "Prints", RED, 1500 + (i % 400)));
  for (let i = 0; i < 100; i += 1) works.push(work(id++, "Textiles", i % 2 ? RED : BLUE, 1600 + i));
  return works;
}

const share = (sample, test) => sample.filter(test).length / sample.length;

test("returns exactly the target, without duplicates, sorted by year then id", () => {
  const sample = sampleWorks(collection(), 200);
  assert.equal(sample.length, 200);
  assert.equal(new Set(sample.map((w) => w.id)).size, 200);
  for (let i = 1; i < sample.length; i += 1) {
    const [a, b] = [sample[i - 1], sample[i]];
    assert.ok(a.year < b.year || (a.year === b.year && a.id < b.id));
  }
});

test("draws the same works every time, whatever order the cache is in", () => {
  const first = sampleWorks(collection(), 200).map((w) => w.id);
  const second = sampleWorks(collection().reverse(), 200).map((w) => w.id);
  assert.deepEqual(first, second);
});

test("a small department gets more than its proportional share", () => {
  const sample = sampleWorks(collection(), 200);
  const textiles = share(sample, (w) => w.department === "Textiles");
  assert.ok(textiles > 0.15, `textiles are 9% of the pool, got ${textiles}`);
  assert.ok(textiles < 0.5, `prints must stay the majority, got ${textiles}`);
});

test("colourful works are preferred inside a department", () => {
  const prints = sampleWorks(collection(), 200).filter((w) => w.department === "Prints");
  const red = share(prints, (w) => w.grid === RED);
  assert.ok(red > 0.25, `red prints are 10% of the pool's prints, got ${red}`);
});

test("a rare hue is preferred over a common one of similar chroma", () => {
  const textiles = sampleWorks(collection(), 200).filter((w) => w.department === "Textiles");
  const blue = share(textiles, (w) => w.grid === BLUE);
  assert.ok(blue > 0.5, `blue is half of the textiles, got ${blue}`);
});

test("returns the whole pool when the target is larger than it", () => {
  const works = collection();
  const sample = sampleWorks(works, 5000);
  assert.equal(sample.length, works.length);
  assert.equal(new Set(sample.map((w) => w.id)).size, works.length);
});

test("skips works with a broken miniature or an implausible year", () => {
  const works = [work(1, "Prints", GREY), work(2, "Prints", "80"), work(3, "Prints", RED, 1486490)];
  assert.deepEqual(sampleWorks(works, 10).map((w) => w.id), [1]);
});
````

**Verify**: `node --check scripts/build-archive-data.mjs` exits 0 with no output, and `npm test`
prints `# pass 7` and `# fail 0`.

### Step 6: Regenerate the committed data

From `projects/latent-archive`, run `npm run data`. If you were given a cache path, run
`ARCHIVE_CACHE=<absolute path> npm run data` instead. If you were not, the script fetches the
collection first (about 15 minutes). Let it finish.

**Verify** the build log contains this line exactly:

````text
  mean chroma 13.1 · Prints and Drawings 28%, Arts of Asia 15%, Textiles 12%
````

Then run this check from `projects/latent-archive`:

````sh
node --input-type=module -e '
import { readFileSync } from "node:fs";
const buf = readFileSync("public/data/latent-archive.bin");
const meta = JSON.parse(readFileSync("public/data/latent-archive.json", "utf8"));
const n = meta.count;
const colors = new Uint8Array(buf.buffer, buf.byteOffset + 16 + n * 24, n * 48);
let sat = 0;
for (let i = 0; i < colors.length; i += 3) {
  const mx = Math.max(colors[i], colors[i + 1], colors[i + 2]);
  const mn = Math.min(colors[i], colors[i + 1], colors[i + 2]);
  sat += mx ? (mx - mn) / mx : 0;
}
const counts = new Map();
for (const d of meta.works.department) counts.set(d, (counts.get(d) || 0) + 1);
const largest = Math.max(...counts.values()) / n;
console.log("count=" + n, "meanSaturation=" + (sat / (colors.length / 3)).toFixed(3), "largestDepartment=" + largest.toFixed(3), "islands=" + meta.islands.length);
'
````

Expected output: `count=20000 meanSaturation=0.212 largestDepartment=0.277 islands=11`.
Before this plan the same check printed `count=20000 meanSaturation=0.172 largestDepartment=0.435 islands=11`.

Also confirm `git status --short scripts/cache` prints nothing.

Commit the script, the test, `package.json` and both data files:
`Balance the Latent Archive sample by department and colour`.

### Step 7: Bring the README and the spec in line

**Edit 1 of `projects/latent-archive/README.md`.** Find this text (it occurs exactly once):

````markdown
- Each work's `thumbnail.lqip` (a tiny base64 GIF the API ships with every record) is decoded and averaged into a **4×4 grid of real colours**. The 16 cells are the work's pigments. No full images are downloaded at build time.
````

Replace it with:

````markdown
- Each work's `thumbnail.lqip` (a tiny base64 GIF the API ships with every record) is decoded and averaged into a **4×4 grid of real colours**. The 16 cells are the work's pigments. No full images are downloaded at build time.
- The 20,000 works are not a uniform sample. A uniform draw returns the collection's own proportions: 43% prints and drawings, mostly the colour of paper. Each department instead gets a quota that grows as its size to the power 0.6, which brings Prints and Drawings down to about 28%, and inside a department colourful works and rare hues are more likely to be drawn. The draw is seeded, so every build picks the same works. `npm test` checks the sampler.
````

**Edit 2 of `projects/latent-archive/README.md`.** Find this text (it occurs exactly once):

````markdown
- One artwork → a 4×4 mosaic of its own colours, always facing the viewer
````

Replace it with:

````markdown
- One artwork → a 4×4 mosaic of its own colours, always facing the viewer
- Pigment is opaque: each cell is drawn in its own colour, with depth, so dense regions stay coloured instead of adding up to white. Saturation is lifted by one fixed factor (`uChroma`, 1.6 in `src/dream/DreamField.js`); hue is never changed
````

**Edit 1 of `docs/superpowers/specs/2026-09-25-latent-archive-design.md`.** Find this text (it occurs exactly once):

````markdown
- Additive glow with half-resolution bloom on a near-black background.
````

Replace it with:

````markdown
- Opaque, depth-tested pigment with a light half-resolution bloom on a near-black background. Cell colours are decoded from sRGB, lifted in chroma by one fixed factor and tone mapped. (Amended 2026-11-11: the first build used additive glow, which summed to white.)
````

**Verify** (from the repo root): `grep -c "not a uniform sample\|Pigment is opaque" projects/latent-archive/README.md`
prints `2`, and `grep -c "Additive glow" docs/superpowers/specs/2026-09-25-latent-archive-design.md` prints `0`.

Commit: `Describe the opaque pigment and the weighted sample`.

### Step 8: Final gate

From `projects/latent-archive`: `npm test` and `npm run build`.

**Verify**: `# pass 7`, `# fail 0`, and `✓ built in`. From the repo root,
`git status --short` prints nothing, and `git diff --stat a98e0cf..HEAD` lists only files from
the in-scope list.

## Test plan

- New file `projects/latent-archive/scripts/build-archive-data.test.mjs`, using Node's built-in `node:test` runner
  (no new dependency). It builds a synthetic collection of 1,000 prints (900 grey, 100 red) and
  100 textiles (half red, half blue) and checks seven behaviours of `sampleWorks`: exact count
  with no duplicates and year-then-id order; the same draw whatever order the cache is in; a small
  department gets more than its proportional share but not a majority; colourful works are
  preferred inside a department; a rare hue is preferred over a common one; a target larger than
  the pool returns the pool; works with a broken miniature or an implausible year are skipped.
- The shader and scene changes have no automated test in this repo. Their gate is the build plus
  the grep counts above. The reviewer checks rendered frames separately.
- Verification: `npm test` → `# pass 7`, `# fail 0`.

## Done criteria

ALL must hold:

- [ ] `npm run build` in `projects/latent-archive` exits 0
- [ ] `npm test` in `projects/latent-archive` prints `# pass 7` and `# fail 0`
- [ ] `grep -rn "AdditiveBlending\|setClearColor" projects/latent-archive/src` returns no matches
- [ ] The step 6 check prints `count=20000 meanSaturation=0.212 largestDepartment=0.277 islands=11`
- [ ] `git diff --stat a98e0cf..HEAD` lists only in-scope files, and nothing under `scripts/cache`
- [ ] `projects/latent-archive/package-lock.json` is unchanged (`git diff a98e0cf..HEAD -- projects/latent-archive/package-lock.json` is empty)
- [ ] `plans/README.md` status row updated (skip if a reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Find this text" block does not occur exactly once in its file.
- `npm ci` fails, or changes `package-lock.json` in a way `git checkout` does not undo.
- `npm run data` cannot reach `api.artic.edu` and you were not given a cache path.
- The step 6 check prints different numbers. The build is seeded, so a difference means the cache
  or the code differs from what this plan was tested against. Report the numbers you got.
- A verification fails twice after one reasonable fix attempt.
- A fix appears to need a file outside the in-scope list, or a new dependency.

## Maintenance notes

- **Tuning lives in three places.** Look: `uChroma` (1.6), `uIntensity` (1.05), `uDepthFloor`
  (0.4) and `uPointSize` (3.4) in `DreamField.js`, and the bloom arguments in `ArchiveScene.js`.
  Sample: the three `SAMPLE_*` constants in the build script. Raising `SAMPLE_COLOUR_POWER` above
  about 3 gains little (the measured ceiling for stored saturation is about 0.24) and makes the
  sample less representative.
- **`FIT_RADIUS` (34) mirrors `normalizeCloud(…, 34)` in the build script.** If one changes, change the other.
- **Opaque pigment depends on depth.** Anything added to the scene later that should sit over the
  pigment needs its own depth handling. The era filter and hover rely on the two
  `gl_Position.z` lines in the vertex shader.
- **Changing the sample changes the island labels**, because they are derived from the layout.
  That is expected: labels now include, for example, "Paperweights" and "Portraits".
- **Deferred, on purpose**: richer per-cell colour. It needs real thumbnails, and the museum's
  image server returned HTTP 521 to build-time requests and blocks cross-site browser requests.
  Revisit with a collection whose images are openly served.
- **What a reviewer should look at**: rendered frames of all three states on desktop and at phone
  width, the era slider, and hover. Expect a near-black ground, visible reds, blues and ochres, and
  no white blow-out.
