const DETAIL_ZOOM = 70; // camera distance below which every label shows its detail line
const NEAR_POINTER_PX = 140;
const PAD = 6;

// Map-style callouts that name the regions of the latent cloud. Purely visual (aria-hidden):
// the same information is in the inspector and the README.
export class IslandLabels {
  constructor(container, islands = []) {
    this.container = container;
    this.enabled = true;
    this.islands = islands;
    this.screen = { x: 0, y: 0, w: 0 };
    this.items = islands.map((island) => {
      const node = document.createElement("div");
      node.className = "island";
      const dot = document.createElement("span");
      dot.className = "island-dot";
      const text = document.createElement("div");
      text.className = "island-text";
      const title = document.createElement("span");
      title.className = "island-title";
      title.textContent = island.title;
      const meta = document.createElement("span");
      meta.className = "island-meta";
      meta.textContent = `${island.detail} · ${island.count.toLocaleString()} works`;
      text.append(title, meta);
      node.append(dot, text);
      container.append(node);
      return { island, node, size: null, expanded: false };
    });
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this.container.style.opacity = "0";
  }

  update(scene, { morph, dream, zoom }) {
    const presence = this.enabled ? smoothstep(0.75, 1, morph) * clamp01(1 - dream * 2) : 0;
    this.container.style.opacity = presence.toFixed(3);
    this.container.hidden = presence < 0.01;
    if (this.container.hidden || !this.items.length) return;

    const { width, height } = scene.viewport;
    const pointer = scene.pointerClient;
    const projected = this.items.map((item) => {
      const [x, y, z] = item.island.center;
      const p = scene.project(x, y, z, this.screen);
      return { item, x: p.x, y: p.y, w: p.w };
    });
    const depths = projected.filter((p) => p.w > 0.1).map((p) => p.w);
    const near = Math.min(...depths);
    const far = Math.max(...depths);

    let nearest = null;
    if (pointer) {
      let best = NEAR_POINTER_PX * NEAR_POINTER_PX;
      for (const p of projected) {
        const d = (p.x - pointer.x) ** 2 + (p.y - pointer.y) ** 2;
        if (p.w > 0.1 && d < best) {
          best = d;
          nearest = p.item;
        }
      }
    }

    // Largest regions claim their space first; later labels that would overlap are hidden.
    const placed = [];
    for (const p of projected) {
      const { item } = p;
      const expanded = zoom < DETAIL_ZOOM || item === nearest;
      if (expanded !== item.expanded || !item.size) {
        item.expanded = expanded;
        item.node.classList.toggle("is-expanded", expanded);
        item.size = { w: item.node.offsetWidth, h: item.node.offsetHeight };
      }

      const box = { x: p.x - 4, y: p.y - item.size.h / 2, w: item.size.w, h: item.size.h };
      const onScreen = p.w > 0.1 && box.x > -box.w && box.x < width && box.y > -box.h && box.y < height;
      const clear = onScreen && placed.every((other) => !overlaps(box, other));
      if (!clear) {
        item.node.style.opacity = "0";
        continue;
      }
      placed.push(box);
      const depth = far > near ? (p.w - near) / (far - near) : 0;
      item.node.style.opacity = (1 - depth * 0.55).toFixed(3);
      item.node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    }
  }

  dispose() {
    this.container.replaceChildren();
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.w + PAD && a.x + a.w + PAD > b.x && a.y < b.y + b.h + PAD && a.y + a.h + PAD > b.y;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
