import type { Coordinate, GraphEdge, JourneyRoute, PilotGraph } from "../types";
import { edgeShade } from "../routing/shade";
import { WALKING_METERS_PER_MINUTE } from "../routing/journey";

const MINIMUM_VISIBLE_CHANGE_MINUTES = 0.000_001;
const SHADE_SOURCE_IDS = ["openstreetmap", "nyc-building-footprints", "building-shadow-model"];
const UNHELPFUL_LOCATION = /^(?:unnamed|unknown|unmapped)|unnamed\s+(?:pedestrian\s+)?(?:way|path)|pedestrian\s+(?:way|path)$/i;

export interface ShadeInterventionInput {
  /** Modeled shade after the intervention, expressed as a user-facing zero-to-100 percentage. */
  targetShadePercent: number;
  /** Optional graph edges selected by a planner. Omit to use the most exposed edge across the sample. */
  edgeIds?: readonly string[];
  /** Optional plain-language intervention label, such as "Temporary summer canopy". */
  label?: string;
}

export interface ShadeDetourJourneyInput {
  id: string;
  route: JourneyRoute;
  label?: string;
  /** Transparent demand weight. Defaults to one and must be greater than zero. */
  weight?: number;
}

export interface ShadeDetourEvaluationInput {
  departureHour: number;
  journeys: readonly ShadeDetourJourneyInput[];
  intervention: ShadeInterventionInput;
}

export interface ShadeSelectedEdge {
  edgeId: string;
  locationName: string;
  distanceMeters: number;
  baselineShadePercent: number;
  scenarioShadePercent: number;
  baselineDirectSunMinutes: number;
  scenarioDirectSunMinutes: number;
  avoidedDirectSunMinutes: number;
  geometry: Coordinate[];
}

export interface ShadeSelectionGeoJSON {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      edgeId: string;
      locationName: string;
      distanceMeters: number;
      baselineShadePercent: number;
      scenarioShadePercent: number;
    };
    geometry: { type: "LineString"; coordinates: Coordinate[] };
  }>;
}

export interface ShadeJourneyComparison {
  journeyId: string;
  label: string;
  weight: number;
  usesSelectedEdges: boolean;
  affectedEdgeIds: string[];
  baselineDirectSunMinutes: number;
  scenarioDirectSunMinutes: number;
  avoidedDirectSunMinutes: number;
  /** This bounded evaluator compares the same path before and after; it does not claim a reroute. */
  routeChanged: false;
}

export interface ShadeDetourScenario {
  title: string;
  summary: string;
  status: "hypothetical";
  /** Backward-compatible primary location and edge for the resident Detour card. */
  street: string;
  edgeId: string;
  baselineDirectSunMinutes: number;
  scenarioDirectSunMinutes: number;
  avoidedDirectSunMinutes: number;
  intervention: string;
  modeledIntervention: {
    label: string;
    targetShadePercent: number;
    edgeIds: string[];
  };
  selection: {
    edgeIds: string[];
    locationNames: string[];
    totalLengthMeters: number;
    edges: ShadeSelectedEdge[];
    geojson: ShadeSelectionGeoJSON;
  };
  burden: {
    unit: "weighted direct-sun minutes";
    baseline: number;
    scenario: number;
    avoided: number;
    calculation: string;
  };
  journeyCounts: {
    evaluated: number;
    touchingIntervention: number;
    withChangedBurden: number;
    unchangedBurden: number;
    routesChanged: 0;
    routesUnchanged: number;
    totalWeight: number;
    improvedWeight: number;
  };
  journeyComparisons: ShadeJourneyComparison[];
  caveat: string;
  assumptions: string[];
  sourceIds: string[];
}

function usefulStreetName(street: string | undefined): string | null {
  const value = street?.trim();
  return value && !UNHELPFUL_LOCATION.test(value) ? value : null;
}

