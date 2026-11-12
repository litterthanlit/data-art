import { RIVERS, regionAngle, riverStep, viewFit, yearIndexAt } from "../rivers/mapping.js";

const TRACERS_PER_REGION = 18;
const WARM_UP_STEPS = 400;
const WARM_UP_DT = 0.05;
const NAME_BAND = [0.45, 0.75];
const NAME_RADIUS = 0.6;
const LABEL_BAND = [0.25, 0.8];
const CADENCE = 3;
const HOLD = 5;
const FADE_MS = 1200;

// Invisible tracers follow the same currents as each region's light. Names sit
// where a region's tracers gather; labels pin to a tracer and read that year.
export function createStreams({ names, labels }, scene, data, { maxLabels = 5 } = {}) {
  const K = data.regions.length;
  const years = data.end - data.start + 1;
  const tracers = [];
  for (let k = 0; k < K; k++) {
    for (let i = 0; i < TRACERS_PER_REGION; i++) {
      const home = regionAngle(k, K);
      tracers.push({ k, home, theta: home, r: RIVERS.centre + Math.random() * RIVERS.rim, speed: 0.6 + Math.random() * 0.8 });
    }
  }
  // The currents are attractors, so a short head start settles tracers into the rivers.
  for (let s = 0; s < WARM_UP_STEPS; s++) for (const t of tracers) riverStep(t, WARM_UP_DT, 0);

  const nameEls = data.regions.map((region) => {
    const el = document.createElement("span");
    el.className = "name";
    el.textContent = region.name;
    names.append(el);
    return el;
  });

  const keepClear = [...document.querySelectorAll(".title, .legend, .dock")];
  // Boxes are [left, top, right, bottom] in CSS pixels.
  const overlapsInterface = ([l, t, r, b]) =>
    keepClear.some((el) => {
      const box = el.getBoundingClientRect();
      return l < box.right + 12 && r > box.left - 12 && t < box.bottom + 12 && b > box.top - 12;
    });

  function toScreen(theta, r) {
    const { fitX, fitY, reach } = viewFit(window.innerWidth, window.innerHeight);
    return {
      x: (Math.cos(theta) * r * reach * fitX * 0.5 + 0.5) * window.innerWidth,
      y: (-Math.sin(theta) * r * reach * fitY * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function placeNames() {
    for (let k = 0; k < K; k++) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const t of tracers) {
        if (t.k !== k || t.r < NAME_BAND[0] || t.r > NAME_BAND[1]) continue;
        sx += Math.cos(t.theta);
        sy += Math.sin(t.theta);
        n++;
      }
      const coherence = n ? Math.hypot(sx, sy) / n : 0;
      const { x, y } = toScreen(Math.atan2(sy, sx), NAME_RADIUS);
      nameEls[k].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      const onScreen = x > 48 && x < window.innerWidth - 48 && y > 24 && y < window.innerHeight - 24;
      nameEls[k].classList.toggle("is-visible", coherence > 0.6 && onScreen && !overlapsInterface([x - 64, y - 8, x + 64, y + 8]));
    }
  }

  const live = [];
  let nextAt = 2;
  function retire(label) {
    label.el.classList.remove("is-visible");
    window.setTimeout(() => label.el.remove(), FADE_MS);
  }

  function pin(time) {
    const candidates = tracers
      .filter((t) => t.r > LABEL_BAND[0] && t.r < LABEL_BAND[1])
      .map((t) => ({ t, ...toScreen(t.theta, t.r) }))
      // Labels run rightward from their point, so leave room for the text.
      .filter(({ x, y }) => x > 16 && x < window.innerWidth - 200 && y > 24 && !overlapsInterface([x, y - 8, x + 190, y + 8]));
    if (candidates.length === 0) return;
    const { t, x, y } = candidates[Math.floor(Math.random() * candidates.length)];
    const y0 = yearIndexAt(t.r, years);
    const v = data.regions[t.k].values[y0];
    const el = document.createElement("span");
    el.className = "label";
    el.textContent = `${data.regions[t.k].name} · ${data.start + y0} · ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}°C`;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    labels.append(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    live.push({ el, until: time + HOLD });
    if (live.length > maxLabels) retire(live.shift());
  }

  let frame = 0;
  scene.onFrame((time, dt) => {
    for (const t of tracers) riverStep(t, dt, time);
    if (++frame % 4 === 0) placeNames();
    while (live.length && live[0].until <= time) retire(live.shift());
    if (time >= nextAt) {
      pin(time);
      nextAt = time + CADENCE;
    }
  });
  placeNames();
}
