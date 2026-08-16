import type {
  CityInterventionCandidate,
  DeterministicInsightFact,
  InsightSource,
  RouteCityInsight,
  RouteCityInsightRequest,
} from "../../server/insights";
import type { CivicAsset } from "../data/civicAssets";
import { sourceRegistryPresentation } from "../data/sourceRegistry";
import type { ShadeDetourScenario } from "../detour/shadeScenario";
import type { JourneyRoute } from "../types";
import type { TripBrief } from "./tripBrief";

export interface CityInsightContext {
  brief: TripBrief;
  route: JourneyRoute;
  scenario: ShadeDetourScenario | null;
  nearbyAssets: readonly CivicAsset[];
  simulatedCoverPercent: number;
}

function fact(
  factId: string,
  statement: string,
  sourceIds: readonly string[],
): DeterministicInsightFact {
  return { factId, statement, sourceIds };
}

function sourceKind(sourceId: string): InsightSource["kind"] {
  if (sourceId === "openstreetmap") return "community";
  if (sourceId === "demo-cover-simulation") return "synthetic";
  if (sourceId === "building-shadow-model" || sourceId === "greenery-edge-model") return "derived";
  return "official";
}

function source(sourceId: string): InsightSource {
  const presentation = sourceRegistryPresentation(sourceId);
  return {
    sourceId,
    label: presentation?.title ?? "Deterministic proof-of-concept signal",
    kind: sourceKind(sourceId),
  };
}

function routeLabel(brief: TripBrief, route: JourneyRoute) {
  const minutes = Math.round(route.durationMinutes);
  if (brief.shape === "loop") return `${minutes}-minute comfort loop`;
  if (brief.shape === "wander") return `${minutes}-minute exploratory walk`;
  return `${minutes}-minute route to ${brief.destinationQuery || "the destination"}`;
}

function routeFacts(context: CityInsightContext) {
  const { route, brief, nearbyAssets } = context;
  const facts: DeterministicInsightFact[] = [
    fact("route-time", `The walking graph estimates this route at ${route.durationMinutes.toFixed(1)} minutes.`, ["openstreetmap"]),
  ];
  if (brief.priorities.includes("shade")) {
    facts.push(fact(
      "route-sun",
      `The shade model estimates ${route.directSunMinutes.toFixed(1)} minutes in direct sun at the selected time.`,
      ["nyc-building-footprints", "building-shadow-model"],
    ));
  }
  if (brief.priorities.includes("greenery")) {
    facts.push(fact(
      "route-greenery",
      `${route.greeneryPercent.toFixed(0)}% of the route has mapped tree or park adjacency in the demo model.`,
      ["nyc-forestry-tree-points", "nyc-parks-properties", "greenery-edge-model"],
    ));
  }
  if (nearbyAssets.length > 0) {
    facts.push(fact(
      "route-amenities",
      `${nearbyAssets.length} mapped public amenities are within 120 meters of the route geometry.`,
      [...new Set(nearbyAssets.map((asset) => asset.sourceId))],
    ));
  }
  if (brief.avoidMappedSteps) {
    facts.push(fact(
      "route-mapped-steps",
      `The selected route uses ${route.mappedStepEdges} edges tagged as steps in the bundled walking graph.`,
      ["openstreetmap"],
    ));
  }
  return facts;
}

function interventionCandidates(context: CityInsightContext) {
  const { brief, route, scenario, nearbyAssets, simulatedCoverPercent } = context;
  const candidates: CityInterventionCandidate[] = [];
  const routeLocation = route.streets.find((street) => street && !/^unnamed/i.test(street)) || "the selected route";
  if (scenario) {
    const location = scenario.selection.locationNames[0] || routeLocation;
    candidates.push({
      candidateId: "test-shade-gap",
      interventionType: "shade",
      locationLabel: location,
      proposedAction: `Test a shade intervention on ${location}`,
      evidence: [fact(
        "shade-gap-benefit",
        `This modeled change reduces average direct-sun burden by ${(scenario.burden.avoided / scenario.journeyCounts.totalWeight).toFixed(1)} minutes.`,
        ["nyc-building-footprints", "building-shadow-model"],
      )],
      referenceSourceIds: [],
      caveat: "This is a shade-model comparison, not a surveyed, designed, funded, or approved City project.",
    });
  }

  const seatingCount = nearbyAssets.filter((asset) => asset.kind === "seating").length;
  candidates.push({
    candidateId: "test-rest-gap",
    interventionType: "seating",
    locationLabel: `Near the midpoint of ${routeLocation}`,
    proposedAction: "Test one additional rest opportunity near the route midpoint",
    evidence: [fact(
      "rest-gap-count",
      `${seatingCount} NYC DOT seating records are within 120 meters of this route geometry.`,
      ["nyc-dot-seating"],
    )],
    referenceSourceIds: [],
    caveat: "Inventory proximity does not confirm walking access, current seating, sidewalk capacity, or site feasibility.",
  });

  candidates.push({
    candidateId: "audit-weather-cover",
    interventionType: "weather_cover",
    locationLabel: routeLocation,
    proposedAction: "Validate current overhead cover and sidewalk conditions along the exposed segments",
    evidence: [fact(
      "cover-proof-share",
      `The demo cover signal highlights ${Math.round(simulatedCoverPercent)}% of this route for scenario testing.`,
      ["demo-cover-simulation"],
    )],
    referenceSourceIds: ["nyc-sidewalk-shed-permits"],
    caveat: "The cover signal is simulated; permit records do not prove a shed is installed, present, passable, or dry.",
  });

  if (brief.avoidMappedSteps) {
    candidates.push({
      candidateId: "audit-step-free-evidence",
      interventionType: "mapped_steps",
      locationLabel: routeLocation,
      proposedAction: "Audit curb ramps, crossings, slopes, and obstructions along the mapped-step-free route",
      evidence: [fact(
        "step-free-boundary",
        `The route excludes mapped steps, while ${route.mappedStepEdges} step-tagged edges remain on the selected path.`,
        ["openstreetmap"],
      )],
      referenceSourceIds: ["nyc-pedestrian-ramps"],
      caveat: "Mapped-step exclusion is not an accessibility or ADA guarantee; curb, slope, width, elevator, and obstruction evidence is incomplete.",
    });
  }

  return candidates;
}

