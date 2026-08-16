import type { Coordinate, GraphEdge, GraphNode } from "../types";

type NodeLookup = ReadonlyMap<string, GraphNode>;

function sameCoordinate(a: Coordinate, b: Coordinate) {
  return a[0] === b[0] && a[1] === b[1];
}

function validStoredGeometry(edge: GraphEdge): Coordinate[] | null {
  if (!edge.geometry || edge.geometry.length < 2) return null;
  if (edge.geometry.some((coordinate) => coordinate.length !== 2 || coordinate.some((value) => !Number.isFinite(value)))) {
    return null;
  }
  return edge.geometry;
}

/**
 * Returns the edge polyline in traversal order. Legacy or synthetic edges
 * without stored shape geometry fall back to their graph-node endpoints.
 */
export function orientedEdgeCoordinates(
  edge: GraphEdge,
  traversedFromNodeId: string,
  nodeById: NodeLookup,
): Coordinate[] {
  const from = nodeById.get(edge.from)?.coordinate;
  const to = nodeById.get(edge.to)?.coordinate;
  if (!from || !to) throw new Error(`Edge ${edge.id} references an unknown node`);

  const stored = validStoredGeometry(edge);
  const coordinates = stored && sameCoordinate(stored[0], from) && sameCoordinate(stored.at(-1)!, to)
    ? stored
    : [from, to];

  if (traversedFromNodeId === edge.from) return [...coordinates];
  if (traversedFromNodeId === edge.to) return [...coordinates].reverse();
  throw new Error(`Edge ${edge.id} is not adjacent to traversal node ${traversedFromNodeId}`);
}

/** Stitches route edges without duplicating shared graph-node coordinates. */
export function routeCoordinates(
  nodeIds: string[],
  edges: GraphEdge[],
  nodeById: NodeLookup,
): Coordinate[] {
  if (edges.length === 0) {
    const coordinate = nodeById.get(nodeIds[0])?.coordinate;
    return coordinate ? [coordinate] : [];
  }
  if (nodeIds.length !== edges.length + 1) {
    throw new Error("Route node and edge counts do not describe one continuous path");
  }

  const coordinates: Coordinate[] = [];
  edges.forEach((edge, index) => {
    const segment = orientedEdgeCoordinates(edge, nodeIds[index], nodeById);
    coordinates.push(...(index === 0 ? segment : segment.slice(1)));
  });
  return coordinates;
}

