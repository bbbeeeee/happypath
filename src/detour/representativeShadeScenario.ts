import fixtureJson from "../data/detour/seward-park-shade.json";
import { planJourney, WALKING_METERS_PER_MINUTE } from "../routing/journey";
import { edgeShade } from "../routing/shade";
import type { Coordinate, GraphEdge, JourneyRoute, PilotGraph, TripBrief } from "../types";

const IMPACT_EPSILON_MINUTES = 0.000_001;

export interface RepresentativeShadeFixture {
  schemaVersion: number;
  id: string;
  title: string;
  question: string;
  geography: string;
  departureHour: number;
  routePolicy: {
    detourAllowanceMinutes: number;
    edgePreferenceId: string;
    edgePreferenceWeight: number;
  };
  selectionPolicy: {
    minimumJourneyCount: number;
    minimumAvoidedMinutesPerEdge: number;
    targetShadePercent: number;
    tieBreak: string;
  };
  gap: { id: string; label: string };
  anchorPolicy: Record<string, string | number | boolean>;
  destination: {
    assetId: string;
    nodeId: string;
    label: string;
    coordinate: Coordinate;
    sourceId: string;
    operationStatus: string;
  };
  journeys: Array<{
    id: string;
    label: string;
    purpose: string;
    origin: { assetId: string; nodeId: string; label: string; coordinate: Coordinate };
    destinationAssetId: string;
    destinationNodeId: string;
    weight: number;
  }>;
  interventions: Array<{
    id: string;
    label: string;
    targetShadePercent: number;
    role: "primary" | "alternative";
  }>;
  sources: Array<Record<string, string | number>>;
  limitations: string[];
  exclusions: string[];
}

export interface RepeatedShadeGapRoute {
  journeyId: string;
  edgeIds: readonly string[];
  weight: number;
}

export interface SelectedRepeatedShadeGap {
  edgeIds: string[];
  affectedJourneyIds: string[];
  affectedJourneyWeight: number;
  totalLengthMeters: number;
  weightedAvoidableMinutes: number;
  selectionKey: string;
}

export interface RepresentativeRouteSnapshot {
  candidateId: string;
  edgeIds: string[];
  distanceMeters: number;
  durationMinutes: number;
  directSunMinutes: number;
}

export interface RepresentativeJourneyComparison {
  journeyId: string;
  label: string;
  weight: number;
  effect: "improved" | "unchanged" | "worsened";
  routeChanged: boolean;
  baselineDirectSunMinutes: number;
  scenarioDirectSunMinutes: number;
  avoidedDirectSunMinutes: number;
  baselineRoute: RepresentativeRouteSnapshot;
  scenarioRoute: RepresentativeRouteSnapshot;
}

export interface RepresentativeInterventionResult {
  id: string;
  label: string;
  role: "primary" | "alternative";
  status: "hypothetical";
  targetShadePercent: number;
  cohortJourneyIds: string[];
  routePolicy: RepresentativeShadeFixture["routePolicy"];
  summary: {
    unit: "weighted direct-sun minutes";
    evaluated: number;
    totalWeight: number;
    improved: number;
    unchanged: number;
    worsened: number;
    routesChanged: number;
    routesUnchanged: number;
    baseline: number;
    scenario: number;
    avoided: number;
    remaining: number;
    averageBaseline: number;
    averageScenario: number;
    averageAvoided: number;
  };
  journeys: RepresentativeJourneyComparison[];
}

export interface RepresentativeShadeScenarioResult {
  schemaVersion: 1;
  id: string;
  fixtureId: string;
  title: string;
  question: string;
  geography: string;
  status: "hypothetical";
  departureHour: number;
  cohort: {
    type: "frozen public-anchor cohort";
    journeyIds: string[];
    journeyCount: number;
    totalWeight: number;
    anchorPolicy: RepresentativeShadeFixture["anchorPolicy"];
    destination: RepresentativeShadeFixture["destination"];
  };
  selectedGap: {
    id: string;
    label: string;
    edgeIds: string[];
    affectedJourneyIds: string[];
    affectedJourneyWeight: number;
    totalLengthMeters: number;
    weightedAvoidableMinutesAtPrimaryTarget: number;
    selectionPolicy: RepresentativeShadeFixture["selectionPolicy"];
    selectionKey: string;
  };
  interventions: RepresentativeInterventionResult[];
  evidence: {
    sourceIds: string[];
    sources: RepresentativeShadeFixture["sources"];
    limitations: string[];
    exclusions: string[];
  };
  fingerprint: string;
}

