import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { RIVERS, buildPalette } from "./mapping.js";
import { simulationFragment, riverVertex, riverFragment } from "./riverShaders.js";

export const PARTICLES_SIDE = 512;
export const PARTICLE_COUNT = PARTICLES_SIDE * PARTICLES_SIDE;

// Brightness per particle, scaled so the rivers carry the same light whatever the count.
const ALPHA = (0.14 * 60000) / PARTICLE_COUNT;

// Every particle is light from one region. Its radius and angle live in a float
// texture a fragment shader advances each frame; its colour is read from a
// year × region palette texture at the year its radius stands for.
export class RiverField {
  constructor(renderer, sources, regions) {
    const side = PARTICLES_SIDE;
    this.regions = regions;
    this.gpu = new GPUComputationRenderer(side, side, renderer);

    const initial = this.gpu.createTexture();
    const sourceData = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      initial.image.data[i * 4] = RIVERS.centre + Math.random() * (RIVERS.rim - RIVERS.centre);
      initial.image.data[i * 4 + 1] = sources.home[i] + (Math.random() - 0.5) * 0.25;
      sourceData[i * 4] = sources.home[i];
      sourceData[i * 4 + 1] = sources.speed[i];
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

    const years = regions[0].values.length;
    this.palette = new THREE.DataTexture(buildPalette(regions, "region"), years, regions.length, THREE.RGBAFormat);
    this.palette.magFilter = THREE.NearestFilter;
    this.palette.minFilter = THREE.NearestFilter;
    this.palette.needsUpdate = true;

    const refs = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      refs[i * 3] = ((i % side) + 0.5) / side;
      refs[i * 3 + 1] = (Math.floor(i / side) + 0.5) / side;
      refs[i * 3 + 2] = sources.region[i];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(refs, 3));

    this.uniforms = {
      uState: { value: null },
      uPalette: { value: this.palette },
      uFit: { value: new THREE.Vector2(1, 1) },
      uReach: { value: 1 },
      uPointSize: { value: 1.6 },
      uAlpha: { value: ALPHA },
      uCentre: { value: RIVERS.centre },
      uYears: { value: years },
      uRegions: { value: regions.length },
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

  setScale(mode) {
    this.palette.image.data.set(buildPalette(this.regions, mode));
    this.palette.needsUpdate = true;
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
