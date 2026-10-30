# Redshift Tunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `Redshift Tunnel`: a full-screen Three.js light tunnel of about 600k real DESI DR1 galaxies and quasars. Each object sits at its own lookback time, in its own redshift colour, and emits faint streaks of light that flow toward a glowing core.

**Architecture:** A Vite project at `projects/redshift-tunnel`, mirroring `projects/latent-archive`. A Node script downloads DESI DR1 LSS clustering catalogues, parses only `TARGETID`, `RA`, `DEC` and `Z` from the FITS files with a small in-repo reader, computes lookback time, samples uniformly, and writes a columnar binary. The app computes positions and colours once in JS (pure, tested). All motion is analytic in the vertex shader: one `THREE.Points` for the fixed objects and one for the photon streaks, plus a core glow and `UnrealBloomPass`.

**Tech Stack:** Vite, `three@^0.164.1` (`EffectComposer`, `UnrealBloomPass`), vanilla JS modules, `node:test`, and Playwright (pre-installed) for screenshots. There are no other dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-redshift-tunnel-design.md`

## Global Constraints

- Motion runs from the screen edges toward the center. It is slow and meditative and never strobes.
- Colour is monotonic in `z`: deep red at the highest `z`, through amber and white, to blue-white at the lowest `z`.
- Objects never move from their own lookback position (only a small drift is allowed). The streaks carry the emitting object's colour and fade before reaching the core.
- Sampling is uniform over the deduplicated catalogue, with no `z` reweighting.
- The radial or depth mapping may be eased, but it must stay strictly monotonic in lookback time.
- Cosmology: flat ΛCDM, `H0 = 67.7`, `Ωm = 0.31`.
- Committed `public/data/` totals under 15 MB. The raw cache lives in `scripts/cache/`, which is gitignored with the same pattern as `projects/latent-archive/scripts/cache/.gitignore`.
- There is no runtime network access.
- Fewer than 10 labels are visible at once, in the format `7.2 Gyr`, in Geist Mono.
- `prefers-reduced-motion` cuts flow speed to 0.15× and disables parallax.
- Fonts: `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`. The UI uses one quiet accent and near-black (`#05060a`).

## Review Focus

1. **The FITS file is big-endian with a header padded to 2880-byte blocks.** A reader that ignores `NAXIS1` row stride or endianness yields garbage `z`. Task 2 tests a synthetic file with multiple header blocks.
2. **Objects appear in several tracer catalogues** (for example, LRG and ELG). Duplicates would inflate the density bands. Task 3 dedupes by `TARGETID` and tests it.
3. **A partially downloaded cache file** after an interrupted run would parse as a truncated table. Task 3 downloads to `*.part`, checks `Content-Length`, then renames, and skips a cached file only when its size matches.
4. **A tab that is hidden then shown, or a huge frame delta,** makes the photons jump. Task 5 clamps `dt` to 0.1 s and uses accumulated time, not `performance.now()` directly.
5. **Mobile and small screens.** Point size must scale with viewport height, DPR is capped at 1.75, and controls must stay reachable at 360 px width. Task 7's mobile screenshot pins this.

---

## File Structure

- `projects/redshift-tunnel/package.json`: scripts `dev`, `build`, `preview`, `data`, `test` (`node --test test/`)
- `projects/redshift-tunnel/vite.config.js`, `index.html`, `README.md`
- `scripts/lib/cosmology.mjs`: `lookbackGyr(z)`
- `scripts/lib/fits.mjs`: `readFitsColumns(buffer, names)`
- `scripts/lib/encode.mjs`: `encodeTunnel(objects)`. The decoder lives in `src/data/loadTunnel.js` and the two share the layout constants in `src/data/layout.js`.
- `scripts/build-tunnel-data.mjs`: download, cache, parse, dedupe, sample and write
- `scripts/cache/.gitignore`
- `public/data/redshift-tunnel.bin`, `public/data/redshift-tunnel.json`: generated, committed
- `src/data/layout.js`, `src/data/loadTunnel.js`
- `src/tunnel/mapping.js`: depth, angle, radius and colour ramp (pure)
- `src/tunnel/shaders.js`: GLSL strings
- `src/tunnel/TunnelField.js`: the anchor and photon `Points`
- `src/scene/TunnelScene.js`: renderer, camera, composer, core glow, loop, parallax
- `src/ui/labels.js`, `src/ui/controls.js`, `src/main.js`, `src/styles.css`
- `test/*.test.mjs`
- Root `README.md`: add the project link

