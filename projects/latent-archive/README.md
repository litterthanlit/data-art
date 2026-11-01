# Latent Archive

A museum that dreams. 20,000 public-domain artworks from the Cleveland Museum of Art are broken into 320,000 points of pigment. They drift between a chronological spiral, a cloud where the machine groups works by how they look, and a hallucination where the colour leaves the canvas.

Inspired by Refik Anadol's *Unsupervised* and *Machine Hallucinations*.

Open locally:

```sh
npm install
npm run data   # first run fetches the catalogue and one image per work (about 30 minutes)
npm run dev
```

Then visit:

```text
http://127.0.0.1:5173/
```

## Data

- [Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org/): about 41,800 artworks whose metadata and images are both CC0.
- The build downloads each sampled work's web image once, decodes it, and area-averages it into a **4×4 grid of real colours**. The 16 cells are the work's pigments.
- The hover inspector lazy-loads the same web image from `openaccess-cdn.clevelandart.org`, which serves it to any site. If a load fails, the plate shows the work's 4×4 colour memory instead.

Why not the Art Institute of Chicago: an earlier version used AIC. Since June 2026 AIC's IIIF image host answers embedded requests with a Cloudflare challenge that an `<img>` cannot pass ([api-data#9](https://github.com/art-institute-of-chicago/api-data/issues/9)), so no image could be shown.

`npm run data` caches its work locally in `scripts/cache/` (`cma-artworks.json` holds the catalogue, `cma-grids.json` holds each downloaded work's 16 colours keyed by id; both are gitignored). An interrupted build resumes from the grid cache. Once the cache exists, reruns work offline. The committed `public/data/` files are all the site needs. Pass `--refresh` to fetch again, `ARCHIVE_TARGET=5000` to build a smaller sample, or `ARCHIVE_CACHE=path.json` to build from another cache.

Outputs:

- `public/data/latent-archive.bin`: little-endian binary with a `LARC` header, then the latent xyz and helix xyz as Float32, the 16 RGB cells as Uint8, and the year as Int16
- `public/data/latent-archive.json`: columnar metadata (accession number, title, artist, date, place, department, image path under `imageHost`)

## How the layouts are made

- **Latent**: every work becomes a feature vector: its 16 cells in CIELAB, the mean colour, the year rank, and a hashed classification. UMAP (`umap-js`, fixed seed) reduces these to 3D. Works with a similar look drift together, whatever their era.
- **Archive**: a rising spiral. Year rank sets the height and the turn, department adds an angular offset, and lightness sets the radius.

## Island labels

The latent cloud is named at build time. A voxel flood fill finds the separated islands, and large islands are split further with seeded k-means (about one region per 1,800 works). Each region is titled by its most over-represented classification relative to the whole sample, with the dominant place and the p10–p90 year span as detail: for example *Prints, France · 1540 – 1900* or *Arms and armors, Japan · 1500 – 1800*. The labels are stored in `latent-archive.json` under `islands`. On screen they appear only in the Latent state: the largest regions claim space first, overlapping labels are hidden, and the detail line shows when you zoom in or point near a region.

## Visual mapping

- One artwork → a 4×4 mosaic of its own colours, always facing the viewer
- Archive state → the collection in chronological order
- Latent state → nebulae of visual likeness
- Dream state → curl-noise flow pulls each cell off its tile into rivers of paint
- Transitions → pigment lifts and arcs between memories
- Era slider → shows about 8% of the collection around a point in time; the rest fades to embers

## Interaction

- Hover a light to recall a work. Click to hold it, and Escape to let it go.
- Drag to orbit, scroll or pinch to zoom.
- Keys: Space to pause, R to reset, 1–4 for Auto, Archive, Latent and Dream, L to toggle the island labels, arrow keys to orbit, `+` and `-` to zoom.
- With `prefers-reduced-motion`, the auto-cycle stops on Latent, time slows, and the dream flow is capped.

The UI uses Geist and Geist Mono (bundled through Fontsource, so no font CDN), on a Vercel-style dark token scale defined in `src/styles.css`.

This is a data sculpture, not a collection browser.