/** Returns resident-facing location copy without leaking raw OSM placeholder names. */
export function describeShadeInterventionLocation(graph: PilotGraph, edge: GraphEdge): string {
  const ownName = usefulStreetName(edge.street);
  if (ownName) return ownName;

  const nearbyNames = graph.edges
    .filter((candidate) => candidate.id !== edge.id
      && (candidate.from === edge.from || candidate.from === edge.to || candidate.to === edge.from || candidate.to === edge.to))
    .map((candidate) => usefulStreetName(candidate.street))
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b));
  const nearbyName = nearbyNames[0];
  const isWalkway = ["footway", "path", "pedestrian"].includes(edge.osm?.highway ?? "");
  if (nearbyName) return `${isWalkway ? "Walkway" : "Block"} near ${nearbyName}`;
  return isWalkway ? "the selected walkway" : "the selected block";
}

function exposedMinutes(edge: GraphEdge, hour: number, shade = edgeShade(edge, hour)) {
  return edge.distanceMeters * (1 - shade) / WALKING_METERS_PER_MINUTE;
}

function validateInput(graph: PilotGraph, input: ShadeDetourEvaluationInput) {
  if (!Number.isFinite(input.departureHour) || input.departureHour < 0 || input.departureHour >= 24) {
    throw new RangeError("departureHour must be between zero and 24");
  }
  if (!Number.isFinite(input.intervention.targetShadePercent)
    || input.intervention.targetShadePercent < 0
    || input.intervention.targetShadePercent > 100) {
    throw new RangeError("targetShadePercent must be between zero and 100");
  }
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  for (const edgeId of input.intervention.edgeIds ?? []) {
    if (!edgeIds.has(edgeId)) throw new RangeError(`Unknown intervention edge: ${edgeId}`);
  }
  const journeyIds = new Set<string>();
  for (const journey of input.journeys) {
    if (!journey.id.trim()) throw new TypeError("Each representative journey needs an id");
    if (journeyIds.has(journey.id)) throw new TypeError(`Duplicate representative journey id: ${journey.id}`);
    journeyIds.add(journey.id);
    const weight = journey.weight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0) throw new RangeError(`Journey weight for ${journey.id} must be greater than zero`);
    if (!Number.isFinite(journey.route.directSunMinutes) || journey.route.directSunMinutes < 0) {
      throw new RangeError(`Journey ${journey.id} has an invalid direct-sun burden`);
    }
  }
}

function selectedEdges(
  graph: PilotGraph,
  journeys: readonly ShadeDetourJourneyInput[],
  hour: number,
  requestedIds?: readonly string[],
): GraphEdge[] {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  if (requestedIds?.length) {
    return [...new Set(requestedIds)].map((id) => edgeById.get(id)!).filter(Boolean);
  }

  const exposureByEdgeId = new Map<string, number>();
  for (const journey of journeys) {
    const weight = journey.weight ?? 1;
    for (const edgeId of journey.route.edgeIds) {
      const edge = edgeById.get(edgeId);
      if (!edge) continue;
      exposureByEdgeId.set(edgeId, (exposureByEdgeId.get(edgeId) ?? 0) + exposedMinutes(edge, hour) * weight);
    }
  }
  const selectedId = [...exposureByEdgeId]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return selectedId ? [edgeById.get(selectedId)!] : [];
}

function edgeGeometry(graph: PilotGraph, edge: GraphEdge): Coordinate[] {
  if (edge.geometry && edge.geometry.length >= 2) return edge.geometry.map((coordinate) => [...coordinate] as Coordinate);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const from = nodeById.get(edge.from)?.coordinate;
  const to = nodeById.get(edge.to)?.coordinate;
  return from && to ? [[...from] as Coordinate, [...to] as Coordinate] : [];
}

function sentenceForIntervention(edgeCount: number, targetShadePercent: number, locationNames: string[]) {
  const where = locationNames.length === 1
    ? `along ${locationNames[0]}`
    : `across ${edgeCount} selected segments`;
  return `Model ${Math.round(targetShadePercent)}% estimated shade ${where}.`;
}

