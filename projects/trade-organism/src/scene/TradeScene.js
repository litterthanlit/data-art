import * as THREE from "three";

export const CATEGORY_COLORS = {
  general: 0x9be7ff,
  energy: 0xff6b3d,
  food: 0xb9f56a,
  manufacturing: 0x9d7cff,
};

export class TradeScene {
  constructor({ stage }) {
    if (!stage) {
      throw new Error("Scene stage is missing");
    }

    this.stage = stage;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.clock = new THREE.Clock();
    this.animationId = null;
    this.paused = false;

    this.nodes = new THREE.Group();
    this.edges = new THREE.Group();
    this.organism = new THREE.Group();
    this.organism.add(this.edges, this.nodes);
    this.scene.add(this.organism);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.ambientLight);

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.stage.appendChild(this.renderer.domElement);

    this.resetView();
    this.handleResize = this.handleResize.bind(this);
    this.animate = this.animate.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.handleResize();
  }

  load(network) {
    this.clearGroup(this.nodes);
    this.clearGroup(this.edges);

    for (const edge of network.edges) {
      const color = CATEGORY_COLORS[edge.category] ?? CATEGORY_COLORS.general;
      const geometry = new THREE.BufferGeometry().setFromPoints(
        edge.curve.getPoints(44)
      );
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34 + edge.intensity * 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.userData = { kind: "edge", item: edge };
      this.edges.add(line);
    }

    for (const node of network.nodes) {
      const color = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.general;
      const geometry = new THREE.SphereGeometry(
        0.18 + node.weight * 1.3,
        24,
        16
      );
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(node.position);
      mesh.userData = { kind: "node", item: node };
      this.nodes.add(mesh);
    }

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
      this.organism.rotation.y += delta * 0.08;
      this.organism.rotation.x = Math.sin(this.clock.elapsedTime * 0.22) * 0.08;
    }

    this.render();
  }

  setPaused(value) {
    this.paused = Boolean(value);
  }

  resetView() {
    this.camera.position.set(0, 3, 56);
    this.camera.lookAt(0, 0, 0);
    this.organism.rotation.set(0, 0, 0);
    this.render();
  }

  dispose() {
    if (this.animationId !== null) {
      window.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    window.removeEventListener("resize", this.handleResize);
    this.clearGroup(this.nodes);
    this.clearGroup(this.edges);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  handleResize() {
    const width = Math.max(1, this.stage.clientWidth || window.innerWidth);
    const height = Math.max(1, this.stage.clientHeight || window.innerHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children.pop();
      child.geometry?.dispose();

      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material?.dispose();
      }
    }
  }
}