## Data Notes

- Source: `https://data.desi.lbl.gov/public/dr1/survey/catalogs/dr1/LSS/iron/LSScats/v1.5/`. Files are `{BGS_ANY,LRG,ELG_LOPnotqso,QSO}_{NGC,SGC}_clustering.dat.fits`: 8 files, about 1.26 GB in total, all with confident redshifts.
- Each tracer has a `z` window (roughly BGS 0.1–0.4, LRG 0.4–1.1, ELG 0.8–1.6, QSO 0.8–2.1), so lookback spans about 1.3 to 10.7 Gyr. These windows are the "bands" the About panel describes.
- Binary columns, in order: `z` as Float32, `lookback` (Gyr) as Float32, `ra` (deg) as Float32, `dec` (deg) as Float32, and `tracer` as Uint8 (0 BGS, 1 LRG, 2 ELG, 3 QSO). That's 17 bytes per object, about 10 MB at 600k.
- JSON: `{ count, columns: [{ name, type, offset }], zMin, zMax, lookbackMin, lookbackMax, tracerCounts, source, builtAt, seed }`
- `DEFAULT_SAMPLE = 600_000`, overridable with the `TUNNEL_SAMPLE` env var. The seeded PRNG (mulberry32, seed `1998`) makes rebuilds identical.
- Downloads use Node `fetch`. Run the script with `NODE_USE_ENV_PROXY=1` (this goes in the npm script) so the agent proxy is honoured.

---

### Task 1: Scaffold and cosmology

**Files:**
- Create: `projects/redshift-tunnel/{package.json,vite.config.js,index.html,README.md}`, `scripts/cache/.gitignore`, `scripts/lib/cosmology.mjs`, `test/cosmology.test.mjs`

**Interfaces:**
- Produces: `lookbackGyr(z: number) => number`, using the closed form `t = (2 / (3·H0·√ΩΛ)) · [asinh(√(ΩΛ/Ωm)) − asinh(√(ΩΛ/Ωm)·(1+z)^−1.5)]` with `1/H0 = 977.79222 / 67.7` Gyr.

- [ ] **Step 1:** Copy `package.json`, `vite.config.js` and `index.html` from `projects/latent-archive`, then rename the project to `redshift-tunnel`. Set `"data": "NODE_USE_ENV_PROXY=1 node scripts/build-tunnel-data.mjs"` and `"test": "node --test test/"`. Run `npm install`.
- [ ] **Step 2:** Write `test/cosmology.test.mjs` with these asserts:
  - `lookbackGyr(0) === 0`
  - `lookbackGyr(0.1) ≈ 1.345`
  - `lookbackGyr(1) ≈ 7.936`
  - `lookbackGyr(2) ≈ 10.513`
  - `lookbackGyr(3) ≈ 11.648` (all within ±0.01)
  - It is strictly increasing over `z = 0..4` in steps of 0.05.
  - `lookbackGyr(1e9) < 13.8`
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module missing).
- [ ] **Step 4:** Implement `scripts/lib/cosmology.mjs`.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit with the message `Add Redshift Tunnel scaffold and cosmology`.

### Task 2: FITS binary table reader

**Files:**
- Create: `scripts/lib/fits.mjs`, `test/fits.test.mjs`

**Interfaces:**
- Produces: `readFitsColumns(buf: Buffer, names: string[]) => { rows: number, columns: Record<string, Float64Array | BigInt64Array> }`. It finds the first `XTENSION = 'BINTABLE'` HDU, parses `NAXIS1`, `NAXIS2` and `TTYPEn`/`TFORMn` with widths `K=8, D=8, E=4, J=4, I=2, B=1, L=1, nA=n`, and reads the requested columns big-endian at row stride `NAXIS1`. It throws a descriptive error for a missing column or an unsupported TFORM in a requested column. `K` columns become `BigInt64Array`, and `D` or `E` columns become `Float64Array`.

