import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { DreamField } from "../dream/DreamField.js";

export const STATES = {
  archive: { morph: 0, dream: 0, label: "Archive — the collection in chronological order" },
  latent: { morph: 1, dream: 0, label: "Latent — works gathered by visual likeness" },
  dream: { morph: 1, dream: 1, label: "Dream — pigment loosened from its canvas" },
};

// Installation loop: seconds held in each memory before drifting onward.
const AUTO_SEQUENCE = [
  ["archive", 18],
  ["latent", 20],
  ["dream", 16],
  ["latent", 12],
];

const PICK_RADIUS_PX = 16;

export class ArchiveScene {
  constructor({ stage, onHover = () => {}, onSelect = () => {}, onPhase = () => {} }) {
    if (!stage) throw new Error("Scene stage is missing");

    this.stage = stage;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.onPhase = onPhase;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    this.clock = new THREE.Clock();
    this.animationId = null;
    this.time = 0;
    this.paused = false;
    this.reducedMotion = false;
    this.mode = "auto";
    this.autoIndex = 0;
    this.autoElapsed = 0;
    this.phase = null;
    this.morph = 0;
    this.dream = 0;
    this.archive = null;
    this.hovered = null;
    this.selected = null;
    this.pointerClient = null;
    this.pointerDirty = false;
    this.activePointers = new Map();
    this.dragStart = null;
    this.pinchStart = null;
    this.baseRotation = { x: 0.18, y: 0 };
    this.autoRotationY = 0;
    this.zoomLimits = { min: 18, max: 150 };
    this.scratch = new THREE.Vector3();
    this.inverseQuat = new THREE.Quaternion();

    this.organism = new THREE.Group();
    this.field = new DreamField();
    this.organism.add(this.field.object);
    this.scene.add(this.organism);

    this.renderer.setClearColor(0x020206, 1);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.field.uniforms.uPixelRatio.value = this.pixelRatio;
    Object.assign(this.renderer.domElement.style, {
      display: "block",
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      touchAction: "none",
    });
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.stage.prepend(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.42, 0.16);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWheel = this.handleWheel.bind(this);

    const canvas = this.renderer.domElement;
    window.addEventListener("resize", this.handleResize);
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });

    this.resetView();
    this.handleResize();
  }

  load(archive) {
    this.archive = archive;
    this.field.load(archive);
    this.enterPhase(this.targetState());
    this.render();
  }

  start() {
    if (this.animationId !== null) return;
    this.clock.start();
    this.animate();
  }

  animate() {
    this.animationId = window.requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const speed = this.reducedMotion ? 0.25 : 1;

    if (!this.paused) {
      this.time += delta * speed;
      if (!this.reducedMotion) this.autoRotationY += delta * 0.035;
      this.advanceDirector(delta);
    }

    const target = STATES[this.targetState()];
    const dreamCap = this.reducedMotion ? 0.35 : 1;
    const ease = 1 - Math.exp(-delta * (this.paused ? 0 : 0.42));
    this.morph += (target.morph - this.morph) * ease;
    this.dream += (target.dream * dreamCap - this.dream) * ease * 1.4;

    this.applyRotation();
    this.updateBillboard();
    const u = this.field.uniforms;
    u.uTime.value = this.time;
    u.uMorph.value = this.morph;
    u.uDream.value = this.dream;

    if (this.pointerDirty) {
      this.pointerDirty = false;
      this.updateHover();
    }
    this.render();
  }

  advanceDirector(delta) {
    if (this.mode !== "auto" || this.reducedMotion) return;
    this.autoElapsed += delta;
    const [, hold] = AUTO_SEQUENCE[this.autoIndex];
    if (this.autoElapsed >= hold) {
      this.autoElapsed = 0;
      this.autoIndex = (this.autoIndex + 1) % AUTO_SEQUENCE.length;
      this.enterPhase(this.targetState());
    }
  }

  targetState() {
    if (this.mode !== "auto") return this.mode;
    return this.reducedMotion ? "latent" : AUTO_SEQUENCE[this.autoIndex][0];
  }

  enterPhase(name) {
    if (this.phase === name) return;
    this.phase = name;
    this.onPhase(name, STATES[name]);
  }

  setMode(mode) {
    this.mode = mode in STATES ? mode : "auto";
    if (this.mode === "auto") {
      this.autoIndex = 0;
      this.autoElapsed = 0;
    }
    this.enterPhase(this.targetState());
  }

  setPaused(value) {
    this.paused = Boolean(value);
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
    this.enterPhase(this.targetState());
  }

  setEra(window) {
    this.era = window;
    this.field.setEra(window);
    this.pointerDirty = true;
  }

  select(index) {
    this.selected = index;
    this.field.setHover(index ?? this.hovered);
    this.onSelect(index);
  }

  resetView() {
    this.baseRotation.x = 0.18;
    this.baseRotation.y = 0;
    this.autoRotationY = 0;
    this.camera.position.set(0, 0, 92);
    this.camera.lookAt(0, 0, 0);
    this.applyRotation();
  }

  applyRotation() {
    const sway = Math.sin(this.time * 0.11) * 0.06;
    this.organism.rotation.x = this.baseRotation.x + sway;
    this.organism.rotation.y = this.baseRotation.y + this.autoRotationY;
    this.organism.updateMatrixWorld(true);
  }

  // Miniatures always face the viewer: camera axes expressed in the organism's frame.
  updateBillboard() {
    this.inverseQuat.copy(this.organism.quaternion).invert();
    const u = this.field.uniforms;
    u.uRight.value.set(1, 0, 0).applyQuaternion(this.camera.quaternion).applyQuaternion(this.inverseQuat);
    u.uUp.value.set(0, 1, 0).applyQuaternion(this.camera.quaternion).applyQuaternion(this.inverseQuat);
  }

  /* ------------------------------------------------------------ picking */

  updateHover() {
    const index = this.pick();
    if (index === this.hovered) return;
    this.hovered = index;
    if (this.selected === null) this.field.setHover(index);
    this.renderer.domElement.style.cursor = index === null ? "" : "pointer";
    this.onHover(index);
  }

  pick() {
    if (!this.archive || !this.pointerClient || this.activePointers.size > 0) return null;
    if (this.dream > 0.45) return null; // pigment is scattered; anchors no longer match

    const { width, height, x, y } = this.pointerClient;
    const matrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    ).multiply(this.organism.matrixWorld);
    const e = matrix.elements;
    const years = this.archive.years;
    const era = this.era;
    let best = null;
    let bestScore = PICK_RADIUS_PX * PICK_RADIUS_PX;

    for (let i = 0; i < this.archive.count; i += 1) {
      if (era && (years[i] < era[0] || years[i] > era[1])) continue;
      const p = this.field.anchorOf(i, this.morph, this.scratch);
      const w = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15];
      if (w <= 0.1) continue;
      const sx = ((e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12]) / w * 0.5 + 0.5) * width;
      const sy = (1 - ((e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]) / w * 0.5 + 0.5)) * height;
      const dx = sx - x;
      const dy = sy - y;
      // Prefer nearer works when several overlap under the cursor.
      const score = dx * dx + dy * dy + w * 0.02;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------ input */

  handlePointerDown(event) {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.renderer.domElement.setPointerCapture?.(event.pointerId);

    if (this.activePointers.size === 1) {
      this.dragStart = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        rotationX: this.baseRotation.x,
        rotationY: this.baseRotation.y,
        moved: false,
      };
      this.pinchStart = null;
    } else if (this.activePointers.size === 2) {
      this.dragStart = null;
      this.pinchStart = { distance: this.pointerDistance(), z: this.camera.position.z };
    }
  }

  handlePointerMove(event) {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pinchStart && this.activePointers.size >= 2) {
        const distance = this.pointerDistance();
        if (distance) this.setZoom(this.pinchStart.z * (this.pinchStart.distance / distance));
        return;
      }

      if (this.dragStart?.id === event.pointerId) {
        const dx = event.clientX - this.dragStart.x;
        const dy = event.clientY - this.dragStart.y;
        if (Math.hypot(dx, dy) > 4) this.dragStart.moved = true;
        this.baseRotation.y = this.dragStart.rotationY + dx * 0.006;
        this.baseRotation.x = THREE.MathUtils.clamp(this.dragStart.rotationX + dy * 0.005, -1.1, 1.1);
        return;
      }
    }

    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointerClient = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    this.pointerDirty = true;
  }

  handlePointerUp(event) {
    const drag = this.dragStart;
    this.activePointers.delete(event.pointerId);
    if (this.renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (drag?.id === event.pointerId && !drag.moved && event.type === "pointerup") {
      const bounds = this.renderer.domElement.getBoundingClientRect();
      this.pointerClient = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        width: bounds.width,
        height: bounds.height,
      };
      this.select(this.pick());
    }

    this.dragStart = null;
    this.pinchStart = null;
  }

  handlePointerLeave() {
    if (this.activePointers.size > 0) return;
    this.pointerClient = null;
    this.pointerDirty = true;
  }

  handleWheel(event) {
    event.preventDefault();
    this.setZoom(this.camera.position.z + event.deltaY * 0.05);
  }

  pointerDistance() {
    const [a, b] = [...this.activePointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  setZoom(z) {
    this.camera.position.z = THREE.MathUtils.clamp(z, this.zoomLimits.min, this.zoomLimits.max);
    this.pointerDirty = true;
  }

  zoomBy(factor) {
    this.setZoom(this.camera.position.z * factor);
  }

  rotateBy(dx, dy) {
    this.baseRotation.y += dx;
    this.baseRotation.x = THREE.MathUtils.clamp(this.baseRotation.x + dy, -1.1, 1.1);
  }

  handleResize() {
    const width = Math.max(1, this.stage.clientWidth || window.innerWidth);
    const height = Math.max(1, this.stage.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    // Keep the whole sculpture in frame on portrait screens.
    this.camera.fov = width < height ? 62 : 46;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.field.uniforms.uViewScale.value = height / 900;
    this.composer.setSize(width, height);
    this.bloom.setSize(Math.round(width / 2), Math.round(height / 2));
    this.pointerDirty = true;
  }

  render() {
    this.composer.render();
  }

  dispose() {
    if (this.animationId !== null) window.cancelAnimationFrame(this.animationId);
    this.animationId = null;
    const canvas = this.renderer.domElement;
    window.removeEventListener("resize", this.handleResize);
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointercancel", this.handlePointerUp);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    canvas.removeEventListener("wheel", this.handleWheel);
    this.field.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
