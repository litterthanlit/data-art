# Latent Archive Design

## Concept

`Latent Archive` is an abstract 3D data sculpture of a museum collection remembering itself. It is a homage to Refik Anadol's *Unsupervised*, built from open data.

It should not look like a gallery wall, a grid of thumbnails, or a collection browser. It should feel like a machine's memory of 20,000 artworks: glowing pigment that settles into orderly history, regroups by visual likeness, and then dissolves into dreaming rivers of colour.

Data metaphor:

- Each artwork is a 4×4 mosaic of its own real colours, 16 pigments per work.
- Chronological order is the archive's conscious memory, shown as a rising spiral.
- Visual likeness (UMAP of colour composition) is its latent memory.
- Curl-noise flow is hallucination: pigment leaves the canvas and recondenses.

## Visual System

- Full-screen Three.js scene with one GPU point system of about 320k points.
- No frames, walls or thumbnails in the 3D space. The only literal image appears in the inspector on hover.
- Additive glow with half-resolution bloom on a near-black background.
- Colour comes only from the artworks. The UI has a single warm accent (`#f2c48d`).
- The auto-cycle runs Archive (18s), Latent (20s), Dream (16s), Latent (12s), and repeats.
- During transitions, pigment arcs through a curl field rather than moving in a straight line.

Typography: a serif display face (Iowan Old Style / Palatino / Georgia) for the title and artwork captions, with IBM Plex Sans and the system sans stack for the UI. The status line uses tabular numbers.

## Data

- Art Institute of Chicago API, public-domain works with an `image_id`, split into date ranges to stay under the 10k search window.
- `thumbnail.lqip` is decoded with omggif and area-averaged into a 4×4 RGB grid.
- Features are CIELAB cells, mean colour, year rank and a hashed classification. UMAP reduces them to 3D with a fixed seed.
- The build ships `public/data/latent-archive.bin` and `latent-archive.json`. The app runs offline apart from the hover image.

## Interaction

- Drag to orbit, scroll or pinch to zoom, Reset, Pause.
- Memory state: Auto, Archive, Latent, Dream.
- The era slider isolates about 8% of the collection around a point in time. The "All" button clears it.
- Hover to recall a work, click to hold it, Escape to release.
- Full keyboard control and `prefers-reduced-motion` support.

## Verification

- `npm run data` writes the binary and metadata and reports counts and sizes.
- `npm run build` passes.
- Headless Chromium screenshots of each state on desktop, plus a mobile run with reduced motion. Hover, hold and the era filter are exercised. There are no console errors other than blocked network images in a sandbox.
