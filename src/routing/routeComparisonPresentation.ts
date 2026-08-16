import type { JourneyRequirements, JourneyRoute, PilotGraph } from "../types";
import { orientedEdgeCoordinates } from "./geometry";

export interface DeterministicRouteComparison {
  recommendedCandidateId: string;
  baselineCandidateId: string;
  sameRoute: boolean;
  extraMinutes: number;
  directSunMinutesSaved: number;
  longestExposedMinutesSaved: number;
  greeneryGainPoints: number;
  mappedStepEdgeChange: number;
  hardRequirements: {
    avoidMappedSteps: {
      requested: true;
      baselineSatisfied: boolean;
      recommendedSatisfied: boolean;
      retained: boolean;
    } | null;
  };
}

export function compareJourneyRoutes(
  recommended: JourneyRoute,
  baseline: JourneyRoute,
  requirements: JourneyRequirements = {},
): DeterministicRouteComparison {
  const avoidMappedSteps = requirements.avoidMappedSteps ? {
    requested: true as const,
    baselineSatisfied: baseline.mappedStepEdges === 0,
    recommendedSatisfied: recommended.mappedStepEdges === 0,
    retained: baseline.mappedStepEdges === 0 && recommended.mappedStepEdges === 0,
  } : null;
  return {
    recommendedCandidateId: recommended.candidateId,
    baselineCandidateId: baseline.candidateId,
    sameRoute: recommended.candidateId === baseline.candidateId,
    extraMinutes: recommended.durationMinutes - baseline.durationMinutes,
    directSunMinutesSaved: baseline.directSunMinutes - recommended.directSunMinutes,
    longestExposedMinutesSaved: baseline.longestExposedMinutes - recommended.longestExposedMinutes,
    greeneryGainPoints: recommended.greeneryPercent - baseline.greeneryPercent,
    mappedStepEdgeChange: recommended.mappedStepEdges - baseline.mappedStepEdges,
    hardRequirements: { avoidMappedSteps },
  };
}

/**
 * Emits only geometry that differs between the recommendation and baseline.
 * It describes route change, not causal attribution for a benefit claim.
 */
export function routeComparisonDeltaGeoJSON(
  recommended: JourneyRoute,
  baseline: JourneyRoute,
  graph: PilotGraph,
) {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const baselineEdges = new Set(baseline.edgeIds);
  const recommendedEdges = new Set(recommended.edgeIds);

  const changedFeatures = (
    route: JourneyRoute,
    comparisonEdges: Set<string>,
    routeRole: "recommended_only" | "baseline_only",
  ) => {
    if (route.nodeIds.length !== route.edgeIds.length + 1) {
      throw new Error(`Route ${route.candidateId} does not describe one continuous path`);
    }
    return route.edgeIds.flatMap((edgeId, order) => {
      if (comparisonEdges.has(edgeId)) return [];
      const edge = edgeById.get(edgeId);
      if (!edge) throw new Error(`Route ${route.candidateId} references unknown edge ${edgeId}`);
      return [{
        type: "Feature" as const,
        id: `${routeRole}:${route.candidateId}:${order}`,
        properties: {
          routeRole,
          candidateId: route.candidateId,
          edgeId,
          order,
          street: edge.street,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: orientedEdgeCoordinates(edge, route.nodeIds[order], nodeById),
        },
      }];
    });
  };

  return {
    type: "FeatureCollection" as const,
    features: [
      ...changedFeatures(recommended, baselineEdges, "recommended_only"),
      ...changedFeatures(baseline, recommendedEdges, "baseline_only"),
    ],
  };
}
