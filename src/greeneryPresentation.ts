import { edgeGreenery } from "./routing/greenery";
import { orientedEdgeCoordinates } from "./routing/geometry";
import type { JourneyRoute, PilotGraph } from "./types";

export const AMBIENT_GREENERY_MIN_SCORE = 0.8;

function greeneryFeature(
  edge: PilotGraph["edges"][number],
  nodeById: ReadonlyMap<string, PilotGraph["nodes"][number]>,
  score: number,
  parkNames: readonly string[],
) {
  return {
    type: "Feature" as const,
    id: edge.id,
    properties: {
      edgeId: edge.id,
      street: edge.street,
      greeneryScore: score,
      greeneryBand: parkNames.length > 0 ? "park_edge" as const : "tree_context" as const,
      parkNames: parkNames.join(", "),
      label: parkNames.length > 0 ? `Near ${parkNames.slice(0, 2).join(" and ")}` : "Trees listed nearby",
      proofLabel: "Based on nearby tree and park listings; street conditions may have changed",
    },
    geometry: {
      type: "LineString" as const,
      coordinates: orientedEdgeCoordinates(edge, edge.from, nodeById),
    },
  };
}

/**
 * A deliberately sparse neighborhood field. It highlights only the strongest
 * edge evidence instead of turning tens of thousands of tree records into pins.
 */
export function ambientGreeneryGeoJSON(graph: PilotGraph, minimumScore = AMBIENT_GREENERY_MIN_SCORE) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    type: "FeatureCollection" as const,
    features: graph.edges.flatMap((edge) => {
      const greenery = edgeGreenery(edge);
      return greenery.score >= minimumScore
        ? [greeneryFeature(edge, nodeById, greenery.score, greenery.parkNames)]
        : [];
    }),
  };
}

/** Keeps route identity intact by rendering greenery as an offset shoulder. */
export function routeGreeneryGeoJSON(route: JourneyRoute | null | undefined, graph: PilotGraph) {
  if (!route) return { type: "FeatureCollection" as const, features: [] };
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    type: "FeatureCollection" as const,
    features: route.edgeIds.flatMap((edgeId) => {
      const edge = edgeById.get(edgeId);
      if (!edge) return [];
      const greenery = edgeGreenery(edge);
      return greenery.score > 0
        ? [greeneryFeature(edge, nodeById, greenery.score, greenery.parkNames)]
        : [];
    }),
  };
}
