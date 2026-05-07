export function formatNode(node) {
  return `${node.name} · ${Math.round(node.weight * 100)} intensity`;
}

export function formatEdge(edge) {
  return `${edge.source.name} → ${edge.target.name} · ${edge.category}`;
}
