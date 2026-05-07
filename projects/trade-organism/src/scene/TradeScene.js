import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FlowField } from "../particles/FlowField.js";

export const CATEGORY_COLORS = {
  general: 0x9be7ff,
  energy: 0xff6b3d,
  food: 0xb9f56a,
  manufacturing: 0x9d7cff,
};

export class TradeScene {
  constructor({ stage, onHover = () => {} }) {
    if (!stage) {
      throw new Error("Scene stage is missing");
    }

    this.stage = stage;
    this.onHover = onHover;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x03060b, 0.012);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerClient = null;
    this.clock = new THREE.Clock();
    this.animationId = null;
    this.paused = false;
    this.hoveredItem = null;
    this.flowField = null;
    this.edgeHitSamples = [];
    this.activePointers = new Map();
    this.dragPointerId = null;
    this.dragStart = null;
    this.baseRotation = { x: 0, y: 0 };
    this.autoRotationY = 0;
    this.pinchStart = null;
    this.zoomLimits = { min: 22, max: 82 };
    this.layerState = {
      general: true,
      energy: true,
      food: true,
      manufacturing: true,
    };

    this.nodes = new THREE.Group();
    this.edges = new THREE.Group();
    this.organism = new THREE.Group();
    this.organism.add(this.edges, this.nodes);
    this.scene.add(this.organism);
    this.atmosphere = this.createAtmosphere();
    this.scene.add(this.atmosphere);

