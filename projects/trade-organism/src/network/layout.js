import * as THREE from "three";

export function nodePosition(index, total, weight) {
  const turn = index * 2.399963229728653;
  const normalizedY = 1 - (2 * (index + 0.5)) / Math.max(1, total);
  const shell = Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
  const radius = shell * (18 + weight * 18) + (index % 7) * 0.42;
  const y = normalizedY * 22;
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
