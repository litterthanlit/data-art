# Warming Rivers

Nine rivers of light, one for each region of the world, flow from 1850 at the rim to 2025 in a dark centre. As the light passes each year it takes that region's real temperature for that year: deep violet and red when the region was cool, amber and white-hot when it was hot. The Arctic, Asia and Europe pour white-hot into the present. The ocean and the Antarctic barely warm.

Built on the river engine from [Redshift Tunnel](../redshift-tunnel), with the same braided currents and long-exposure trails. Only the meaning of the light changes.

Open locally:

```sh
npm install
npm run data   # downloads nine NOAA series (about 50 KB) into scripts/cache/
npm run dev
```

Then visit:

```text
http://127.0.0.1:5173/
```

Run the unit tests with `npm test`. With `npm run dev` running, `npm run test:browser -- http://127.0.0.1:5173/` checks the no-WebGL message and the About panel in headless Chromium.

## Data

- [NOAA NCEI Climate at a Glance](https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series), global time series. Values are the annual (January–December) temperature departure in °C from the 1901–2000 average, for 1850–2025.
- Regions: Arctic, Europe, Asia, North America, global ocean, Africa, South America, Oceania and Antarctic.
- `npm run data` caches each series in `scripts/cache/` (gitignored) and writes `public/data/warming-rivers.json` (9 KB). The site runs offline from that file. Pass `--refresh` to download again.
- Values for the 1800s, especially near the poles, rest on sparse observations and carry wide uncertainty.

## How the data becomes the picture

- **Distance from the centre is the year.** The rim is 1850 and the centre is 2025.
- **Colour is the temperature for that region and year**, on a heat ramp running from deep violet through red, red-orange and amber to white.
- **Per region** (the default) stretches each river over its own coolest-to-hottest range, so every region ends white-hot. **Shared** puts all nine on one range, which shows how unequal the warming is. Press `S` to switch.
- About 262,000 particles carry the light. Each one belongs to a region and enters at that region's place on the rim. The shared currents braid the rivers, so neighbours can mingle near the centre. Every point keeps its own region's colour.
- Region names float where their light gathers. Labels ride the rivers and read the region, year and temperature at that point.

## Interaction

- It plays on load. `Space` pauses, `S` switches the scale, `F` goes fullscreen, `A` opens the About panel and `Esc` closes it.
- With `prefers-reduced-motion`, the flow slows to a quarter speed. Pausing stops all GPU work.

Built with Vite, Three.js and hand-written GLSL. The river simulation runs on the GPU (`GPUComputationRenderer`). Colour comes from a 176 × 9 year-by-region palette texture.
