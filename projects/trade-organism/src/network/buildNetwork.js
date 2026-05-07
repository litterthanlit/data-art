import * as THREE from "three";
import { chokepointPosition, nodePosition } from "./layout.js";

export function buildNetwork(data) {
  const chokepoints = new Map(
    data.chokepoints.map((point, index) => [
      point.id,
      { ...point, position: chokepointPosition(index, data.chokepoints.length) },
    ])
  );

  const nodes = data.nodes.map((node, index) => ({
    ...node,
    position: nodePosition(index, data.nodes.length, node.weight),
  }));

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = data.edges.map((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const choke = chokepoints.get(edge.chokepoint);
    const mid = source.position.clone().lerp(target.position, 0.5);
    const control = mid.lerp(choke.position, 0.42 + choke.pressure * 0.18);
    const curve = new THREE.CatmullRomCurve3([
      source.position,
      control,
      target.position,
    ]);
    return { ...edge, source, target, choke, curve };
  });

  return {
    meta: data.meta,
    categories: data.categories,
    chokepoints: [...chokepoints.values()],
    nodes,
    edges,
  };
}
