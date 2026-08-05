import "./styles.css";
import { buildPlasma } from "./plasma/buildPlasma.js";
import { SolarScene } from "./scene/SolarScene.js";
import { formatHour } from "./ui/readouts.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/solar-wind-breath.json`;
const state = {
  paused: false,
  layers: { plasma: true, cme: true, storm: true },
  scrubbing: false,
};

let activeScene = null;
let cleanupControls = () => {};
let bootRun = 0;
let bootController = null;
let plasmaData = null;

async function boot() {
  const runId = ++bootRun;
  bootController = new AbortController();
  const { signal } = bootController;
  const isStale = () => signal.aborted || runId !== bootRun;

  const response = await fetch(DATA_URL, { signal });
  if (isStale()) return;
  if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
  const data = await response.json();
  if (isStale()) return;

  plasmaData = buildPlasma(data);
  if (isStale()) return;

  cleanupControls();
  activeScene?.dispose();

  const scene = new SolarScene({
    stage: document.getElementById("stage"),
    onSample: updateInspector,
  });
  activeScene = scene;
  scene.load(plasmaData);
  scene.setPaused(state.paused);
  scene.setLayers(state.layers);
  cleanupControls = wireControls(scene);
  scene.start();

  document.getElementById("status").textContent =
    `${plasmaData.samples.length.toLocaleString()} hours · ${plasmaData.cmes.length} CMEs · ${plasmaData.storms.length} storms`;
}

function wireControls(scene) {
  const pauseButton = document.getElementById("pause");
  const resetButton = document.getElementById("reset");
  const timeInput = document.getElementById("time");
  const layerInputs = [...document.querySelectorAll("[data-layer]")];

  const updatePauseState = () => {
    scene.setPaused(state.paused);
    pauseButton.textContent = state.paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(state.paused));
  };

  const handlePause = () => {
    state.paused = !state.paused;
    updatePauseState();
  };

  const handleReset = () => {
    scene.resetView();
  };

  const handleLayerChange = (event) => {
    const layer = event.target.dataset.layer;
    state.layers[layer] = event.target.checked;
    scene.setLayers(state.layers);
  };

  const handleTimeInput = () => {
    state.scrubbing = true;
    scene.setAutoPlay(false);
    scene.setProgress(Number(timeInput.value) / 100);
  };

  const handleTimeCommit = () => {
    state.scrubbing = false;
  };

  pauseButton.addEventListener("click", handlePause);
  resetButton.addEventListener("click", handleReset);
  timeInput.addEventListener("input", handleTimeInput);
  timeInput.addEventListener("change", handleTimeCommit);
  layerInputs.forEach((input) => {
    input.checked = state.layers[input.dataset.layer] !== false;
    input.addEventListener("change", handleLayerChange);
  });

  updatePauseState();
  scene.setLayers(state.layers);

  return () => {
    pauseButton.removeEventListener("click", handlePause);
    resetButton.removeEventListener("click", handleReset);
    timeInput.removeEventListener("input", handleTimeInput);
    timeInput.removeEventListener("change", handleTimeCommit);
    layerInputs.forEach((input) => {
      input.removeEventListener("change", handleLayerChange);
    });
  };
}

function updateInspector(sample, { fromAutoplay = false } = {}) {
  const inspector = document.getElementById("inspector");
  const timeInput = document.getElementById("time");
  const timeLabel = document.getElementById("time-label");

  if (!sample) {
    inspector.textContent = "Drag to explore the breath";
    return;
  }

  if (!state.scrubbing && fromAutoplay) {
    timeInput.value = String(Math.round(activeScene.progress * 100));
  } else if (!fromAutoplay) {
    timeInput.value = String(Math.round(activeScene.progress * 100));
  }

  timeLabel.textContent = sample.hour.t.slice(0, 16).replace("T", " ");
  inspector.textContent = formatHour(sample.hour, sample.cme);
}

boot().catch((error) => {
  if (error.name === "AbortError") return;
  document.body.classList.add("has-error");
  document.getElementById("status").textContent = error.message;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    bootRun += 1;
    bootController?.abort();
    cleanupControls();
    activeScene?.dispose();
    activeScene = null;
  });
}
