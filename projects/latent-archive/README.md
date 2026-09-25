# Latent Archive

A museum that dreams. 20,000 public-domain artworks from the Art Institute of Chicago are broken into 320,000 points of pigment. They drift between a chronological spiral, a cloud where the machine groups works by how they look, and a hallucination where the colour leaves the canvas.

Inspired by Refik Anadol's *Unsupervised* and *Machine Hallucinations*.

Open locally:

```sh
npm install
npm run data   # first run fetches ~20k works (about 10 minutes at the API's rate limit)
npm run dev
```

Then visit:

```text
http://127.0.0.1:5173/
```

## Data

- [Art Institute of Chicago API](https://api.artic.edu/docs/): public-domain artworks with images. The metadata is CC0.
- Each work's `thumbnail.lqip` (a tiny base64 GIF the API ships with every record) is decoded and averaged into a **4×4 grid of real colours**. The 16 cells are the work's pigments. No full images are downloaded at build time.
- The hover inspector lazy-loads the actual image from AIC's IIIF server, and only when you linger on a work.

`npm run data` caches API responses in `scripts/cache/` (`aic-artworks.json` is committed; per-range pages in `.ranges/` are not). Reruns work offline. Pass `--refresh` to fetch again, `ARCHIVE_TARGET=5000` to build a smaller sample, or `ARCHIVE_CACHE=path.json` to build from another cache.

Outputs:

- `public/data/latent-archive.bin`: little-endian binary with a `LARC` header, then the latent xyz and helix xyz as Float32, the 16 RGB cells as Uint8, and the year as Int16
- `public/data/latent-archive.json`: columnar metadata (title, artist, date, place, department, IIIF id)

## How the layouts are made

- **Latent**: every work becomes a feature vector: its 16 cells in CIELAB, the mean colour, the year rank, and a hashed classification. UMAP (`umap-js`, fixed seed) reduces these to 3D. Works with a similar look drift together, whatever their era.
- **Archive**: a rising spiral. Year rank sets the height and the turn, department adds an angular offset, and lightness sets the radius.

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
- Keys: Space to pause, R to reset, 1–4 for Auto, Archive, Latent and Dream, arrow keys to orbit, `+` and `-` to zoom.
- With `prefers-reduced-motion`, the auto-cycle stops on Latent, time slows, and the dream flow is capped.

This is a data sculpture, not a collection browser.
