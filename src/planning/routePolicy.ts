import { pilotGraph } from "../data/cityGraph";
import { resolveTransitAssetsToGraphNodes } from "../data/transitEndpoints";
import { parkEndpointNodeIds } from "../routing/greenery";
import type { PilotGraph, TripBrief as RoutingTripBrief } from "../types";
import { distanceMilesToRoutingMinutes, type TripBrief } from "./tripBrief";

export function buildRoutingTripBrief(
  brief: TripBrief,
  originNodeId: string,
  destinationNodeId: string,
  graph: PilotGraph = pilotGraph,
): RoutingTripBrief {
  const preferences = [
    ...(brief.priorities.includes("shade") ? [{ featureId: "shade" as const, weight: 1 }] : []),
    ...(brief.priorities.includes("greenery") ? [{ featureId: "green" as const, weight: 1 }] : []),
  ];
  const common = {
    originNodeId,
    departureHour: brief.departureHour,
    preferences,
    requirements: { avoidMappedSteps: brief.avoidMappedSteps },
  };
  if (brief.shape === "destination") {
    return { ...common, journeyShape: "destination", destinationNodeId, detourAllowanceMinutes: brief.detourMinutes };
  }
  const walkingBudgetMinutes = brief.distanceMiles === null
    ? brief.walkingMinutes
    : distanceMilesToRoutingMinutes(brief.distanceMiles);
  if (brief.shape === "loop") return { ...common, journeyShape: "loop", walkingBudgetMinutes };

  const endCondition = brief.endCondition === "transit"
    ? {
        nodeIds: [...new Set(resolveTransitAssetsToGraphNodes(graph.nodes, { maxSnapDistanceMeters: 50 }).map((candidate) => candidate.graphNodeId))],
        label: "near a subway entrance",
      }
    : brief.endCondition === "park"
      ? { nodeIds: parkEndpointNodeIds(graph, originNodeId), label: "near a mapped park edge" }
      : undefined;
  return {
    ...common,
    journeyShape: "wander",
    walkingBudgetMinutes,
    direction: brief.direction ?? undefined,
    endCondition,
  };
}