export const representativeShadeFixture = fixtureJson as unknown as RepresentativeShadeFixture;

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function fingerprint(value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function exposedMinutes(edge: GraphEdge, departureHour: number, shade = edgeShade(edge, departureHour)) {
  return edge.distanceMeters * (1 - shade) / WALKING_METERS_PER_MINUTE;
}

function uniqueIds(values: readonly string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (!value.trim()) throw new TypeError(`${label} IDs must not be empty`);
    if (seen.has(value)) throw new TypeError(`Duplicate ${label} ID: ${value}`);
    seen.add(value);
  }
}

function validateFixture(graph: PilotGraph, fixture: RepresentativeShadeFixture) {
  if (fixture.schemaVersion !== 1) throw new RangeError(`Unsupported representative scenario schema: ${fixture.schemaVersion}`);
  if (!Number.isFinite(fixture.departureHour) || fixture.departureHour < 0 || fixture.departureHour >= 24) {
    throw new RangeError("departureHour must be between zero and 24");
  }
  if (!Number.isFinite(fixture.routePolicy.detourAllowanceMinutes) || fixture.routePolicy.detourAllowanceMinutes < 0) {
    throw new RangeError("detourAllowanceMinutes must be zero or greater");
  }
  if (!Number.isFinite(fixture.routePolicy.edgePreferenceWeight)
    || fixture.routePolicy.edgePreferenceWeight < 0
    || fixture.routePolicy.edgePreferenceWeight > 1) {
    throw new RangeError("edgePreferenceWeight must be between zero and one");
  }
  uniqueIds(fixture.journeys.map((journey) => journey.id), "journey");
  uniqueIds(fixture.interventions.map((intervention) => intervention.id), "intervention");
  uniqueIds(fixture.sources.map((source) => String(source.sourceId)), "source");
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const journey of fixture.journeys) {
    if (!nodeIds.has(journey.origin.nodeId)) throw new RangeError(`Unknown origin node: ${journey.origin.nodeId}`);
    if (!nodeIds.has(journey.destinationNodeId)) throw new RangeError(`Unknown destination node: ${journey.destinationNodeId}`);
    if (journey.destinationAssetId !== fixture.destination.assetId
      || journey.destinationNodeId !== fixture.destination.nodeId) {
      throw new TypeError(`Journey ${journey.id} does not use the frozen destination`);
    }
    if (!Number.isFinite(journey.weight) || journey.weight <= 0) {
      throw new RangeError(`Journey weight for ${journey.id} must be greater than zero`);
    }
  }
  const primary = fixture.interventions.filter((intervention) => intervention.role === "primary");
  if (primary.length !== 1 || primary[0].targetShadePercent !== fixture.selectionPolicy.targetShadePercent) {
    throw new TypeError("Exactly one primary intervention must match the gap-selection target");
  }
  for (const intervention of fixture.interventions) {
    if (!Number.isFinite(intervention.targetShadePercent)
      || intervention.targetShadePercent < 0
      || intervention.targetShadePercent > 100) {
      throw new RangeError(`targetShadePercent for ${intervention.id} must be between zero and 100`);
    }
  }
  const graphSource = fixture.sources.find((source) => source.sourceId === "openstreetmap");
  if (graphSource?.generatedAt !== graph.metadata?.generatedAt) {
    throw new Error("Representative scenario and walking graph snapshots do not match");
  }
}

/**
 * Selects a connected repeated gap deterministically. Components rank by
 * weighted avoidable burden, affected weight, length, then their sorted IDs.
 */
