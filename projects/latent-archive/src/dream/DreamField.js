import * as THREE from "three";
import { fragmentShader, vertexShader } from "./shaders.js";

export class DreamField {
  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uDream: { value: 0 },
        uTile: { value: 0.17 },
        uPointSize: { value: 3.2 },
        uPixelRatio: { value: 1 },
        uViewScale: { value: 1 },
        uHover: { value: -1 },
        uHasHover: { value: 0 },
        uYearWindow: { value: new THREE.Vector2(-9999, 9999) },
        uYearFade: { value: 0 },
        uIntensity: { value: 0.3 },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
      },
    });
    this.object = new THREE.Points(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.uniforms = this.material.uniforms;
    this.seeds = new Float32Array(0);
  }

  load(archive) {
    const { count, grid, cells, latent, helix, colors, years } = archive;
    const total = count * cells;
    const aLatent = new Float32Array(total * 3);
    const aHelix = new Float32Array(total * 3);
    const aCell = new Float32Array(total * 2);
    const aColor = new Float32Array(total * 3);
    const aYear = new Float32Array(total);
    const aWork = new Float32Array(total);
    const aSeed = new Float32Array(total);
    const seeds = new Float32Array(count);
    const half = (grid - 1) / 2;

    for (let work = 0; work < count; work += 1) {
      const seed = fract(Math.sin(work * 12.9898 + 78.233) * 43758.5453);
      seeds[work] = seed;
      for (let cell = 0; cell < cells; cell += 1) {
        const v = work * cells + cell;
        for (let axis = 0; axis < 3; axis += 1) {
          aLatent[v * 3 + axis] = latent[work * 3 + axis];
          aHelix[v * 3 + axis] = helix[work * 3 + axis];
          aColor[v * 3 + axis] = colors[v * 3 + axis] / 255;
        }
        aCell[v * 2] = (cell % grid) - half;
        aCell[v * 2 + 1] = half - Math.floor(cell / grid);
        aYear[v] = years[work];
        aWork[v] = work;
        aSeed[v] = seed;
      }
    }

    // Same attribute object under both names → one GPU buffer; `position` sets the draw count.
    const latentAttribute = new THREE.BufferAttribute(aLatent, 3);
    this.geometry.setAttribute("position", latentAttribute);
    this.geometry.setAttribute("aLatent", latentAttribute);
    this.geometry.setAttribute("aHelix", new THREE.BufferAttribute(aHelix, 3));
    this.geometry.setAttribute("aCell", new THREE.BufferAttribute(aCell, 2));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(aColor, 3));
    this.geometry.setAttribute("aYear", new THREE.BufferAttribute(aYear, 1));
    this.geometry.setAttribute("aWork", new THREE.BufferAttribute(aWork, 1));
    this.geometry.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
    this.archive = archive;
    this.seeds = seeds;
  }

  // CPU mirror of the shader's anchor blend, used for hover picking.
  anchorOf(work, morph, target) {
    const seed = this.seeds[work];
    const t = smoothstep(clamp(morph * 1.25 - seed * 0.25));
    const { latent, helix } = this.archive;
    const i = work * 3;
    return target.set(
      helix[i] + (latent[i] - helix[i]) * t,
      helix[i + 1] + (latent[i + 1] - helix[i + 1]) * t,
      helix[i + 2] + (latent[i + 2] - helix[i + 2]) * t
    );
  }

  setHover(work) {
    this.uniforms.uHover.value = work ?? -1;
    this.uniforms.uHasHover.value = work === null || work === undefined ? 0 : 1;
  }

  setEra(window) {
    if (window) this.uniforms.uYearWindow.value.set(window[0], window[1]);
    this.uniforms.uYearFade.value = window ? 1 : 0;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function fract(value) {
  return value - Math.floor(value);
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}
