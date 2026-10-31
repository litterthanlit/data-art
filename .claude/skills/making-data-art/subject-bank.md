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
| NOAA CO-OPS tides (`api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&station=9414290`) | Rhythm: tide as breathing; spring/neap swell | No key, JSON, 6-min readings (~36 KB/day) | Verified 2026-10 |
| NOAA OISST v2.1 daily SST (`ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/`) | Temperature is colour; El Niño tongues | NetCDF, ~1.5 MB/day, Range supported (needs a NetCDF parser) | Verified 2026-10 |
| NDBC buoy realtime (`ndbc.noaa.gov/data/realtime2/46026.txt`) | Wave height and period | Plain text, ~600 KB | Verified 2026-10 |
| Open-Meteo Marine (`marine-api.open-meteo.com/v1/marine`) | Waves and swell | No key, JSON (shared daily limit) | Verified 2026-10 |
| OSCAR surface currents on ERDDAP (`coastwatch.pfeg.noaa.gov/erddap/griddap/jplOscar`) | u/v current vectors: flow itself | ERDDAP CSV or JSON. Check the time axis first, because 2020 and 2023 queries returned 404 (past the end). | Partly verified 2026-10 |
| Warming-stripes temperatures (global or regional anomaly series) | Temperature is colour; years are a clock | See the Warming Rivers spec once it's scouted | In progress |

## Ideas without a source yet

- Bird migration tracks.
- Earth's daily colour (DSCOVR EPIC).
