import { mkdir, writeFile } from "node:fs/promises";

const outputPath = new URL("../public/data/trade-organism.json", import.meta.url);

const categories = ["general", "energy", "food", "manufacturing"];
const chokepoints = [
  { id: "suez", name: "Suez", pressure: 0.92 },
  { id: "panama", name: "Panama", pressure: 0.76 },
  { id: "malacca", name: "Malacca", pressure: 0.96 },
  { id: "hormuz", name: "Hormuz", pressure: 0.88 },
  { id: "gibraltar", name: "Gibraltar", pressure: 0.64 },
  { id: "singapore", name: "Singapore", pressure: 0.98 }
];

const hubs = [
  ["china", "China", 275000000],
  ["united-states", "United States", 61000000],
  ["singapore", "Singapore", 39000000],
  ["south-korea", "South Korea", 30000000],
  ["malaysia", "Malaysia", 28000000],
  ["netherlands", "Netherlands", 25000000],
  ["united-arab-emirates", "United Arab Emirates", 22000000],
  ["germany", "Germany", 19000000],
  ["japan", "Japan", 18000000],
  ["india", "India", 17000000],
  ["spain", "Spain", 17000000],
  ["belgium", "Belgium", 14000000]
];

const anchorNodes = hubs.map(([id, name, teu], index) => ({
  id,
  name,
  type: "hub",
  teu,
  weight: Math.sqrt(teu) / Math.sqrt(275000000),
  category: categories[index % categories.length]
}));

const satelliteNodes = hubs.flatMap(([hubId, hubName, hubTeu], hubIndex) =>
  Array.from({ length: 19 }, (_, index) => {
    const ordinal = index + 1;
    const teu = Math.round(hubTeu * (0.03 + ((ordinal % 7) + 1) * 0.006));
    return {
      id: `${hubId}-flow-${String(ordinal).padStart(2, "0")}`,
      name: `${hubName} flow ${ordinal}`,
      type: "flow",
      parent: hubId,
      teu,
      weight: Math.sqrt(teu) / Math.sqrt(275000000),
      category: categories[(hubIndex + ordinal) % categories.length]
    };
  })
);

const nodes = [...anchorNodes, ...satelliteNodes];

const edges = nodes.flatMap((source, sourceIndex) =>
  nodes.slice(sourceIndex + 1, sourceIndex + 5).map((target, offset) => ({
    id: `${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    category: categories[(sourceIndex + offset) % categories.length],
    intensity: Number(((source.weight + target.weight) / 2).toFixed(3)),
    chokepoint: chokepoints[(sourceIndex + offset) % chokepoints.length].id
  }))
);

const data = {
  meta: {
    title: "Trade Organism",
    sourceNote: "Static illustrative cache for the artwork. The structure is curated from public supply-chain references and scaled from container-traffic patterns; it is not live fetched data or a literal logistics dataset.",
    generatedAt: "2026-05-07-cache-v2"
  },
  categories,
  chokepoints,
  nodes,
  edges
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${nodes.length} hubs and ${edges.length} flows`);
