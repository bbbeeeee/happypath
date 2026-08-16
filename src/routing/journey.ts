import type {
  Coordinate,
  GraphEdge,
  JourneyPreference,
  JourneyResult,
  JourneyRoute,
  PilotGraph,
  RouteResult,
  TripBrief,
  WanderDirection,
} from "../types";
import { edgeGreenery } from "./greenery";
import { routeCoordinates } from "./geometry";
import { edgeShade } from "./shade";

export const WALKING_METERS_PER_MINUTE = 80;
export const DEFAULT_TARGET_TOLERANCE_RATIO = 0.1;

export type WalkingTimeIntent = "target" | "maximum";

export interface JourneyEdgePreference {
  /** Stable diagnostic label, such as "likely_cover_demo". */
  id: string;
  /** Relative zero-to-one strength alongside built-in route preferences. */
  weight: number;
  /** Deterministic zero-to-one fit for one edge. */
  score: (edge: GraphEdge) => number;
}

export interface JourneyPlanningOptions {
  /**
   * Set target after interpreting an ordinary duration request. The routing
   * API itself defaults to maximum so legacy walkingBudgetMinutes callers
   * retain their documented hard ceiling.
   */
  walkingTimeIntent?: WalkingTimeIntent;
  /** Defaults to ten percent on either side of the requested target. */
  targetToleranceRatio?: number;
  /**
   * Optional proof or adapter-backed edge signal. This keeps experimental
   * layers such as likely cover out of the permanent graph schema while still
   * allowing path generation—not just post-hoc alternative selection—to use
   * them.
   */
  edgePreference?: JourneyEdgePreference;
}

export interface JourneyTimingMetadata {
  intent: "destination" | WalkingTimeIntent;
  requestedMinutes: number | null;
  actualMinutes: number;
  targetRangeMinutes: { minimum: number; maximum: number } | null;
  status: "destination" | "within-target" | "closest-feasible" | "within-maximum";
  differenceMinutes: number | null;
}

export type PlannedJourneyResult = JourneyResult & { timing: JourneyTimingMetadata };

export type JourneyPlanningErrorCode =
  | "invalid-brief"
  | "unknown-node"
  | "no-route"
  | "no-feasible-loop"
  | "no-feasible-wander";

export class JourneyPlanningError extends Error {
  constructor(
    public readonly code: JourneyPlanningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JourneyPlanningError";
  }
}

interface AdjacentEdge {
  nodeId: string;
  edge: GraphEdge;
}

interface GraphPath {
  nodeIds: string[];
  edges: GraphEdge[];
}

interface EdgeFeatures {
  shade: number;
  green: number;
  nearbyTreeIds: string[];
  parkNames: string[];
}

interface PlannerContext {
  graph: PilotGraph;
  nodeById: Map<string, PilotGraph["nodes"][number]>;
  adjacency: Map<string, AdjacentEdge[]>;
  featuresByEdgeId: Map<string, EdgeFeatures>;
  preferences: JourneyPreference[];
  edgePreference: JourneyEdgePreference | null;
  avoidMappedSteps: boolean;
  departureHour: number;
}

interface WalkingTimeWindow {
  intent: WalkingTimeIntent;
  requestedMinutes: number;
  minimumMinutes: number;
  maximumMinutes: number;
}

interface QueueItem {
  nodeId: string;
  cost: number;
}

class MinQueue {
  private values: QueueItem[] = [];

  get size() {
    return this.values.length;
  }

  push(value: QueueItem) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop(): QueueItem | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!last || this.values.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child = right < this.values.length && this.values[right].cost < this.values[left].cost
        ? right
        : left;
      if (this.values[child].cost >= last.cost) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

function buildContext(
  graph: PilotGraph,
  brief: TripBrief,
  options: JourneyPlanningOptions = {},
): PlannerContext {
  const preferences = normalizePreferences(brief.preferences ?? []);
  const edgePreference = normalizeEdgePreference(options.edgePreference);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const neighbors = new Map<string, AdjacentEdge[]>(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    neighbors.get(edge.from)?.push({ nodeId: edge.to, edge });
    neighbors.get(edge.to)?.push({ nodeId: edge.from, edge });
  }
  const featuresByEdgeId = new Map(graph.edges.map((edge) => {
    const greenery = edgeGreenery(edge);
    return [edge.id, {
      shade: edgeShade(edge, brief.departureHour),
      green: greenery.score,
      nearbyTreeIds: greenery.nearbyTreeIds,
      parkNames: greenery.parkNames,
    }];
  }));
  return {
    graph,
    nodeById,
    adjacency: neighbors,
    featuresByEdgeId,
    preferences,
    edgePreference,
    avoidMappedSteps: brief.requirements?.avoidMappedSteps ?? false,
    departureHour: brief.departureHour,
  };
}

function normalizeEdgePreference(preference: JourneyEdgePreference | undefined): JourneyEdgePreference | null {
  if (!preference) return null;
  if (!preference.id.trim() || !Number.isFinite(preference.weight) || preference.weight < 0 || preference.weight > 1) {
    throw new JourneyPlanningError("invalid-brief", "Edge preference must have an id and a weight between zero and one");
  }
  return preference;
}

function edgePreferenceSignal(context: PlannerContext, edge: GraphEdge) {
  if (!context.edgePreference) return null;
  const score = context.edgePreference.score(edge);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new JourneyPlanningError(
      "invalid-brief",
      `Edge preference ${context.edgePreference.id} returned a score outside zero and one`,
    );
  }
  return score;
}

