# Warming Rivers Design

Made with the `making-data-art` skill.

## Intent

The user wanted a warming-stripes piece that is broader than one city, with one river per region of the world. After seeing a sketch in a separate visual style, they found Redshift Tunnel "so much sicker". So this piece reuses the Redshift river engine and changes only what the light means.

## Decided with the user

- **One river per region** (user). Nine NOAA regions: Arctic, Europe, Asia, North America, global ocean, Africa, South America, Oceania and Antarctic.
- **Per-region colour scale as the default** (user). A Shared toggle is available for comparison.
- **The Redshift engine look** (user, after comparing sketches). Braided GPU rivers, long-exposure trails and a dark centre.

## My calls

- Distance from the centre is the year: 1850 at the rim, 2025 at the centre. Colour is the region's departure in that year. Because colour belongs to position, it stays true to the data while the light flows.
- The colour is a heat ramp (deep violet, red, red-orange, amber, warm white, white) whose luminance only rises. The print warming-stripes palette was rejected because its dark ends vanish as light on black.
- Regions braid where the currents meet. Each point keeps its own region's colour, and the About panel says so.
- The About panel notes the sparse 1800s observations, especially near the poles.

## Data

NOAA NCEI Climate at a Glance global time series: annual departures from 1901–2000, 1850–2025, about 5 KB per series, no key. Verified 2026-10.
