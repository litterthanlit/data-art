# Subject Bank

Sources checked from this repo's cloud sessions. **Status** tells you how much to trust a row. Re-probe anything marked unverified, or anything older than a few months, before recommending it.

## Used in pieces

| Source | Native channel | Access | Status |
|---|---|---|---|
| DESI DR1 LSS clustering catalogues v1.5 (`data.desi.lbl.gov/public/dr1/survey/catalogs/dr1/LSS/iron/LSScats/v1.5/`) | Redshift is colour and lookback time | Public FITS, 8 files, ~1.26 GB, Range supported. The full zcatalog files are 9–11 GB each, too big. | Verified 2026-10 (Redshift Tunnel) |
| Art Institute of Chicago API (`api.artic.edu`) | Artwork colour (`thumbnail.lqip`) | No key, 60 req/min, 10k search window. IIIF images blocked cross-site by Cloudflare. | Verified 2026-09 (Latent Archive) |
| NASA DONKI CME / GST (`kauai.ccmc.gsfc.nasa.gov/DONKI/`) | Eruption speed and timing, storm windows | No key | Verified 2026-08 (Solar Wind Breath) |
| Open-Meteo Historical (`archive-api.open-meteo.com`) | Hourly weather | No key. A daily limit is shared across the proxy and can return "limit exceeded". | Verified 2026-10, rate-limited |
| World Bank / UN Comtrade | Trade flows | Illustrative only in Trade Organism | Partially used |

## Scouted, not yet used

| Source | Native channel | Access | Status |
|---|---|---|---|
| LIGO/Virgo/KAGRA GWTC-4.0 via GWOSC (`gwosc.org/eventapi/json/allevents/`) | Inspiral chirp (rising pitch); 218 mergers | Public JSON plus strain audio | Unverified: TLS failed through the session proxy (2026-10) |
| SDSS SkyServer SQL (`skyserver.sdss.org`) | Redshift | Public SQL API | Unverified: TLS failed through the proxy (2026-10) |
| NOIRLab Astro Data Lab DESI queries (`datalab.noirlab.edu`) | Redshift | Needs a token (returned 401 without one) | Blocked without login |
| Warming-stripes temperatures (global or regional anomaly series) | Temperature is colour; years are a clock | See the Warming Rivers spec once it's scouted | In progress |

## Ideas without a source yet

- Ocean surface currents (flow field) and sea-surface temperature.
- Tides at one harbour (breathing rhythm).
- Bird migration tracks.
- Earth's daily colour (DSCOVR EPIC).
