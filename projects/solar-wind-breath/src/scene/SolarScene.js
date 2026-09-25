import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { PlasmaField } from "../plasma/PlasmaField.js";
import { sampleAtProgress } from "../plasma/buildPlasma.js";

export class SolarScene {
  constructor({ stage, onSample = () => {}, onHover = () => {} }) {
    if (!stage) {
      throw new Error("Scene stage is missing");
    }

    this.stage = stage;
    this.onSample = onSample;
    this.onHover = onHover;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerClient = null;
    this.hoveredKind = null;
    this.clock = new THREE.Clock();
    this.animationId = null;
    this.paused = false;
    this.progress = 0;
    this.autoPlay = true;
    this.scrubbing = false;
    this.plasmaData = null;
    this.currentSample = null;
    this.activePointers = new Map();
    this.dragPointerId = null;
    this.dragStart = null;
    this.baseRotation = { x: 0.2, y: -0.62 };
    this.cameraHome = new THREE.Vector3(0, 5, 74);
    this.shakeOffset = new THREE.Vector3();
    this.reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.autoRotationY = 0;
    this.swayTime = 0;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.pinchStart = null;
    this.zoomLimits = { min: 30, max: 200 };
    this.layerState = { plasma: true, cme: true, storm: true };

    this.organism = new THREE.Group();
    this.field = new PlasmaField();
    this.organism.add(this.field.object);
    this.scene.add(this.organism);

    this.renderer.setClearColor(0x010208, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.5, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    this.stage.appendChild(this.renderer.domElement);

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.animate = this.animate.bind(this);

    window.addEventListener("resize", this.handleResize);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.addEventListener("pointercancel", this.handlePointerUp);
    this.renderer.domElement.addEventListener("pointerleave", this.handlePointerLeave);
    this.renderer.domElement.addEventListener("wheel", this.handleWheel, {
      passive: false,
    });
    this.handleResize();
    this.resetView();
  }

  load(plasmaData) {
    this.plasmaData = plasmaData;
    this.setProgress(0);
    this.field.setLayers(this.layerState);
    this.field.update(0);
    this.render();
  }

  start() {
    if (this.animationId === null) {
      this.clock.start();
      this.animate();
    }
  }

  animate() {
    this.animationId = window.requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (!this.paused) {
      // Slow sway rather than a full orbit keeps the source-to-Earth
      // diagonal composed on screen.
      this.swayTime += delta;
      this.autoRotationY = Math.sin(this.swayTime * 0.07) * 0.3;
      if (this.autoPlay && this.plasmaData && !this.scrubbing) {
        // Rush through quiet wind, slow down when the Sun is doing something
        // so storms get screen time.
        const activity = this.currentSample?.activity ?? 0;
        const rate = 0.02 - Math.min(1, activity) * 0.015;
        this.setProgress((this.progress + delta * rate) % 1, {
          fromAutoplay: true,
        });
      }
    }

    this.applyRotation();
    this.field.update(this.paused ? 0 : delta);
    this.applyEnergy(this.paused ? 0 : delta);
    this.render();
  }

  setPaused(value) {
    this.paused = Boolean(value);
  }

  setAutoPlay(value) {
    this.autoPlay = Boolean(value);
  }

  setScrubbing(value) {
    this.scrubbing = Boolean(value);
  }

  setLayers(layers) {
    this.layerState = { ...this.layerState, ...layers };
    this.field.setLayers(this.layerState);
    this.render();
  }

  setProgress(value, { fromAutoplay = false } = {}) {
    this.progress = Math.min(1, Math.max(0, value));
    if (!this.plasmaData) return;

    this.currentSample = sampleAtProgress(this.plasmaData, this.progress);
    this.field.setSample(this.currentSample);
    this.onSample(this.currentSample, { fromAutoplay });
  }

  resetView() {
    this.baseRotation.x = 0.2;
    this.baseRotation.y = -0.62;
    this.autoRotationY = 0;
    this.swayTime = 0;
    this.cameraHome.z = this.homeDistance();
    this.camera.position.copy(this.cameraHome);
    this.camera.lookAt(this.cameraTarget);
    this.applyRotation();
    this.render();
  }

  dispose() {
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("pointercancel", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("pointerleave", this.handlePointerLeave);
    this.renderer.domElement.removeEventListener("wheel", this.handleWheel);

    this.field.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  handleResize() {
    const width = Math.max(1, this.stage.clientWidth || window.innerWidth);
    const height = Math.max(1, this.stage.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.render();
  }

  handlePointerDown(event) {
    this.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    this.renderer.domElement.setPointerCapture?.(event.pointerId);

    if (this.activePointers.size === 1) {
      this.dragPointerId = event.pointerId;
      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
        rotationX: this.baseRotation.x,
        rotationY: this.baseRotation.y,
      };
      this.pinchStart = null;
      return;
    }

    if (this.activePointers.size === 2) {
      this.dragPointerId = null;
      this.dragStart = null;
      this.pinchStart = {
        distance: this.getPointerDistance(),
        cameraZ: this.cameraHome.z,
      };
    }
  }

  handlePointerMove(event) {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (this.activePointers.size >= 2 && this.pinchStart) {
        this.handlePinchZoom();
        return;
      }

      if (this.dragPointerId === event.pointerId && this.dragStart) {
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;
        this.baseRotation.y = this.dragStart.rotationY + deltaX * 0.008;
        this.baseRotation.x = THREE.MathUtils.clamp(
          this.dragStart.rotationX + deltaY * 0.006,
          -0.95,
          0.95
        );
        this.applyRotation();
        this.render();
        return;
      }
    }

    this.updatePointer(event);
    this.updateHover();
  }

  handlePointerUp(event) {
    this.activePointers.delete(event.pointerId);
    if (this.renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (this.dragPointerId === event.pointerId) {
      this.dragPointerId = null;
      this.dragStart = null;
    }

    if (this.activePointers.size === 1) {
      const [pointerId, pointer] = this.activePointers.entries().next().value;
      this.dragPointerId = pointerId;
      this.dragStart = {
        x: pointer.x,
        y: pointer.y,
        rotationX: this.baseRotation.x,
        rotationY: this.baseRotation.y,
      };
      this.pinchStart = null;
      return;
    }

    this.pinchStart = null;
  }

  handlePointerLeave() {
    this.pointerClient = null;
    this.setHoveredKind(null);
  }

  handleWheel(event) {
    event.preventDefault();
    this.setCameraZoom(this.cameraHome.z + event.deltaY * 0.04);
  }

  handlePinchZoom() {
    const distance = this.getPointerDistance();
    if (!distance || !this.pinchStart?.distance) return;
    const scale = this.pinchStart.distance / distance;
    this.setCameraZoom(this.pinchStart.cameraZ * scale);
  }

  getPointerDistance() {
    const points = [...this.activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  // Pull back on portrait screens so the whole stream stays in frame.
  homeDistance() {
    const aspect = this.camera.aspect || 1;
    return aspect < 1.2 ? 74 * (1.2 / Math.max(0.5, aspect)) : 74;
  }

  setCameraZoom(value) {
    this.cameraHome.z = THREE.MathUtils.clamp(
      value,
      this.zoomLimits.min,
      this.zoomLimits.max
    );
    this.camera.position.copy(this.cameraHome).add(this.shakeOffset);
    this.camera.lookAt(this.cameraTarget);
    this.render();
  }

  // Storm, shock and eruption energy drive bloom, exposure and a camera
  // tremor, so the big hours physically hit instead of just changing hue.
  applyEnergy(delta) {
    const { storm, shock, launch, flash } = this.field.energy;
    this.bloom.strength = 0.5 + storm * 0.15 + shock * 0.2 + launch * 0.35 + flash * 0.4;
    this.bloom.radius = 0.4;
    this.renderer.toneMappingExposure = 0.85 - storm * 0.1 + flash * 0.3 + launch * 0.1;

    const tremor = this.reducedMotion ? 0 : shock * 0.55 + flash * 1.1 + storm * 0.12;
    if (delta > 0 && tremor > 0.01) {
      const t = this.clock.elapsedTime;
      this.shakeOffset.set(
        Math.sin(t * 37.1) * Math.sin(t * 11.3) * tremor,
        Math.sin(t * 29.7 + 1.3) * Math.sin(t * 7.9) * tremor,
        0
      );
    } else if (delta > 0) {
      this.shakeOffset.multiplyScalar(0.85);
    }
    this.camera.position.copy(this.cameraHome).add(this.shakeOffset);
    this.camera.lookAt(this.cameraTarget);
  }

  applyRotation() {
    const drift = this.paused
      ? 0
      : Math.sin(this.clock.elapsedTime * 0.18) * 0.05;
    this.organism.rotation.x = this.baseRotation.x + drift;
    this.organism.rotation.y = this.baseRotation.y + this.autoRotationY;
  }

  updatePointer(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointerClient = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    this.pointer.x = (this.pointerClient.x / bounds.width) * 2 - 1;
    this.pointer.y = -(this.pointerClient.y / bounds.height) * 2 + 1;
  }

  updateHover() {
    if (!this.pointerClient || this.activePointers.size > 0) {
      return;
    }

    this.organism.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.field.hoverTargets, false);
    this.setHoveredKind(hits[0]?.object.userData.kind ?? null);
  }

  setHoveredKind(kind) {
    if (this.hoveredKind === kind) return;
    this.hoveredKind = kind;
    this.onHover(kind, this.currentSample);
  }

  render() {
    this.composer.render();
  }
}