    this.ambientLight = new THREE.AmbientLight(0xaecbff, 0.55);
    this.scene.add(this.ambientLight);

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.touchAction = "none";
    this.stage.appendChild(this.renderer.domElement);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      1.35,
      0.7,
      0.08
    );
    this.composer.addPass(this.bloomPass);

    this.resetView();
    this.handleResize = this.handleResize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.animate = this.animate.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.handlePointerDown
    );
    this.renderer.domElement.addEventListener(
      "pointermove",
      this.handlePointerMove
    );
    this.renderer.domElement.addEventListener(
      "pointerup",
      this.handlePointerUp
    );
    this.renderer.domElement.addEventListener(
      "pointercancel",
      this.handlePointerUp
    );
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.handlePointerLeave
    );
    this.renderer.domElement.addEventListener("wheel", this.handleWheel, {
      passive: false,
    });
    this.handleResize();
  }

  load(network) {
    this.disposeFlowField();
    this.clearGroup(this.nodes);
    this.clearGroup(this.edges);
    this.edgeHitSamples = [];

    for (const edge of network.edges) {
      const color = CATEGORY_COLORS[edge.category] ?? CATEGORY_COLORS.general;
      const baseOpacity = 0.055 + edge.intensity * 0.16;
      const geometry = new THREE.BufferGeometry().setFromPoints(
        edge.curve.getPoints(44)
      );
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: baseOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.userData = { kind: "edge", item: edge, baseOpacity };
      this.edges.add(line);

      this.edgeHitSamples.push(
        ...edge.curve.getPoints(36).map((point) => ({ edge, point }))
      );
    }

    for (const node of network.nodes) {
      const color = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.general;
      const coreRadius = 0.08 + node.weight * 0.62;
      const geometry = new THREE.SphereGeometry(coreRadius, 24, 16);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.position);
      mesh.userData = { kind: "node", item: node, baseOpacity: 0.95 };
      this.nodes.add(mesh);

      const haloGeometry = new THREE.SphereGeometry(coreRadius * 3.8, 20, 12);
      const haloMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.position.copy(node.position);
      halo.userData = { kind: "node", item: node, baseOpacity: 0.11 };
      this.nodes.add(halo);
    }

    this.flowField = new FlowField(network.edges);
    this.edges.add(this.flowField.object);

    this.setLayers(this.layerState);
    this.render();
  }

  start() {
    if (this.animationId === null) {
      this.clock.start();
      this.animate();
    }
  }

  animate() {
    this.animationId = window.requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    if (!this.paused) {
      this.autoRotationY += delta * 0.08;
    }

    this.applyRotation();
    this.flowField?.update(this.paused ? 0 : delta, this.layerState);
    this.updateHover();
    this.render();
  }

  setPaused(value) {
    this.paused = Boolean(value);
  }

  setLayers(layers) {
    this.layerState = { ...this.layerState, ...layers };

    for (const line of this.edges.children) {
      if (line.userData.kind !== "edge") {
        continue;
      }

      const category = line.userData.item.category;
      const enabled = this.layerState[category] !== false;
      line.visible = enabled;
      line.material.opacity = line.userData.baseOpacity;
    }

    for (const mesh of this.nodes.children) {
      const category = mesh.userData.item.category;
      const enabled = this.layerState[category] !== false;
      mesh.visible = enabled;
      mesh.material.opacity = mesh.userData.baseOpacity;
    }

    this.flowField?.update(0, this.layerState);
    this.updateHover();
    this.render();
  }

  resetView() {
    this.baseRotation.x = 0;
    this.baseRotation.y = 0;
    this.autoRotationY = 0;
    this.camera.position.set(0, 4, 74);
    this.camera.lookAt(0, 0, 0);
    this.applyRotation();
    this.render();
  }

  dispose() {
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    window.removeEventListener("resize", this.handleResize);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown
    );
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.handlePointerMove
    );
    this.renderer.domElement.removeEventListener(
      "pointerup",
      this.handlePointerUp
    );
    this.renderer.domElement.removeEventListener(
      "pointercancel",
      this.handlePointerUp
    );
    this.renderer.domElement.removeEventListener(
      "pointerleave",
      this.handlePointerLeave
    );
    this.renderer.domElement.removeEventListener("wheel", this.handleWheel);
    this.disposeFlowField();
    this.clearGroup(this.nodes);
    this.clearGroup(this.edges);
    this.edgeHitSamples = [];
    this.composer.dispose();
    this.disposeObject(this.atmosphere);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  handleResize() {
    const width = Math.max(1, this.stage.clientWidth || window.innerWidth);
    const height = Math.max(1, this.stage.clientHeight || window.innerHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.render();
  }

  handlePointerDown(event) {
    this.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    this.renderer.domElement.setPointerCapture?.(event.pointerId);

    if (this.activePointers.size === 1) {
      this.dragPointerId = event.pointerId;
      this.dragStart = {
        x: event.clientX,
        y: event.clientY,
        rotationX: this.baseRotation.x,
        rotationY: this.baseRotation.y,
      };
      this.pinchStart = null;
      return;
    }

    if (this.activePointers.size === 2) {
      this.dragPointerId = null;
      this.dragStart = null;
      this.pinchStart = {
        distance: this.getPointerDistance(),
        cameraZ: this.camera.position.z,
      };
    }
  }

  handlePointerMove(event) {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (this.activePointers.size >= 2 && this.pinchStart) {
        this.handlePinchZoom();
        return;
      }

      if (this.dragPointerId === event.pointerId && this.dragStart) {
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;
        this.baseRotation.y = this.dragStart.rotationY + deltaX * 0.008;
        this.baseRotation.x = THREE.MathUtils.clamp(
          this.dragStart.rotationX + deltaY * 0.006,
          -0.9,
          0.9
        );
        this.applyRotation();
        this.render();
        return;
      }
    }

    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    this.pointerClient = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    this.updateHover();
  }

  handlePointerUp(event) {
    this.activePointers.delete(event.pointerId);
    if (this.renderer.domElement.hasPointerCapture?.(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (this.dragPointerId === event.pointerId) {
      this.dragPointerId = null;
      this.dragStart = null;
    }

    if (this.activePointers.size === 1) {
      const [pointerId, pointer] = this.activePointers.entries().next().value;
      this.dragPointerId = pointerId;
      this.dragStart = {
        x: pointer.x,
        y: pointer.y,
        rotationX: this.baseRotation.x,
        rotationY: this.baseRotation.y,
      };
      this.pinchStart = null;
      return;
    }

    this.pinchStart = null;
  }

  handlePointerLeave() {
    if (this.activePointers.size === 0) {
      this.pointerClient = null;
      this.setHoveredItem(null);
    }
  }

  handleWheel(event) {
    event.preventDefault();
    this.setCameraZoom(this.camera.position.z + event.deltaY * 0.035);
  }

  handlePinchZoom() {
    const distance = this.getPointerDistance();
    if (!distance || !this.pinchStart?.distance) {
      return;
    }

    const scale = this.pinchStart.distance / distance;
    this.setCameraZoom(this.pinchStart.cameraZ * scale);
  }

  getPointerDistance() {
    const points = [...this.activePointers.values()];
    if (points.length < 2) {
      return 0;
    }

    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  setCameraZoom(value) {
    this.camera.position.z = THREE.MathUtils.clamp(
      value,
      this.zoomLimits.min,
      this.zoomLimits.max
    );
    this.camera.lookAt(0, 0, 0);
    this.render();
  }

  applyRotation() {
    const drift = this.paused
      ? 0
      : Math.sin(this.clock.elapsedTime * 0.22) * 0.08;
    this.organism.rotation.x = this.baseRotation.x + drift;
    this.organism.rotation.y = this.baseRotation.y + this.autoRotationY;
    this.atmosphere.rotation.y = this.organism.rotation.y * 0.35;
    this.atmosphere.rotation.x = this.organism.rotation.x * 0.18;
  }

  updateHover() {
    if (!this.pointerClient) {
      return;
    }

    this.organism.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const nodeHits = this.raycaster
      .intersectObjects(this.nodes.children, false)
      .filter((hit) => {
        const category = hit.object.userData.item.category;
        return this.layerState[category] !== false;
      });

    if (nodeHits.length > 0) {
      this.setHoveredItem({
        kind: "node",
        value: nodeHits[0].object.userData.item,
      });
      return;
    }

    const edgeHit = this.findNearestEdgeSample();
    this.setHoveredItem(edgeHit ? { kind: "edge", value: edgeHit.edge } : null);
  }

  findNearestEdgeSample() {
    const threshold = 14;
    const projected = new THREE.Vector3();
    const worldPoint = new THREE.Vector3();
    let nearest = null;
    let nearestDistance = threshold;

    for (const sample of this.edgeHitSamples) {
      if (this.layerState[sample.edge.category] === false) {
        continue;
      }

      worldPoint.copy(sample.point);
      this.organism.localToWorld(worldPoint);
      projected.copy(worldPoint).project(this.camera);

      if (projected.z < -1 || projected.z > 1) {
        continue;
      }

      const x = ((projected.x + 1) / 2) * this.pointerClient.width;
      const y = ((-projected.y + 1) / 2) * this.pointerClient.height;
      const distance = Math.hypot(
        x - this.pointerClient.x,
        y - this.pointerClient.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = sample;
      }
    }

    return nearest;
  }

  setHoveredItem(item) {
    const currentKind = this.hoveredItem?.kind;
    const currentId = this.hoveredItem?.value.id;
    const nextKind = item?.kind;
    const nextId = item?.value.id;

    if (currentKind === nextKind && currentId === nextId) {
      return;
    }

    this.hoveredItem = item;
    this.onHover(item);
  }

  render() {
    this.composer.render();
  }

  clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children.pop();
      this.disposeObject(child);
    }
  }

  disposeObject(object) {
    object.geometry?.dispose();

    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else {
      object.material?.dispose();
    }
  }

  disposeFlowField() {
    if (!this.flowField) {
      return;
    }

    this.flowField.object.removeFromParent();
    this.flowField.dispose();
    this.flowField = null;
  }

  createAtmosphere() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorA = new THREE.Color(0x376bff);
    const colorB = new THREE.Color(0xff7145);

    for (let index = 0; index < count; index += 1) {
      const seed = index + 1;
      const angle = seed * 2.399963229728653;
      const radius = 18 + ((seed * 37) % 100) * 0.52;
      const height = (((seed * 53) % 100) / 100 - 0.5) * 56;
      const depth = Math.sin(seed * 12.9898) * 24;
      const positionIndex = index * 3;

      positions[positionIndex] = Math.cos(angle) * radius;
      positions[positionIndex + 1] = height;
      positions[positionIndex + 2] = Math.sin(angle) * radius + depth;

      const color = colorA.clone().lerp(colorB, ((seed * 17) % 100) / 100);
      colors[positionIndex] = color.r * 0.38;
      colors[positionIndex + 1] = color.g * 0.38;
      colors[positionIndex + 2] = color.b * 0.38;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geometry, material);
  }
}
