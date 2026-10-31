import * as THREE from "three";
import { RiverField } from "../rivers/RiverField.js";
import { viewFit } from "../rivers/mapping.js";
import { quadVertex, fadeFragment, displayFragment } from "../rivers/riverShaders.js";

const FADE_PER_FRAME = 0.965;
const MAX_DT = 0.05;
const POINT_SIZE = 1.6;

// Each frame: dim the previous light a little, add this frame's particles on top,
// then tone-map the result to the screen. The trails are what read as rivers.
export class RiverScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.autoClear = false;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);
    this.fadeMaterial = new THREE.ShaderMaterial({
      uniforms: { uTrail: { value: null }, uFade: { value: FADE_PER_FRAME } },
      vertexShader: quadVertex,
      fragmentShader: fadeFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.displayMaterial = new THREE.ShaderMaterial({
      uniforms: { uTrail: { value: null }, uAspect: { value: new THREE.Vector2(1, 1) } },
      vertexShader: quadVertex,
      fragmentShader: displayFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.fadeScene = new THREE.Scene().add(new THREE.Mesh(quad, this.fadeMaterial));
    this.displayScene = new THREE.Scene().add(new THREE.Mesh(quad, this.displayMaterial));
    this.riverScene = new THREE.Scene();

    this.field = null;
    this.targets = [];
    this.time = 0;
    this.paused = false;
    this.motionScale = 1;
    this.frameCallbacks = [];
    this.animationId = null;
    this.last = 0;

    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.handleResize();
  }

  setData(sources, regions) {
    this.field = new RiverField(this.renderer, sources, regions);
    this.riverScene.add(this.field.points);
    this.handleResize();
  }

  setScale(mode) {
    this.field.setScale(mode);
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setMotionScale(scale) {
    this.motionScale = scale;
  }

  onFrame(callback) {
    this.frameCallbacks.push(callback);
  }

  start() {
    if (this.animationId !== null) return;
    this.last = performance.now();
    this.animationId = window.requestAnimationFrame(this.animate);
  }

  animate(now) {
    this.animationId = window.requestAnimationFrame(this.animate);
    const dt = this.paused ? 0 : Math.min((now - this.last) / 1000, MAX_DT) * this.motionScale;
    this.last = now;
    // Paused: the last frame stays on screen and the GPU rests.
    if (dt === 0) return;
    this.time += dt;
    this.field.step(this.time, dt);

    const [previous, next] = this.targets;
    this.fadeMaterial.uniforms.uTrail.value = previous.texture;
    this.fadeMaterial.uniforms.uFade.value = FADE_PER_FRAME ** (dt * 60);
    this.renderer.setRenderTarget(next);
    this.renderer.render(this.fadeScene, this.camera);
    this.renderer.render(this.riverScene, this.camera);
    this.targets = [next, previous];
    this.present();
    for (const callback of this.frameCallbacks) callback(this.time, dt);
  }

  present() {
    this.displayMaterial.uniforms.uTrail.value = this.targets[0].texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.displayScene, this.camera);
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    const w = Math.floor(width * this.pixelRatio);
    const h = Math.floor(height * this.pixelRatio);
    for (const target of this.targets) target.dispose();
    this.renderer.setClearColor(0x000000, 1);
    this.targets = [0, 1].map(() => {
      const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
      return target;
    });
    this.renderer.setRenderTarget(null);
    this.displayMaterial.uniforms.uAspect.value.set(width / height, 1);
    this.field?.setView(viewFit(width, height), POINT_SIZE * this.pixelRatio);
    this.present();
  }
}
