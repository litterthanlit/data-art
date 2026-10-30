import * as THREE from "three";
import { anchorVertex, photonVertex, pointFragment } from "./shaders.js";

const PHOTONS_PER_ANCHOR = 2;

export class TunnelField {
  constructor() {
    this.object = new THREE.Group();
    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uViewportHeight: { value: 800 },
      uSpeed: { value: 0.11 },
      uTravel: { value: 22 },
    };
    this.anchors = null;
    this.photons = null;
  }

  load({ positions, colors, seeds, sizes }) {
    const count = seeds.length;

    const anchorGeometry = new THREE.BufferGeometry();
    anchorGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    anchorGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    anchorGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    anchorGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    this.anchors = new THREE.Points(anchorGeometry, this.material(anchorVertex));

    const n = count * PHOTONS_PER_ANCHOR;
    const photonPositions = new Float32Array(n * 3);
    const photonColors = new Float32Array(n * 3);
    const photonSeeds = new Float32Array(n);
    const phases = new Float32Array(n);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < PHOTONS_PER_ANCHOR; k++) {
        const j = i * PHOTONS_PER_ANCHOR + k;
        photonPositions.set(positions.subarray(i * 3, i * 3 + 3), j * 3);
        photonColors.set(colors.subarray(i * 3, i * 3 + 3), j * 3);
        photonSeeds[j] = seeds[i];
        phases[j] = (seeds[i] * 7.31 + k / PHOTONS_PER_ANCHOR) % 1;
      }
    }
    const photonGeometry = new THREE.BufferGeometry();
    photonGeometry.setAttribute("position", new THREE.BufferAttribute(photonPositions, 3));
    photonGeometry.setAttribute("color", new THREE.BufferAttribute(photonColors, 3));
    photonGeometry.setAttribute("seed", new THREE.BufferAttribute(photonSeeds, 1));
    photonGeometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    this.photons = new THREE.Points(photonGeometry, this.material(photonVertex));

    for (const points of [this.anchors, this.photons]) {
      points.frustumCulled = false;
      this.object.add(points);
    }
  }

  material(vertexShader) {
    return new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
}