/**
 * Compares fixed representative routes before and after an adjustable shade
 * intervention. It intentionally does not price, prioritize, or claim to
 * reroute a journey; those boundaries are explicit in the returned counts.
 */
export function evaluateShadeDetourScenario(
  graph: PilotGraph,
  input: ShadeDetourEvaluationInput,
): ShadeDetourScenario | null {
  validateInput(graph, input);
  if (input.journeys.length === 0) return null;

  const edges = selectedEdges(graph, input.journeys, input.departureHour, input.intervention.edgeIds);
  if (edges.length === 0) return null;
  const targetShade = input.intervention.targetShadePercent / 100;
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const selectedById = new Map(edges.map((edge) => {
    const baselineShade = edgeShade(edge, input.departureHour);
    const scenarioShade = Math.max(baselineShade, targetShade);
    return [edge.id, { edge, baselineShade, scenarioShade }];
  }));

  const journeyComparisons = input.journeys.map((journey): ShadeJourneyComparison => {
    const affectedEdgeIds = [...new Set(journey.route.edgeIds.filter((edgeId) => selectedById.has(edgeId)))];
    // Route metrics describe the resident's original departure time. Planner
    // shade time is independently adjustable, so recompute the baseline at
    // the scenario hour instead of reusing a stale route-level total.
    const baselineDirectSunMinutes = journey.route.edgeIds.reduce((sum, edgeId) => {
      const edge = edgeById.get(edgeId);
      return edge ? sum + exposedMinutes(edge, input.departureHour) : sum;
    }, 0);
    const avoidedDirectSunMinutes = journey.route.edgeIds.reduce((sum, edgeId) => {
      const selected = selectedById.get(edgeId);
      if (!selected) return sum;
      return sum + Math.max(
        0,
        exposedMinutes(selected.edge, input.departureHour, selected.baselineShade)
          - exposedMinutes(selected.edge, input.departureHour, selected.scenarioShade),
      );
    }, 0);
    return {
      journeyId: journey.id,
      label: journey.label?.trim() || `Sample journey ${journey.id}`,
      weight: journey.weight ?? 1,
      usesSelectedEdges: affectedEdgeIds.length > 0,
      affectedEdgeIds,
      baselineDirectSunMinutes,
      scenarioDirectSunMinutes: Math.max(0, baselineDirectSunMinutes - avoidedDirectSunMinutes),
      avoidedDirectSunMinutes,
      routeChanged: false,
    };
  });

  const weightedBaseline = journeyComparisons.reduce((sum, journey) => sum + journey.baselineDirectSunMinutes * journey.weight, 0);
  const weightedScenario = journeyComparisons.reduce((sum, journey) => sum + journey.scenarioDirectSunMinutes * journey.weight, 0);
  const weightedAvoided = Math.max(0, weightedBaseline - weightedScenario);
  const changed = journeyComparisons.filter((journey) => journey.avoidedDirectSunMinutes > MINIMUM_VISIBLE_CHANGE_MINUTES);
  const totalWeight = journeyComparisons.reduce((sum, journey) => sum + journey.weight, 0);
  const improvedWeight = changed.reduce((sum, journey) => sum + journey.weight, 0);

  const selectionEdges = edges.map((edge): ShadeSelectedEdge => {
    const selected = selectedById.get(edge.id)!;
    const baselineDirectSunMinutes = exposedMinutes(edge, input.departureHour, selected.baselineShade);
    const scenarioDirectSunMinutes = exposedMinutes(edge, input.departureHour, selected.scenarioShade);
    return {
      edgeId: edge.id,
      locationName: describeShadeInterventionLocation(graph, edge),
      distanceMeters: edge.distanceMeters,
      baselineShadePercent: selected.baselineShade * 100,
      scenarioShadePercent: selected.scenarioShade * 100,
      baselineDirectSunMinutes,
      scenarioDirectSunMinutes,
      avoidedDirectSunMinutes: Math.max(0, baselineDirectSunMinutes - scenarioDirectSunMinutes),
      geometry: edgeGeometry(graph, edge),
    };
  });
  const locationNames = [...new Set(selectionEdges.map((edge) => edge.locationName))];
  const primaryLocation = locationNames[0];
  const label = input.intervention.label?.trim() || "Modeled shade intervention";
  const summary = changed.length === 0
    ? `None of the ${journeyComparisons.length} route options changes under this assumption.`
    : `${changed.length} of ${journeyComparisons.length} route option${journeyComparisons.length === 1 ? "" : "s"} would spend less time in estimated direct sun.`;
  const geojson: ShadeSelectionGeoJSON = {
    type: "FeatureCollection",
    features: selectionEdges.map((edge) => ({
      type: "Feature",
      properties: {
        edgeId: edge.edgeId,
        locationName: edge.locationName,
        distanceMeters: edge.distanceMeters,
        baselineShadePercent: edge.baselineShadePercent,
        scenarioShadePercent: edge.scenarioShadePercent,
      },
      geometry: { type: "LineString", coordinates: edge.geometry },
    })),
  };

  return {
    title: `What if ${primaryLocation} had more shade?`,
    summary,
    status: "hypothetical",
    street: primaryLocation,
    edgeId: edges[0].id,
    baselineDirectSunMinutes: weightedBaseline,
    scenarioDirectSunMinutes: weightedScenario,
    avoidedDirectSunMinutes: weightedAvoided,
    intervention: sentenceForIntervention(edges.length, input.intervention.targetShadePercent, locationNames),
    modeledIntervention: {
      label,
      targetShadePercent: input.intervention.targetShadePercent,
      edgeIds: edges.map((edge) => edge.id),
    },
    selection: {
      edgeIds: edges.map((edge) => edge.id),
      locationNames,
      totalLengthMeters: edges.reduce((sum, edge) => sum + edge.distanceMeters, 0),
      edges: selectionEdges,
      geojson,
    },
    burden: {
      unit: "weighted direct-sun minutes",
      baseline: weightedBaseline,
      scenario: weightedScenario,
      avoided: weightedAvoided,
      calculation: "Sum of each compared route’s estimated direct-sun minutes multiplied by its disclosed weight.",
    },
    journeyCounts: {
      evaluated: journeyComparisons.length,
      touchingIntervention: journeyComparisons.filter((journey) => journey.usesSelectedEdges).length,
      withChangedBurden: changed.length,
      unchangedBurden: journeyComparisons.length - changed.length,
      routesChanged: 0,
      routesUnchanged: journeyComparisons.length,
      totalWeight,
      improvedWeight,
    },
    journeyComparisons,
    caveat: "Hypothetical shade estimate—not designed, approved, costed, or built, and not a prediction of temperature or comfort.",
    assumptions: [
      "The selected routes are held fixed so the comparison isolates the modeled shade change; no rerouting is claimed.",
      "The intervention changes estimated building-shade coverage only. It does not model tree growth, temperature, construction, cost, or maintenance.",
      "These compared route options do not represent travel demand or establish City-wide need or project priority.",
    ],
    sourceIds: [...SHADE_SOURCE_IDS],
  };
}

/**
 * Backward-compatible single-route proof used by the resident Detour card.
 * New planner views can call evaluateShadeDetourScenario with an explicit
 * representative-journey sample and selected edges.
 */
export function buildShadeDetourScenario(graph: PilotGraph, route: JourneyRoute, hour: number): ShadeDetourScenario | null {
  return evaluateShadeDetourScenario(graph, {
    departureHour: hour,
    journeys: [{ id: route.candidateId, label: "Current resident journey", route }],
    intervention: { targetShadePercent: 80 },
  });
}