- [ ] **Step 1:** Write `test/fits.test.mjs`. The test helper `makeFits(rows)` builds a valid file in memory: a primary HDU, then a BINTABLE whose header has enough cards to spill past one 2880-byte block. Its columns are `TARGETID K`, `PHOTSYS 1A`, `RA D`, `DEC D` and `Z D`, which gives `NAXIS1 = 33`. Asserts:
  - Three rows round-trip to their exact values.
  - Reading `['Z']` alone works.
  - Requesting `'NOPE'` throws `/NOPE/`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `readFitsColumns`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Run a real-file smoke test. Fetch the first 28 800 bytes of `QSO_SGC_clustering.dat.fits` with a `Range` header and confirm the header parse (header only) reports the `Z` column at the right byte offset.
- [ ] **Step 6:** Commit with the message `Add minimal FITS binary table reader`.

### Task 3: Data build

**Files:**
- Create: `src/data/layout.js`, `scripts/lib/encode.mjs`, `src/data/loadTunnel.js`, `scripts/build-tunnel-data.mjs`, `test/encode.test.mjs`, `test/sample.test.mjs`
- Generated: `public/data/redshift-tunnel.{bin,json}`

**Interfaces:**
- Consumes: `lookbackGyr`, `readFitsColumns`
- Produces:
  - `TRACERS = ['BGS', 'LRG', 'ELG', 'QSO']` and `COLUMNS = [{ name: 'z', type: 'f32' }, { name: 'lookback', type: 'f32' }, { name: 'ra', type: 'f32' }, { name: 'dec', type: 'f32' }, { name: 'tracer', type: 'u8' }]` in `layout.js`
  - `encodeTunnel({ z, lookback, ra, dec, tracer }) => { bin: Buffer, meta }`, columnar, each column 4-byte aligned
  - `decodeTunnel(arrayBuffer, meta) => { count, z: Float32Array, lookback: Float32Array, ra: Float32Array, dec: Float32Array, tracer: Uint8Array }`
  - `loadTunnel(baseUrl) => Promise<ReturnType<decodeTunnel>>`
  - In the build script, exported for tests: `dedupeByTargetId(records) => records` (keeps the first occurrence) and `sampleUniform(n, count, seed) => Uint32Array` (sorted, unique indices; returns all indices when `count ≤ n`)

- [ ] **Step 1:** Write the tests:
  - The encode→decode round trip preserves values (f32 precision) and `count`.
  - `meta.columns` offsets are multiples of 4.
  - `dedupeByTargetId` on ids `[5n, 7n, 5n]` keeps 2 records and the first `z`.
  - `sampleUniform(3, 10, 1998)` returns the same output twice, with 3 unique sorted values all `< 10`.
  - `sampleUniform(20, 10, 1998).length === 10`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `layout.js`, `encode.mjs`, `loadTunnel.js` and the two helpers.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Implement the `build-tunnel-data.mjs` main path. It downloads each of the 8 files to `scripts/cache/<name>.part`, verifies `Content-Length`, then renames the file. A cached file whose size matches is skipped. The script parses `TARGETID`, `RA`, `DEC` and `Z`, tags each record with its tracer, dedupes, samples `TUNNEL_SAMPLE ?? 600_000`, computes lookback and writes both outputs. It prints the count per tracer, the `z` range, the lookback range and the file sizes. `--refresh` re-downloads.
- [ ] **Step 6:** Run `npm run data`. Expected: about 600 000 objects, `z` from about 0.1 to 2.1, `.bin` under 15 MB. A second run makes no downloads.
- [ ] **Step 7:** Commit the code and `public/data/` with the message `Bundle DESI DR1 redshift sample`.

### Task 4: Tunnel mapping

**Files:**
- Create: `src/tunnel/mapping.js`, `test/mapping.test.mjs`

