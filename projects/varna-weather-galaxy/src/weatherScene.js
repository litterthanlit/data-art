import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const START_YEAR = 2015;
const END_YEAR = 2025;
const YEAR_COUNT = END_YEAR - START_YEAR + 1;

const PALETTES = {
  cold: new THREE.Color("#38e9ff"),
  cool: new THREE.Color("#6778ff"),
  violet: new THREE.Color("#d84cff"),
  hot: new THREE.Color("#ff5b8a"),
  gold: new THREE.Color("#ffe66d"),
  white: new THREE.Color("#ffffff"),
  wind: new THREE.Color("#8f80ff"),
};

function normalizeDateProgress(time) {
  const date = new Date(`${time}:00+02:00`);
  const start = new Date(`${date.getFullYear()}-01-01T00:00:00+02:00`);
  const end = new Date(`${date.getFullYear() + 1}-01-01T00:00:00+02:00`);
  return (date - start) / (end - start);
}

function colorFromTemperature(tempNorm, humidityNorm, rainNorm) {
  const low =
    tempNorm < 0.5
      ? PALETTES.cold.clone().lerp(PALETTES.cool, tempNorm * 2)
      : PALETTES.violet.clone().lerp(PALETTES.gold, (tempNorm - 0.5) * 2);
  return rainNorm > 0.12 ? low.lerp(PALETTES.white, rainNorm * 0.75) : low.lerp(PALETTES.hot, humidityNorm * 0.38);
}

function colorForMode(mode, values, season) {
  const { humidity, temperature, rain, pressure, wind } = values;

  if (mode === "storm") {
    return PALETTES.cool.clone().lerp(PALETTES.white, Math.min(1, rain * 1.4 + wind * 0.35));
  }

  if (mode === "seasons") {
    const spring = new THREE.Color("#76ffcf");
    const summer = new THREE.Color("#ffe66d");
    const autumn = new THREE.Color("#ff6e54");
    const winter = new THREE.Color("#55d9ff");
    if (season < 0.25) return winter.lerp(spring, season / 0.25);
    if (season < 0.5) return spring.lerp(summer, (season - 0.25) / 0.25);
    if (season < 0.75) return summer.lerp(autumn, (season - 0.5) / 0.25);
    return autumn.lerp(winter, (season - 0.75) / 0.25);
  }

  if (mode === "heat") {
    return PALETTES.cold.clone().lerp(PALETTES.hot, temperature).lerp(PALETTES.gold, Math.max(0, temperature - 0.72));
  }

  if (mode === "wind") {
    return PALETTES.cold.clone().lerp(PALETTES.wind, wind).lerp(PALETTES.white, wind * 0.24);
  }

  return colorFromTemperature(temperature, humidity, rain).lerp(PALETTES.white, pressure * 0.08);
}

