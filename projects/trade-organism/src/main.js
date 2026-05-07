import "./styles.css";
import { buildNetwork } from "./network/buildNetwork.js";
import { TradeScene } from "./scene/TradeScene.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/trade-organism.json`;

let activeScene = null;
let cleanupControls = () => {};

async function boot() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
  const data = await response.json();
  const network = buildNetwork(data);

  cleanupControls();
  activeScene?.dispose();

  const scene = new TradeScene({ stage: document.getElementById("stage") });
  activeScene = scene;
  scene.load(network);
  cleanupControls = wireControls(scene);
  scene.start();
  document.getElementById("status").textContent =
    `${network.nodes.length.toLocaleString()} hubs · ${network.edges.length.toLocaleString()} flows`;
}

function wireControls(scene) {
  const pauseButton = document.getElementById("pause");
  const resetButton = document.getElementById("reset");
  let paused = false;

  const updatePauseState = () => {
    scene.setPaused(paused);
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(paused));
  };

  const handlePause = () => {
    paused = !paused;
    updatePauseState();
  };

  const handleReset = () => {
    scene.resetView();
  };

  pauseButton.addEventListener("click", handlePause);
  resetButton.addEventListener("click", handleReset);
  updatePauseState();

  return () => {
    pauseButton.removeEventListener("click", handlePause);
    resetButton.removeEventListener("click", handleReset);
  };
}

boot().catch((error) => {
  document.body.classList.add("has-error");
  document.getElementById("status").textContent = error.message;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupControls();
    activeScene?.dispose();
    activeScene = null;
  });
}
