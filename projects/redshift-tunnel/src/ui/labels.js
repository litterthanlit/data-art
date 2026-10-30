import * as THREE from "three";

const CADENCE = 2.5;
const FADE_MS = 1200;
const MIN_CENTRE_DISTANCE = 0.18;
const ATTEMPTS = 40;

// A few lookback times float beside the objects they belong to, then fade.
export function createLabels(root, scene, data, anchors, { max = 8 } = {}) {
  const live = [];
  const point = new THREE.Vector3();
  let nextAt = 1;

  function project(index) {
    point.fromArray(anchors.positions, index * 3).applyMatrix4(scene.field.matrixWorld).project(scene.camera);
    return point;
  }

  function place(label) {
    const p = project(label.index);
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    label.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function pick() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const minDistance = MIN_CENTRE_DISTANCE * Math.min(w, h);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const index = Math.floor(Math.random() * data.count);
      const p = project(index);
      if (p.z > 1 || Math.abs(p.x) > 0.88 || Math.abs(p.y) > 0.82) continue;
      if (Math.hypot((p.x * w) / 2, (p.y * h) / 2) < minDistance) continue;
      return index;
    }
    return null;
  }

  function retire(label) {
    label.el.classList.remove("is-visible");
    window.setTimeout(() => label.el.remove(), FADE_MS);
  }

  function spawn() {
    const index = pick();
    if (index === null) return;
    const el = document.createElement("span");
    el.className = "label";
    el.textContent = `${data.lookback[index].toFixed(1)} Gyr`;
    root.append(el);
    const label = { el, index };
    place(label);
    live.push(label);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    if (live.length > max) retire(live.shift());
  }

  scene.onFrame((time) => {
    if (time >= nextAt) {
      spawn();
      nextAt = time + CADENCE;
    }
    for (const label of live) place(label);
  });
}