function hasPreferences(context: PlannerContext) {
  return context.preferences.length > 0 || Boolean(context.edgePreference?.weight);
}

function normalizePreferences(preferences: JourneyPreference[]): JourneyPreference[] {
  const byFeature = new Map<JourneyPreference["featureId"], number>();
  for (const preference of preferences) {
    if (!Number.isFinite(preference.weight) || preference.weight < 0 || preference.weight > 1) {
      throw new JourneyPlanningError(
        "invalid-brief",
        `Preference weight for ${preference.featureId} must be between zero and one`,
      );
    }
    byFeature.set(preference.featureId, Math.max(byFeature.get(preference.featureId) ?? 0, preference.weight));
  }
  return [...byFeature].map(([featureId, weight]) => ({ featureId, weight }));
}

function validateBrief(graph: PilotGraph, brief: TripBrief) {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(brief.originNodeId)) {
    throw new JourneyPlanningError("unknown-node", `Unknown origin node: ${brief.originNodeId}`);
  }
  if (!Number.isFinite(brief.departureHour) || brief.departureHour < 0 || brief.departureHour >= 24) {
    throw new JourneyPlanningError("invalid-brief", "Departure hour must be between zero and 24");
  }
  if (brief.journeyShape === "destination") {
    if (!nodeIds.has(brief.destinationNodeId)) {
      throw new JourneyPlanningError("unknown-node", `Unknown destination node: ${brief.destinationNodeId}`);
    }
    if (!Number.isFinite(brief.detourAllowanceMinutes) || brief.detourAllowanceMinutes < 0) {
      throw new JourneyPlanningError("invalid-brief", "Detour allowance must be zero or greater");
    }
  } else if (!Number.isFinite(brief.walkingBudgetMinutes) || brief.walkingBudgetMinutes <= 0) {
    throw new JourneyPlanningError("invalid-brief", "Walking budget must be greater than zero");
  }
  if (brief.journeyShape === "wander" && brief.endCondition) {
    if (brief.endCondition.nodeIds.length === 0) {
      throw new JourneyPlanningError("invalid-brief", "A wander end condition must include at least one node");
    }
    const unknown = brief.endCondition.nodeIds.find((nodeId) => !nodeIds.has(nodeId));
    if (unknown) throw new JourneyPlanningError("unknown-node", `Unknown end-condition node: ${unknown}`);
  }
}

function walkingTimeWindow(
  brief: Extract<TripBrief, { journeyShape: "loop" | "wander" }>,
  options: JourneyPlanningOptions,
): WalkingTimeWindow {
  const intent = options.walkingTimeIntent ?? "maximum";
  const requestedMinutes = brief.walkingBudgetMinutes;
  if (intent === "maximum") {
    return { intent, requestedMinutes, minimumMinutes: 0, maximumMinutes: requestedMinutes };
  }
  const tolerance = options.targetToleranceRatio ?? DEFAULT_TARGET_TOLERANCE_RATIO;
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 0.5) {
    throw new JourneyPlanningError("invalid-brief", "Target tolerance must be between zero and one half");
  }
  return {
    intent,
    requestedMinutes,
    minimumMinutes: requestedMinutes * (1 - tolerance),
    maximumMinutes: requestedMinutes * (1 + tolerance),
  };
}

function timingMetadata(
  brief: TripBrief,
  route: JourneyRoute,
  options: JourneyPlanningOptions,
): JourneyTimingMetadata {
  if (brief.journeyShape === "destination") {
    return {
      intent: "destination",
      requestedMinutes: null,
      actualMinutes: route.durationMinutes,
      targetRangeMinutes: null,
      status: "destination",
      differenceMinutes: null,
    };
  }
  const window = walkingTimeWindow(brief, options);
  const withinTarget = route.durationMinutes >= window.minimumMinutes - 0.0001
    && route.durationMinutes <= window.maximumMinutes + 0.0001;
  return {
    intent: window.intent,
    requestedMinutes: window.requestedMinutes,
    actualMinutes: route.durationMinutes,
    targetRangeMinutes: window.intent === "target"
      ? { minimum: window.minimumMinutes, maximum: window.maximumMinutes }
      : null,
    status: window.intent === "maximum"
      ? "within-maximum"
      : withinTarget ? "within-target" : "closest-feasible",
    differenceMinutes: route.durationMinutes - window.requestedMinutes,
  };
}

