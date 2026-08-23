import * as THREE from "three";

const FILAMENTS = 34;
const SEGMENTS = 84;
const SPARKS = 1600;
const CME_RAYS = 18;
const CME_SEGMENTS = 28;
const STREAM_LENGTH = 82;
const _tangent = new THREE.Vector3();
const _radial = new THREE.Vector3();
const _side = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _color = new THREE.Color();
const _cool = new THREE.Color(0x3d7dff);
const _cyan = new THREE.Color(0x7ae7ff);
const _hot = new THREE.Color(0xffc56a);
const _storm = new THREE.Color(0xff6a58);
const _gold = new THREE.Color(0xffe6a3);

export class PlasmaField {
  constructor() {
    this.group = new THREE.Group();
    this.time = 0;
    this.sample = null;
    this.layers = { plasma: true, cme: true, storm: true };
    this.filamentMeta = [];
    this.cmeMeta = [];

    this.createFilaments();
    this.createSparks();
    this.createCmeBurst();
    this.createStormSheath();
    this.createHitTargets();
  }

  get object() {
    return this.group;
  }

  get hoverTargets() {
    const targets = [];
    if (this.layers.plasma !== false) targets.push(this.bodyHit);
    if (this.layers.cme !== false) targets.push(this.flareHit);
    if (this.layers.storm !== false) targets.push(this.stormHit);
    return targets;
  }