**Interfaces:**
- Consumes: the `decodeTunnel` result plus `meta.lookbackMin` and `meta.lookbackMax`
- Produces:
  - `TUNNEL = { length: 120, radius: 9, radiusJitter: 2.2 }`
  - `depthFor(lookback, min, max) => number`. It returns `0` at `max`, nearest the camera, and `-TUNNEL.length` at `min`. It is eased with `u^0.8` on normalized lookback and is strictly monotonic.
  - `colorFor(z, zMin, zMax) => [r, g, b]` (linear, 0–1). It works on normalized `t = (z − zMin) / (zMax − zMin)` with these stops:
    - `0` → `#d6e4ff` (blue-white)
    - `0.3` → `#fff3e0` (white)
    - `0.55` → `#ffb257` (amber)
    - `0.8` → `#ff4f2e` (red-orange)
    - `1` → `#7a0d1c` (deep red)

    Luminance may change, but hue must move monotonically from blue toward red.
  - `buildAnchors(data, meta) => { positions: Float32Array, colors: Float32Array, seeds: Float32Array, sizes: Float32Array }` (`sizes` is `1.6` for QSO and `1.0` otherwise, so quasars read slightly brighter). The angle is `ra` in radians. The radius is `TUNNEL.radius + radiusJitter · sin(dec)` combined with a hash-based seed jitter, so `dec` forms the sheets. The depth comes from `depthFor`.

- [ ] **Step 1:** Write the tests:
  - `depthFor` hits its endpoints and is strictly decreasing as lookback goes from min to max over 200 samples. The far end gets the low lookback.
  - `colorFor(zMin)` ≈ `#d6e4ff` and `colorFor(zMax)` ≈ `#7a0d1c` (±1/255).
  - `r − b` is non-decreasing across 100 samples.
  - `buildAnchors` on a 3-object fixture returns arrays of length 9 / 9 / 3 / 3, a QSO fixture gets size 1.6, with every radius in `[radius − 2.2 − 1, radius + 2.2 + 1]`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `mapping.js`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit with the message `Map redshift to tunnel depth and colour`.

### Task 5: Render the tunnel

**Files:**
- Create: `src/tunnel/shaders.js`, `src/tunnel/TunnelField.js`, `src/scene/TunnelScene.js`, `src/main.js`, `src/styles.css`

**Interfaces:**
- Consumes: `loadTunnel`, `buildAnchors`, `TUNNEL`
- Produces:
  - `new TunnelScene(canvas)` with `.setData(anchors)`, `.setPaused(bool)`, `.setMotionScale(number)`, `.setParallax(enabled)`, `.camera`, `.field` (a `THREE.Group` that holds both point layers, used for label projection) and `.onFrame(cb)`
  - `TunnelField`, which builds:
    - **Anchors:** a `THREE.Points` with attributes `position`, `color`, `seed` and `size`. The vertex shader adds a small curl-noise drift (amplitude ≤ 0.35) and a slow twinkle. Size scales with `uViewportHeight` and with distance.
    - **Photons:** a second `THREE.Points` with 2 photons per anchor, sharing the anchor buffers and adding a `phase` attribute. The vertex shader computes `t = fract(uTime · speed · (0.6 + 0.8·seed) + phase)`. Each photon starts at its anchor, moves deeper (−z) by up to `22` units and inward by up to `35 %` of its radius, and its alpha is `smoothstep(0, 0.08, t) · (1 − t)^1.6 · 0.55`. So it is fully faded before travelling 22 units and never reaches the core, as long as the core sits beyond `-TUNNEL.length`.
  - Both layers use additive blending, `depthWrite: false`, and the `color` attribute unchanged (no hue shift).
  - The core is a camera-facing quad at `z = -TUNNEL.length - 10` with a radial glow shader, a soft blue-white centre and a faint iridescent ring.
  - The camera sits at `z = 14` on the axis, looking down −z, with FOV 70. The `field` group rotates about z at 0.01 rad/s, multiplied by the motion scale.
  - `EffectComposer` + `UnrealBloomPass` at half resolution with strength about 1.1, radius 0.6 and threshold 0.1. Tune these by eye.
  - DPR is capped at 1.75. The loop accumulates time with `dt` clamped to 0.1 s.

