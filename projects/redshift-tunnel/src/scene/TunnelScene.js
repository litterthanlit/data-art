import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { TunnelField } from "../tunnel/TunnelField.js";
import { TUNNEL } from "../tunnel/mapping.js";
import { coreVertex, coreFragment } from "../tunnel/shaders.js";

const SPIN = 0.01;
const MAX_TILT = THREE.MathUtils.degToRad(2.5);

export class TunnelScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    // The composer clears its linear render target with this value as-is, so hand it linear light.
    this.renderer.setClearColor(new THREE.Color(0x05060a).convertSRGBToLinear(), 1);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    this.camera.position.set(0, 0, 14);

    this.field = new THREE.Group();
    this.tunnel = new TunnelField();
    this.tunnel.uniforms.uPixelRatio.value = this.pixelRatio;
    this.field.add(this.tunnel.object);
    this.scene.add(this.field);

    this.coreUniforms = { uTime: this.tunnel.uniforms.uTime };
    this.core = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.ShaderMaterial({
        uniforms: this.coreUniforms,
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.core.position.z = -TUNNEL.length - 10;
    this.scene.add(this.core);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.22);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.clock = new THREE.Clock(false);
    this.time = 0;
    this.paused = false;
    this.motionScale = 1;
    this.parallax = true;
    this.pointer = new THREE.Vector2();
    this.tilt = new THREE.Vector2();
    this.frameCallbacks = [];
    this.animationId = null;

    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handlePointer = this.handlePointer.bind(this);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("pointermove", this.handlePointer);
    this.handleResize();
  }

  setData(anchors) {
    this.tunnel.load(anchors);
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setMotionScale(scale) {
    this.motionScale = scale;
  }

  setParallax(enabled) {
    this.parallax = enabled;
    if (!enabled) this.pointer.set(0, 0);
  }

  onFrame(callback) {
    this.frameCallbacks.push(callback);
  }

  start() {
    if (this.animationId !== null) return;
    this.clock.start();
    this.animate();
  }

  animate() {
    this.animationId = window.requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    if (!this.paused) {
      this.time += delta * this.motionScale;
      this.field.rotation.z = this.time * SPIN;
      this.tilt.lerp(this.pointer, 1 - Math.exp(-delta * 1.5));
    }
    this.tunnel.uniforms.uTime.value = this.time;
    this.camera.rotation.set(this.tilt.y * MAX_TILT, -this.tilt.x * MAX_TILT, 0);
    this.composer.render();
    for (const callback of this.frameCallbacks) callback(this.time);
  }

  handlePointer(event) {
    if (!this.parallax) return;
    this.pointer.set((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloom.resolution.set(width / 2, height / 2);
    this.tunnel.uniforms.uViewportHeight.value = height;
  }
}
