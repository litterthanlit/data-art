import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const START = "2015-01-01";
const END = "2025-12-31";
const LATITUDE = 43.2141;
const LONGITUDE = 27.9147;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../public/data/varna-weather-2015-2025.json");

const url =
  "https://archive-api.open-meteo.com/v1/archive" +
  `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
  `&start_date=${START}&end_date=${END}` +
  "&hourly=temperature_2m,relative_humidity_2m,precipitation,surface_pressure,wind_speed_10m,wind_direction_10m" +
  "&timezone=Europe%2FSofia";

function finiteValues(values) {
  return values.filter((value) => Number.isFinite(value));
}

function range(values) {
  const clean = finiteValues(values);
  return {
    min: Math.min(...clean),
    max: Math.max(...clean),
  };
}

function normalize(value, min, max) {
  if (!Number.isFinite(value) || max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function rounded(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundedArray(values, digits = 3) {
  return values.map((value) => rounded(value, digits));
}

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Open-Meteo request failed: ${response.status}`);
}

const source = await response.json();
const hourly = source.hourly;

const temperature = hourly.temperature_2m;
const humidity = hourly.relative_humidity_2m;
const rain = hourly.precipitation;
const pressure = hourly.surface_pressure;
const windSpeed = hourly.wind_speed_10m;
const windDirection = hourly.wind_direction_10m;

const temperatureRange = range(temperature);
const pressureRange = range(pressure);
const windRange = range(windSpeed);
const rainRange = { min: 0, max: 5 };

const dataset = {
  meta: {
    title: "Varna Weather Galaxy",
    source: "Open-Meteo Historical Weather API",
    sourceUrl: "https://open-meteo.com/en/docs/historical-weather-api",
    latitude: LATITUDE,
    longitude: LONGITUDE,
    timezone: source.timezone,
    start: START,
    end: END,
    count: hourly.time.length,
    generatedAt: new Date().toISOString(),
  },
  ranges: {
    humidity: { min: 0, max: 100 },
    temperature: temperatureRange,
    rain: rainRange,
    pressure: pressureRange,
    wind: windRange,
  },
  hourly: {
    time: hourly.time,
    humidity: roundedArray(humidity, 1),
    temperature: roundedArray(temperature, 1),
    rain: roundedArray(rain, 2),
    pressure: roundedArray(pressure, 1),
    windSpeed: roundedArray(windSpeed, 1),
    windDirection: roundedArray(windDirection, 0),
    humidityNorm: roundedArray(humidity.map((value) => normalize(value, 0, 100))),
    temperatureNorm: roundedArray(temperature.map((value) => normalize(value, temperatureRange.min, temperatureRange.max))),
    rainNorm: roundedArray(rain.map((value) => normalize(value, rainRange.min, rainRange.max))),
    pressureNorm: roundedArray(pressure.map((value) => normalize(value, pressureRange.min, pressureRange.max))),
    windNorm: roundedArray(windSpeed.map((value) => normalize(value, windRange.min, windRange.max))),
  },
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(dataset)}\n`);

console.log(`Wrote ${dataset.meta.count.toLocaleString()} readings to ${outPath}`);
