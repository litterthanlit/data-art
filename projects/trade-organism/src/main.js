import "./styles.css";
import { buildNetwork } from "./network/buildNetwork.js";
import { TradeScene } from "./scene/TradeScene.js";
import { formatEdge, formatNode } from "./ui/readouts.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/trade-organism.json`;
const state = {
  paused: false,
  layers: { general: true, energy: true, food: true, manufacturing: true },
};

let activeScene = null;
let cleanupControls = () => {};
let bootRun = 0;
let bootController = null;

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
  const network = buildNetwork(data);
  if (isStale()) return;

  cleanupControls();
  activeScene?.dispose();

  const scene = new TradeScene({
    stage: document.getElementById("stage"),
    onHover: updateInspector,
  });
  activeScene = scene;
  scene.load(network);
  scene.setPaused(state.paused);
  scene.setLayers(state.layers);
  cleanupControls = wireControls(scene);
  scene.start();
  document.getElementById("status").textContent =
    `${network.nodes.length.toLocaleString()} hubs · ${network.edges.length.toLocaleString()} flows`;
}

function wireControls(scene) {
  const pauseButton = document.getElementById("pause");
  const resetButton = document.getElementById("reset");
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

  pauseButton.addEventListener("click", handlePause);
  resetButton.addEventListener("click", handleReset);
  layerInputs.forEach((input) => {
    input.checked = state.layers[input.dataset.layer] !== false;
    input.addEventListener("change", handleLayerChange);
  });

  updatePauseState();
  scene.setLayers(state.layers);

  return () => {
    pauseButton.removeEventListener("click", handlePause);
    resetButton.removeEventListener("click", handleReset);
    layerInputs.forEach((input) => {
      input.removeEventListener("change", handleLayerChange);
    });
  };
}

function updateInspector(item) {
  const inspector = document.getElementById("inspector");
  if (!item) {
    inspector.textContent = "Hover a hub or flow";
    return;
  }

  inspector.textContent =
    item.kind === "node" ? formatNode(item.value) : formatEdge(item.value);
}

boot().catch((error) => {
  if (error.name === "AbortError") {
    return;
  }

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
