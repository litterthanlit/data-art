import "./styles.css";
import { WeatherAudio } from "./weatherAudio.js";
import { WeatherScene } from "./weatherScene.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/varna-weather-2015-2025.json`;

const elements = {
  stage: document.getElementById("stage"),
  count: document.getElementById("count"),
  focusReadout: document.getElementById("focusReadout"),
  status: document.getElementById("status"),
  drawer: document.getElementById("drawer"),
  drawerToggle: document.getElementById("drawerToggle"),
  drawerClose: document.getElementById("drawerClose"),
  allYears: document.getElementById("allYears"),
  yearRange: document.getElementById("yearRange"),
  yearLabel: document.getElementById("yearLabel"),
  timeRange: document.getElementById("timeRange"),
  timeLabel: document.getElementById("timeLabel"),
  audioToggle: document.getElementById("audioToggle"),
  volumeRange: document.getElementById("volumeRange"),
  volumeLabel: document.getElementById("volumeLabel"),
  intensityRange: document.getElementById("intensityRange"),
  intensityLabel: document.getElementById("intensityLabel"),
  pause: document.getElementById("pause"),
  reset: document.getElementById("reset"),
  inspector: document.getElementById("inspector"),
  inspectorDate: document.getElementById("inspectorDate"),
  inspectHumidity: document.getElementById("inspectHumidity"),
  inspectTemp: document.getElementById("inspectTemp"),
  inspectRain: document.getElementById("inspectRain"),
  inspectWind: document.getElementById("inspectWind"),
  inspectPressure: document.getElementById("inspectPressure"),
};

const state = {
  mode: "galaxy",
  focus: "humidity",
  allYears: true,
  selectedYear: 2025,
  timeProgress: 0,
  audioEnabled: false,
  intensity: 0.7,
  selectedPoint: null,
};

const audio = new WeatherAudio();
const scene = new WeatherScene({
  stage: elements.stage,
  onSelect: (reading) => {
    state.selectedPoint = reading;
    updateInspector(reading);
  },
  onFrame: (reading, sceneState) => {
    audio.update(state.selectedPoint ?? reading, sceneState);
  },
});

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatTime(time) {
  if (!time) return "--";
  const [date, hour] = time.split("T");
  const [, month, day] = date.split("-");
  return `${month}.${day} ${hour}`;
}

function formatDate(time) {
  if (!time) return "Hover a point";
  const [date, hour] = time.split("T");
  return `${date} ${hour}`;
}

function setDrawer(open) {
  elements.drawer.classList.toggle("is-open", open);
  elements.drawerToggle.classList.toggle("is-hidden", open);
  elements.drawerToggle.setAttribute("aria-expanded", String(open));
}

function setSegmentedValue(group, value) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.value === value));
  }
}

function updateReadouts() {
  elements.focusReadout.textContent = state.focus.toUpperCase();
  elements.yearLabel.textContent = state.allYears ? `ALL / ${state.selectedYear}` : String(state.selectedYear);
  elements.timeLabel.textContent = formatTime(scene.currentReading()?.time);
  elements.volumeLabel.textContent = `${elements.volumeRange.value}%`;
  elements.intensityLabel.textContent = `${elements.intensityRange.value}%`;
  document.body.dataset.mode = state.mode;
}

function applySceneState() {
  scene.setState({
    mode: state.mode,
    focus: state.focus,
    allYears: state.allYears,
    selectedYear: state.selectedYear,
    timeProgress: state.timeProgress,
    intensity: state.intensity,
  });
  updateReadouts();
  updateInspector(scene.currentReading());
}

function updateInspector(reading) {
  if (!reading) return;
  elements.inspector.classList.add("is-visible");
  elements.inspectorDate.textContent = formatDate(reading.time);
  elements.inspectHumidity.textContent = `${reading.humidity}%`;
  elements.inspectTemp.textContent = `${reading.temperature}°C`;
  elements.inspectRain.textContent = `${reading.rain} mm`;
  elements.inspectWind.textContent = `${reading.windSpeed} km/h`;
  elements.inspectPressure.textContent = `${reading.pressure} hPa`;
}

function updateStatus(data) {
  const meanHumidity = Math.round(
    data.hourly.humidity.reduce((sum, value) => sum + value, 0) / data.hourly.humidity.length
  );
  elements.status.textContent = `${meanHumidity}% mean humidity · Click field for pulse`;
}

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Could not load local weather data (${response.status})`);
  return response.json();
}

for (const group of document.querySelectorAll(".segmented")) {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const value = button.dataset.value;
    setSegmentedValue(group, value);

    if (group.dataset.control === "mode") {
      state.mode = value;
      elements.status.textContent = `${titleCase(value)} mode`;
    }

    if (group.dataset.control === "focus") {
      state.focus = value;
      elements.status.textContent = `${titleCase(value)} focus`;
    }

    applySceneState();
  });
}

elements.drawerToggle.addEventListener("click", () => setDrawer(true));
elements.drawerClose.addEventListener("click", () => setDrawer(false));

elements.allYears.addEventListener("change", () => {
  state.allYears = elements.allYears.checked;
  applySceneState();
});

elements.yearRange.addEventListener("input", () => {
  state.selectedYear = Number(elements.yearRange.value);
  applySceneState();
});

elements.timeRange.addEventListener("input", () => {
  state.timeProgress = Number(elements.timeRange.value) / 1000;
  applySceneState();
});

elements.volumeRange.addEventListener("input", () => {
  audio.setVolume(Number(elements.volumeRange.value) / 100);
  updateReadouts();
});

elements.intensityRange.addEventListener("input", () => {
  state.intensity = Number(elements.intensityRange.value) / 100;
  audio.setIntensity(state.intensity);
  applySceneState();
});

elements.audioToggle.addEventListener("click", async () => {
  if (state.audioEnabled) {
    audio.stop();
    state.audioEnabled = false;
    elements.audioToggle.textContent = "START SOUND";
    elements.audioToggle.classList.remove("is-active");
    elements.status.textContent = "Sound stopped";
    return;
  }

  try {
    await audio.start();
    audio.setVolume(Number(elements.volumeRange.value) / 100);
    audio.setIntensity(state.intensity);
    state.audioEnabled = true;
    elements.audioToggle.textContent = "STOP SOUND";
    elements.audioToggle.classList.add("is-active");
    elements.status.textContent = "Sound active";
  } catch (error) {
    console.error(error);
    elements.status.textContent = "Sound could not start";
  }
});

elements.pause.addEventListener("click", () => {
  scene.setPaused(!scene.paused);
  elements.pause.textContent = scene.paused ? "PLAY" : "PAUSE";
});

elements.reset.addEventListener("click", () => {
  scene.resetView();
  state.timeProgress = 0;
  elements.timeRange.value = "0";
  applySceneState();
});

addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "g") setDrawer(!elements.drawer.classList.contains("is-open"));
  if (event.key === "Escape") setDrawer(false);
});

async function init() {
  try {
    const data = await loadData();
    elements.count.textContent = data.meta.count.toLocaleString();
    scene.setData(data);
    updateStatus(data);
    applySceneState();
  } catch (error) {
    console.error(error);
    elements.count.textContent = "FAILED";
    elements.status.textContent = "Could not load local weather archive.";
  }
}

init();
