import * as THREE from "three";

const FILAMENTS = 30;
const SEGMENTS = 128;
const STREAKS = 14000;
const DUST = 1400;
const CME_RAYS = 42;
const CME_SEGMENTS = 22;
export const STREAM_LENGTH = 92;
const UPSTREAM_X = -STREAM_LENGTH * 0.5;
const QUAD_ACROSS = [-1, 1, 1, -1, 1, -1];
const QUAD_ALONG = [0, 0, 1, 0, 1, 1];

// Shared tail of both ribbon vertex shaders. Each shader defines
// ribbonPoint(t) (the strip's centreline) and ribbonWidth(t); this turns the
// centreline into a camera-independent ribbon by offsetting each vertex
// sideways, perpendicular to the flow and to the stream axis.
const RIBBON_EXTRUDE = `
  vec3 extrude(float t, float across, float width) {
    vec3 p = ribbonPoint(t);
    vec3 tangent = ribbonPoint(t + 0.002) - ribbonPoint(t - 0.002);
    tangent = dot(tangent, tangent) < 1e-10 ? vec3(1.0, 0.0, 0.0) : normalize(tangent);
    vec3 radial = vec3(0.0, p.y, p.z);
    radial = dot(radial, radial) < 1e-8 ? vec3(0.0, 1.0, 0.0) : normalize(radial);
    vec3 side = cross(tangent, radial);
    if (dot(side, side) < 1e-8) side = cross(tangent, vec3(0.0, 1.0, 0.0));
    return p + normalize(side) * width * 0.5 * across;
  }
`;

// Filament centrelines are computed entirely on the GPU: the geometry is a
// static strip of (across, along) coordinates uploaded once, and the vertex
// shader bends it every frame from the solar-wind uniforms.
const FILAMENT_VERTEX = `
  attribute vec3 rib;
  attribute vec4 strip;   // phase, radius, spin, width
  attribute float sheath; // 1.0 for the wide, dim outer sheath ribbons
  varying vec3 vColor;
  varying vec3 vRib;
  uniform float uTime;
  uniform float uDensity;
  uniform float uSpeed;
  uniform float uHeat;
  uniform float uStorm;
  uniform float uShock;
  uniform float uBt;
  uniform float uLength;
  uniform vec3 uIndigo;
  uniform vec3 uCyan;
  uniform vec3 uHot;
  uniform vec3 uStormColor;

  vec3 ribbonPoint(float t) {
    float phase = strip.x;
    float breathe = 0.6 + uDensity * 0.5 + uStorm * 0.3 + sin(uTime * 0.9 + phase) * 0.06;
    // Flared at the source, narrowing as the stream travels, then fanning
    // out again downstream — gives the body a silhouette instead of a tube.
    float envelope = 0.55 + pow(abs(t - 0.38) * 1.6, 1.4);
    float turbulence = sin(t * 19.0 + uTime * 2.4 + phase * 3.0) * uStorm * 0.35;
    float radius = strip.y * breathe * (envelope + sin(t * 7.5 + phase) * 0.12 + turbulence);
    float twist = uTime * strip.z * (0.4 + uBt * 2.2);
    float angle = phase + twist + t * (1.4 + uBt * 7.5);
    float x = (t - 0.5) * uLength * (1.0 + uSpeed * 0.18);
    return vec3(x, cos(angle) * radius, sin(angle) * radius);
  }
${RIBBON_EXTRUDE}
  void main() {
    float width = strip.w * (0.7 + uDensity * 0.6 + uStorm * 0.3) * mix(1.0, 2.2, sheath);
    vec3 p = extrude(rib.y, rib.x, width);

    vec3 c = mix(uIndigo, uCyan, mix(0.55 + uDensity * 0.3, 0.2, sheath));
    c = mix(c, uHot, min(1.0, uHeat * 0.45 + uShock * 0.35));
    c = mix(c, uStormColor, uStorm * mix(0.7, 0.95, sheath));
    float shade = mix(0.75, 0.3, sheath) + uDensity * 0.2 + uStorm * 0.3;

    vColor = c * shade;
    vRib = rib;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// CME rays: Fibonacci-sphere spokes from the upstream source that grow with
// eruption progress and scale with the CME's catalogued speed.
const CME_VERTEX = `
  attribute vec3 rib;
  attribute vec4 strip;   // theta, angle, length, width
  attribute float sheath; // launch delay (0..1) for staggered rays
  varying vec3 vColor;
  varying vec3 vRib;
  uniform float uTime;
  uniform float uProgress;
  uniform float uStrength;
  uniform float uSpeedScale;
  uniform float uHeat;
  uniform vec3 uGold;
  uniform vec3 uHot;
  uniform vec3 uOrigin;

  float rayLength() {
    float reach = clamp((uProgress - sheath * 0.25) * 1.4, 0.0, 1.0);
    return strip.z * uSpeedScale * (0.2 + reach * 1.8);
  }

  vec3 ribbonPoint(float t) {
    float d = 0.8 + t * rayLength();
    float theta = strip.x + sin(t * 6.0 + uTime * 3.0 + strip.y) * 0.08 * t;
    return uOrigin + vec3(cos(theta), sin(theta) * cos(strip.y), sin(theta) * sin(strip.y)) * d;
  }
