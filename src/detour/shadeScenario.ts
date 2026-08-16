import type { GraphEdge, JourneyRoute, PilotGraph } from "../types";
import { edgeShade } from "../routing/shade";
import { WALKING_METERS_PER_MINUTE } from "../routing/journey";

export interface ShadeDetourScenario {
  title: string;
  status: "hypothetical";
  street: string;
  edgeId: string;
  baselineDirectSunMinutes: number;
  scenarioDirectSunMinutes: number;
  avoidedDirectSunMinutes: number;
  intervention: string;
  assumptions: string[];
  sourceIds: string[];
}

function exposedMinutes(edge: GraphEdge, hour: number) {
  return edge.distanceMeters * (1 - edgeShade(edge, hour)) / WALKING_METERS_PER_MINUTE;
}

/**
 * Produces one guided Detour proof from the same graph and shade feature used
 * by the resident route. It does not select, price, or recommend a real City
 * project; it only shows a bounded before/after calculation.
 */
export function buildShadeDetourScenario(graph: PilotGraph, route: JourneyRoute, hour: number): ShadeDetourScenario | null {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const routeEdges = route.edgeIds.map((id) => edgeById.get(id)).filter((edge): edge is GraphEdge => Boolean(edge));
  if (routeEdges.length === 0) return null;
  const target = [...routeEdges].sort((a, b) => exposedMinutes(b, hour) - exposedMinutes(a, hour))[0];
  const before = exposedMinutes(target, hour);
  const existingShade = edgeShade(target, hour);
  const hypotheticalShade = Math.max(existingShade, 0.8);
  const after = target.distanceMeters * (1 - hypotheticalShade) / WALKING_METERS_PER_MINUTE;
  const avoided = Math.max(0, before - after);
  return {
    title: `A shade gap on ${target.street || "this block"}`,
    status: "hypothetical",
    street: target.street || "Unnamed mapped path",
    edgeId: target.id,
    baselineDirectSunMinutes: route.directSunMinutes,
    scenarioDirectSunMinutes: Math.max(0, route.directSunMinutes - avoided),
    avoidedDirectSunMinutes: avoided,
    intervention: "Model 80% shade on the route’s longest exposed candidate block.",
    assumptions: [
      "The intervention is hypothetical and has not been designed, approved, costed, or built.",
      "The calculation changes building-shade coverage only; it does not model tree growth, temperature, construction, or maintenance.",
      "One representative journey does not establish City-wide need or project priority.",
    ],
    sourceIds: ["openstreetmap", "nyc-building-footprints", "building-shadow-model"],
  };
}