  createFilaments() {
    const vertexCount = FILAMENTS * SEGMENTS * 6;
    this.filamentPositions = new Float32Array(vertexCount * 3);
    this.filamentColors = new Float32Array(vertexCount * 3);
    this.filamentGeometry = new THREE.BufferGeometry();
    this.filamentGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.filamentPositions, 3)
    );
    this.filamentGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.filamentColors, 3)
    );

    this.filamentMaterial = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: { uOpacity: { value: 0.9 } },
      vertexShader: `
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float uOpacity;
        void main() {
          gl_FragColor = vec4(vColor, uOpacity);
        }
      `,
    });

    this.filaments = new THREE.Mesh(this.filamentGeometry, this.filamentMaterial);
    this.filaments.frustumCulled = false;
    this.group.add(this.filaments);

    for (let i = 0; i < FILAMENTS; i += 1) {
      this.filamentMeta.push({
        phase: (i / FILAMENTS) * Math.PI * 2,
        radius: 1.8 + (i % 9) * 0.95,
        spin: 0.22 + (i % 6) * 0.08,
        width: 0.28 + (i % 5) * 0.08,
        sheath: i % 4 === 0,
      });
    }
  }

  createSparks() {
    const vertexCount = SPARKS * 6;
    const positions = new Float32Array(vertexCount * 3);
    const corners = new Float32Array(vertexCount * 2);
    const seeds = new Float32Array(vertexCount * 4);
    const quad = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ];

    for (let i = 0; i < SPARKS; i += 1) {
      const t = i / SPARKS;
      const radius = 0.8 + Math.random() * 11.5;
      const angle = Math.random() * Math.PI * 2;
      const x = (t - 0.5) * STREAM_LENGTH;
      const y = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const seed = [
        Math.random(),
        Math.random(),
        Math.random(),
        0.35 + Math.random() * 0.9,
      ];

      for (let c = 0; c < 6; c += 1) {
        const index = i * 6 + c;
        positions[index * 3] = x;
        positions[index * 3 + 1] = y;
        positions[index * 3 + 2] = z;
        corners[index * 2] = quad[c][0];
        corners[index * 2 + 1] = quad[c][1];
        seeds[index * 4] = seed[0];
        seeds[index * 4 + 1] = seed[1];
        seeds[index * 4 + 2] = seed[2];
        seeds[index * 4 + 3] = seed[3];
      }
    }

    this.sparkGeometry = new THREE.BufferGeometry();
    this.sparkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.sparkGeometry.setAttribute(
      "corner",
      new THREE.BufferAttribute(corners, 2)
    );
    this.sparkGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));

    this.sparkMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uDensity: { value: 0.4 },
        uSpeed: { value: 0.3 },
        uHeat: { value: 0.2 },
        uStorm: { value: 0 },
        uShock: { value: 0 },
      },
      vertexShader: `
        attribute vec2 corner;
        attribute vec4 seed;
        varying vec3 vColor;
        varying float vAlpha;
        varying vec2 vCorner;
        uniform float uTime;
        uniform float uDensity;
        uniform float uSpeed;
        uniform float uHeat;
        uniform float uStorm;
        uniform float uShock;

        void main() {
          vec3 p = position;
          float angle0 = atan(p.z, p.y);
          float radial = max(length(p.yz), 0.15);
          float twist = uTime * (0.28 + uSpeed * 1.35) + seed.x * 6.283185;
          float breathe = 0.92 + uDensity * 0.55 + uShock * 0.38 + sin(uTime * 0.85 + seed.y) * 0.05;
          p.y = cos(angle0 + twist * 0.45) * radial * breathe;
          p.z = sin(angle0 + twist * 0.45) * radial * breathe;
          p.x += sin(uTime * (0.7 + uSpeed * 1.4) + seed.y * 10.0) * (0.5 + uSpeed * 2.4);
          p.y += sin(uTime * 1.3 + seed.z * 8.0) * (0.12 + uStorm * 1.5);
          p.z += cos(uTime * 1.05 + seed.x * 7.0) * (0.12 + uStorm * 1.2);

          float heat = clamp(uHeat + uShock * 0.5 + seed.z * 0.12, 0.0, 1.0);
          vec3 cool = vec3(0.28, 0.5, 1.0);
          vec3 hot = vec3(1.0, 0.78, 0.38);
          vec3 storm = vec3(1.0, 0.34, 0.3);
          vColor = mix(cool, hot, heat);
          vColor = mix(vColor, storm, clamp(uStorm, 0.0, 1.0));
          vAlpha = 0.38 + seed.w * 0.32 + uDensity * 0.18 + uShock * 0.2;
          vCorner = corner;

          float size = 0.22 + seed.w * 0.32 + uDensity * 0.4 + uShock * 0.28;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          mv.xy += corner * size;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying vec2 vCorner;

        void main() {
          float d = length(vCorner);
          if (d > 1.0) discard;
          float glow = pow(1.0 - d, 1.55);
          gl_FragColor = vec4(vColor * (0.45 + glow * 2.1), vAlpha * glow);
        }
      `,
    });

    this.sparks = new THREE.Mesh(this.sparkGeometry, this.sparkMaterial);
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
  }

  createCmeBurst() {
    const vertexCount = CME_RAYS * CME_SEGMENTS * 6;
    this.cmePositions = new Float32Array(vertexCount * 3);
    this.cmeColors = new Float32Array(vertexCount * 3);
    this.cmeGeometry = new THREE.BufferGeometry();
    this.cmeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.cmePositions, 3)
    );
    this.cmeGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.cmeColors, 3)
    );

    this.cmeMaterial = this.filamentMaterial.clone();
    this.cmeMaterial.uniforms = { uOpacity: { value: 0 } };
    this.cmeBurst = new THREE.Mesh(this.cmeGeometry, this.cmeMaterial);
    this.cmeBurst.frustumCulled = false;
    this.group.add(this.cmeBurst);

    for (let i = 0; i < CME_RAYS; i += 1) {
      this.cmeMeta.push({
        angle: (i / CME_RAYS) * Math.PI * 2,
        tilt: (i % 5) * 0.18 - 0.36,
        length: 8 + (i % 7) * 1.4,
        width: 0.18 + (i % 3) * 0.05,
      });
    }
  }

  createStormSheath() {
    this.sheathMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6a58,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.sheath = new THREE.Mesh(
      new THREE.SphereGeometry(6.4, 22, 16),
      this.sheathMaterial
    );
    this.sheath.position.set(11, 0, 0);
    this.group.add(this.sheath);
  }

  createHitTargets() {
    const hidden = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.bodyHit = new THREE.Mesh(
      new THREE.CylinderGeometry(12.5, 12.5, STREAM_LENGTH, 16, 1, true),
      hidden
    );
    this.bodyHit.rotation.z = Math.PI / 2;
    this.bodyHit.userData.kind = "plasma";

    this.flareHit = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 12), hidden);
    this.flareHit.position.set(-36, 0, 0);
    this.flareHit.userData.kind = "cme";

    this.stormHit = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 12), hidden);
    this.stormHit.position.set(11, 0, 0);
    this.stormHit.userData.kind = "storm";

    this.group.add(this.bodyHit, this.flareHit, this.stormHit);
  }

  setLayers(layers) {
    this.layers = { ...this.layers, ...layers };
    this.filaments.visible = this.layers.plasma !== false;
    this.sparks.visible = this.layers.plasma !== false;
    this.cmeBurst.visible = this.layers.cme !== false;
    this.sheath.visible = this.layers.storm !== false;
  }

  setSample(sample) {
    this.sample = sample;
  }

  update(delta) {
    if (!this.sample) return;

    this.time += delta * (0.45 + this.sample.speedN * 1.35);

    const density = 0.28 + this.sample.densityN * 0.72;
    const speed = this.sample.speedN;
    const heat = this.sample.tempN;
    const storm = this.sample.storm;
    const shock = this.sample.shock;
    const launch = this.layers.cme === false ? 0 : this.sample.launch;
    const stormVisible = this.layers.storm === false ? 0 : Math.max(storm, shock * 0.8);

    this.sparkMaterial.uniforms.uTime.value = this.time;
    this.sparkMaterial.uniforms.uDensity.value = density;
    this.sparkMaterial.uniforms.uSpeed.value = speed;
    this.sparkMaterial.uniforms.uHeat.value = heat;
    this.sparkMaterial.uniforms.uStorm.value = stormVisible;
    this.sparkMaterial.uniforms.uShock.value = shock;

    this.updateFilaments(density, heat, stormVisible, shock, speed);
    this.updateCmeBurst(launch, heat);
    this.updateStormSheath(stormVisible, shock);
  }

  updateFilaments(density, heat, storm, shock, speed) {
    const positions = this.filamentPositions;
    const colors = this.filamentColors;
    let cursor = 0;

    for (let f = 0; f < FILAMENTS; f += 1) {
      const meta = this.filamentMeta[f];
      const twist = this.time * meta.spin * (0.55 + this.sample.btN * 1.6);
      const width =
        meta.width *
        (0.95 + density * 1.55 + shock * 0.9 + storm * 0.35) *
        (meta.sheath ? 2.3 : 1);

      for (let i = 0; i < SEGMENTS; i += 1) {
        const t0 = i / SEGMENTS;
        const t1 = (i + 1) / SEGMENTS;
        this.filamentPoint(_a, meta, t0, twist, density, shock, speed);
        this.filamentPoint(_b, meta, t1, twist, density, shock, speed);
        this.writeQuad(positions, cursor, _a, _b, width);

        _color.copy(_cool).lerp(_cyan, 0.25 + t0 * 0.35);
        _color.lerp(_hot, Math.max(heat, shock * 0.65));
        _color.lerp(_storm, storm);
        const shade = 0.55 + density * 0.45 + storm * 0.2 + (meta.sheath ? 0.05 : 0.22);
        for (let v = 0; v < 6; v += 1) {
          const colorIndex = (cursor + v) * 3;
          colors[colorIndex] = _color.r * shade;
          colors[colorIndex + 1] = _color.g * shade;
          colors[colorIndex + 2] = _color.b * shade;
        }
        cursor += 6;
      }
    }

    this.filamentGeometry.attributes.position.needsUpdate = true;
    this.filamentGeometry.attributes.color.needsUpdate = true;
    this.filamentGeometry.computeBoundingSphere();
    this.filamentMaterial.uniforms.uOpacity.value = 0.55 + density * 0.35;
  }

  filamentPoint(target, meta, t, twist, density, shock, speed) {
    const x = (t - 0.5) * STREAM_LENGTH;
    const breathe =
      0.78 +
      density * 0.7 +
      shock * 0.32 +
      Math.sin(this.time * 0.9 + meta.phase) * 0.05;
    const radius =
      meta.radius *
      breathe *
      (0.72 + Math.sin(t * 7.5 + meta.phase) * 0.16 + this.sample.btN * 0.2);
    const stretch = 1 + speed * 0.12;
    const angle = meta.phase + twist + t * (2.1 + this.sample.btN * 4.2);
    target.set(
      x * stretch,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
  }

  updateCmeBurst(launch, heat) {
    const positions = this.cmePositions;
    const colors = this.cmeColors;
    let cursor = 0;
    const strength = Math.min(1, launch);
    this.cmeMaterial.uniforms.uOpacity.value = strength * 0.95;
    this.cmeBurst.visible = this.layers.cme !== false && strength > 0.04;

    for (let r = 0; r < CME_RAYS; r += 1) {
      const meta = this.cmeMeta[r];
      const length = meta.length * (0.55 + strength * 1.8);
      for (let i = 0; i < CME_SEGMENTS; i += 1) {
        const t0 = i / CME_SEGMENTS;
        const t1 = (i + 1) / CME_SEGMENTS;
        this.cmePoint(_a, meta, t0, length, strength);
        this.cmePoint(_b, meta, t1, length, strength);
        this.writeQuad(positions, cursor, _a, _b, meta.width * (1.1 + strength));

        _color.copy(_gold).lerp(_hot, heat * 0.35);
        const fade = (1 - t0) * (0.35 + strength);
        for (let v = 0; v < 6; v += 1) {
          const colorIndex = (cursor + v) * 3;
          colors[colorIndex] = _color.r * fade;
          colors[colorIndex + 1] = _color.g * fade;
          colors[colorIndex + 2] = _color.b * fade;
        }
        cursor += 6;
      }
    }

    this.cmeGeometry.attributes.position.needsUpdate = true;
    this.cmeGeometry.attributes.color.needsUpdate = true;
  }

  cmePoint(target, meta, t, length, strength) {
    const x = -38 - t * length * 0.35 - strength * 2;
    const radius = 1.2 + t * length;
    const flicker = this.time * 2.4 + meta.angle;
    target.set(
      x,
      Math.cos(meta.angle + flicker * 0.05) * radius,
      Math.sin(meta.angle + meta.tilt + flicker * 0.05) * radius
    );
  }

  updateStormSheath(storm, shock) {
    const pulse = Math.max(storm, shock * 0.75);
    this.sheathMaterial.opacity = Math.min(0.38, pulse * 0.42);
    this.sheath.scale.set(2.4 + pulse * 2.2, 1.1 + pulse * 1.4, 1.1 + pulse * 1.4);
    this.sheath.position.set(8 + shock * 9, 0, 0);
    this.stormHit.position.copy(this.sheath.position);
    this.stormHit.scale.setScalar(0.8 + pulse * 1.1);
    this.flareHit.scale.setScalar(0.7 + this.sample.launch * 1.4);
  }

  writeQuad(positions, cursor, a, b, width) {
    _tangent.copy(b).sub(a);
    if (_tangent.lengthSq() < 1e-8) {
      _tangent.set(1, 0, 0);
    } else {
      _tangent.normalize();
    }

    _radial.set(0, a.y, a.z);
    if (_radial.lengthSq() < 1e-6) {
      _radial.set(0, 1, 0);
    } else {
      _radial.normalize();
    }

    _side.crossVectors(_tangent, _radial);
    if (_side.lengthSq() < 1e-6) {
      _side.crossVectors(_tangent, new THREE.Vector3(0, 1, 0));
    }
    _side.normalize().multiplyScalar(width * 0.5);

    const verts = [
      a.x - _side.x,
      a.y - _side.y,
      a.z - _side.z,
      a.x + _side.x,
      a.y + _side.y,
      a.z + _side.z,
      b.x + _side.x,
      b.y + _side.y,
      b.z + _side.z,
      a.x - _side.x,
      a.y - _side.y,
      a.z - _side.z,
      b.x + _side.x,
      b.y + _side.y,
      b.z + _side.z,
      b.x - _side.x,
      b.y - _side.y,
      b.z - _side.z,
    ];

    positions.set(verts, cursor * 3);
  }

  dispose() {
    this.filamentGeometry.dispose();
    this.filamentMaterial.dispose();
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
    this.cmeGeometry.dispose();
    this.cmeMaterial.dispose();
    this.sheath.geometry.dispose();
    this.sheathMaterial.dispose();
    this.bodyHit.geometry.dispose();
    this.flareHit.geometry.dispose();
    this.stormHit.geometry.dispose();
    this.bodyHit.material.dispose();
  }
}
