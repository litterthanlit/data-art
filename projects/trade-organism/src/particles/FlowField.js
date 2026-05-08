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

const VERTICES_PER_RIBBON = 6;

export class FlowField {
  constructor(edges) {
    this.edges = edges;
    this.time = 0;
    this.particles = this.createParticles(edges);

    this.trailPositions = new Float32Array(
      this.particles.length * VERTICES_PER_RIBBON * 3
    );
    this.trailColors = new Float32Array(
      this.particles.length * VERTICES_PER_RIBBON * 3
    );
    this.trailAlpha = new Float32Array(
      this.particles.length * VERTICES_PER_RIBBON
    );
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPositions, 3)
    );
    this.trailGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.trailColors, 3)
    );
    this.trailGeometry.setAttribute(
      "alpha",
      new THREE.BufferAttribute(this.trailAlpha, 1)
    );

    this.trailMaterial = new THREE.ShaderMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        opacity: { value: 0.86 },
      },
      vertexShader: `
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float glow = smoothstep(0.0, 1.0, vAlpha);
          gl_FragColor = vec4(vColor * (0.45 + glow * 1.65), vAlpha * opacity);
        }
      `,
    });

    this.trails = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
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
      const direction = point.clone().sub(tail).normalize();
      const side = direction
        .clone()
        .cross(point.clone().normalize())
        .normalize()
        .multiplyScalar(particle.width);

      if (!Number.isFinite(side.x) || side.lengthSq() < 0.0001) {
        side.set(particle.width, 0, 0);
      }

      const tailLeft = tail.clone().sub(side.clone().multiplyScalar(0.25));
      const tailRight = tail.clone().add(side.clone().multiplyScalar(0.25));
      const headLeft = point.clone().sub(side);
      const headRight = point.clone().add(side);
      const vertices = [tailLeft, tailRight, headRight, tailLeft, headRight, headLeft];
      const trailIndex = index * VERTICES_PER_RIBBON * 3;
      const alphaIndex = index * VERTICES_PER_RIBBON;

      vertices.forEach((vertex, vertexIndex) => {
        const positionIndex = trailIndex + vertexIndex * 3;
        this.trailPositions[positionIndex] = vertex.x;
        this.trailPositions[positionIndex + 1] = vertex.y;
        this.trailPositions[positionIndex + 2] = vertex.z;
      });

      const isVisible = layerState[particle.edge.category] !== false;
      const color = isVisible
        ? CATEGORY_THREE_COLORS[particle.edge.category] ??
          CATEGORY_THREE_COLORS.general
        : DISABLED_COLOR;
      const tailColor = isVisible ? color.clone().multiplyScalar(0.12) : color;
      const colors = [tailColor, tailColor, color, tailColor, color, color];
      const alphas = isVisible ? [0, 0, 0.72, 0, 0.72, 1] : [0, 0, 0, 0, 0, 0];

      colors.forEach((vertexColor, vertexIndex) => {
        const colorIndex = trailIndex + vertexIndex * 3;
        this.trailColors[colorIndex] = vertexColor.r;
        this.trailColors[colorIndex + 1] = vertexColor.g;
        this.trailColors[colorIndex + 2] = vertexColor.b;
        this.trailAlpha[alphaIndex + vertexIndex] = alphas[vertexIndex];
      });
    }

    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.color.needsUpdate = true;
    this.trailGeometry.attributes.alpha.needsUpdate = true;
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
        width: 0.025 + edge.intensity * 0.12,
      }));
    });
  }
}
