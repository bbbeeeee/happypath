import greenerySnapshot from "../data/greenery/bootstrap.json";
import type { GraphEdge, PilotGraph } from "../types";

const greeneryByEdge = greenerySnapshot.edgeGreenery as Record<string, { score: number; nearbyTreeIds: string[]; parkNames: string[] }>;
export const greeneryMetadata = greenerySnapshot.metadata;
const greeneryModules = import.meta.glob(["../data/greenery/*.json", "!../data/greenery/bootstrap.json"]);
const loadedPartitions = new Set<string>();

export async function loadGreeneryPartitions(partitionIds: readonly string[]) {
  await Promise.all(partitionIds.map(async (partitionId) => {
    if (loadedPartitions.has(partitionId)) return;
    const load = greeneryModules[`../data/greenery/${partitionId}.json`];
    if (!load) throw new Error(`Missing greenery partition: ${partitionId}`);
    const module = await load() as { default: { edgeGreenery: typeof greeneryByEdge } };
    Object.assign(greeneryByEdge, module.default.edgeGreenery);
    loadedPartitions.add(partitionId);
  }));
}

export function edgeGreenery(edge: GraphEdge) {
  return greeneryByEdge[edge.id] ?? { score: 0, nearbyTreeIds: [], parkNames: [] };
}

/**
 * Resolves the ends of graph edges with park-adjacency evidence into bounded,
 * deterministic Wander endpoints. These nodes are near a mapped park edge;
 * they are not claimed to be an entrance or proof of current access.
 */
export function parkEndpointNodeIds(graph: PilotGraph, originNodeId?: string, limit = 24) {
  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const origin = originNodeId ? nodeById.get(originNodeId) : undefined;
  const ids = [...new Set(graph.edges.flatMap((edge) => (
    edgeGreenery(edge).parkNames.length > 0 ? [edge.from, edge.to] : []
  )))].filter((nodeId) => graphNodeIds.has(nodeId));
  if (!origin) return ids.slice(0, limit);
  return ids.sort((a, b) => {
    const first = nodeById.get(a)!;
    const second = nodeById.get(b)!;
    const firstDistance = Math.hypot((first.coordinate[1] - origin.coordinate[1]) * 111_111, (first.coordinate[0] - origin.coordinate[0]) * 84_200);
    const secondDistance = Math.hypot((second.coordinate[1] - origin.coordinate[1]) * 111_111, (second.coordinate[0] - origin.coordinate[0]) * 84_200);
    return firstDistance - secondDistance || a.localeCompare(b);
  }).slice(0, limit);
}
