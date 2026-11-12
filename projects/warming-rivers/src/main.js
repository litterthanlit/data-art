import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { loadWarming } from "./data/loadWarming.js";
import { buildSources } from "./rivers/mapping.js";
import { particleSide } from "./rivers/RiverField.js";
import { RiverScene } from "./scene/RiverScene.js";
import { createStreams } from "./ui/streams.js";
import { createControls } from "./ui/controls.js";

const REDUCED_MOTION_SCALE = 0.25;
const SCALE_NOTES = { region: "Each region on its own range", shared: "One range for all regions" };

const status = document.getElementById("status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function describe(data) {
  const list = document.getElementById("regions");
  for (const region of data.regions) {
    const v = region.values.at(-1);
    const row = document.createElement("div");
    row.innerHTML = `<dt></dt><dd>${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)} °C</dd>`;
    row.querySelector("dt").textContent = region.name;
    list.append(row);
  }
}

function createScaleSwitch(scene) {
  const buttons = [...document.querySelectorAll("[data-scale]")];
  let mode = "region";
  function choose(next) {
    mode = next;
    scene.setScale(mode);
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scale === mode)));
    document.getElementById("scale-note").textContent = SCALE_NOTES[mode];
  }
  buttons.forEach((b) => b.addEventListener("click", () => choose(b.dataset.scale)));
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (document.getElementById("about").open) return;
    if (event.key === "s" || event.key === "S") choose(mode === "region" ? "shared" : "region");
  });
}

try {
  const scene = new RiverScene(document.getElementById("scene"));
  createControls(scene);
  const applyMotion = () => scene.setMotionScale(reducedMotion.matches ? REDUCED_MOTION_SCALE : 1);
  applyMotion();
  reducedMotion.addEventListener("change", applyMotion);

  const data = await loadWarming(`${import.meta.env.BASE_URL}data/`);
  scene.setData(buildSources(data.regions.length, particleSide() ** 2), data.regions);
  createScaleSwitch(scene);
  describe(data);
  createStreams({ names: document.getElementById("names"), labels: document.getElementById("labels") }, scene, data);
  status.hidden = true;
  scene.start();
} catch (error) {
  status.textContent = "The rivers could not start in this browser.";
  console.error(error);
}
