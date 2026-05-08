import * as THREE from "three";

export function nodePosition(index, total, weight) {
  const progress = index / Math.max(1, total - 1);
  const turn = progress * Math.PI * 18 + Math.sin(progress * Math.PI * 8) * 0.7;
  const current = Math.sin(progress * Math.PI);
  const radius = 6 + current * 30 + weight * 7 + Math.sin(index * 1.71) * 2.2;
  const y = (0.5 - progress) * 32 + Math.sin(turn * 0.55) * 7;
  return new THREE.Vector3(
    Math.cos(turn) * radius,
    y,
    Math.sin(turn) * radius * 0.72
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