function shortestPath(
  context: PlannerContext,
  origin: string,
  destination: string,
  edgeCost: (edge: GraphEdge) => number,
): GraphPath | null {
  const distances = new Map(context.graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, { nodeId: string; edge: GraphEdge }>();
  const settled = new Set<string>();
  const queue = new MinQueue();
  distances.set(origin, 0);
  queue.push({ nodeId: origin, cost: 0 });

  while (queue.size > 0) {
    const next = queue.pop();
    if (!next || settled.has(next.nodeId)) continue;
    settled.add(next.nodeId);
    if (next.nodeId === destination) break;
    for (const adjacent of context.adjacency.get(next.nodeId) ?? []) {
      if (settled.has(adjacent.nodeId)) continue;
      const cost = edgeCost(adjacent.edge);
      if (!Number.isFinite(cost)) continue;
      const candidate = next.cost + cost;
      if (candidate < (distances.get(adjacent.nodeId) ?? Number.POSITIVE_INFINITY)) {
        distances.set(adjacent.nodeId, candidate);
        previous.set(adjacent.nodeId, { nodeId: next.nodeId, edge: adjacent.edge });
        queue.push({ nodeId: adjacent.nodeId, cost: candidate });
      }
    }
  }

  if (origin === destination) return { nodeIds: [origin], edges: [] };
  if (!previous.has(destination)) return null;

  const nodeIds = [destination];
  const edges: GraphEdge[] = [];
  let cursor = destination;
  while (cursor !== origin) {
    const step = previous.get(cursor);
    if (!step) return null;
    nodeIds.unshift(step.nodeId);
    edges.unshift(step.edge);
    cursor = step.nodeId;
  }
  return { nodeIds, edges };
}

function pathDistance(path: GraphPath) {
  return path.edges.reduce((sum, edge) => sum + edge.distanceMeters, 0);
}

function edgePreferenceFit(context: PlannerContext, edge: GraphEdge) {
  const totalWeight = context.preferences.reduce((sum, preference) => sum + preference.weight, 0)
    + (context.edgePreference?.weight ?? 0);
  if (totalWeight === 0) return 0;
  const features = context.featuresByEdgeId.get(edge.id)!;
  const builtInFit = context.preferences.reduce((sum, preference) => {
    const fit = preference.featureId === "shade" ? features.shade : features.green;
    return sum + fit * preference.weight;
  }, 0);
  const adapterFit = context.edgePreference
    ? (edgePreferenceSignal(context, edge) ?? 0) * context.edgePreference.weight
    : 0;
  return (builtInFit + adapterFit) / totalWeight;
}

function routingCost(
  context: PlannerContext,
  preferenceStrength: number,
  edgePenalty?: (edge: GraphEdge) => number,
) {
  return (edge: GraphEdge) => {
    if (context.avoidMappedSteps && edge.osm?.steps) return Number.POSITIVE_INFINITY;
    const fitDiscount = 1 - Math.min(0.78, preferenceStrength * edgePreferenceFit(context, edge) * 0.78);
    return edge.distanceMeters * fitDiscount * (edgePenalty?.(edge) ?? 1);
  };
}

function summarize(context: PlannerContext, path: GraphPath): RouteResult {
  const distanceMeters = pathDistance(path);
  let exposedMeters = 0;
  let exposedRunMeters = 0;
  let longestExposedMeters = 0;
  let greeneryTotal = 0;
  const nearbyTreeIds = new Set<string>();
  const adjacentParkNames = new Set<string>();

  for (const edge of path.edges) {
    const features = context.featuresByEdgeId.get(edge.id)!;
    const exposed = edge.distanceMeters * (1 - features.shade);
    exposedMeters += exposed;
    exposedRunMeters = features.shade < 0.5 ? exposedRunMeters + exposed : 0;
    longestExposedMeters = Math.max(longestExposedMeters, exposedRunMeters);
    greeneryTotal += edge.distanceMeters * features.green;
    features.nearbyTreeIds.forEach((id) => nearbyTreeIds.add(id));
    features.parkNames.forEach((name) => adjacentParkNames.add(name));
  }

  return {
    nodeIds: path.nodeIds,
    coordinates: routeCoordinates(path.nodeIds, path.edges, context.nodeById),
    distanceMeters,
    durationMinutes: distanceMeters / WALKING_METERS_PER_MINUTE,
    directSunMinutes: exposedMeters / WALKING_METERS_PER_MINUTE,
    longestExposedMinutes: longestExposedMeters / WALKING_METERS_PER_MINUTE,
    mappedStepEdges: path.edges.filter((edge) => edge.osm?.steps).length,
    greeneryPercent: distanceMeters === 0 ? 0 : (greeneryTotal / distanceMeters) * 100,
    nearbyTreeCount: nearbyTreeIds.size,
    adjacentParkNames: [...adjacentParkNames],
    shadePercent: distanceMeters === 0 ? 100 : (1 - exposedMeters / distanceMeters) * 100,
    streets: [...new Set(path.edges.map((edge) => edge.street))],
  };
}

function routePreferenceScore(context: PlannerContext, path: GraphPath, route: RouteResult) {
  const totalWeight = context.preferences.reduce((sum, preference) => sum + preference.weight, 0)
    + (context.edgePreference?.weight ?? 0);
  if (totalWeight === 0) return 0;
  const builtInFit = context.preferences.reduce((sum, preference) => {
    const fit = preference.featureId === "shade" ? route.shadePercent / 100 : route.greeneryPercent / 100;
    return sum + fit * preference.weight;
  }, 0);
  const adapterFit = context.edgePreference && route.distanceMeters > 0
    ? path.edges.reduce((sum, edge) => (
        sum + edge.distanceMeters * (edgePreferenceSignal(context, edge) ?? 0)
      ), 0) / route.distanceMeters * context.edgePreference.weight
    : 0;
  return (builtInFit + adapterFit) / totalWeight;
}

function stableCandidateId(shape: TripBrief["journeyShape"], path: GraphPath) {
  const value = `${shape}:${path.nodeIds.join(">")}:${path.edges.map((edge) => edge.id).join("|")}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${shape}-${(hash >>> 0).toString(36)}`;
}

function toJourneyRoute(
  context: PlannerContext,
  shape: TripBrief["journeyShape"],
  path: GraphPath,
  baselineDuration: number | null,
): JourneyRoute {
  const route = summarize(context, path);
  const uniqueEdges = new Set(path.edges.map((edge) => edge.id));
  return {
    ...route,
    candidateId: stableCandidateId(shape, path),
    journeyShape: shape,
    edgeIds: path.edges.map((edge) => edge.id),
    endpointNodeId: path.nodeIds.at(-1)!,
    repeatedEdgeRatio: path.edges.length === 0 ? 0 : (path.edges.length - uniqueEdges.size) / path.edges.length,
    preferenceScore: routePreferenceScore(context, path, route),
    extraMinutesVsBaseline: baselineDuration === null
      ? null
      : Math.max(0, route.durationMinutes - baselineDuration),
  };
}

function pathKey(path: GraphPath, shape: TripBrief["journeyShape"]) {
  if (shape === "loop") return [...path.edges.map((edge) => edge.id)].sort().join("|");
  return path.nodeIds.join(">");
}

function edgeOverlap(a: JourneyRoute, b: JourneyRoute) {
  const first = new Set(a.edgeIds);
  const second = new Set(b.edgeIds);
  if (first.size === 0 || second.size === 0) return a.candidateId === b.candidateId ? 1 : 0;
  let overlap = 0;
  for (const edgeId of first) if (second.has(edgeId)) overlap += 1;
  return overlap / Math.min(first.size, second.size);
}

function distinctAlternatives(
  ordered: JourneyRoute[],
  recommended: JourneyRoute,
  excludedIds: Set<string>,
) {
  const alternatives: JourneyRoute[] = [];
  for (const candidate of ordered) {
    if (excludedIds.has(candidate.candidateId) || edgeOverlap(candidate, recommended) >= 0.82) continue;
    if (alternatives.some((alternative) => edgeOverlap(candidate, alternative) >= 0.82)) continue;
    alternatives.push(candidate);
    if (alternatives.length === 2) break;
  }
  return alternatives;
}

function destinationJourney(context: PlannerContext, brief: Extract<TripBrief, { journeyShape: "destination" }>): JourneyResult {
  const fastestPath = shortestPath(context, brief.originNodeId, brief.destinationNodeId, routingCost(context, 0));
  if (!fastestPath) throw new JourneyPlanningError("no-route", "No valid destination route satisfies the requirements");
  const baseline = toJourneyRoute(context, "destination", fastestPath, null);
  baseline.extraMinutesVsBaseline = 0;
  const maximumDistance = baseline.distanceMeters + brief.detourAllowanceMinutes * WALKING_METERS_PER_MINUTE;
  const paths = new Map<string, GraphPath>();
  paths.set(pathKey(fastestPath, "destination"), fastestPath);

  const strengths = hasPreferences(context) ? [0.3, 0.5, 0.7, 0.86, 1] : [0];
  for (const strength of strengths) {
    const preferred = shortestPath(
      context,
      brief.originNodeId,
      brief.destinationNodeId,
      routingCost(context, strength),
    );
    if (preferred && pathDistance(preferred) <= maximumDistance + 0.01) {
      paths.set(pathKey(preferred, "destination"), preferred);
    }
  }

  const seeds = [...paths.values()].slice(0, 6);
  for (const seed of seeds) {
    const seedEdges = new Set(seed.edges.map((edge) => edge.id));
    for (const penalty of [1.25, 1.55]) {
      const diverse = shortestPath(
        context,
        brief.originNodeId,
        brief.destinationNodeId,
        routingCost(context, hasPreferences(context) ? 0.85 : 0, (edge) => seedEdges.has(edge.id) ? penalty : 1),
      );
      if (diverse && pathDistance(diverse) <= maximumDistance + 0.01) {
        paths.set(pathKey(diverse, "destination"), diverse);
      }
    }
  }

  const candidates = [...paths.values()].map((path) => toJourneyRoute(
    context,
    "destination",
    path,
    baseline.durationMinutes,
  ));
  const allowance = Math.max(brief.detourAllowanceMinutes, 1);
  const score = (route: JourneyRoute) => route.preferenceScore
    - ((route.extraMinutesVsBaseline ?? 0) / allowance) * 0.025;
  const ordered = candidates.sort((a, b) => score(b) - score(a) || a.durationMinutes - b.durationMinutes);
  const recommended = !hasPreferences(context) || brief.detourAllowanceMinutes === 0
    ? baseline
    : ordered[0];
  return {
    brief,
    baseline,
    recommended,
    alternatives: distinctAlternatives(ordered, recommended, new Set([baseline.candidateId, recommended.candidateId])),
    evaluatedCandidateCount: candidates.length,
  };
}

function coordinateOffsetMeters(origin: Coordinate, destination: Coordinate) {
  const meanLatitudeRadians = ((origin[1] + destination[1]) / 2) * Math.PI / 180;
  return {
    x: (destination[0] - origin[0]) * 111_320 * Math.cos(meanLatitudeRadians),
    y: (destination[1] - origin[1]) * 111_111,
  };
}

function coordinateDistance(origin: Coordinate, destination: Coordinate) {
  const offset = coordinateOffsetMeters(origin, destination);
  return Math.hypot(offset.x, offset.y);
}

const DIRECTION_VECTOR: Record<WanderDirection, [number, number]> = {
  north: [0, 1],
  northeast: [Math.SQRT1_2, Math.SQRT1_2],
  east: [1, 0],
  southeast: [Math.SQRT1_2, -Math.SQRT1_2],
  south: [0, -1],
  southwest: [-Math.SQRT1_2, -Math.SQRT1_2],
  west: [-1, 0],
  northwest: [-Math.SQRT1_2, Math.SQRT1_2],
};

function directionMetrics(origin: Coordinate, endpoint: Coordinate, direction?: WanderDirection) {
  if (!direction) return { alignment: 0, progressMeters: 0 };
  const offset = coordinateOffsetMeters(origin, endpoint);
  const magnitude = Math.hypot(offset.x, offset.y);
  if (magnitude === 0) return { alignment: -1, progressMeters: 0 };
  const [x, y] = DIRECTION_VECTOR[direction];
  const progressMeters = offset.x * x + offset.y * y;
  return { alignment: progressMeters / magnitude, progressMeters };
}

function loopAnchorNodes(context: PlannerContext, originNodeId: string, budgetMeters: number) {
  const origin = context.nodeById.get(originNodeId)!;
  const eligible = context.graph.nodes
    .filter((node) => node.id !== originNodeId)
    .map((node) => ({ node, distance: coordinateDistance(origin.coordinate, node.coordinate) }))
    .filter(({ distance }) => distance >= Math.min(35, budgetMeters * 0.08) && distance <= budgetMeters * 0.52);
  const selected = new Map<string, typeof eligible[number]>();
  for (const targetRatio of [0.24, 0.34, 0.44]) {
    [...eligible]
      .sort((a, b) => Math.abs(a.distance - budgetMeters * targetRatio) - Math.abs(b.distance - budgetMeters * targetRatio))
      .slice(0, 18)
      .forEach((candidate) => selected.set(candidate.node.id, candidate));
  }
  return [...selected.values()].map(({ node }) => node);
}

function loopJourney(
  context: PlannerContext,
  brief: Extract<TripBrief, { journeyShape: "loop" }>,
  options: JourneyPlanningOptions,
): JourneyResult {
  const timeWindow = walkingTimeWindow(brief, options);
  const budgetMeters = timeWindow.maximumMinutes * WALKING_METERS_PER_MINUTE;
  const requestedMeters = timeWindow.requestedMinutes * WALKING_METERS_PER_MINUTE;
  const paths = new Map<string, GraphPath>();
  const strengths = hasPreferences(context) ? [0, 0.55, 0.9] : [0];

  for (const anchor of loopAnchorNodes(context, brief.originNodeId, budgetMeters)) {
    for (const strength of strengths) {
      const outward = shortestPath(context, brief.originNodeId, anchor.id, routingCost(context, strength));
      if (!outward || pathDistance(outward) > budgetMeters * 0.7) continue;
      const outwardEdges = new Set(outward.edges.map((edge) => edge.id));
      for (const repeatPenalty of [5, 12]) {
        const returning = shortestPath(
          context,
          anchor.id,
          brief.originNodeId,
          routingCost(context, strength, (edge) => outwardEdges.has(edge.id) ? repeatPenalty : 1),
        );
        if (!returning) continue;
        const path: GraphPath = {
          nodeIds: [...outward.nodeIds, ...returning.nodeIds.slice(1)],
          edges: [...outward.edges, ...returning.edges],
        };
        const distance = pathDistance(path);
        const uniqueEdges = new Set(path.edges.map((edge) => edge.id));
        const repeatedEdgeRatio = path.edges.length === 0 ? 1 : (path.edges.length - uniqueEdges.size) / path.edges.length;
        if (distance > budgetMeters + 0.01 || distance < requestedMeters * 0.52) continue;
        if (uniqueEdges.size < 3 || new Set(path.nodeIds).size < 3 || repeatedEdgeRatio > 0.2) continue;
        paths.set(pathKey(path, "loop"), path);
      }
    }
  }

  const candidates = [...paths.values()].map((path) => toJourneyRoute(context, "loop", path, null));
  if (candidates.length === 0) {
    throw new JourneyPlanningError("no-feasible-loop", "No nontrivial loop fits the walking budget and requirements");
  }
  const maximumScore = (route: JourneyRoute) => {
    const budgetUse = route.durationMinutes / timeWindow.requestedMinutes;
    return route.preferenceScore * 0.48 + budgetUse * 0.52 - route.repeatedEdgeRatio;
  };
  const inTargetRange = (route: JourneyRoute) => route.durationMinutes >= timeWindow.minimumMinutes - 0.0001
    && route.durationMinutes <= timeWindow.maximumMinutes + 0.0001;
  const hasTargetMatch = timeWindow.intent === "target" && candidates.some(inTargetRange);
  const ordered = candidates.sort((a, b) => {
    if (timeWindow.intent === "maximum") return maximumScore(b) - maximumScore(a) || b.durationMinutes - a.durationMinutes;
    const aInRange = inTargetRange(a);
    const bInRange = inTargetRange(b);
    if (aInRange !== bInRange) return bInRange ? 1 : -1;
    const aDifference = Math.abs(a.durationMinutes - timeWindow.requestedMinutes);
    const bDifference = Math.abs(b.durationMinutes - timeWindow.requestedMinutes);
    // If no route hits the band, “closest feasible” must mean closest in time;
    // preferences only break near-ties. Inside the band, retain meaningful
    // comfort choice while gently favoring the requested duration.
    if (!hasTargetMatch && Math.abs(aDifference - bDifference) > 0.05) return aDifference - bDifference;
    const aScore = a.preferenceScore * 0.52
      + (1 - Math.min(1, aDifference / Math.max(1, timeWindow.requestedMinutes))) * 0.48
      - a.repeatedEdgeRatio;
    const bScore = b.preferenceScore * 0.52
      + (1 - Math.min(1, bDifference / Math.max(1, timeWindow.requestedMinutes))) * 0.48
      - b.repeatedEdgeRatio;
    return bScore - aScore || aDifference - bDifference;
  });
  const recommended = ordered[0];
  return {
    brief,
    baseline: null,
    recommended,
    alternatives: distinctAlternatives(ordered, recommended, new Set([recommended.candidateId])),
    evaluatedCandidateCount: candidates.length,
  };
}

function wanderEndpointNodes(
  context: PlannerContext,
  brief: Extract<TripBrief, { journeyShape: "wander" }>,
  timeWindow: WalkingTimeWindow,
) {
  const origin = context.nodeById.get(brief.originNodeId)!;
  const budgetMeters = timeWindow.maximumMinutes * WALKING_METERS_PER_MINUTE;
  const requestedMeters = timeWindow.requestedMinutes * WALKING_METERS_PER_MINUTE;
  const minimumProgress = Math.max(20, Math.min(120, requestedMeters * 0.1));
  const allowedIds = brief.endCondition ? new Set(brief.endCondition.nodeIds) : null;
  const eligible = context.graph.nodes
    .filter((node) => node.id !== brief.originNodeId && (!allowedIds || allowedIds.has(node.id)))
    .map((node) => {
      const distance = coordinateDistance(origin.coordinate, node.coordinate);
      const direction = directionMetrics(origin.coordinate, node.coordinate, brief.direction);
      return { node, distance, ...direction };
    })
    .filter((candidate) => candidate.distance <= budgetMeters + 0.01)
    .filter((candidate) => !brief.direction
      || (candidate.progressMeters >= minimumProgress && candidate.alignment >= 0.35));

  if (allowedIds) return eligible;
  return [...eligible]
    .sort((a, b) => Math.abs(a.distance - requestedMeters * 0.78) - Math.abs(b.distance - requestedMeters * 0.78))
    .slice(0, 72);
}

function wanderWaypointNodes(
  context: PlannerContext,
  originNodeId: string,
  endpointNodeId: string,
  requestedMeters: number,
) {
  const origin = context.nodeById.get(originNodeId)!;
  const endpoint = context.nodeById.get(endpointNodeId)!;
  const ranked = context.graph.nodes
    .filter((node) => node.id !== originNodeId && node.id !== endpointNodeId)
    .map((node) => ({
      node,
      // Straight-line distance is only a cheap search heuristic. Every
      // candidate is still validated against the walking graph below.
      sweepMeters: coordinateDistance(origin.coordinate, node.coordinate)
        + coordinateDistance(node.coordinate, endpoint.coordinate),
    }))
    .filter(({ sweepMeters }) => sweepMeters >= requestedMeters * 0.42)
    .sort((a, b) => Math.abs(a.sweepMeters - requestedMeters * 0.76)
      - Math.abs(b.sweepMeters - requestedMeters * 0.76));

  // Graph exports contain several nodes at almost the same intersection.
  // A small spatial key keeps the search broad enough to find a pleasant arc
  // without turning every request into hundreds of pathfinding runs.
  const spatialCells = new Set<string>();
  const selected: PilotGraph["nodes"] = [];
  for (const candidate of ranked) {
    const [longitude, latitude] = candidate.node.coordinate;
    const key = `${Math.round(longitude * 2_500)}:${Math.round(latitude * 2_500)}`;
    if (spatialCells.has(key)) continue;
    spatialCells.add(key);
    selected.push(candidate.node);
    if (selected.length === 28) break;
  }
  return selected;
}

function wanderJourney(
  context: PlannerContext,
  brief: Extract<TripBrief, { journeyShape: "wander" }>,
  options: JourneyPlanningOptions,
): JourneyResult {
  const timeWindow = walkingTimeWindow(brief, options);
  const budgetMeters = timeWindow.maximumMinutes * WALKING_METERS_PER_MINUTE;
  const requestedMeters = timeWindow.requestedMinutes * WALKING_METERS_PER_MINUTE;
  const paths = new Map<string, GraphPath>();
  const strengths = hasPreferences(context) ? [0, 0.5, 0.82, 1] : [0];
  const endpoints = wanderEndpointNodes(context, brief, timeWindow);
  for (const endpoint of endpoints) {
    const endpointPaths: GraphPath[] = [];
    for (const strength of strengths) {
      const path = shortestPath(context, brief.originNodeId, endpoint.node.id, routingCost(context, strength));
      if (!path) continue;
      const distance = pathDistance(path);
      if (distance > budgetMeters + 0.01) continue;
      if (!brief.endCondition && distance < requestedMeters * 0.38) continue;
      paths.set(pathKey(path, "wander"), path);
      endpointPaths.push(path);
    }
    // Resolved end conditions often include a nearby transit entrance. Search
    // materially different valid approaches so a target-duration request does
    // not collapse to the shortest possible walk when a longer route exists.
    if (brief.endCondition) {
      for (const seed of endpointPaths.slice(0, 2)) {
        const seedEdges = new Set(seed.edges.map((edge) => edge.id));
        for (const penalty of [1.5, 3, 8]) {
          const diverse = shortestPath(
            context,
            brief.originNodeId,
            endpoint.node.id,
            routingCost(context, hasPreferences(context) ? 0.82 : 0, (edge) => seedEdges.has(edge.id) ? penalty : 1),
          );
          if (!diverse || pathDistance(diverse) > budgetMeters + 0.01) continue;
          paths.set(pathKey(diverse, "wander"), diverse);
        }
      }
    }
  }


  // A wander is allowed to take the scenic way to its endpoint. If ordinary
  // shortest/diverse routes all fall short of a requested target, try a
  // graph-snapped intermediate sweep. This is what makes “30-minute wander,
  // ending near a train” behave like a duration request rather than silently
  // collapsing to the nearest station.
  const initialRoutes = [...paths.values()].map((path) => toJourneyRoute(context, "wander", path, null));
  const hasInitialTargetMatch = timeWindow.intent === "target"
    && initialRoutes.some((route) => route.durationMinutes >= timeWindow.minimumMinutes - 0.0001
      && route.durationMinutes <= timeWindow.maximumMinutes + 0.0001);
  if (timeWindow.intent === "target" && !hasInitialTargetMatch) {
    const endpointsByPromise = endpoints
      .map((endpoint) => ({
        endpoint,
        difference: initialRoutes
          .filter((route) => route.endpointNodeId === endpoint.node.id)
          .reduce((best, route) => Math.min(best, Math.abs(route.distanceMeters - requestedMeters)), Number.POSITIVE_INFINITY),
      }))
      .sort((a, b) => a.difference - b.difference)
      .slice(0, brief.endCondition ? 12 : 8);

    let foundTargetSweep = false;
    for (const { endpoint } of endpointsByPromise) {
      for (const waypoint of wanderWaypointNodes(context, brief.originNodeId, endpoint.node.id, requestedMeters)) {
        const outward = shortestPath(
          context,
          brief.originNodeId,
          waypoint.id,
          routingCost(context, hasPreferences(context) ? 0.82 : 0),
        );
        if (!outward || pathDistance(outward) > budgetMeters) continue;
        const outwardEdges = new Set(outward.edges.map((edge) => edge.id));
        const finishing = shortestPath(
          context,
          waypoint.id,
          endpoint.node.id,
          routingCost(context, hasPreferences(context) ? 0.82 : 0, (edge) => outwardEdges.has(edge.id) ? 6 : 1),
        );
        if (!finishing) continue;
        const sweep: GraphPath = {
          nodeIds: [...outward.nodeIds, ...finishing.nodeIds.slice(1)],
          edges: [...outward.edges, ...finishing.edges],
        };
        const distance = pathDistance(sweep);
        if (distance > budgetMeters + 0.01 || distance < timeWindow.minimumMinutes * WALKING_METERS_PER_MINUTE) continue;
        const uniqueEdges = new Set(sweep.edges.map((edge) => edge.id));
        const repeatedEdgeRatio = sweep.edges.length === 0 ? 1 : (sweep.edges.length - uniqueEdges.size) / sweep.edges.length;
        if (repeatedEdgeRatio > 0.25) continue;
        paths.set(pathKey(sweep, "wander"), sweep);
        if (distance <= budgetMeters + 0.01) foundTargetSweep = true;
        if (paths.size >= 48) break;
      }
      if (foundTargetSweep || paths.size >= 48) break;
    }
  }

  const candidates = [...paths.values()].map((path) => toJourneyRoute(context, "wander", path, null));
  if (candidates.length === 0) {
    throw new JourneyPlanningError("no-feasible-wander", "No wander endpoint fits the direction, end condition, budget, and requirements");
  }
  const origin = context.nodeById.get(brief.originNodeId)!;
  const maximumScore = (route: JourneyRoute) => {
    const endpoint = context.nodeById.get(route.endpointNodeId)!;
    const { alignment } = directionMetrics(origin.coordinate, endpoint.coordinate, brief.direction);
    const budgetUse = route.durationMinutes / timeWindow.requestedMinutes;
    return route.preferenceScore * 0.5 + budgetUse * 0.38 + Math.max(0, alignment) * 0.12;
  };
  const inTargetRange = (route: JourneyRoute) => route.durationMinutes >= timeWindow.minimumMinutes - 0.0001
    && route.durationMinutes <= timeWindow.maximumMinutes + 0.0001;
  const hasTargetMatch = timeWindow.intent === "target" && candidates.some(inTargetRange);
  const ordered = candidates.sort((a, b) => {
    if (timeWindow.intent === "maximum") return maximumScore(b) - maximumScore(a) || b.durationMinutes - a.durationMinutes;
    const aInRange = inTargetRange(a);
    const bInRange = inTargetRange(b);
    if (aInRange !== bInRange) return bInRange ? 1 : -1;
    const aDifference = Math.abs(a.durationMinutes - timeWindow.requestedMinutes);
    const bDifference = Math.abs(b.durationMinutes - timeWindow.requestedMinutes);
    if (!hasTargetMatch && Math.abs(aDifference - bDifference) > 0.05) return aDifference - bDifference;
    const aScore = maximumScore(a) * 0.52
      + (1 - Math.min(1, aDifference / Math.max(1, timeWindow.requestedMinutes))) * 0.48;
    const bScore = maximumScore(b) * 0.52
      + (1 - Math.min(1, bDifference / Math.max(1, timeWindow.requestedMinutes))) * 0.48;
    return bScore - aScore || aDifference - bDifference;
  });
  const recommended = ordered[0];
  return {
    brief,
    baseline: null,
    recommended,
    alternatives: distinctAlternatives(ordered, recommended, new Set([recommended.candidateId])),
    evaluatedCandidateCount: candidates.length,
  };
}

/**
 * Rebuilds the currently selected path through one graph-snapped waypoint.
 * This powers direct map steering without accepting unroutable freehand
 * geometry. The returned route keeps the original endpoint and hard step
 * requirement.
 */
export function rerouteJourneyThroughWaypoint(
  graph: PilotGraph,
  brief: TripBrief,
  currentRoute: JourneyRoute,
  waypointNodeId: string,
  options: JourneyPlanningOptions = {},
): JourneyRoute {
  validateBrief(graph, brief);
  const context = buildContext(graph, brief, options);
  if (!context.nodeById.has(waypointNodeId)) {
    throw new JourneyPlanningError("unknown-node", `Unknown waypoint node: ${waypointNodeId}`);
  }
  const preferenceStrength = hasPreferences(context) ? 0.82 : 0;
  const cost = routingCost(context, preferenceStrength);
  const first = shortestPath(context, brief.originNodeId, waypointNodeId, cost);
  const second = shortestPath(context, waypointNodeId, currentRoute.endpointNodeId, cost);
  if (!first || !second) {
    throw new JourneyPlanningError("no-route", "That point does not connect to this walking route");
  }
  const combined: GraphPath = {
    nodeIds: [...first.nodeIds, ...second.nodeIds.slice(1)],
    edges: [...first.edges, ...second.edges],
  };
  const duration = pathDistance(combined) / WALKING_METERS_PER_MINUTE;
  if (brief.journeyShape === "destination") {
    const baselineDuration = Math.max(0, currentRoute.durationMinutes - (currentRoute.extraMinutesVsBaseline ?? 0));
    if (duration > baselineDuration + brief.detourAllowanceMinutes + 0.0001) {
      throw new JourneyPlanningError("no-route", "That point needs more time than this walk allows");
    }
    return toJourneyRoute(context, brief.journeyShape, combined, baselineDuration);
  }
  const window = walkingTimeWindow(brief, options);
  if (duration > window.maximumMinutes + 0.0001) {
    throw new JourneyPlanningError(
      brief.journeyShape === "loop" ? "no-feasible-loop" : "no-feasible-wander",
      "That point takes the walk beyond the requested time",
    );
  }
  return toJourneyRoute(context, brief.journeyShape, combined, null);
}

/**
 * Plans one deterministic journey from a typed Trip Brief.
 *
 * All geometry, time arithmetic, hard constraints, and route metrics are
 * established here. A language model may construct the brief or explain the
 * returned values, but it must not modify a returned candidate.
 */
export function planJourney(
  graph: PilotGraph,
  brief: TripBrief,
  options: JourneyPlanningOptions = {},
): PlannedJourneyResult {
  validateBrief(graph, brief);
  const context = buildContext(graph, brief, options);
  const result = brief.journeyShape === "destination"
    ? destinationJourney(context, brief)
    : brief.journeyShape === "loop"
      ? loopJourney(context, brief, options)
      : wanderJourney(context, brief, options);
  return {
    ...result,
    timing: timingMetadata(brief, result.recommended, options),
  };
}
