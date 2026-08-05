# Solar Wind Breath Implementation Plan

**Goal:** Build `Solar Wind Breath`, a full-screen Three.js artwork where NASA solar-storm event data becomes an abstract living plasma organism.

**Architecture:** Vite project at `projects/solar-wind-breath`, mirroring `projects/trade-organism`. Ship cached JSON generated from NASA DONKI CME/GST catalogs for the May 2024 storm window, then render a time-evolving plasma stream with CME flares and geomagnetic pulses.

**Tech Stack:** Vite, Three.js, vanilla JavaScript modules, local JSON data, Node scripts.

## File Structure

- `projects/solar-wind-breath/package.json`
- `projects/solar-wind-breath/vite.config.js`
- `projects/solar-wind-breath/index.html`
- `projects/solar-wind-breath/src/main.js`
- `projects/solar-wind-breath/src/styles.css`
- `projects/solar-wind-breath/src/scene/SolarScene.js`
- `projects/solar-wind-breath/src/plasma/buildPlasma.js`
- `projects/solar-wind-breath/src/plasma/PlasmaField.js`
- `projects/solar-wind-breath/src/ui/readouts.js`
- `projects/solar-wind-breath/scripts/build-solar-wind-data.mjs`
- `projects/solar-wind-breath/public/data/solar-wind-breath.json`
- `projects/solar-wind-breath/README.md`
- Root `README.md` link
- Design spec and this plan under `docs/superpowers/`

## Data Notes

- DONKI CME API: `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/CME`
- DONKI GST API: `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/GST`
- Continuous plasma series in v1 is reconstructed from real CME/GST timing using typical OMNI ranges; README must say so.
- Later upgrade path: replace reconstruction with cached OMNIWeb hourly ASCII.
