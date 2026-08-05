import * as THREE from "three";
import { PlasmaField } from "../plasma/PlasmaField.js";
import { sampleAtProgress } from "../plasma/buildPlasma.js";

export class SolarScene {
  constructor({ stage, onSample = () => {} }) {
    if (!stage) {
      throw new Error("Scene stage is missing");
    }

    this.stage = stage;
    this.onSample = onSample;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.clock = new THREE.Clock();
    this.animationId = null;
    this.paused = false;
    this.progress = 0;
    this.autoPlay = true;
    this.plasmaData = null;
    this.currentSample = null;
    this.activePointers = new Map();
    this.dragPointerId = null;
    this.dragStart = null;
    this.baseRotation = { x: 0.18, y: -0.35 };
    this.autoRotationY = 0;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.pinchStart = null;
    this.zoomLimits = { min: 28, max: 110 };
    this.layerState = { plasma: true, cme: true, storm: true };

    this.organism = new THREE.Group();
    this.field = new PlasmaField();
    this.organism.add(this.field.object);
    this.scene.add(this.organism);
    this.scene.add(new THREE.AmbientLight(0xb9d7ff, 0.75));

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.touchAction = "none";
    this.stage.appendChild(this.renderer.domElement);

    this.resetView();
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
  }

  load(plasmaData) {
    this.plasmaData = plasmaData;
    this.setProgress(0);
    this.field.setLayers(this.layerState);
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
      this.autoRotationY += delta * 0.05;
      if (this.autoPlay && this.plasmaData) {
        this.setProgress((this.progress + delta * 0.012) % 1, {
          fromAutoplay: true,
        });
      }
    }

    this.applyRotation();
    this.field.update(this.paused ? 0 : delta);
    this.render();
  }

  setPaused(value) {
    this.paused = Boolean(value);
  }

  setAutoPlay(value) {
    this.autoPlay = Boolean(value);
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
    this.baseRotation.x = 0.18;
    this.baseRotation.y = -0.35;
    this.autoRotationY = 0;
    this.camera.position.set(0, 8, 72);
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  handleResize() {
    const width = Math.max(1, this.stage.clientWidth || window.innerWidth);
    const height = Math.max(1, this.stage.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
        cameraZ: this.camera.position.z,
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
      }
    }
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
    // no-op beyond pointer map cleanup on up
  }

  handleWheel(event) {
    event.preventDefault();
    this.setCameraZoom(this.camera.position.z + event.deltaY * 0.04);
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

  setCameraZoom(value) {
    this.camera.position.z = THREE.MathUtils.clamp(
      value,
      this.zoomLimits.min,
      this.zoomLimits.max
    );
    this.camera.lookAt(this.cameraTarget);
    this.render();
  }

  applyRotation() {
    const drift = this.paused
      ? 0
      : Math.sin(this.clock.elapsedTime * 0.18) * 0.05;
    this.organism.rotation.x = this.baseRotation.x + drift;
    this.organism.rotation.y = this.baseRotation.y + this.autoRotationY;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
