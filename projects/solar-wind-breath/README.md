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

- Proton density → particle thickness / glow mass
- Flow speed → stream stretch and urgency
- Magnetic intensity → ribbon twist
- Temperature → cool cyan ↔ hot amber
- CME launches → upstream gold flares
- Storm Kp peaks → whole-field coral pulse

Hover the stream, a CME flare, or the storm pulse for labels.

This is a data sculpture, not a space-weather dashboard.
