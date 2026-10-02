# Latent Archive Implementation Plan

**Goal:** Build `Latent Archive`, a full-screen Three.js artwork where 20,000 public-domain artworks from the Art Institute of Chicago become a dreaming cloud of pigment. The piece is inspired by Refik Anadol's *Unsupervised*.

**Architecture:** Vite project at `projects/latent-archive`, mirroring `projects/solar-wind-breath`. A Node script bakes AIC data into a compact binary plus columnar JSON. The renderer is one `THREE.Points` with a custom shader that blends two precomputed layouts (UMAP latent and time helix) and adds curl-noise hallucination.

**Tech Stack:** Vite, Three.js (EffectComposer + UnrealBloomPass), vanilla JS modules, Node scripts with `omggif` and `umap-js`.

## File Structure

- `projects/latent-archive/package.json`
- `projects/latent-archive/vite.config.js`
- `projects/latent-archive/index.html`
- `projects/latent-archive/src/main.js`: boot, controls, inspector
- `projects/latent-archive/src/styles.css`
- `projects/latent-archive/src/archive/loadArchive.js`: binary and metadata parsing
- `projects/latent-archive/src/scene/ArchiveScene.js`: renderer, bloom, state director, orbit, picking
- `projects/latent-archive/src/dream/DreamField.js`: particle attributes, uniforms
- `projects/latent-archive/src/dream/shaders.js`: morph, curl noise, billboarded mosaics
- `projects/latent-archive/src/ui/readouts.js`
- `projects/latent-archive/scripts/build-archive-data.mjs`
- `projects/latent-archive/public/data/latent-archive.{bin,json}`: generated
- `projects/latent-archive/README.md`
- Root `README.md` link
- Design spec and this plan under `docs/superpowers/`

## Data Notes

- API: `POST https://api.artic.edu/api/v1/artworks/search`, filtered to `is_public_domain` plus an `image_id` and a `date_start` range. Ranges are split recursively until each holds 9,900 works or fewer.
- Requests are throttled to 1.1s (the anonymous limit is 60/min) and sent with an `AIC-User-Agent` header.
- The deterministic sample is seeded with 1917, so rebuilds from the same cache are identical.
- The IIIF image is `https://www.artic.edu/iiif/2/{image_id}/full/400,/0/default.jpg`, loaded only on hover (220ms delay).

## Performance Notes

- All motion runs in the vertex shader. The CPU does no per-frame work beyond uniforms.
- Noise branches are skipped when the transit and dream amounts are zero.
- DPR is capped at 1.75, bloom runs at half resolution, and point size scales with viewport height.
- Picking projects the 20k anchors only on pointer move, and is disabled while pigment is scattered.
