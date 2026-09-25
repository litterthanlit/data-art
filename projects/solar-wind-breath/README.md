# Solar Wind Breath

Interactive 3D data sculpture of the Sun’s near-Earth plasma stream during the May 2024 solar storms.

Open locally:

```sh
npm install
npm run data
npm run dev
```

Then visit:

```text
http://127.0.0.1:5173/
```

## Data

Real public anchors:

- [NASA DONKI CME catalog](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) — eruption timing, speed, half-angle, Earth-impact forecasts
- [NASA DONKI GST catalog](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) — geomagnetic storm windows and NOAA Kp indices

Window:

- `2024-05-01` → `2024-05-15`

The bundled JSON is a stable artwork cache. Continuous plasma values (density, speed, `|B|`, temperature) are a reconstruction driven by real CME/GST timing and typical OMNI ranges. They are not a raw OMNIWeb dump. Later builds can swap in cached OMNI hourly data.

## Visual mapping

- Proton density → how many plasma streaks are alive, body thickness
- Flow speed → streak trail length, drift rate, stream stretch
- Magnetic intensity → ribbon and streak twist
- Temperature → cool indigo/cyan ↔ hot amber
- CME launches → gold eruption from the upstream source, scaled by CME speed
- Shock arrivals → a white compression wave rolling down the stream, flash + camera tremor
- Storm Kp → coral magnetosphere shell, turbulent filaments, bloom surge
- Headline → current phase (quiet · CME launch · shock · NOAA G-scale storm)
- Scrubber track → the storm timeline (amber shocks, coral storms)

Autoplay rushes through quiet hours and slows down during activity so the storms get screen time. Camera tremor is disabled under `prefers-reduced-motion`.

Hover the stream, a CME flare, or the storm pulse for labels.

This is a data sculpture, not a space-weather dashboard.