function nearestIndexForProgress(indices, progress, progresses) {
  if (!indices.length) return 0;
  let best = indices[0];
  let bestDistance = Infinity;
  for (const index of indices) {
    const distance = Math.abs(progresses[index] - progress);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export class WeatherScene {
  constructor({ stage, onSelect, onFrame }) {
    this.stage = stage;
    this.onSelect = onSelect;
    this.onFrame = onFrame;
    this.data = null;
    this.count = 0;
    this.basePositions = null;
    this.positions = null;
    this.colors = null;
    this.sizes = null;
    this.alphas = null;
    this.metrics = null;
    this.yearIndices = new Map();
    this.pulses = [];
    this.selectedIndex = null;
    this.currentIndex = 0;
    this.paused = false;

    this.state = {
      mode: "galaxy",
      focus: "humidity",
      allYears: true,
      selectedYear: END_YEAR,
      timeProgress: 0,
      intensity: 0.7,
    };

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0026);

    this.camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 1, 5000);
    this.camera.position.set(0, 36, 720);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.stage.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 1450;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.22;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 9;
    this.pointer = new THREE.Vector2();
    this.pointerDirty = false;

    this.marker = this.createMarker();
    this.group.add(this.marker);

    this.stage.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.stage.addEventListener("pointerleave", () => this.clearHover());
    this.stage.addEventListener("click", (event) => this.handleClick(event));
    addEventListener("resize", () => this.resize());

    this.animate();
  }

  createMarker() {
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7, 10, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf5f2ea,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    );
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 18, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      })
    );
    marker.add(ring, dot);
    marker.visible = false;
    return marker;
  }

  pointMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        pixelRatio: { value: Math.min(devicePixelRatio, 2) },
      },
      vertexShader: `
        uniform float pixelRatio;
        attribute float size;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * pixelRatio * (360.0 / max(120.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          float glow = smoothstep(0.5, 0.0, dist);
          float core = smoothstep(0.18, 0.0, dist);
          gl_FragColor = vec4(vColor + core * 0.28, glow * vAlpha);
        }
      `,
    });
  }

  setData(data) {
    this.data = data;
    this.count = data.hourly.time.length;
    this.positions = new Float32Array(this.count * 3);
    this.basePositions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.alphas = new Float32Array(this.count);
    this.metrics = {
      year: new Uint16Array(this.count),
      progress: new Float32Array(this.count),
      hour: new Uint8Array(this.count),
      humidity: new Float32Array(this.count),
      temperature: new Float32Array(this.count),
      pressure: new Float32Array(this.count),
      wind: new Float32Array(this.count),
      rain: new Float32Array(this.count),
      windDirection: new Float32Array(this.count),
    };

    this.buildGeometry();
    this.updateAppearance();
    this.updateCurrentIndex();
    this.updateMarker();
  }

  buildGeometry() {
    const h = this.data.hourly;
    const linePositions = [];
    const lineColors = [];

    for (let i = 0; i < this.count; i++) {
      const time = h.time[i];
      const year = Number(time.slice(0, 4));
      const yearIndex = year - START_YEAR;
      const progress = normalizeDateProgress(time);
      const hour = Number(time.slice(11, 13));
      const humidity = h.humidityNorm[i] ?? 0;
      const rain = h.rainNorm[i] ?? 0;
      const temperature = h.temperatureNorm[i] ?? 0;
      const pressure = h.pressureNorm[i] ?? 0;
      const wind = h.windNorm[i] ?? 0;
      const windDirection = ((h.windDirection[i] ?? 0) * Math.PI) / 180;

      this.metrics.year[i] = year;
      this.metrics.progress[i] = progress;
      this.metrics.hour[i] = hour;
      this.metrics.humidity[i] = humidity;
      this.metrics.temperature[i] = temperature;
      this.metrics.pressure[i] = pressure;
      this.metrics.wind[i] = wind;
      this.metrics.rain[i] = rain;
      this.metrics.windDirection[i] = windDirection;

      if (!this.yearIndices.has(year)) this.yearIndices.set(year, []);
      this.yearIndices.get(year).push(i);

      const yearRadius = 82 + yearIndex * 15;
      const seasonAngle = progress * Math.PI * 2 + yearIndex * 0.48;
      const hourPulse = Math.sin((hour / 24) * Math.PI * 2) * 16;
      const windBend = wind * 84;
      const humidityPull = humidity * 120;
      const radius = yearRadius + humidityPull + hourPulse + Math.sin(progress * Math.PI * 8) * 34;
      const swirl = seasonAngle + wind * 1.8 + Math.sin(i * 0.0018) * 0.8;

      const x = Math.cos(swirl) * radius + Math.cos(windDirection) * windBend;
      const y = Math.sin(swirl) * radius * 0.72 + Math.sin(windDirection) * windBend;
      const z =
        (pressure - 0.5) * 430 +
        Math.sin(progress * Math.PI * 2 + yearIndex) * 85 +
        Math.cos(i * 0.003) * humidity * 70;

      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;

      if (i % 37 === 0) {
        const color = colorFromTemperature(temperature, humidity, rain);
        const endX = x + Math.cos(windDirection) * (30 + wind * 90);
        const endY = y + Math.sin(windDirection) * (30 + wind * 90);
        const endZ = z + (pressure - 0.5) * 50;
        linePositions.push(x, y, z, endX, endY, endZ);
        lineColors.push(color.r, color.g, color.b, color.r * 0.4, color.g * 0.4, color.b * 0.4);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));

    this.points = new THREE.Points(geometry, this.pointMaterial());
    this.group.add(this.points);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
    this.lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(lineGeometry, this.lineMaterial);
    this.group.add(this.lines);

    this.rings = [];
    for (let i = 0; i < YEAR_COUNT; i++) {
      const curve = new THREE.EllipseCurve(0, 0, 90 + i * 15, 64 + i * 11, 0, Math.PI * 2);
      const points2d = curve.getPoints(180);
      const ringGeometry = new THREE.BufferGeometry().setFromPoints(
        points2d.map((p) => new THREE.Vector3(p.x, p.y, (i - YEAR_COUNT / 2) * 18))
      );
      const ringMaterial = new THREE.LineBasicMaterial({
        color: i % 2 ? 0x835cff : 0x47e7ff,
        transparent: true,
        opacity: 0.08,
      });
      const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
      ring.rotation.x = 0.72;
      ring.rotation.z = i * 0.11;
      ring.userData.year = START_YEAR + i;
      this.rings.push(ring);
      this.group.add(ring);
    }
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.updateAppearance();
    this.updateCurrentIndex();
    this.updateRings();
    this.updateMarker();
  }

  setPaused(paused) {
    this.paused = paused;
    this.controls.autoRotate = !paused;
  }

  resetView() {
    this.camera.position.set(0, 36, 720);
    this.controls.target.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.controls.update();
  }

  focusValue(index) {
    const focus = this.state.focus;
    if (focus === "temperature") return this.metrics.temperature[index];
    if (focus === "pressure") return this.metrics.pressure[index];
    if (focus === "wind") return this.metrics.wind[index];
    if (focus === "rain") return this.metrics.rain[index];
    return this.metrics.humidity[index];
  }

  updateAppearance(includePulse = false) {
    if (!this.data || !this.points) return;
    const { mode, allYears, selectedYear, timeProgress, intensity } = this.state;
    const pulseNow = performance.now();
    const activePulses = includePulse ? this.pulses.filter((pulse) => pulseNow - pulse.started < 1350) : [];
    if (includePulse) this.pulses = activePulses;

    for (let i = 0; i < this.count; i++) {
      const p = i * 3;
      const yearVisible = allYears || this.metrics.year[i] === selectedYear;
      const sameYear = this.metrics.year[i] === selectedYear;
      const focus = this.focusValue(i);
      const values = {
        humidity: this.metrics.humidity[i],
        temperature: this.metrics.temperature[i],
        pressure: this.metrics.pressure[i],
        wind: this.metrics.wind[i],
        rain: this.metrics.rain[i],
      };
      const baseX = this.basePositions[p];
      const baseY = this.basePositions[p + 1];
      const baseZ = this.basePositions[p + 2];
      const windPush = mode === "wind" ? 48 : mode === "storm" ? 34 : 0;
      const heatLift = mode === "heat" ? (values.temperature - 0.5) * 120 : 0;
      const stormLift = mode === "storm" ? (values.rain * 130 + values.wind * 42) : 0;

      this.positions[p] = baseX + Math.cos(this.metrics.windDirection[i]) * values.wind * windPush;
      this.positions[p + 1] = baseY + Math.sin(this.metrics.windDirection[i]) * values.wind * windPush;
      this.positions[p + 2] = baseZ + heatLift + stormLift;

      const temporalDistance = sameYear ? Math.abs(this.metrics.progress[i] - timeProgress) : 1;
      const temporalBoost = sameYear ? Math.exp(-Math.pow(temporalDistance * 28, 2)) : 0;
      const baseAlpha = yearVisible ? 0.38 : 0.055;
      let alpha = baseAlpha + focus * 0.5 + temporalBoost * 0.7;
      let size = 2.2 + values.humidity * 4.5 + values.rain * 13 + values.wind * 3 + focus * 7 * intensity;

      if (mode === "storm") {
        alpha += values.rain * 0.7 + values.wind * 0.2;
        size += values.rain * 18 + values.wind * 5;
      } else if (mode === "seasons") {
        alpha += sameYear ? 0.2 : 0.02;
        size += temporalBoost * 9;
      } else if (mode === "heat") {
        alpha += values.temperature * 0.45;
        size += values.temperature * 10;
      } else if (mode === "wind") {
        alpha += values.wind * 0.55;
        size += values.wind * 13;
      }

      for (const pulse of activePulses) {
        const age = (pulseNow - pulse.started) / 1350;
        const radius = age * 560;
        const dx = this.positions[p] - pulse.origin.x;
        const dy = this.positions[p + 1] - pulse.origin.y;
        const dz = this.positions[p + 2] - pulse.origin.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const band = Math.exp(-Math.pow((distance - radius) / 58, 2)) * (1 - age);
        alpha += band * 1.2;
        size += band * 28;
      }

      const color = colorForMode(mode, values, this.metrics.progress[i]);
      this.colors[p] = color.r;
      this.colors[p + 1] = color.g;
      this.colors[p + 2] = color.b;
      this.sizes[i] = Math.max(1.2, size);
      this.alphas[i] = Math.min(1, Math.max(0.035, alpha));
    }

    const attributes = this.points.geometry.attributes;
    attributes.position.needsUpdate = true;
    attributes.color.needsUpdate = true;
    attributes.size.needsUpdate = true;
    attributes.alpha.needsUpdate = true;
    this.lineMaterial.opacity = mode === "wind" ? 0.54 : mode === "storm" ? 0.48 : 0.28;
  }

  updateCurrentIndex() {
    if (!this.data) return;
    const indices = this.yearIndices.get(this.state.selectedYear) ?? [];
    this.currentIndex = nearestIndexForProgress(indices, this.state.timeProgress, this.metrics.progress);
  }

  updateMarker() {
    if (!this.data || this.currentIndex == null) return;
    const p = this.currentIndex * 3;
    this.marker.position.set(this.positions[p], this.positions[p + 1], this.positions[p + 2]);
    this.marker.visible = true;
  }

  updateRings() {
    if (!this.rings) return;
    for (const ring of this.rings) {
      const selected = ring.userData.year === this.state.selectedYear;
      ring.material.opacity =
        this.state.mode === "seasons" ? (selected ? 0.34 : 0.13) : this.state.allYears || selected ? 0.08 : 0.025;
    }
  }

  handlePointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerDirty = true;
  }

  handleClick(event) {
    if (!this.data) return;
    this.handlePointerMove(event);
    const index = this.pickPoint();
    const pulseIndex = index ?? this.currentIndex;
    const p = pulseIndex * 3;
    this.pulses.push({
      started: performance.now(),
      origin: new THREE.Vector3(this.positions[p], this.positions[p + 1], this.positions[p + 2]),
    });
    if (index != null) this.selectIndex(index);
  }

  pickPoint() {
    if (!this.points) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.points, false)[0];
    return hit?.index ?? null;
  }

  selectIndex(index) {
    this.selectedIndex = index;
    this.onSelect?.(this.readingAt(index));
  }

  clearHover() {
    this.pointerDirty = false;
  }

  readingAt(index) {
    if (!this.data || index == null) return null;
    const h = this.data.hourly;
    return {
      index,
      time: h.time[index],
      humidity: h.humidity[index],
      temperature: h.temperature[index],
      rain: h.rain[index],
      pressure: h.pressure[index],
      windSpeed: h.windSpeed[index],
      windDirection: h.windDirection[index],
      humidityNorm: h.humidityNorm[index],
      temperatureNorm: h.temperatureNorm[index],
      rainNorm: h.rainNorm[index],
      pressureNorm: h.pressureNorm[index],
      windNorm: h.windNorm[index],
    };
  }

  currentReading() {
    return this.readingAt(this.currentIndex);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.pointerDirty && this.data) {
      const index = this.pickPoint();
      if (index != null) this.selectIndex(index);
    }

    if (this.pulses.length) {
      this.updateAppearance(true);
      this.updateMarker();
    }

    if (!this.paused) {
      const speed = this.state.mode === "storm" ? 0.0016 : this.state.mode === "wind" ? 0.0013 : 0.0009;
      this.group.rotation.y += speed;
      this.group.rotation.z = Math.sin(performance.now() * 0.00008) * 0.08;
    }

    this.marker.lookAt(this.camera.position);
    this.controls.update();
    this.onFrame?.(this.currentReading(), this.state);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    if (this.points) this.points.material.uniforms.pixelRatio.value = Math.min(devicePixelRatio, 2);
  }
}