export function selectRepeatedShadeGap(
  graph: PilotGraph,
  routes: readonly RepeatedShadeGapRoute[],
  departureHour: number,
  targetShadePercent: number,
  minimumJourneyCount: number,
  minimumAvoidedMinutesPerEdge: number,
): SelectedRepeatedShadeGap | null {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const targetShade = targetShadePercent / 100;
  const statsByEdgeId = new Map<string, { weightedAvoidable: number; journeyIds: Set<string> }>();
  for (const route of routes) {
    for (const edgeId of new Set(route.edgeIds)) {
      const edge = edgeById.get(edgeId);
      if (!edge) throw new RangeError(`Unknown route edge: ${edgeId}`);
      const avoided = exposedMinutes(edge, departureHour, edgeShade(edge, departureHour))
        - exposedMinutes(edge, departureHour, Math.max(edgeShade(edge, departureHour), targetShade));
      const stats = statsByEdgeId.get(edgeId) ?? { weightedAvoidable: 0, journeyIds: new Set<string>() };
      stats.weightedAvoidable += avoided * route.weight;
      stats.journeyIds.add(route.journeyId);
      statsByEdgeId.set(edgeId, stats);
    }
  }

  const eligible = [...statsByEdgeId]
    .filter(([, stats]) => stats.journeyIds.size >= minimumJourneyCount
      && stats.weightedAvoidable > minimumAvoidedMinutesPerEdge + IMPACT_EPSILON_MINUTES)
    .map(([edgeId]) => edgeId)
    .sort();
  const eligibleSet = new Set(eligible);
  const idsByNode = new Map<string, string[]>();
  for (const edgeId of eligible) {
    const edge = edgeById.get(edgeId)!;
    idsByNode.set(edge.from, [...(idsByNode.get(edge.from) ?? []), edgeId]);
    idsByNode.set(edge.to, [...(idsByNode.get(edge.to) ?? []), edgeId]);
  }

  const components: string[][] = [];
  const unvisited = new Set(eligible);
  while (unvisited.size) {
    const seed = [...unvisited].sort()[0];
    const component: string[] = [];
    const queue = [seed];
    unvisited.delete(seed);
    while (queue.length) {
      const edgeId = queue.shift()!;
      component.push(edgeId);
      const edge = edgeById.get(edgeId)!;
      const neighbors = [...(idsByNode.get(edge.from) ?? []), ...(idsByNode.get(edge.to) ?? [])]
        .filter((candidate) => eligibleSet.has(candidate) && unvisited.has(candidate))
        .sort();
      for (const neighbor of neighbors) {
        unvisited.delete(neighbor);
        queue.push(neighbor);
      }
    }
    components.push(component.sort());
  }

  const weightByJourneyId = new Map(routes.map((route) => [route.journeyId, route.weight]));
  const scored = components.map((edgeIds) => {
    const affectedJourneyIds = [...new Set(edgeIds.flatMap((edgeId) => [...statsByEdgeId.get(edgeId)!.journeyIds]))].sort();
    return {
      edgeIds,
      affectedJourneyIds,
      affectedJourneyWeight: affectedJourneyIds.reduce((sum, id) => sum + (weightByJourneyId.get(id) ?? 0), 0),
      totalLengthMeters: edgeIds.reduce((sum, id) => sum + edgeById.get(id)!.distanceMeters, 0),
      weightedAvoidableMinutes: edgeIds.reduce((sum, id) => sum + statsByEdgeId.get(id)!.weightedAvoidable, 0),
      selectionKey: edgeIds.join("|"),
    };
  }).sort((a, b) => b.weightedAvoidableMinutes - a.weightedAvoidableMinutes
    || b.affectedJourneyWeight - a.affectedJourneyWeight
    || b.totalLengthMeters - a.totalLengthMeters
    || a.selectionKey.localeCompare(b.selectionKey));
  const selected = scored[0];
  return selected ? {
    ...selected,
    totalLengthMeters: round(selected.totalLengthMeters),
    weightedAvoidableMinutes: round(selected.weightedAvoidableMinutes),
  } : null;
}

function briefForJourney(fixture: RepresentativeShadeFixture, journey: RepresentativeShadeFixture["journeys"][number]): TripBrief {
  return {
    journeyShape: "destination",
    originNodeId: journey.origin.nodeId,
    destinationNodeId: journey.destinationNodeId,
    departureHour: fixture.departureHour,
    detourAllowanceMinutes: fixture.routePolicy.detourAllowanceMinutes,
    preferences: [],
  };
}

