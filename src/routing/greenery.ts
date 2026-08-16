import greenerySnapshot from "../data/pilot-greenery.json";
import type { GraphEdge } from "../types";

const greeneryByEdge = greenerySnapshot.edgeGreenery as Record<string, { score: number; nearbyTreeIds: string[]; parkNames: string[] }>;
export const greeneryMetadata = greenerySnapshot.metadata;

export function edgeGreenery(edge: GraphEdge) {
  return greeneryByEdge[edge.id] ?? { score: 0, nearbyTreeIds: [], parkNames: [] };
}