export function buildRouteCityInsightRequest(context: CityInsightContext): RouteCityInsightRequest {
  const evidence = routeFacts(context);
  const candidates = interventionCandidates(context);
  const sourceIds = [...new Set([
    ...evidence.flatMap((item) => item.sourceIds),
    ...candidates.flatMap((candidate) => candidate.evidence.flatMap((item) => item.sourceIds)),
    ...candidates.flatMap((candidate) => candidate.referenceSourceIds),
  ])];
  return {
    route: {
      routeId: context.route.candidateId,
      journeyLabel: routeLabel(context.brief, context.route),
      evidence,
      caveat: "Route time, shade, greenery, and amenity proximity are modeled or mapped evidence, not live street conditions.",
    },
    sources: sourceIds.map(source),
    candidates,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, minimum: number, maximum: number): string[] | null {
  if (!Array.isArray(value)
    || value.length < minimum
    || value.length > maximum
    || !value.every((item) => typeof item === "string")
    || new Set(value).size !== value.length) return null;
  return value;
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function isRouteCityInsight(value: unknown, request: RouteCityInsightRequest): value is RouteCityInsight {
  if (!isRecord(value)
    || !["model", "fallback"].includes(value.generatedBy as string)
    || !isRecord(value.rationale)
    || !Array.isArray(value.interventions)
    || value.interventions.length < 2
    || value.interventions.length > 3) return false;

  const rationaleFactIds = stringArray(value.rationale.factIds, 1, 2);
  const routeFacts = rationaleFactIds?.map((factId) => request.route.evidence.find((fact) => fact.factId === factId));
  const routeSourceIds = routeFacts?.flatMap((fact) => fact?.sourceIds ?? []) ?? [];
  const rationaleSourceIds = stringArray(value.rationale.sourceIds, 1, 12);
  if (!rationaleFactIds
    || routeFacts?.some((fact) => !fact)
    || !rationaleSourceIds
    || value.rationale.routeId !== request.route.routeId
    || value.rationale.headline !== request.route.journeyLabel
    || value.rationale.summary !== routeFacts?.map((fact) => fact!.statement).join(" ")
    || value.rationale.caveat !== request.route.caveat
    || !sameStrings(rationaleSourceIds, [...new Set(routeSourceIds)])) return false;

  const selectedCandidateIds = new Set<string>();
  return value.interventions.every((intervention, index) => {
    if (!isRecord(intervention) || typeof intervention.candidateId !== "string" || selectedCandidateIds.has(intervention.candidateId)) return false;
    const candidate = request.candidates.find((item) => item.candidateId === intervention.candidateId);
    const factIds = stringArray(intervention.factIds, 1, 2);
    const selectedFacts = factIds?.map((factId) => candidate?.evidence.find((fact) => fact.factId === factId));
    const sourceIds = stringArray(intervention.sourceIds, 1, 12);
    const referenceSourceIds = stringArray(intervention.referenceSourceIds, 0, 4);
    if (!candidate || !factIds || selectedFacts?.some((fact) => !fact) || !sourceIds || !referenceSourceIds) return false;
    selectedCandidateIds.add(candidate.candidateId);
    return intervention.rank === index + 1
      && intervention.interventionType === candidate.interventionType
      && intervention.locationLabel === candidate.locationLabel
      && intervention.proposedAction === candidate.proposedAction
      && intervention.rationale === selectedFacts?.map((fact) => fact!.statement).join(" ")
      && sameStrings(sourceIds, [...new Set(selectedFacts!.flatMap((fact) => fact!.sourceIds))])
      && sameStrings(referenceSourceIds, candidate.referenceSourceIds)
      && intervention.caveat === candidate.caveat
      && intervention.status === "hypothetical";
  });
}

export async function requestRouteCityInsight(
  request: RouteCityInsightRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<RouteCityInsight> {
  const response = await fetchImpl("/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error("Route insights are unavailable");
  const payload = await response.json() as { insight?: unknown };
  if (!isRouteCityInsight(payload.insight, request)) {
    throw new Error("Route insights returned an invalid response");
  }
  return payload.insight;
}
