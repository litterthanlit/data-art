import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { loadTunnel } from "./data/loadTunnel.js";
import { buildSources } from "./tunnel/mapping.js";
import { particleSide } from "./tunnel/RiverField.js";
import { RiverScene } from "./scene/RiverScene.js";
import { createLabels } from "./ui/labels.js";
import { createControls } from "./ui/controls.js";

const REDUCED_MOTION_SCALE = 0.25;
const TRACER_RANGES = { BGS: "z 0.0–0.5", LRG: "z 0.4–1.1", ELG: "z 0.8–1.6", QSO: "z 0.8–3.5" };

const status = document.getElementById("status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function applyMotionPreference(scene) {
  scene.setMotionScale(reducedMotion.matches ? REDUCED_MOTION_SCALE : 1);
}

function describe(meta) {
  const number = new Intl.NumberFormat("en");
  for (const [tracer, count] of Object.entries(meta.tracerCounts)) {
    const dd = document.getElementById(`band-${tracer}`);
    if (dd) dd.textContent = `${number.format(count)} · ${TRACER_RANGES[tracer]}`;
  }
  document.getElementById("about-sample").textContent =
    `${number.format(meta.count)} objects, a uniform, unweighted draw of ${number.format(meta.catalogCount)},`;
  document.getElementById("legend-max").textContent = `${meta.lookbackMax.toFixed(0)} billion years ago`;
}

try {
  const scene = new RiverScene(document.getElementById("scene"));
  createControls(scene);
  applyMotionPreference(scene);
  reducedMotion.addEventListener("change", () => applyMotionPreference(scene));
  const data = await loadTunnel(`${import.meta.env.BASE_URL}data/`);
  const sources = buildSources(data, particleSide() ** 2);
  scene.setData(sources);
  describe(data.meta);
  createLabels(document.getElementById("labels"), scene, data.meta, sources);
  status.hidden = true;
  scene.start();
} catch (error) {
  status.textContent = "The tunnel could not start in this browser.";
  console.error(error);
}
