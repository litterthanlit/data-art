import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { RIVERS } from "./mapping.js";
import { simulationFragment, riverVertex, riverFragment } from "./riverShaders.js";

// About a million particles on large screens with a fine pointer; 262k elsewhere.
export function particleSide() {
  const large = Math.min(window.innerWidth, window.innerHeight) >= 700;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  return large && finePointer ? 1024 : 512;
}

// Brightness per particle, scaled so the rivers carry the same light whatever the count.
const alphaFor = (count) => (0.14 * 60000) / count;

// Every particle is light from one sampled galaxy. Its radius and angle live in a
// float texture that a fragment shader advances each frame.
export class RiverField {
  constructor(renderer, sources) {
    const side = Math.round(Math.sqrt(sources.home.length));
    const PARTICLE_COUNT = side * side;
    this.gpu = new GPUComputationRenderer(side, side, renderer);

    const initial = this.gpu.createTexture();
    const sourceData = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      initial.image.data[i * 4] = RIVERS.centre + Math.random() * (RIVERS.rim - RIVERS.centre);
      initial.image.data[i * 4 + 1] = sources.home[i] + (Math.random() - 0.5) * 0.25;
      sourceData[i * 4] = sources.home[i];
      sourceData[i * 4 + 1] = sources.speed[i];
      sourceData[i * 4 + 2] = sources.size[i];
    }
    const sourceTexture = new THREE.DataTexture(sourceData, side, side, THREE.RGBAFormat, THREE.FloatType);
    sourceTexture.needsUpdate = true;

    this.state = this.gpu.addVariable("tState", simulationFragment, initial);
    this.gpu.setVariableDependencies(this.state, [this.state]);
    this.simUniforms = Object.assign(this.state.material.uniforms, {
      uTime: { value: 0 },
      uDt: { value: 0 },
      uChannels: { value: RIVERS.channels },
      uSwirl: { value: RIVERS.swirl },
      uPull: { value: RIVERS.pull },
      uBunch: { value: RIVERS.bunch },
      uRim: { value: RIVERS.rim },
      uCentre: { value: RIVERS.centre },
      uSources: { value: sourceTexture },
    });
    const error = this.gpu.init();
    if (error) throw new Error(error);

    // position = (u, v) into the state texture, and the particle's size.
    const refs = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      refs[i * 3] = ((i % side) + 0.5) / side;
      refs[i * 3 + 1] = (Math.floor(i / side) + 0.5) / side;
      refs[i * 3 + 2] = sources.size[i];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(refs, 3));

    this.uniforms = {
      uState: { value: null },
      uFit: { value: new THREE.Vector2(1, 1) },
      uReach: { value: 1 },
      uPointSize: { value: 1.6 },
      uAlpha: { value: alphaFor(PARTICLE_COUNT) },
      uColourScale: { value: RIVERS.colourScale },
    };
    this.points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: riverVertex,
        fragmentShader: riverFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.uniforms.uState.value = this.gpu.getCurrentRenderTarget(this.state).texture;
  }

  step(time, dt) {
    this.simUniforms.uTime.value = time;
    this.simUniforms.uDt.value = dt;
    this.gpu.compute();
    this.uniforms.uState.value = this.gpu.getCurrentRenderTarget(this.state).texture;
  }

  setView({ fitX, fitY, reach }, pointSize) {
    this.uniforms.uFit.value.set(fitX, fitY);
    this.uniforms.uReach.value = reach;
    this.uniforms.uPointSize.value = pointSize;
  }
}
