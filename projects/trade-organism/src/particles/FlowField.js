import * as THREE from "three";

const CATEGORY_COLORS = {
  general: 0xdff7ff,
  energy: 0xff9b5f,
  food: 0xa9ffe2,
  manufacturing: 0x7cc8ff,
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

    this.trailPositions = new Float32Array(this.particles.length * 2 * 3);
    this.trailColors = new Float32Array(this.particles.length * 2 * 3);
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPositions, 3)
    );
    this.trailGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.trailColors, 3)
    );

    this.trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.trails = new THREE.LineSegments(this.trailGeometry, this.trailMaterial);
    this.object = new THREE.Group();
    this.object.add(this.trails);
    this.update(0);
  }

  update(delta, layerState = {}) {
    this.time += delta;

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      const progress = (particle.offset + this.time * particle.speed) % 1;
      const tailProgress = (progress - particle.length + 1) % 1;
      const point = particle.edge.curve.getPoint(progress);
      const tail = particle.edge.curve.getPoint(tailProgress);
      const trailIndex = index * 6;

      this.trailPositions[trailIndex] = tail.x;
      this.trailPositions[trailIndex + 1] = tail.y;
      this.trailPositions[trailIndex + 2] = tail.z;
      this.trailPositions[trailIndex + 3] = point.x;
      this.trailPositions[trailIndex + 4] = point.y;
      this.trailPositions[trailIndex + 5] = point.z;

      const isVisible = layerState[particle.edge.category] !== false;
      const color = isVisible
        ? CATEGORY_THREE_COLORS[particle.edge.category] ??
          CATEGORY_THREE_COLORS.general
        : DISABLED_COLOR;
      const tailColor = isVisible ? color.clone().multiplyScalar(0.12) : color;

      this.trailColors[trailIndex] = tailColor.r;
      this.trailColors[trailIndex + 1] = tailColor.g;
      this.trailColors[trailIndex + 2] = tailColor.b;
      this.trailColors[trailIndex + 3] = color.r;
      this.trailColors[trailIndex + 4] = color.g;
      this.trailColors[trailIndex + 5] = color.b;
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
  }

  createParticles(edges) {
    return edges.flatMap((edge, edgeIndex) => {
      const count = Math.max(8, Math.ceil(edge.intensity * 28));
      return Array.from({ length: count }, (_, particleIndex) => ({
        edge,
        offset: (particleIndex / count + edgeIndex * 0.137) % 1,
        speed: 0.2 + edge.intensity * 0.48,
        length: 0.045 + edge.intensity * 0.075,
      }));
    });
  }
}
