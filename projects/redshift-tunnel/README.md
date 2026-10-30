# Redshift Tunnel

A light tunnel made of 600,000 real galaxies and quasars. Light from distant objects is stretched toward red on its way to us. Here that stretch decides everything: each object sits at the depth of its own light-travel time and glows in its own colour. Deep red light from 12 billion years ago lines the rim. Younger light warms through amber to white and blue-white at the core, which stands for here and now.

The objects stay where the data puts them. What flows is their light: faint streaks leave each object toward the core and fade before they arrive, while spiral bands of brightness travel down the tunnel.

Inspired by the stargate sequence in *2001: A Space Odyssey*, kishimisu's *Eclipse*, and Tiziana Alocci's particle sculptures.

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

Run the tests with `npm test`.

## Data

- [DESI Data Release 1](https://data.desi.lbl.gov/public/dr1/), LSS clustering catalogues v1.5 (`{BGS_ANY,LRG,ELG_LOPnotqso,QSO}_{NGC,SGC}_clustering.dat.fits`). These are the survey's confident redshifts: 11.3 million objects after removing those listed in more than one catalogue.
- `scripts/lib/fits.mjs` reads only `TARGETID`, `RA`, `DEC` and `Z` from the FITS binary tables, so there is no FITS dependency.
- The sample is a uniform, unweighted draw (seed 1998). The tunnel keeps the survey's real fingerprint: nearby bright galaxies (z 0–0.5), luminous red galaxies (0.4–1.1), star-forming galaxies (0.8–1.6) and quasars (0.8–3.5) each fill their own band.
- Lookback time uses flat ΛCDM with H₀ = 67.7 and Ωm = 0.31.

`npm run data` caches the downloads in `scripts/cache/` (gitignored) and skips any file whose size already matches. Pass `--refresh` to download again, or set `TUNNEL_SAMPLE=200000` to build a smaller sample. The committed `public/data/redshift-tunnel.{bin,json}` (10.2 MB) is all the site needs, so it runs offline.

## How the data becomes the picture

- **Depth** is lookback time, eased so the crowd of nearby galaxies doesn't pile up at the far end. Oldest light is nearest the camera and youngest light is deepest.
- **Colour** follows lookback time through blue-white, white, amber, red-orange and deep red. It rises strictly with redshift.
- **Angle** follows right ascension mapped through its own distribution. DESI sees two patches of sky, and this closes the tunnel wall while keeping neighbours together. **Radius** follows declination, which forms the sheets.
- Quasars are drawn a little brighter.

## Interaction

- It plays on load. Space pauses, F goes fullscreen, A opens the About panel and Escape closes it.
- Moving the pointer tilts the tunnel slightly.
- With `prefers-reduced-motion`, the flow slows to 15% and the tilt is off.

Built with Vite, Three.js and hand-written GLSL. All motion is analytic in the vertex shader, and the CPU only updates uniforms.
