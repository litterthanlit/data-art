# Varna Weather Galaxy Handoff

## Project

Interactive data visualization art piece inspired by Refik Anadol-style data sculptures.

Current file:

- `varna-humidity-3-years.html`

Local preview:

- `http://127.0.0.1:8765/varna-humidity-3-years.html`

## Concept

The piece turns Varna, Bulgaria weather data into a 3D atmospheric sculpture.

It is not a literal scientific chart. It is an artistic interpretation built from real hourly weather readings.

Working title:

- `Weather Data Universe - Black Sea`

## Data

Source:

- Open-Meteo Historical Weather API

Location:

- Varna, Bulgaria
- Latitude: `43.2141`
- Longitude: `27.9147`

Time range:

- `2015-01-01` to `2025-12-31`

Resolution:

- Hourly readings
- `96,432` expected readings

Variables:

- `relative_humidity_2m`
- `temperature_2m`
- `precipitation`
- `surface_pressure`
- `wind_speed_10m`
- `wind_direction_10m`

## Visual Mapping

- Humidity controls particle density, glow, and size.
- Temperature controls color.
- Wind speed and direction bend the particle field and streaks.
- Pressure controls depth.
- Rain creates brighter spark-like particles.
- Time forms the spiral/yearly structure.

## Interaction

Current interactions:

- Drag to rotate.
- Scroll or pinch to zoom.
- `PAUSE` stops animation and auto-rotation.
- `RESET VIEW` restores the camera.

Built with:

- Single HTML file
- Three.js
- OrbitControls
- Open-Meteo API fetch in browser

## Accuracy

Accurate:

- Real weather data source.
- Real Varna coordinates.
- Real hourly variables.
- Real reading count for the selected range.

Artistic:

- Particle positions are generated as a sculptural form.
- The shape is not a map, satellite image, or meteorological model.
- The visual output should be described as a data sculpture, not a scientific visualization.

Suggested description:

> An interactive atmospheric data sculpture generated from 11 years of hourly Varna weather readings.

## Refik Anadol Reference

Useful framing:

- Refik Anadol often uses real archives or environmental datasets.
- The final visuals are machine-generated interpretations, not literal charts.
- This project follows that logic: real data, expressive transformation.

References:

- https://www.moma.org/calendar/exhibitions/5535
- https://open-meteo.com/en/docs/historical-weather-api

## Current State

The piece is a working local prototype.

Strengths:

- Stronger visual presence than the humidity-only version.
- Interactive 3D navigation works.
- Data source and mapping are explainable.
- The style is close to an AI data sculpture aesthetic.

Limitations:

- It depends on live CDN imports for Three.js.
- It fetches Open-Meteo data in the browser each time.
- No loading progress bar yet.
- No hover tooltip for exact timestamp/value yet.
- No export/screenshot mode yet.
- No Git repo initialized yet.

## Recommended Next Steps

1. Improve beauty:
   - Add bloom/post-processing.
   - Tune color palette.
   - Add stronger depth fog.
   - Add denser clusters for rain and seasonal extremes.

2. Improve interaction:
   - Add hover tooltip for hour/date/weather values.
   - Add year filter.
   - Add variable toggles.
   - Add camera presets.

3. Improve data handling:
   - Cache the Open-Meteo response locally as JSON.
   - Add a fallback if the API is unavailable.
   - Precompute normalized values for faster load.

4. Improve project structure:
   - Create a Vite/Three.js app if this grows beyond one file.
   - Initialize git.
   - Commit the current prototype.
   - Optionally push to GitHub.

## GitHub Recommendation

Do GitHub after one more visual pass.

Suggested first commit message:

`Create interactive Varna weather galaxy prototype`

