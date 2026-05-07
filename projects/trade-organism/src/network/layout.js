import * as THREE from "three";

export function nodePosition(index, total, weight) {
  const turn = index * 2.399963229728653;
  const radius = 12 + weight * 18 + (index % 5) * 1.7;
  const y = (index / Math.max(1, total - 1) - 0.5) * 22;
  return new THREE.Vector3(
    Math.cos(turn) * radius,
    y,
    Math.sin(turn) * radius
  );
}

export function chokepointPosition(index, total) {
  const angle = (index / total) * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(angle) * 9,
    Math.sin(angle * 1.7) * 4,
    Math.sin(angle) * 9
  );
}
