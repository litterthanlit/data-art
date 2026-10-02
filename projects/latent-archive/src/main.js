import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { describeWork, loadArchive, MissingArchiveError } from "./archive/loadArchive.js";
import { ArchiveScene } from "./scene/ArchiveScene.js";
import { IslandLabels } from "./ui/IslandLabels.js";
import { formatEra, formatYear, imageUrl, workUrl } from "./ui/readouts.js";

const ERA_SPAN = 0.04; // each era window shows ±4% of the collection, by rank
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const state = { paused: false, mode: "auto", era: null, held: null, labels: true };

let activeScene = null;
let islandLabels = null;
let archive = null;
let sortedYears = null;
let cleanupControls = () => {};
let bootRun = 0;
let bootController = null;
let imageTimer = null;
let imageToken = 0;
let imageFailures = 0;
const IMAGE_GIVE_UP = 3; // stop asking the image host after repeated refusals

async function boot() {
  const runId = ++bootRun;
  bootController = new AbortController();
  const { signal } = bootController;
  const isStale = () => signal.aborted || runId !== bootRun;

  const loaded = await loadArchive({ signal, onProgress: showProgress });
  if (isStale()) return;
  archive = loaded;
  sortedYears = Int16Array.from(archive.years).sort();

  cleanupControls();
  activeScene?.dispose();
  islandLabels?.dispose();
  islandLabels = new IslandLabels(document.getElementById("islands"), archive.meta.islands);
  islandLabels.setEnabled(state.labels);
  const cycleFill = document.getElementById("cycle-fill");

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
      const [name, description] = info.label.split(" — ");
      document.getElementById("phase-name").textContent = name;
      document.getElementById("phase").textContent = description;
    },
    onFrame: (frame) => {
      islandLabels.update(scene, frame);
      cycleFill.style.transform = `scaleX(${frame.cycle ?? 0})`;
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

  const [first, last] = archive.meta.years;
  document.getElementById("stat-works").textContent = archive.count.toLocaleString();
  document.getElementById("stat-pigments").textContent = (archive.count * archive.cells).toLocaleString();
  document.getElementById("stat-span").textContent = `${formatYear(first)} – ${formatYear(last)}`;
  window.requestAnimationFrame(() => document.getElementById("loader").classList.add("is-done"));
}

function showProgress(fraction) {
  const loader = document.getElementById("loader");
  loader.classList.remove("is-indeterminate");
  document.getElementById("loader-fill").style.transform = `scaleX(${fraction})`;
  document.getElementById("loader-pct").textContent = `${Math.round(fraction * 100)}%`;
}

function wireControls(scene) {
  const pauseButton = document.getElementById("pause");
  const resetButton = document.getElementById("reset");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
  const eraInput = document.getElementById("era");
  const eraAll = document.getElementById("era-all");
  const labelsInput = document.getElementById("labels");
  const indicator = document.querySelector(".segmented-indicator");

  const updatePause = () => {
    scene.setPaused(state.paused);
    pauseButton.setAttribute("aria-label", state.paused ? "Resume" : "Pause");
    pauseButton.setAttribute("aria-pressed", String(state.paused));
  };

  // Slide the segmented control's pill under the checked option.
  const moveIndicator = () => {
    // Measure the <label>: the inner span's offsetParent is the label itself.
    const checked = modeInputs.find((input) => input.checked)?.parentElement;
    if (!checked) return;
    indicator.style.width = `${checked.offsetWidth}px`;
    indicator.style.transform = `translateX(${checked.offsetLeft}px)`;
  };

  const setMode = (mode) => {
    state.mode = mode;
    modeInputs.forEach((input) => {
      input.checked = input.value === mode;
    });
    scene.setMode(mode);
    moveIndicator();
  };

  const setLabels = (value) => {
    state.labels = value;
    labelsInput.checked = value;
    islandLabels.setEnabled(value);
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
    labels: () => setLabels(labelsInput.checked),
    resize: moveIndicator,
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
        l: () => setLabels(!state.labels),
        L: () => setLabels(!state.labels),
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
  labelsInput.addEventListener("change", handlers.labels);
  window.addEventListener("resize", handlers.resize);
  document.fonts?.ready.then(moveIndicator);
  reducedMotionQuery.addEventListener("change", handlers.motion);
  window.addEventListener("keydown", handlers.key);

  updatePause();
  setMode(state.mode);
  setEra(state.era);
  setLabels(state.labels);

  return () => {
    pauseButton.removeEventListener("click", handlers.pause);
    resetButton.removeEventListener("click", handlers.reset);
    modeInputs.forEach((input) => input.removeEventListener("change", handlers.mode));
    eraInput.removeEventListener("input", handlers.era);
    eraAll.removeEventListener("click", handlers.eraAll);
    labelsInput.removeEventListener("change", handlers.labels);
    window.removeEventListener("resize", handlers.resize);
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
  document.getElementById("work-held").hidden = state.held !== index;
  hint.hidden = true;

  document.getElementById("work-title").textContent = work.title;
  document.getElementById("work-artist").textContent = work.artist;
  setFact("work-date", work.date);
  setFact("work-place", work.place);
  setFact("work-dept", work.department);
  document.getElementById("work-link").href = workUrl(work);
  paintMosaic(index);

  // The 16 pigments show instantly; the real image arrives only if the gaze lingers.
  // AIC's image host sits behind a Cloudflare challenge that <img> cannot pass, so a
  // failure is expected: the plate then shows the machine's 16-colour memory instead.
  const image = document.getElementById("plate-image");
  const token = ++imageToken;
  image.hidden = true;
  image.onload = null;
  image.onerror = null;

  if (imageFailures >= IMAGE_GIVE_UP) {
    setPlate("unavailable");
    return;
  }

  setPlate("loading");
  imageTimer = window.setTimeout(() => {
    const done = (ok) => {
      if (token !== imageToken) return; // a newer hover owns the plate
      imageFailures = ok ? 0 : imageFailures + 1;
      image.hidden = !ok;
      setPlate(ok ? "loaded" : "unavailable");
    };
    image.onload = () => done(image.naturalWidth > 0);
    image.onerror = () => done(false);
    image.alt = `${work.title}, ${work.artist}`;
    const src = imageUrl(work);
    if (image.src === src && image.complete) {
      done(image.naturalWidth > 0); // same image again: no new load event fires
    } else {
      image.src = src;
    }
  }, state.held === index ? 0 : 220);
}

function setFact(id, value) {
  const node = document.getElementById(id);
  node.textContent = value || "";
  node.parentElement.hidden = !value;
}

function setPlate(status) {
  document.getElementById("plate").dataset.state = status;
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
  document.getElementById("loader").classList.add("is-done");
  const status = document.getElementById("status");
  status.hidden = false;
  status.textContent =
    error instanceof MissingArchiveError ? error.message : `Could not recall the archive: ${error.message}`;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    bootRun += 1;
    bootController?.abort();
    cleanupControls();
    activeScene?.dispose();
    activeScene = null;
    islandLabels?.dispose();
  });
}
