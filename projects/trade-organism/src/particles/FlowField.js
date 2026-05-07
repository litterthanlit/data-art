import * as THREE from "three";

const CATEGORY_COLORS = {
  general: 0x9be7ff,
  energy: 0xff6b3d,
  food: 0xb9f56a,
  manufacturing: 0x9d7cff,
};

const DISABLED_COLOR = new THREE.Color(0x000000);
const CATEGORY_THREE_COLORS = Object.fromEntries(
  Object.entries(CATEGORY_COLORS).map(([category, color]) => [
    category,
    new THREE.Color(color),
  ])
);

export class FlowField {
  constructor(edges) {
    this.edges = edges;
    this.time = 0;
    this.particles = this.createParticles(edges);

    this.positions = new Float32Array(this.particles.length * 3);
    this.colors = new Float32Array(this.particles.length * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3)
    );

    this.material = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.object = this.points;
    this.update(0);
  }

  update(delta, layerState = {}) {
    this.time += delta;

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      const progress = (particle.offset + this.time * particle.speed) % 1;
      const point = particle.edge.curve.getPoint(progress);
      const positionIndex = index * 3;

      this.positions[positionIndex] = point.x;
      this.positions[positionIndex + 1] = point.y;
      this.positions[positionIndex + 2] = point.z;

      const isVisible = layerState[particle.edge.category] !== false;
      const color = isVisible
        ? CATEGORY_THREE_COLORS[particle.edge.category] ??
          CATEGORY_THREE_COLORS.general
        : DISABLED_COLOR;

      this.colors[positionIndex] = color.r;
      this.colors[positionIndex + 1] = color.g;
      this.colors[positionIndex + 2] = color.b;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }

  createParticles(edges) {
    return edges.flatMap((edge, edgeIndex) => {
      const count = Math.max(3, Math.ceil(edge.intensity * 16));
      return Array.from({ length: count }, (_, particleIndex) => ({
        edge,
        offset: (particleIndex / count + edgeIndex * 0.137) % 1,
        speed: 0.12 + edge.intensity * 0.34,
      }));
    });
  }
}
