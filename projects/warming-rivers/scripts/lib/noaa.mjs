// NOAA NCEI Climate at a Glance, global time series: annual temperature departure
// (°C) from the 1901–2000 average. The continents ignore the surface part of the path.
export const BASE_URL = "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/global/time-series";

export const REGIONS = [
  { id: "arctic", name: "Arctic", path: "arctic/land_ocean" },
  { id: "europe", name: "Europe", path: "europe/land_ocean" },
  { id: "asia", name: "Asia", path: "asia/land_ocean" },
  { id: "north-america", name: "North America", path: "northAmerica/land_ocean" },
  { id: "global-ocean", name: "Global ocean", path: "globe/ocean" },
  { id: "africa", name: "Africa", path: "africa/land_ocean" },
  { id: "south-america", name: "South America", path: "southAmerica/land_ocean" },
  { id: "oceania", name: "Oceania", path: "oceania/land_ocean" },
  { id: "antarctic", name: "Antarctic", path: "antarctic/land_ocean" },
];

export function seriesUrl(region, start, end) {
  return `${BASE_URL}/${region.path}/12/12/${start}-${end}/data.json`;
}

export function parseSeries(json, start, end) {
  const values = new Array(end - start + 1);
  for (let year = start; year <= end; year++) {
    const v = json?.data?.[String(year)]?.departure;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`NOAA series has no usable departure for ${year} (got ${JSON.stringify(v)})`);
    }
    values[year - start] = v;
  }
  return values;
}