${RIBBON_EXTRUDE}
  void main() {
    float t = rib.y;
    float width = strip.w * (1.0 + uStrength * 1.4) * (1.0 - t * 0.6);
    vec3 p = extrude(t, rib.x, width);
    vColor = mix(uGold, uHot, uHeat * 0.4) * (1.0 - t) * (1.4 + uStrength * 2.2);
    vRib = rib;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// Soft-edged additive ribbon: bright core, feathered edges, pulses that
// travel downstream so the filaments read as flowing plasma, not flat tape.
const RIBBON_FRAGMENT = `
  varying vec3 vColor;
  varying vec3 vRib;
  uniform float uPulseTime;
  uniform float uOpacity;
  uniform float uFlow;
  uniform float uShock;
  uniform float uShockFront;
  uniform float uEndFade;

  void main() {
    float across = abs(vRib.x);
    float core = exp(-across * across * 4.0);
    float edge = smoothstep(1.0, 0.35, across);
    float phase = vRib.y * 14.0 - uPulseTime * uFlow + vRib.z * 6.2831;
    float pulse = pow(0.5 + 0.5 * sin(phase), 8.0);
    float ends = smoothstep(0.0, uEndFade, vRib.y) * smoothstep(1.0, 1.0 - uEndFade, vRib.y);
    float front = exp(-pow((vRib.y - uShockFront) * 11.0, 2.0)) * uShock;
    vec3 c = vColor * (0.25 + core * 0.9 + pulse * 1.6);
    c += vec3(1.0, 0.86, 0.74) * front * 1.4 * core;
    gl_FragColor = vec4(c, uOpacity * edge * ends);
  }
`;

// Streak particles are advected entirely on the GPU. Each one is a short
// velocity-aligned trail; density decides how many are alive, speed decides
// trail length and drift rate.
const STREAK_VERTEX = `
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
  uniform float uBt;
  uniform float uLength;
  uniform float uShockFront;

  vec3 streamPoint(float a, float front) {
    float r = pow(seed.y, 1.3) * (3.0 + uDensity * 4.0 + uStorm * 3.0);
    r *= 1.0 + front * 0.9;
    r += sin(a * 31.0 + uTime * 2.6 + seed.x * 40.0) * uStorm * 1.4;
    float ang = seed.z * 6.2831 + a * (1.5 + uBt * 9.0) + uTime * (0.08 + uBt * 0.3);
    float stretch = 1.0 + uSpeed * 0.18;
    return vec3((a - 0.5) * uLength * stretch, cos(ang) * r, sin(ang) * r);
  }

  void main() {
    float alive = step(seed.w, 0.22 + uDensity * 0.48);
    float rate = (0.025 + uSpeed * 0.16 + uShock * 0.06) * (0.55 + seed.w * 0.9);
    float a = fract(seed.x + uTime * rate);
    float front = exp(-pow((a - uShockFront) * 9.0, 2.0)) * uShock;
    float trail = 0.004 + uSpeed * 0.028 + front * 0.03;

    vec4 head = modelViewMatrix * vec4(streamPoint(a, front), 1.0);
    vec4 tail = modelViewMatrix * vec4(streamPoint(a - trail, front), 1.0);
    vec2 dir = head.xy - tail.xy;
    float len = length(dir);
    dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float width = 0.035 + seed.w * 0.05 + uDensity * 0.02 + front * 0.04;

    vec4 mv = mix(tail, head, corner.x * 0.5 + 0.5);
    mv.xy += perp * corner.y * width + dir * corner.x * width;

    float radial = pow(seed.y, 1.3);
    float heat = clamp(uHeat * 0.55 + front * 0.8 + (1.0 - radial) * 0.12, 0.0, 1.0);
    vec3 cool = mix(vec3(0.16, 0.24, 1.0), vec3(0.4, 0.92, 1.0), 1.0 - radial);
    vec3 hot = vec3(1.0, 0.72, 0.34);
    vec3 storm = vec3(1.0, 0.24, 0.38);
    vColor = mix(cool, hot, heat);
    vColor = mix(vColor, storm, clamp(uStorm * (0.35 + radial), 0.0, 0.85));
    vColor += vec3(1.0, 0.9, 0.8) * front * 1.2;
    vColor *= 0.7 + (1.0 - radial) * 0.9;

    float ends = smoothstep(0.0, 0.06, a) * smoothstep(1.0, 0.9, a);
    vAlpha = alive * ends * (0.07 + seed.w * 0.1 + uDensity * 0.03);
    vCorner = corner;
    gl_Position = projectionMatrix * mv;
  }
`;

const STREAK_FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vCorner;
  void main() {
    float side = 1.0 - vCorner.y * vCorner.y;
    float headBias = 0.25 + 0.75 * (vCorner.x * 0.5 + 0.5);
    float a = vAlpha * side * side * headBias;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

// Fresnel shell around the stream: invisible face-on, a hot coral rim when
// Earth's magnetosphere answers a storm.
const SHEATH_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vX;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vX = position.x;
    gl_Position = projectionMatrix * mv;
  }
`;

const SHEATH_FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vX;
  uniform float uPulse;
  uniform float uTime;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
    float ripple = 0.65 + 0.35 * sin(vX * 3.0 - uTime * 4.0);
    vec3 c = vec3(1.0, 0.25, 0.4) * rim * ripple * uPulse * 0.9;
    gl_FragColor = vec4(c * 0.8, rim * uPulse * 0.28);
  }
`;

const GLOW_VERTEX = `
  varying vec2 vUv;
  uniform float uScale;
  void main() {
    vUv = uv * 2.0 - 1.0;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uScale;
    gl_Position = projectionMatrix * mv;
  }
`;

const GLOW_FRAGMENT = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uIntensity;
  void main() {
    float d = length(vUv);
    float g = exp(-d * d * 6.0) + exp(-d * 18.0) * 1.5;
    gl_FragColor = vec4(uColor * g * uIntensity, g * min(1.0, uIntensity));
  }
`;

function additiveShader(params) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    ...params,
  });
}

export class PlasmaField {
  constructor() {
    this.group = new THREE.Group();
    this.time = 0;
    this.sample = null;
    this.layers = { plasma: true, cme: true, storm: true };
    this.shockFront = 0;
    this.flash = 0;
    this.prevShock = 0;
    this.eruption = 0;
    this.prevLaunch = 0;

    this.createFilaments();
    this.createStreaks();
    this.createCmeBurst();
    this.createStormSheath();
    this.createDust();
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

  // Scene-level intensity signals used for bloom, exposure and camera shake.
  get energy() {
    if (!this.sample) return { storm: 0, shock: 0, launch: 0, flash: 0 };
    return {
      storm: this.layers.storm === false ? 0 : this.sample.storm,
      shock: this.sample.shock,
      launch: this.layers.cme === false ? 0 : Math.min(1, this.eruption),
      flash: this.flash,
    };
  }

  // Static strip geometry: per-vertex (across, along, seed) plus the strip's
  // own parameters. Nothing here is rewritten after creation — the vertex
  // shader derives every position from these and the current uniforms.
  createRibbonGeometry(stripMeta, segments) {
    const strips = stripMeta.length;
    const vertexCount = strips * segments * 6;
    const rib = new Float32Array(vertexCount * 3);
    const strip = new Float32Array(vertexCount * 4);
    const flag = new Float32Array(vertexCount);

    for (let s = 0; s < strips; s += 1) {
      const stripSeed = (s * 0.618034) % 1;
      const { params, flag: stripFlag } = stripMeta[s];
      for (let i = 0; i < segments; i += 1) {
        for (let v = 0; v < 6; v += 1) {
          const vertex = (s * segments + i) * 6 + v;
          rib[vertex * 3] = QUAD_ACROSS[v];
          rib[vertex * 3 + 1] = (i + QUAD_ALONG[v]) / segments;
          rib[vertex * 3 + 2] = stripSeed;
          strip.set(params, vertex * 4);
          flag[vertex] = stripFlag;
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    // Three needs a position attribute to size the draw call; the shader
    // ignores it.
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3)
    );
    geometry.setAttribute("rib", new THREE.BufferAttribute(rib, 3));
    geometry.setAttribute("strip", new THREE.BufferAttribute(strip, 4));
    geometry.setAttribute("sheath", new THREE.BufferAttribute(flag, 1));
    return geometry;
  }

  createRibbonMaterial({ vertexShader, endFade, uniforms }) {
    return additiveShader({
      side: THREE.DoubleSide,
      uniforms: {
        uPulseTime: { value: 0 },
        uOpacity: { value: 0.8 },
        uFlow: { value: 2 },
        uShock: { value: 0 },
        uShockFront: { value: -1 },
        uEndFade: { value: endFade },
        ...uniforms,
      },
      vertexShader,
      fragmentShader: RIBBON_FRAGMENT,
    });
  }

  createFilaments() {
    const meta = [];
    for (let i = 0; i < FILAMENTS; i += 1) {
      meta.push({
        params: [
          (i / FILAMENTS) * Math.PI * 2,
          0.9 + ((i * 7) % 11) * 0.62,
          0.18 + (i % 6) * 0.07,
          0.22 + (i % 5) * 0.09,
        ],
        flag: i % 5 === 0 ? 1 : 0,
      });
    }

    this.filamentGeometry = this.createRibbonGeometry(meta, SEGMENTS);
    this.filamentMaterial = this.createRibbonMaterial({
      vertexShader: FILAMENT_VERTEX,
      endFade: 0.12,
      uniforms: {
        uTime: { value: 0 },
        uDensity: { value: 0.2 },
        uSpeed: { value: 0.2 },
        uHeat: { value: 0.2 },
        uStorm: { value: 0 },
        uBt: { value: 0 },
        uLength: { value: STREAM_LENGTH },
        uIndigo: { value: new THREE.Color(0x2a3cff) },
        uCyan: { value: new THREE.Color(0x5fe6ff) },
        uHot: { value: new THREE.Color(0xffb35a) },
        uStormColor: { value: new THREE.Color(0xff3d5e) },
      },
    });
    this.filaments = new THREE.Mesh(this.filamentGeometry, this.filamentMaterial);
    this.filaments.frustumCulled = false;
    this.group.add(this.filaments);
  }

  createStreaks() {
    const vertexCount = STREAKS * 6;
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

    for (let i = 0; i < STREAKS; i += 1) {
      const seed = [Math.random(), Math.random(), Math.random(), Math.random()];
      for (let c = 0; c < 6; c += 1) {
        const index = i * 6 + c;
        corners[index * 2] = quad[c][0];
        corners[index * 2 + 1] = quad[c][1];
        seeds.set(seed, index * 4);
      }
    }

    this.streakGeometry = new THREE.BufferGeometry();
    this.streakGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.streakGeometry.setAttribute("corner", new THREE.BufferAttribute(corners, 2));
    this.streakGeometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 4));

    this.streakMaterial = additiveShader({
      uniforms: {
        uTime: { value: 0 },
        uDensity: { value: 0.2 },
        uSpeed: { value: 0.2 },
        uHeat: { value: 0.2 },
        uStorm: { value: 0 },
        uShock: { value: 0 },
        uBt: { value: 0 },
        uLength: { value: STREAM_LENGTH },
        uShockFront: { value: -1 },
      },
      vertexShader: STREAK_VERTEX,
      fragmentShader: STREAK_FRAGMENT,
    });

    this.streaks = new THREE.Mesh(this.streakGeometry, this.streakMaterial);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);
  }

  createCmeBurst() {
    const meta = [];
    for (let i = 0; i < CME_RAYS; i += 1) {
      const u = (i + 0.5) / CME_RAYS;
      meta.push({
        // Fibonacci sphere, biased downstream so the ejecta blooms toward
        // the stream instead of being a symmetric starburst.
        params: [
          Math.acos(1 - 2 * u) * 0.8,
          i * 2.39996,
          6 + ((i * 5) % 9) * 1.6,
          0.16 + (i % 4) * 0.08,
        ],
        flag: ((i * 3) % 7) / 7,
      });
    }

    this.cmeGeometry = this.createRibbonGeometry(meta, CME_SEGMENTS);
    this.cmeMaterial = this.createRibbonMaterial({
      vertexShader: CME_VERTEX,
      endFade: 0.02,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uStrength: { value: 0 },
        uSpeedScale: { value: 1 },
        uHeat: { value: 0 },
        uGold: { value: new THREE.Color(0xffd27a) },
        uHot: { value: new THREE.Color(0xffb35a) },
        uOrigin: { value: new THREE.Vector3(UPSTREAM_X - 1.5, 0, 0) },
      },
    });
    this.cmeBurst = new THREE.Mesh(this.cmeGeometry, this.cmeMaterial);
    this.cmeBurst.frustumCulled = false;
    this.group.add(this.cmeBurst);

    this.glowMaterial = additiveShader({
      uniforms: {
        uColor: { value: new THREE.Color(1.0, 0.72, 0.4) },
        uIntensity: { value: 0.3 },
        uScale: { value: 12 },
      },
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
    });
    this.sourceGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glowMaterial);
    this.sourceGlow.position.set(UPSTREAM_X - 1.5, 0, 0);
    this.sourceGlow.frustumCulled = false;
    this.group.add(this.sourceGlow);
  }

  createStormSheath() {
    this.sheathMaterial = additiveShader({
      side: THREE.DoubleSide,
      uniforms: { uPulse: { value: 0 }, uTime: { value: 0 } },
      vertexShader: SHEATH_VERTEX,
      fragmentShader: SHEATH_FRAGMENT,
    });
    this.sheath = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 32),
      this.sheathMaterial
    );
    this.sheath.frustumCulled = false;
    this.group.add(this.sheath);
  }

  createDust() {
    const positions = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i += 1) {
      const r = 70 + Math.random() * 160;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dustMaterial = new THREE.PointsMaterial({
      color: 0x6d7cc4,
      size: 1.4,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.dust = new THREE.Points(geometry, this.dustMaterial);
    this.group.add(this.dust);
  }

  createHitTargets() {
    const hidden = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });

    this.bodyHit = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, STREAM_LENGTH, 16, 1, true),
      hidden
    );
    this.bodyHit.rotation.z = Math.PI / 2;
    this.bodyHit.userData.kind = "plasma";

    this.flareHit = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 12), hidden);
    this.flareHit.position.set(UPSTREAM_X - 2, 0, 0);
    this.flareHit.userData.kind = "cme";

    this.stormHit = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 12), hidden);
    this.stormHit.position.set(STREAM_LENGTH * 0.3, 0, 0);
    this.stormHit.userData.kind = "storm";

    this.group.add(this.bodyHit, this.flareHit, this.stormHit);
  }

  setLayers(layers) {
    this.layers = { ...this.layers, ...layers };
    this.filaments.visible = this.layers.plasma !== false;
    this.streaks.visible = this.layers.plasma !== false;
    this.cmeBurst.visible = this.layers.cme !== false;
    this.sourceGlow.visible = this.layers.cme !== false;
    this.sheath.visible = this.layers.storm !== false;
  }

  setSample(sample) {
    this.sample = sample;
  }

  update(delta) {
    if (!this.sample) return;

    const speed = this.sample.speedN;
    this.time += delta * (0.5 + speed * 1.8);

    const density = this.sample.densityN;
    const heat = this.sample.tempN;
    const bt = this.sample.btN;
    const shock = this.sample.shock;
    const storm = this.layers.storm === false ? 0 : this.sample.storm;
    const launch = this.layers.cme === false ? 0 : Math.min(1, this.sample.launch);

    // A shock arrival fires a compression wave that rolls down the stream;
    // a rising edge also triggers a white flash that decays.
    if (shock > 0.05) {
      this.shockFront += delta * (0.22 + speed * 0.5);
      if (this.shockFront > 1.15) this.shockFront = -0.15;
    } else {
      this.shockFront = -0.3;
    }
    if (shock - this.prevShock > 0.01) {
      this.flash = Math.min(1, this.flash + (shock - this.prevShock) * 2.5);
    }
    this.prevShock = shock;
    this.flash *= Math.exp(-delta * 2.2);

    // Eruptions restart from the core on each new launch, then expand out.
    if (launch - this.prevLaunch > 0.08) this.eruption = 0;
    this.prevLaunch = launch;
    this.eruption = launch > 0.05 ? Math.min(1.4, this.eruption + delta * 0.9) : 0;

    const u = this.streakMaterial.uniforms;
    u.uTime.value = this.time;
    u.uDensity.value = density;
    u.uSpeed.value = speed;
    u.uHeat.value = heat;
    u.uStorm.value = storm;
    u.uShock.value = shock;
    u.uBt.value = bt;
    u.uShockFront.value = this.shockFront;

    const f = this.filamentMaterial.uniforms;
    f.uTime.value = this.time;
    f.uPulseTime.value = this.time;
    f.uDensity.value = density;
    f.uSpeed.value = speed;
    f.uHeat.value = heat;
    f.uStorm.value = storm;
    f.uBt.value = bt;
    f.uFlow.value = 1.2 + speed * 5;
    f.uShock.value = shock;
    f.uShockFront.value = this.shockFront;
    f.uOpacity.value = 0.32 + density * 0.12 + storm * 0.08;

    this.updateCmeBurst(launch, heat);
    this.updateStormSheath(storm, shock, density);
  }

  updateCmeBurst(launch, heat) {
    const progress = this.eruption;
    const strength = launch * Math.max(0, 1 - Math.max(0, progress - 0.8) * 1.6);

    const c = this.cmeMaterial.uniforms;
    c.uTime.value = this.time;
    c.uPulseTime.value = this.time * 2;
    c.uFlow.value = 6;
    c.uOpacity.value = Math.min(1, strength * 1.3);
    c.uProgress.value = progress;
    c.uStrength.value = strength;
    c.uHeat.value = heat;
    c.uSpeedScale.value =
      0.6 + Math.min(1, (this.sample.cme?.speed ?? 600) / 2000) * 0.9;
    this.cmeBurst.visible = this.layers.cme !== false && strength > 0.02;

    this.glowMaterial.uniforms.uIntensity.value =
      0.25 + this.sample.speedN * 0.25 + strength * 3.2;
    this.glowMaterial.uniforms.uScale.value = 12 + strength * 18;
  }

  updateStormSheath(storm, shock, density) {
    const pulse = Math.max(storm, shock * 0.7);
    const beat = 1 + Math.sin(this.time * 3.2) * 0.04 * pulse;
    this.sheathMaterial.uniforms.uPulse.value = pulse;
    this.sheathMaterial.uniforms.uTime.value = this.time;
    this.sheath.scale.set(
      STREAM_LENGTH * 0.56,
      (6 + density * 3 + pulse * 4) * beat,
      (6 + density * 3 + pulse * 4) * beat
    );
    this.sheath.visible = this.layers.storm !== false && pulse > 0.02;
    this.stormHit.scale.setScalar(0.8 + pulse * 1.1);
    this.flareHit.scale.setScalar(0.7 + this.sample.launch * 1.4);
  }

  dispose() {
    this.filamentGeometry.dispose();
    this.filamentMaterial.dispose();
    this.streakGeometry.dispose();
    this.streakMaterial.dispose();
    this.cmeGeometry.dispose();
    this.cmeMaterial.dispose();
    this.glowMaterial.dispose();
    this.sourceGlow.geometry.dispose();
    this.sheath.geometry.dispose();
    this.sheathMaterial.dispose();
    this.dust.geometry.dispose();
    this.dustMaterial.dispose();
    this.bodyHit.geometry.dispose();
    this.flareHit.geometry.dispose();
    this.stormHit.geometry.dispose();
    this.bodyHit.material.dispose();
  }
}
