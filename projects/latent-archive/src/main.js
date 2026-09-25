import "./styles.css";
import { describeWork, loadArchive, MissingArchiveError } from "./archive/loadArchive.js";
import { ArchiveScene } from "./scene/ArchiveScene.js";
import { formatEra, formatMeta, formatStatus, imageUrl, workUrl } from "./ui/readouts.js";

const ERA_SPAN = 0.04; // each era window shows ±4% of the collection, by rank
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const state = { paused: false, mode: "auto", era: null, held: null };

let activeScene = null;
let archive = null;
let sortedYears = null;
let cleanupControls = () => {};
let bootRun = 0;
let bootController = null;
let imageTimer = null;

async function boot() {
  const runId = ++bootRun;
  bootController = new AbortController();
  const { signal } = bootController;
  const isStale = () => signal.aborted || runId !== bootRun;

  const loaded = await loadArchive({ signal });
  if (isStale()) return;
  archive = loaded;
  sortedYears = Int16Array.from(archive.years).sort();

  cleanupControls();
  activeScene?.dispose();

  const scene = new ArchiveScene({
    stage: document.getElementById("stage"),
    onHover: (index) => {
      if (state.held === null) showWork(index);
    },
    onSelect: (index) => {
      state.held = index;
      showWork(index);
    },
    onPhase: (_, info) => {
      document.getElementById("phase").textContent = info.label;
    },
  });
  activeScene = scene;
  scene.setReducedMotion(reducedMotionQuery.matches);
  scene.load(archive);
  scene.setMode(state.mode);
  scene.setPaused(state.paused);
  scene.setEra(state.era);
  cleanupControls = wireControls(scene);
  scene.start();

  document.getElementById("status").textContent = formatStatus(archive);
}

function wireControls(scene) {
  const pauseButton = document.getElementById("pause");
  const resetButton = document.getElementById("reset");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
  const eraInput = document.getElementById("era");
  const eraAll = document.getElementById("era-all");

  const updatePause = () => {
    scene.setPaused(state.paused);
    pauseButton.textContent = state.paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(state.paused));
  };

  const setMode = (mode) => {
    state.mode = mode;
    modeInputs.forEach((input) => {
      input.checked = input.value === mode;
    });
    scene.setMode(mode);
  };

  const setEra = (window) => {
    state.era = window;
    scene.setEra(window);
    document.getElementById("era-label").textContent = formatEra(window);
    eraAll.hidden = !window;
  };

  const handlers = {
    pause: () => {
      state.paused = !state.paused;
      updatePause();
    },
    reset: () => scene.resetView(),
    mode: (event) => setMode(event.target.value),
    era: () => setEra(eraWindow(Number(eraInput.value) / 100)),
    eraAll: () => setEra(null),
    motion: () => scene.setReducedMotion(reducedMotionQuery.matches),
    key: (event) => {
      if (event.target.closest?.("input[type=range]") && event.key.startsWith("Arrow")) return;
      const modes = { 1: "auto", 2: "archive", 3: "latent", 4: "dream" };
      const actions = {
        " ": handlers.pause,
        r: handlers.reset,
        R: handlers.reset,
        Escape: () => scene.select(null),
        ArrowLeft: () => scene.rotateBy(-0.12, 0),
        ArrowRight: () => scene.rotateBy(0.12, 0),
        ArrowUp: () => scene.rotateBy(0, -0.1),
        ArrowDown: () => scene.rotateBy(0, 0.1),
        "+": () => scene.zoomBy(0.88),
        "=": () => scene.zoomBy(0.88),
        "-": () => scene.zoomBy(1.14),
      };
      if (event.key in modes) {
        setMode(modes[event.key]);
      } else if (event.key in actions) {
        if (event.key === " " && event.target.closest?.("button, input")) return;
        event.preventDefault();
        actions[event.key]();
      }
    },
  };

  pauseButton.addEventListener("click", handlers.pause);
  resetButton.addEventListener("click", handlers.reset);
  modeInputs.forEach((input) => input.addEventListener("change", handlers.mode));
  eraInput.addEventListener("input", handlers.era);
  eraAll.addEventListener("click", handlers.eraAll);
  reducedMotionQuery.addEventListener("change", handlers.motion);
  window.addEventListener("keydown", handlers.key);

  updatePause();
  setMode(state.mode);
  setEra(state.era);

  return () => {
    pauseButton.removeEventListener("click", handlers.pause);
    resetButton.removeEventListener("click", handlers.reset);
    modeInputs.forEach((input) => input.removeEventListener("change", handlers.mode));
    eraInput.removeEventListener("input", handlers.era);
    eraAll.removeEventListener("click", handlers.eraAll);
    reducedMotionQuery.removeEventListener("change", handlers.motion);
    window.removeEventListener("keydown", handlers.key);
  };
}

function eraWindow(position) {
  const last = sortedYears.length - 1;
  const at = (t) => sortedYears[Math.round(Math.min(1, Math.max(0, t)) * last)];
  const center = ERA_SPAN + position * (1 - ERA_SPAN * 2);
  return [at(center - ERA_SPAN), at(center + ERA_SPAN)];
}

function showWork(index) {
  const inspector = document.getElementById("inspector");
  const hint = document.getElementById("hint");
  window.clearTimeout(imageTimer);

  if (index === null || index === undefined || !archive) {
    inspector.hidden = true;
    inspector.classList.remove("is-held");
    hint.hidden = false;
    return;
  }

  const work = describeWork(archive, index);
  inspector.hidden = false;
  inspector.classList.toggle("is-held", state.held === index);
  hint.hidden = true;

  document.getElementById("work-title").textContent = work.title;
  document.getElementById("work-artist").textContent = work.artist;
  document.getElementById("work-meta").textContent = formatMeta(work);
  document.getElementById("work-link").href = workUrl(work);
  paintMosaic(index);

  // The 16 pigments show instantly; the real image arrives only if the gaze lingers.
  const image = document.getElementById("plate-image");
  image.hidden = true;
  image.onload = null;
  imageTimer = window.setTimeout(() => {
    image.onload = () => {
      image.hidden = false;
    };
    image.alt = `${work.title}, ${work.artist}`;
    image.src = imageUrl(work);
  }, state.held === index ? 0 : 220);
}

function paintMosaic(index) {
  const mosaic = document.getElementById("plate-mosaic");
  const { cells, colors } = archive;
  if (mosaic.childElementCount !== cells) {
    mosaic.replaceChildren(...Array.from({ length: cells }, () => document.createElement("span")));
    mosaic.style.gridTemplateColumns = `repeat(${archive.grid}, 1fr)`;
  }
  [...mosaic.children].forEach((cell, c) => {
    const i = (index * cells + c) * 3;
    cell.style.background = `rgb(${colors[i]} ${colors[i + 1]} ${colors[i + 2]})`;
  });
}

boot().catch((error) => {
  if (error.name === "AbortError") return;
  document.body.classList.add("has-error");
  document.getElementById("status").textContent =
    error instanceof MissingArchiveError ? error.message : `Could not recall the archive: ${error.message}`;
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
