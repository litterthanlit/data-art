import { RIVERS, lookbackAtRadius, riverStep, viewFit } from "../tunnel/mapping.js";

const TRACERS = 24;
const CADENCE = 2.5;
const HOLD = 4.5;
const FADE_MS = 1200;
const BAND = [0.32, 0.72];
const WARM_UP_STEPS = 400;
const WARM_UP_DT = 0.05;

// Invisible tracers follow the same currents as the light, so a label pinned where a
// tracer is sits on a river. It reads the lookback time that distance stands for.
export function createLabels(root, scene, meta, sources, { max = 6 } = {}) {
  const tracers = Array.from({ length: TRACERS }, () => {
    const i = Math.floor(Math.random() * sources.home.length);
    return { r: RIVERS.centre + Math.random() * RIVERS.rim, theta: sources.home[i], home: sources.home[i], speed: sources.speed[i] };
  });
  // The currents are attractors, so a short head start settles tracers into the rivers.
  for (let k = 0; k < WARM_UP_STEPS; k++) for (const t of tracers) riverStep(t, WARM_UP_DT, 0);
  const live = [];
  let nextAt = 1.5;
  const keepClear = [...document.querySelectorAll(".title, .legend, .dock")];

  function overlapsInterface(x, y) {
    return keepClear.some((el) => {
      const box = el.getBoundingClientRect();
      return x > box.left - 90 && x < box.right + 12 && y > box.top - 16 && y < box.bottom + 16;
    });
  }

  function retire(label) {
    label.el.classList.remove("is-visible");
    window.setTimeout(() => label.el.remove(), FADE_MS);
  }

  function screenPosition(t) {
    const { fitX, fitY, reach } = viewFit(window.innerWidth, window.innerHeight);
    return {
      x: (Math.cos(t.theta) * t.r * reach * fitX * 0.5 + 0.5) * window.innerWidth,
      y: (-Math.sin(t.theta) * t.r * reach * fitY * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function pin(time) {
    const candidates = tracers
      .filter((t) => t.r > BAND[0] && t.r < BAND[1])
      .map((t) => ({ t, ...screenPosition(t) }))
      .filter(({ x, y }) => !overlapsInterface(x, y));
    if (candidates.length === 0) return;
    const { t, x, y } = candidates[Math.floor(Math.random() * candidates.length)];
    const el = document.createElement("span");
    el.className = "label";
    el.textContent = `${lookbackAtRadius(t.r, meta).toFixed(1)} Gyr`;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    root.append(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    live.push({ el, until: time + HOLD });
    if (live.length > max) retire(live.shift());
  }

  scene.onFrame((time, dt) => {
    for (const t of tracers) riverStep(t, dt, time);
    while (live.length && live[0].until <= time) retire(live.shift());
    if (time >= nextAt) {
      pin(time);
      nextAt = time + CADENCE;
    }
  });
}
