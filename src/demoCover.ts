import { orientedEdgeCoordinates } from "./routing/geometry";
import type { GraphEdge, JourneyResult, JourneyRoute, PilotGraph } from "./types";

function stableFraction(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

/**
 * A deterministic proof-of-concept signal. It is intentionally kept separate
 * from building shade and is never presented as a live dryness guarantee.
 */
export function demoCoverShare(edge: GraphEdge) {
  if (edge.osm?.steps || edge.distanceMeters < 12) return 0;
  const sample = stableFraction(edge.id);
  if (sample > 0.86) return 0.82;
  if (sample > 0.72 && edge.canyonFactor > 0.58) return 0.58;
  return 0;
}

export function demoCoverGeoJSON(graph: PilotGraph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    type: "FeatureCollection" as const,
    features: graph.edges.flatMap((edge) => {
      const coverShare = demoCoverShare(edge);
      if (coverShare === 0) return [];
      return [{
        type: "Feature" as const,
        id: edge.id,
        properties: {
          edgeId: edge.id,
          street: friendlyStreet(edge.street),
          coverShare,
          label: coverShare >= 0.8 ? "More likely overhead cover" : "Some likely overhead cover",
          sourceLabel: "Planning preview",
          proofLabel: "Estimated for planning; current cover still needs a closer look",
          evidenceKind: "likely_cover_demo" as const,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: orientedEdgeCoordinates(edge, edge.from, nodeById),
        },
      }];
    }),
  };
}

export function routeCoverShare(route: JourneyRoute, graph: PilotGraph) {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  let coveredMeters = 0;
  let totalMeters = 0;
  route.edgeIds.forEach((edgeId) => {
    const edge = edgeById.get(edgeId);
    if (!edge) return;
    totalMeters += edge.distanceMeters;
    coveredMeters += edge.distanceMeters * demoCoverShare(edge);
  });
  return totalMeters === 0 ? 0 : coveredMeters / totalMeters;
}

type TimedJourneyResult = JourneyResult & {
  timing?: {
    intent: "destination" | "target" | "maximum";
    requestedMinutes: number | null;
    targetRangeMinutes: { minimum: number; maximum: number } | null;
  };
};

export function pickRainFriendlyRoute(result: TimedJourneyResult, graph: PilotGraph) {
  const candidates = [result.recommended, ...result.alternatives];
  const requestedMinutes = result.timing?.requestedMinutes;
  const targetRange = result.timing?.targetRangeMinutes;
  let timeEligible = candidates;
  if (targetRange) {
    const inTarget = candidates.filter((route) => route.durationMinutes >= targetRange.minimum - 0.0001
      && route.durationMinutes <= targetRange.maximum + 0.0001);
    if (inTarget.length > 0) {
      timeEligible = inTarget;
    } else if (requestedMinutes !== null && requestedMinutes !== undefined) {
      const closestDifference = Math.min(...candidates.map((route) => Math.abs(route.durationMinutes - requestedMinutes)));
      timeEligible = candidates.filter((route) => Math.abs(route.durationMinutes - requestedMinutes) <= closestDifference + 0.25);
    }
  } else if (result.timing?.intent === "maximum" && requestedMinutes !== null && requestedMinutes !== undefined) {
    timeEligible = candidates.filter((route) => route.durationMinutes <= requestedMinutes + 0.0001);
  }
  return timeEligible.sort((a, b) => (
    routeCoverShare(b, graph) - routeCoverShare(a, graph)
      || b.preferenceScore - a.preferenceScore
      || a.durationMinutes - b.durationMinutes
  ))[0];
}

export function routeCoverSegmentsGeoJSON(route: JourneyRoute | null | undefined, graph: PilotGraph) {
  if (!route) return { type: "FeatureCollection" as const, features: [] };
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    type: "FeatureCollection" as const,
    features: route.edgeIds.map((edgeId, index) => {
      const edge = edgeById.get(edgeId);
      if (!edge) throw new Error(`Route references unknown edge ${edgeId}`);
      const coverShare = demoCoverShare(edge);
      return {
        type: "Feature" as const,
        id: `${route.candidateId}:cover:${index}`,
        properties: {
          edgeId,
          order: index,
          coverShare,
          coverBand: coverShare >= 0.7 ? "more" : coverShare > 0 ? "some" : "gap",
          label: coverShare > 0 ? `${Math.round(coverShare * 100)}% simulated cover signal` : "No simulated cover on this segment",
        },
        geometry: {
          type: "LineString" as const,
          coordinates: orientedEdgeCoordinates(edge, route.nodeIds[index], nodeById),
        },
      };
    }),
  };
}

function friendlyStreet(value: string) {
  const street = value.trim();
  if (!street || /^unnamed|pedestrian way|path$/i.test(street)) return "Pedestrian connection";
  return street;
}
