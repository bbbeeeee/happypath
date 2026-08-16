import {
  distanceBetweenCoordinatesMeters,
  distanceFromRouteGeometryMeters,
} from "../data/civicAssets";
import type { CivicTask } from "../data/civicTasks";
import {
  planJourney,
  rerouteJourneyThroughWaypoint,
  type JourneyPlanningOptions,
  type PlannedJourneyResult,
} from "../routing/journey";
import type { JourneyRoute, PilotGraph, TripBrief as RoutingTripBrief } from "../types";

export interface CivicTaskRouteSelection {
  route: JourneyRoute;
  taskId: string | null;
  status: "not-requested" | "already-along-route" | "routed-through-check" | "not-feasible";
}

function nearestNodeId(graph: PilotGraph, task: CivicTask): string {
  return [...graph.nodes].sort((a, b) => (
    distanceBetweenCoordinatesMeters(task.coordinate, a.coordinate)
    - distanceBetweenCoordinatesMeters(task.coordinate, b.coordinate)
    || a.id.localeCompare(b.id)
  ))[0].id;
}

function uniqueRoutes(routes: readonly JourneyRoute[]): JourneyRoute[] {
  return routes.filter((route, index) => routes.findIndex((candidate) => candidate.candidateId === route.candidateId) === index);
}

/**
 * Tries a single optional, pre-published civic check without weakening route
 * endpoints, time bounds, or mapped-step requirements. The base walk always
 * remains the fallback.
 */
export function selectRouteThroughOptionalCivicTask(options: {
  graph: PilotGraph;
  routingBrief: RoutingTripBrief;
  result: PlannedJourneyResult;
  preferredRoute: JourneyRoute;
  tasks: readonly CivicTask[];
  planningOptions?: JourneyPlanningOptions;
  proximityMeters?: number;
}): CivicTaskRouteSelection {
  if (options.tasks.length === 0) {
    return { route: options.preferredRoute, taskId: null, status: "not-requested" };
  }
  const proximityMeters = options.proximityMeters ?? 70;
  const range = options.result.timing.targetRangeMinutes;
  const requestedMinutes = options.result.timing.requestedMinutes;
  const candidates = uniqueRoutes([options.preferredRoute, options.result.recommended, ...options.result.alternatives]);

  for (const route of candidates) {
    if (range && (route.durationMinutes < range.minimum - 0.0001 || route.durationMinutes > range.maximum + 0.0001)) continue;
    const task = options.tasks.find((candidate) => distanceFromRouteGeometryMeters(candidate, route.coordinates) <= proximityMeters);
    if (task) return { route, taskId: task.id, status: "already-along-route" };
  }

  const routed: Array<{ route: JourneyRoute; task: CivicTask }> = [];
  for (const task of options.tasks) {
    const taskNodeId = nearestNodeId(options.graph, task);
    if (options.routingBrief.journeyShape === "wander") {
      try {
        const towardTask = planJourney(options.graph, {
          ...options.routingBrief,
          direction: undefined,
          endCondition: { nodeIds: [taskNodeId], label: "near an optional city data check" },
        }, options.planningOptions);
        for (const route of [towardTask.recommended, ...towardTask.alternatives]) {
          if (range && (route.durationMinutes < range.minimum - 0.0001 || route.durationMinutes > range.maximum + 0.0001)) continue;
          routed.push({ route, task });
        }
      } catch {
        // Other checks or the base walk can still succeed.
      }
    }
    for (const candidate of candidates) {
      try {
        const route = rerouteJourneyThroughWaypoint(
          options.graph,
          options.routingBrief,
          candidate,
          taskNodeId,
          options.planningOptions,
        );
        if (range && (route.durationMinutes < range.minimum - 0.0001 || route.durationMinutes > range.maximum + 0.0001)) continue;
        routed.push({ route, task });
      } catch {
        // Optional participation never makes the ordinary walk fail.
      }
    }
  }

  const selected = routed.sort((a, b) => {
    const aDifference = requestedMinutes === null ? a.route.durationMinutes : Math.abs(a.route.durationMinutes - requestedMinutes);
    const bDifference = requestedMinutes === null ? b.route.durationMinutes : Math.abs(b.route.durationMinutes - requestedMinutes);
    return aDifference - bDifference
      || b.route.preferenceScore - a.route.preferenceScore
      || a.task.id.localeCompare(b.task.id)
      || a.route.candidateId.localeCompare(b.route.candidateId);
  })[0];
  return selected
    ? { route: selected.route, taskId: selected.task.id, status: "routed-through-check" }
    : { route: options.preferredRoute, taskId: null, status: "not-feasible" };
}
