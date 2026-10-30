# Redshift Tunnel Design

## Concept

`Redshift Tunnel` is a light tunnel made of real galaxies and quasars. It takes the viewer through cosmic time. Light starts at the edges of the screen, deep red and ancient, and flows toward a glowing core at the center, which stands for "you, now." As the light approaches, it shifts from red through amber toward blue-white.

The colour is the data. Light from a distant object is stretched toward red in proportion to how far it has travelled (its redshift, `z`). Each point carries its own measured `z`, and its colour and position in the tunnel come from that value.

Inspiration (from the user):

- A dark gallery projection of white particle rivers with small floating numbers.
- Tiziana Alocci: a particle cloud pulling into thin curved sheets.
- kishimisu, *Eclipse*: iridescent GLSL rings around a dark core.
- The stargate sequence from *2001: A Space Odyssey*.

## Goals

- Moving and flowing at all times, with shades of colour melting into one another (the user's words).
- Motion runs from the sides toward the center. This direction is fixed.
- Slow and meditative, closer to a gallery projection than a warp-speed ride.
- Every point is a real catalogued object with a real redshift.
- Reads well full-screen on a laptop and on a large projection.

## Non-goals

- Not an astronomy explorer. There is no search, no sky map, and no catalogue browser.
- Not an exact sky position for each object. Angle around the tunnel can use RA/Dec for structure, but the piece does not claim to be a sky chart.
- No live fetching at runtime.

## Anti-goals (failure even if it works)

- A generic hyperspace or starfield screensaver with no visible link to the data.
- Rainbow colours that ignore `z`. The red-to-blue journey must follow redshift.
- Motion that is fast, jittery, or strobing.
- UI chrome that competes with the tunnel.

## Visual System

- Full-screen Three.js scene on near-black.
- One GPU point system of roughly 300k to 1M objects, sampled from the catalogue. The builder picks the count that holds 60 fps on an integrated laptop GPU.
- Tunnel mapping: lookback time (derived from `z`) sets each object's depth or radius. High-`z` objects sit at the outer edge or far end, and low-`z` objects sit near the core. Particles flow inward continuously, and objects wrap back to the edge so the stream never runs out.
- Colour: mapped from `z` along a red → amber → white → blue-white ramp. It is tuned for beauty, but it stays monotonic with `z`.
- Additive glow and bloom. A soft bright core like *Eclipse*'s ring at the center.
- Particles drift slightly along a curl or flow field so the streams braid into rivers and sheets, not straight radial lines.
- A handful of floating labels at any moment (fewer than about 10) give lookback time, for example `7.2 Gyr`, in a small monospace face. They fade in and out with the flow.
- Quasars, which are the brightest and most distant objects, can be slightly brighter or larger than galaxies.

## Data

- Primary source: DESI Data Release 1 (public; about 18.7M redshifts). Use only objects with confident redshifts, and keep galaxies and quasars. Stars have `z ≈ 0` and add nothing, so drop them.
- Fallback: if DESI's files are impractical to fetch or parse in a Node build script, use SDSS (DR17 or later) spectroscopic objects through the SkyServer SQL API. The README must say which source the piece uses.
- Per object, keep `z`, class (galaxy or quasar), and RA/Dec. Compute lookback time with a standard flat ΛCDM cosmology (H0 ≈ 67.7, Ωm ≈ 0.31) at build time.
- Follow the repo pattern. A `npm run data` script fetches and caches raw data under `scripts/cache/` (gitignored) and writes a compact binary plus JSON metadata to `public/data/`. The committed output must be small enough to keep in git (target under about 15 MB).
- The app runs fully offline from the bundled data.

## Interaction

- None is required to enjoy it. It plays on load.
- Minimal, quiet controls: Pause, Fullscreen, and a small "About" panel that explains what the colours mean and credits the data.
- Optional, left to the builder: gentle mouse or touch parallax that tilts the tunnel slightly.
- Full keyboard support for the controls. `prefers-reduced-motion` slows the flow sharply and disables parallax.

## Stack

- New project at `projects/redshift-tunnel/`, matching the siblings: Vite plus `three@^0.164.1`, plain JS modules.
- Hand-written GLSL through `ShaderMaterial`. The builder decides whether to use GPU simulation (`GPUComputationRenderer`) or analytic motion in the vertex shader. Analytic motion is preferred if it looks as good, since it is simpler.
- Add the project to the root `README.md` list.

## Left to the builder

- Exact sample size, colour ramp stops, bloom settings, flow speed, and label cadence.
- Whether the tunnel is a cylinder you look down or a flat vortex that funnels inward. The motion from edges to center must hold either way.
- Typeface choice, as long as it uses a quiet sans and a mono face (the Geist fonts already in the repo are fine).

## Verification

- `npm run data` writes the binary and metadata and prints the object count, `z` range, and file size.
- `npm run build` passes.
- Headless Chromium screenshots on desktop and mobile show the tunnel rendering with a red edge and a bright core. There are no console errors, and a reduced-motion run is included.