function plannedRoute(
  graph: PilotGraph,
  fixture: RepresentativeShadeFixture,
  journey: RepresentativeShadeFixture["journeys"][number],
  adjustedShade?: (edge: GraphEdge) => number,
) {
  return planJourney(graph, briefForJourney(fixture, journey), {
    edgePreference: {
      id: fixture.routePolicy.edgePreferenceId,
      weight: fixture.routePolicy.edgePreferenceWeight,
      score: adjustedShade ?? ((edge) => edgeShade(edge, fixture.departureHour)),
    },
  }).recommended;
}

function directSunMinutes(
  route: JourneyRoute,
  edgeById: ReadonlyMap<string, GraphEdge>,
  departureHour: number,
  adjustedShade?: (edge: GraphEdge) => number,
) {
  return route.edgeIds.reduce((sum, edgeId) => {
    const edge = edgeById.get(edgeId);
    if (!edge) throw new RangeError(`Unknown route edge: ${edgeId}`);
    return sum + exposedMinutes(edge, departureHour, adjustedShade?.(edge) ?? edgeShade(edge, departureHour));
  }, 0);
}

function routeSnapshot(route: JourneyRoute, burden: number): RepresentativeRouteSnapshot {
  return {
    candidateId: route.candidateId,
    edgeIds: [...route.edgeIds],
    distanceMeters: round(route.distanceMeters),
    durationMinutes: round(route.durationMinutes),
    directSunMinutes: round(burden),
  };
}

export function classifyRepresentativeBurdenEffect(
  baselineDirectSunMinutes: number,
  scenarioDirectSunMinutes: number,
): RepresentativeJourneyComparison["effect"] {
  const avoided = baselineDirectSunMinutes - scenarioDirectSunMinutes;
  return avoided > IMPACT_EPSILON_MINUTES
    ? "improved"
    : avoided < -IMPACT_EPSILON_MINUTES ? "worsened" : "unchanged";
}

function interventionResult(
  graph: PilotGraph,
  fixture: RepresentativeShadeFixture,
  baselineRoutes: ReadonlyMap<string, JourneyRoute>,
  gap: SelectedRepeatedShadeGap,
  intervention: RepresentativeShadeFixture["interventions"][number],
): RepresentativeInterventionResult {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const gapEdgeIds = new Set(gap.edgeIds);
  const targetShade = intervention.targetShadePercent / 100;
  const adjustedShade = (edge: GraphEdge) => gapEdgeIds.has(edge.id)
    ? Math.max(edgeShade(edge, fixture.departureHour), targetShade)
    : edgeShade(edge, fixture.departureHour);
  const journeys = fixture.journeys.map((journey): RepresentativeJourneyComparison => {
    const baselineRoute = baselineRoutes.get(journey.id)!;
    const scenarioRoute = plannedRoute(graph, fixture, journey, adjustedShade);
    const baselineBurden = directSunMinutes(baselineRoute, edgeById, fixture.departureHour);
    const scenarioBurden = directSunMinutes(scenarioRoute, edgeById, fixture.departureHour, adjustedShade);
    const avoided = baselineBurden - scenarioBurden;
    const effect = classifyRepresentativeBurdenEffect(baselineBurden, scenarioBurden);
    return {
      journeyId: journey.id,
      label: journey.label,
      weight: journey.weight,
      effect,
      routeChanged: baselineRoute.candidateId !== scenarioRoute.candidateId,
      baselineDirectSunMinutes: round(baselineBurden),
      scenarioDirectSunMinutes: round(scenarioBurden),
      avoidedDirectSunMinutes: round(avoided),
      baselineRoute: routeSnapshot(baselineRoute, baselineBurden),
      scenarioRoute: routeSnapshot(scenarioRoute, scenarioBurden),
    };
  });
  const totalWeight = journeys.reduce((sum, journey) => sum + journey.weight, 0);
  const weighted = (key: "baselineDirectSunMinutes" | "scenarioDirectSunMinutes") => journeys.reduce(
    (sum, journey) => sum + journey[key] * journey.weight,
    0,
  );
  const baseline = weighted("baselineDirectSunMinutes");
  const scenario = weighted("scenarioDirectSunMinutes");
  return {
    id: intervention.id,
    label: intervention.label,
    role: intervention.role,
    status: "hypothetical",
    targetShadePercent: intervention.targetShadePercent,
    cohortJourneyIds: fixture.journeys.map((journey) => journey.id),
    routePolicy: { ...fixture.routePolicy },
    summary: {
      unit: "weighted direct-sun minutes",
      evaluated: journeys.length,
      totalWeight: round(totalWeight),
      improved: journeys.filter((journey) => journey.effect === "improved").length,
      unchanged: journeys.filter((journey) => journey.effect === "unchanged").length,
      worsened: journeys.filter((journey) => journey.effect === "worsened").length,
      routesChanged: journeys.filter((journey) => journey.routeChanged).length,
      routesUnchanged: journeys.filter((journey) => !journey.routeChanged).length,
      baseline: round(baseline),
      scenario: round(scenario),
      avoided: round(baseline - scenario),
      remaining: round(scenario),
      averageBaseline: round(baseline / totalWeight),
      averageScenario: round(scenario / totalWeight),
      averageAvoided: round((baseline - scenario) / totalWeight),
    },
    journeys,
  };
}

