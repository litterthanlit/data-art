import { mkdir, readFile, writeFile } from "node:fs/promises";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const START = "2024-05-01";
const END = "2024-05-15";
const HOUR_MS = 60 * 60 * 1000;
const outputPath = new URL(
  "../public/data/solar-wind-breath.json",
  import.meta.url
);
const cmeCachePath = new URL("./cache/cme-2024-05.json", import.meta.url);
const gstCachePath = new URL("./cache/gst-2024-05.json", import.meta.url);

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }
  return response.json();
}

async function loadJson(url, cachePath, label) {
  try {
    console.log(`Fetching ${label}…`);
    const data = await fetchJson(url);
    await mkdir(new URL("./cache/", import.meta.url), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(data)}\n`);
    return data;
  } catch (error) {
    console.warn(`Live ${label} fetch failed (${error.message}). Using local cache.`);
    const raw = await readFile(cachePath, "utf8");
    return JSON.parse(raw);
  }
}

function pickAnalysis(cme) {
  const analyses = cme.cmeAnalyses || [];
  return (
    analyses.find((item) => item.isMostAccurate) || analyses[0] || null
  );
}

function toTimestamp(value) {
  return Date.parse(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothNoise(index, seed) {
  const x = index * 0.17 + seed;
  return (
    0.55 * Math.sin(x) +
    0.3 * Math.sin(x * 0.37 + 1.7) +
    0.15 * Math.sin(x * 1.9 + 0.4)
  );
}

function buildCmes(raw) {
  return raw
    .map((cme) => {
      const analysis = pickAnalysis(cme);
      if (!analysis) return null;

      const arrivals = [];
      for (const enlil of analysis.enlilList || []) {
        if (enlil.estimatedShockArrivalTime) {
          arrivals.push({
            time: enlil.estimatedShockArrivalTime,
            earthDirected: Boolean(
              enlil.isEarthGB || enlil.isEarthMinorImpact
            ),
            kpPeak: Math.max(
              enlil.kp_90 || 0,
              enlil.kp_135 || 0,
              enlil.kp_180 || 0
            ),
          });
        }
      }

      return {
        id: cme.activityID,
        startTime: cme.startTime,
        sourceLocation: cme.sourceLocation || "",
        speed: analysis.speed ?? null,
        halfAngle: analysis.halfAngle ?? null,
        latitude: analysis.latitude ?? null,
        longitude: analysis.longitude ?? null,
        type: analysis.type || "",
        link: cme.link,
        arrivals,
      };
    })
    .filter(Boolean)
    .sort((a, b) => toTimestamp(a.startTime) - toTimestamp(b.startTime));
}

function buildStorms(raw) {
  return raw
    .map((storm) => {
      const kpSeries = (storm.allKpIndex || []).map((item) => ({
        time: item.observedTime,
        kp: item.kpIndex,
        source: item.source,
      }));
      const peakKp = kpSeries.reduce(
        (max, item) => Math.max(max, item.kp || 0),
        0
      );

      return {
        id: storm.gstID,
        startTime: storm.startTime,
        peakKp,
        kpSeries,
        link: storm.link,
      };
    })
    .sort((a, b) => toTimestamp(a.startTime) - toTimestamp(b.startTime));
}

function stormIntensityAt(timeMs, storms) {
  let intensity = 0;
  for (const storm of storms) {
    for (const sample of storm.kpSeries) {
      const ageHours =
        (timeMs - toTimestamp(sample.time)) / HOUR_MS;
      if (ageHours < -3 || ageHours > 18) continue;
      const envelope = Math.exp(-((ageHours - 1.5) ** 2) / 18);
      intensity = Math.max(intensity, (sample.kp / 9) * envelope);
    }
  }
  return clamp(intensity, 0, 1);
}

function cmeLaunchIntensityAt(timeMs, cmes) {
  let intensity = 0;
  let nearest = null;
  for (const cme of cmes) {
    const ageHours = (timeMs - toTimestamp(cme.startTime)) / HOUR_MS;
    if (ageHours < -1 || ageHours > 8) continue;
    const speedFactor = clamp((cme.speed || 400) / 1600, 0.2, 1.4);
    const envelope = Math.exp(-(ageHours ** 2) / 4.5) * speedFactor;
    if (envelope > intensity) {
      intensity = envelope;
      nearest = cme;
    }
  }
  return { intensity: clamp(intensity, 0, 1.5), cme: nearest };
}

function shockIntensityAt(timeMs, cmes) {
  let intensity = 0;
  for (const cme of cmes) {
    for (const arrival of cme.arrivals) {
      const ageHours = (timeMs - toTimestamp(arrival.time)) / HOUR_MS;
      if (ageHours < -2 || ageHours > 20) continue;
      const speedFactor = clamp((cme.speed || 400) / 1400, 0.25, 1.5);
      const earthBoost = arrival.earthDirected ? 1.25 : 0.7;
      const envelope =
        Math.exp(-((ageHours - 1) ** 2) / 12) * speedFactor * earthBoost;
      intensity = Math.max(intensity, envelope);
    }
  }
  return clamp(intensity, 0, 1.6);
}

function buildHours(cmes, storms) {
  const startMs = Date.parse(`${START}T00:00:00Z`);
  const endMs = Date.parse(`${END}T23:00:00Z`);
  const hours = [];

  for (let timeMs = startMs, index = 0; timeMs <= endMs; timeMs += HOUR_MS, index += 1) {
    const storm = stormIntensityAt(timeMs, storms);
    const launch = cmeLaunchIntensityAt(timeMs, cmes);
    const shock = shockIntensityAt(timeMs, cmes);
    const breath = 0.5 + 0.5 * smoothNoise(index, 0.8);
    const activity = clamp(0.12 * breath + 0.55 * storm + 0.5 * shock + 0.2 * launch.intensity, 0, 1.5);

    const density = Number(
      (3.2 + breath * 2.4 + storm * 18 + shock * 22 + launch.intensity * 4).toFixed(2)
    );
    const speed = Number(
      (360 + breath * 40 + storm * 280 + shock * 420 + launch.intensity * 60).toFixed(1)
    );
    const bt = Number(
      (4.2 + breath * 1.8 + storm * 22 + shock * 18 + launch.intensity * 3).toFixed(2)
    );
    const bz = Number(
      ((-1.2 + smoothNoise(index, 2.4) * 3 - storm * 18 - shock * 10)).toFixed(2)
    );
    const temperature = Number(
      Math.round(65000 + breath * 25000 + storm * 380000 + shock * 520000)
    );

    hours.push({
      t: new Date(timeMs).toISOString().replace(".000Z", "Z"),
      density,
      speed,
      bt,
      bz,
      temperature,
      storm: Number(storm.toFixed(3)),
      shock: Number(shock.toFixed(3)),
      launch: Number(launch.intensity.toFixed(3)),
      activity: Number(activity.toFixed(3)),
      cmeId: launch.cme?.id ?? null,
    });
  }

  return hours;
}

const cmeUrl = `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/CME?startDate=${START}&endDate=${END}`;
const gstUrl = `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/GST?startDate=${START}&endDate=${END}`;

const [rawCmes, rawStorms] = await Promise.all([
  loadJson(cmeUrl, cmeCachePath, "DONKI CME"),
  loadJson(gstUrl, gstCachePath, "DONKI GST"),
]);

const cmes = buildCmes(rawCmes);
const storms = buildStorms(rawStorms);
const hours = buildHours(cmes, storms);

const data = {
  meta: {
    title: "Solar Wind Breath",
    window: { start: START, end: END },
    generatedAt: new Date().toISOString(),
    sourceNote:
      "CME and geomagnetic storm events are real NASA DONKI records for May 2024. Continuous plasma values are an artwork reconstruction driven by those event timings and typical OMNI ranges — not a raw OMNIWeb dump.",
    sources: [
      {
        name: "NASA DONKI CME",
        url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/",
      },
      {
        name: "NASA DONKI GST",
        url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/",
      },
    ],
  },
  cmes,
  storms,
  hours,
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data)}\n`);

console.log(
  `Wrote ${hours.length} hours, ${cmes.length} CMEs, ${storms.length} storms`
);
