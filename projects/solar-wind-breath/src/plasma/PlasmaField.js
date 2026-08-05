import * as THREE from "three";

const PARTICLE_COUNT = 5200;
const RIBBON_COUNT = 28;
const RIBBON_SEGMENTS = 64;

export class PlasmaField {
  constructor() {
    this.group = new THREE.Group();
    this.time = 0;
    this.sample = null;
    this.layers = { plasma: true, cme: true, storm: true };

    this.createParticles();
    this.createRibbons();
    this.createFlares();
    this.createCore();
  }

  get object() {
    return this.group;
  }

  createParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT * 4);

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const t = i / PARTICLE_COUNT;
      const radius = 1.2 + Math.random() * 10.5;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = (t - 0.5) * 84;
      positions[i * 3 + 1] = Math.cos(angle) * radius;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      seeds[i * 4] = Math.random();
      seeds[i * 4 + 1] = Math.random();
      seeds[i * 4 + 2] = Math.random();
      seeds[i * 4 + 3] = 0.4 + Math.random() * 1.4;
    }

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.particleGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3)
    );
    this.particleGeometry.setAttribute(
      "seed",
      new THREE.BufferAttribute(seeds, 4)
    );

    this.particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDensity: { value: 0.3 },
        uSpeed: { value: 0.3 },
        uHeat: { value: 0.2 },
        uStorm: { value: 0 },
        uShock: { value: 0 },
        uOpacity: { value: 0.85 },
      },
      vertexShader: `
        attribute vec4 seed;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        uniform float uDensity;
        uniform float uSpeed;
        uniform float uHeat;
        uniform float uStorm;
        uniform float uShock;

        void main() {
          vec3 p = position;
          float along = p.x;
          float swirl = uTime * (0.35 + uSpeed * 1.8) + seed.x * 6.283;
          float radial = length(p.yz);
          float breathe = 1.0 + uDensity * 0.85 + uShock * 0.55;
          float twist = swirl * (0.35 + uDensity * 0.5);

          p.y = cos(atan(p.z, p.y) + twist) * radial * breathe;
          p.z = sin(atan(p.z, p.y) + twist) * radial * breathe;
          p.x = along + sin(uTime * 0.7 + seed.y * 12.0) * (0.4 + uSpeed * 1.8);
          p.y += sin(uTime * 1.4 + seed.z * 9.0) * (0.2 + uStorm * 1.8);
          p.z += cos(uTime * 1.1 + seed.x * 7.0) * (0.2 + uStorm * 1.4);

          float heat = clamp(uHeat + uShock * 0.55 + seed.y * 0.15, 0.0, 1.0);
          vec3 cool = vec3(0.25, 0.55, 1.0);
          vec3 hot = vec3(1.0, 0.62, 0.28);
          vec3 storm = vec3(1.0, 0.42, 0.38);
          vColor = mix(cool, hot, heat);
          vColor = mix(vColor, storm, uStorm * 0.65);
          vAlpha = (0.18 + seed.w * 0.35) * (0.55 + uDensity * 0.9 + uShock * 0.4);

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + seed.w * 4.5 + uDensity * 5.0 + uShock * 3.0) * (120.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uOpacity;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * (0.55 + glow * 1.8), vAlpha * glow * uOpacity);
        }
      `,
    });

    this.particles = new THREE.Points(
      this.particleGeometry,
      this.particleMaterial
    );
    this.group.add(this.particles);
  }

  createRibbons() {
    this.ribbons = new THREE.Group();
    this.ribbonMeshes = [];

    for (let i = 0; i < RIBBON_COUNT; i += 1) {
      const positions = new Float32Array((RIBBON_SEGMENTS + 1) * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({
        color: 0x6ec8ff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.userData = {
        phase: (i / RIBBON_COUNT) * Math.PI * 2,
        radius: 2.4 + (i % 7) * 1.15,
        spin: 0.35 + (i % 5) * 0.12,
      };
      this.ribbonMeshes.push(line);
      this.ribbons.add(line);
    }

    this.group.add(this.ribbons);
  }

  createFlares() {
    const geometry = new THREE.SphereGeometry(1, 16, 16);
    this.flareMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flare = new THREE.Mesh(geometry, this.flareMaterial);
    this.flare.position.set(-38, 0, 0);
    this.group.add(this.flare);

    this.shockMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shock = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 20),
      this.shockMaterial
    );
    this.group.add(this.shock);
  }

  createCore() {
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x7fd0ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 24, 24),
      this.coreMaterial
    );
    this.group.add(this.core);
  }

  setLayers(layers) {
    this.layers = { ...this.layers, ...layers };
    this.particles.visible = this.layers.plasma !== false;
    this.ribbons.visible = this.layers.plasma !== false;
    this.core.visible = this.layers.plasma !== false;
    this.flare.visible = this.layers.cme !== false;
    this.shock.visible = this.layers.storm !== false;
  }

  setSample(sample) {
    this.sample = sample;
  }

  update(delta) {
    if (!this.sample) return;

    this.time += delta * (0.55 + this.sample.speedN * 1.6);

    const density = this.sample.densityN;
    const speed = this.sample.speedN;
    const heat = this.sample.tempN;
    const storm = this.sample.storm;
    const shock = this.sample.shock;
    const launch = this.sample.launch;

    this.particleMaterial.uniforms.uTime.value = this.time;
    this.particleMaterial.uniforms.uDensity.value = density;
    this.particleMaterial.uniforms.uSpeed.value = speed;
    this.particleMaterial.uniforms.uHeat.value = heat;
    this.particleMaterial.uniforms.uStorm.value = storm;
    this.particleMaterial.uniforms.uShock.value = shock;

    for (const ribbon of this.ribbonMeshes) {
      const positions = ribbon.geometry.attributes.position.array;
      const { phase, radius, spin } = ribbon.userData;
      const twist = this.time * spin * (0.4 + this.sample.btN * 1.4);

      for (let i = 0; i <= RIBBON_SEGMENTS; i += 1) {
        const t = i / RIBBON_SEGMENTS;
        const x = (t - 0.5) * 78;
        const localRadius =
          radius *
          (0.75 + density * 0.9 + Math.sin(t * 8.0 + phase) * 0.18 + shock * 0.35);
        const angle = phase + twist + t * (2.2 + this.sample.btN * 4.5);
        positions[i * 3] = x;
        positions[i * 3 + 1] = Math.cos(angle) * localRadius;
        positions[i * 3 + 2] = Math.sin(angle) * localRadius;
      }

      ribbon.geometry.attributes.position.needsUpdate = true;
      ribbon.material.opacity = 0.05 + density * 0.12 + this.sample.btN * 0.1;
      ribbon.material.color.setRGB(
        0.35 + heat * 0.55,
        0.55 + density * 0.25,
        0.95 - heat * 0.35
      );
    }

    const flareStrength = this.layers.cme === false ? 0 : launch;
    this.flareMaterial.opacity = Math.min(0.85, flareStrength * 0.7);
    const flareScale = 1.5 + flareStrength * 10;
    this.flare.scale.setScalar(flareScale);
    this.flare.position.set(-36 - flareStrength * 4, Math.sin(this.time) * 2, 0);

    const stormStrength =
      this.layers.storm === false ? 0 : Math.max(storm, shock * 0.75);
    this.shockMaterial.opacity = Math.min(0.55, stormStrength * 0.45);
    this.shock.scale.setScalar(4 + stormStrength * 18);
    this.shock.position.set(8 + shock * 10, 0, 0);

    this.coreMaterial.opacity = 0.05 + density * 0.12 + storm * 0.1;
    this.core.scale.setScalar(1 + density * 1.4 + shock * 0.8);
  }

  dispose() {
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
    this.flare.geometry.dispose();
    this.flareMaterial.dispose();
    this.shock.geometry.dispose();
    this.shockMaterial.dispose();
    this.core.geometry.dispose();
    this.coreMaterial.dispose();
    for (const ribbon of this.ribbonMeshes) {
      ribbon.geometry.dispose();
      ribbon.material.dispose();
    }
  }
}
