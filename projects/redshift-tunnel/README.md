# Redshift Tunnel

Rivers of light from real galaxies and quasars stream in from the edges and dissolve into a quiet dark centre. Distance from the centre works as a clock. Light at the red rim left about 12 billion years ago, and as it flows inward it melts through amber and white to the blue-white of light that left recently. The centre is now.

Inspired by the stargate sequence in *2001: A Space Odyssey*, kishimisu's *Eclipse*, and Tiziana Alocci's particle sculptures.

**Live:** <https://data-art-three.vercel.app/redshift-tunnel/>

Open locally:

```sh
npm install
npm run data   # first run downloads ~1.26 GB of DESI catalogues into scripts/cache/
npm run dev
```

Then visit:

```text
http://127.0.0.1:5173/
```

Run the unit tests with `npm test`. With `npm run dev` running, `npm run test:browser -- http://127.0.0.1:5173/` checks the no-WebGL message and the About panel in headless Chromium.

## Data

- [DESI Data Release 1](https://data.desi.lbl.gov/public/dr1/), LSS clustering catalogues v1.5 (`{BGS_ANY,LRG,ELG_LOPnotqso,QSO}_{NGC,SGC}_clustering.dat.fits`). These are the survey's confident redshifts: 11.3 million objects after removing those listed in more than one catalogue.
- `scripts/lib/fits.mjs` reads only `TARGETID`, `RA`, `DEC` and `Z` from the FITS binary tables, so there is no FITS dependency.
- The sample is a uniform, unweighted draw (seed 1998). The tunnel keeps the survey's real fingerprint: nearby bright galaxies (z 0–0.5), luminous red galaxies (0.4–1.1), star-forming galaxies (0.8–1.6) and quasars (0.8–3.5) each fill their own band.
- Lookback time uses flat ΛCDM with H₀ = 67.7 and Ωm = 0.31.

`npm run data` caches the downloads in `scripts/cache/` (gitignored) and skips any file whose size already matches. Pass `--refresh` to download again, or set `TUNNEL_SAMPLE=200000` to build a smaller sample. The committed `public/data/redshift-tunnel.{bin,json}` (10.2 MB) is all the site needs, so it runs offline.

## How the data becomes the picture

- About 262,000 river particles are sampled from the 600,000 bundled galaxies. Each one enters at its galaxy's place in the sky. Right ascension is mapped through its own distribution, because DESI sees two patches of sky and this closes the circle while keeping neighbours together.
- A shared flow field gathers the light into braided rivers that pour inward. A long-exposure trail buffer turns moving points into continuous streams.
- **Colour** shows lookback time by distance from the centre, from deep red (oldest) through amber and white to blue-white (now). Floating labels read that time where they sit on a river.
- Quasars are drawn a little brighter.

## Interaction

- It plays on load. Space pauses, F goes fullscreen, A opens the About panel and Escape closes it.
- With `prefers-reduced-motion`, the flow slows to a quarter speed. Pausing stops all GPU work.

Built with Vite, Three.js and hand-written GLSL. The river simulation runs on the GPU (`GPUComputationRenderer`), and the CPU only updates uniforms and a few label tracers.