/** Regenerates the checked-in planner result from the frozen cohort and current evidence snapshot. */
export function generateRepresentativeShadeScenario(
  graph: PilotGraph,
  fixture: RepresentativeShadeFixture = representativeShadeFixture,
): RepresentativeShadeScenarioResult {
  validateFixture(graph, fixture);
  const baselineRoutes = new Map(fixture.journeys.map((journey) => [
    journey.id,
    plannedRoute(graph, fixture, journey),
  ]));
  const gap = selectRepeatedShadeGap(
    graph,
    fixture.journeys.map((journey) => ({
      journeyId: journey.id,
      edgeIds: baselineRoutes.get(journey.id)!.edgeIds,
      weight: journey.weight,
    })),
    fixture.departureHour,
    fixture.selectionPolicy.targetShadePercent,
    fixture.selectionPolicy.minimumJourneyCount,
    fixture.selectionPolicy.minimumAvoidedMinutesPerEdge,
  );
  if (!gap) throw new Error("No repeated shade gap satisfies the frozen selection policy");

  const interventions = fixture.interventions.map((intervention) => interventionResult(
    graph,
    fixture,
    baselineRoutes,
    gap,
    intervention,
  ));
  const stableInputs = {
    fixtureId: fixture.id,
    gapEdgeIds: gap.edgeIds,
    interventions: interventions.map((intervention) => ({
      id: intervention.id,
      targetShadePercent: intervention.targetShadePercent,
      routes: intervention.journeys.map((journey) => ({
        journeyId: journey.journeyId,
        baselineCandidateId: journey.baselineRoute.candidateId,
        scenarioCandidateId: journey.scenarioRoute.candidateId,
      })),
    })),
  };
  const resultFingerprint = fingerprint(stableInputs);
  return {
    schemaVersion: 1,
    id: `${fixture.id}-${resultFingerprint}`,
    fixtureId: fixture.id,
    title: fixture.title,
    question: fixture.question,
    geography: fixture.geography,
    status: "hypothetical",
    departureHour: fixture.departureHour,
    cohort: {
      type: "frozen public-anchor cohort",
      journeyIds: fixture.journeys.map((journey) => journey.id),
      journeyCount: fixture.journeys.length,
      totalWeight: round(fixture.journeys.reduce((sum, journey) => sum + journey.weight, 0)),
      anchorPolicy: { ...fixture.anchorPolicy },
      destination: { ...fixture.destination, coordinate: [...fixture.destination.coordinate] as Coordinate },
    },
    selectedGap: {
      id: fixture.gap.id,
      label: fixture.gap.label,
      edgeIds: gap.edgeIds,
      affectedJourneyIds: gap.affectedJourneyIds,
      affectedJourneyWeight: gap.affectedJourneyWeight,
      totalLengthMeters: gap.totalLengthMeters,
      weightedAvoidableMinutesAtPrimaryTarget: gap.weightedAvoidableMinutes,
      selectionPolicy: { ...fixture.selectionPolicy },
      selectionKey: gap.selectionKey,
    },
    interventions,
    evidence: {
      sourceIds: fixture.sources.map((source) => String(source.sourceId)),
      sources: fixture.sources.map((source) => ({ ...source })),
      limitations: [...fixture.limitations],
      exclusions: [...fixture.exclusions],
    },
    fingerprint: resultFingerprint,
  };
}