- [ ] **Step 1:** Implement the shaders, `TunnelField`, `TunnelScene` and `main.js`. `main.js` boots `loadTunnel('/data/')`, then calls `buildAnchors` and `setData`, and shows a minimal "Loading 600,000 galaxies…" line until the data is ready.
- [ ] **Step 2:** Run `npm run dev`. With a headless Playwright script at 1440×900, take screenshots at 3 s and 8 s and save them to the scratchpad. Expected: red edges, white-to-blue toward a bright core, visible inward streaks, a different photon pattern between the two frames, and no console errors.
- [ ] **Step 3:** Run `npm run build`. Expected: PASS.
- [ ] **Step 4:** Commit with the message `Render Redshift Tunnel anchors, photons and core`.

### Task 6: Labels, controls, About, motion preferences

**Files:**
- Create: `src/ui/labels.js`, `src/ui/controls.js`
- Modify: `src/main.js`, `src/styles.css`, `index.html`

**Interfaces:**
- Consumes: `TunnelScene` (`.camera`, `.field`, `.onFrame`, `.setPaused`, `.setMotionScale`, `.setParallax`), and the `lookback` array from the decoded data
- Produces:
  - `createLabels(root, scene, data, anchors, { max: 8 })`. Every 2.5 s it retires the oldest label and picks a random anchor whose projected position is on screen and at least 18 % of the viewport away from the centre. It shows `${lookback.toFixed(1)} Gyr` beside that anchor (12 px Geist Mono, 55 % opacity) with a 1.2 s fade. It re-projects the label every frame through `field.matrixWorld`. Labels are `aria-hidden="true"`.
  - `createControls(root, scene)`: Pause/Play (`Space`), Fullscreen (`F`) and About (`A`, closed with `Escape`) as real `<button>`s with `aria-label`s and `aria-pressed` on Pause. About is a `<dialog>`.
- About copy, written plainly, covers:
  - What redshift is.
  - That colour comes from each object's measured `z`.
  - That the streaks are light leaving each object.
  - Which bands are which tracer, with counts from `meta.tracerCounts`.
  - That the sample is a uniform, unweighted draw.
  - Credit: "DESI Data Release 1, LSS clustering catalogues v1.5" plus a link.
- Reduced motion: when `matchMedia('(prefers-reduced-motion: reduce)')` matches, call `setMotionScale(0.15)` and `setParallax(false)`. Listen for changes.
- Parallax: pointer or touch position tilts the camera by up to ±2.5° with eased follow.

- [ ] **Step 1:** Implement `labels.js`, `controls.js` and the wiring.
- [ ] **Step 2:** Run Playwright: press `Space` and confirm two screenshots 1 s apart are identical. Press `A` and confirm the dialog is open. Press `Escape` and confirm it closes. Count `.label` elements and confirm there are 8 or fewer, all matching `/^\d+\.\d Gyr$/`. Expected: all pass, with no console errors.
- [ ] **Step 3:** Run `npm run build`. Expected: PASS.
- [ ] **Step 4:** Commit with the message `Add lookback labels, controls and About`.

### Task 7: Docs and final verification

**Files:**
- Modify: `projects/redshift-tunnel/README.md`, root `README.md`

- [ ] **Step 1:** Write the README in the style of `projects/latent-archive/README.md`: concept, run steps (`npm install`, `npm run data`, `npm run dev`), data source and bands, the cache note and `TUNNEL_SAMPLE`. Add `- [Redshift Tunnel](projects/redshift-tunnel)` to the root README.
- [ ] **Step 2:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 3:** Take Playwright screenshots of the desktop (1440×900), mobile (390×844, controls visible and tappable) and reduced-motion (`reducedMotion: 'reduce'`) runs. Expected: the tunnel renders in all three, with no console errors.
- [ ] **Step 4:** Commit with the message `Document Redshift Tunnel` and push to `claude/sweet-ritchie-6yjjwn`.
