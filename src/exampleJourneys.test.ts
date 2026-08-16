import { describe, expect, it } from "vitest";
import { routeMappedCoverMeters, mappedCoverShare, pickRainFriendlyRoute } from "./coverEvidence";
import { findCivicAssetsNearRoute } from "./data/civicAssets";
import { listCivicTasks } from "./data/civicTasks";
import { ensureGraphCoverage, pilotGraph } from "./data/cityGraph";
import { getPilotTransitEndpointCandidates } from "./data/transitEndpoints";
import { EXAMPLE_JOURNEYS, HERO_JOURNEYS, HERO_PROMPT_CONTRACTS } from "./exampleJourneys";
import { getSourceRegistryEntry } from "./data/sourceRegistry";
import { selectRouteThroughOptionalCivicTask } from "./planning/civicTaskRouting";
import { compileTripBrief, DEFAULT_BRIEF, distanceMilesToRoutingMinutes, metersToMiles, withDestinationOverride } from "./planning/tripBrief";
import { planJourney } from "./routing/journey";
import type { JourneyPreference, TripBrief as RoutingTripBrief } from "./types";

describe("curated Try examples", () => {
  async function loadExampleAreas() {
    await ensureGraphCoverage(EXAMPLE_JOURNEYS.flatMap((example) => [
      example.originCoordinate,
      ...(example.destinationCoordinate ? [example.destinationCoordinate] : []),
    ]));
  }

  it("uses a distinct, valid pilot origin for every representative scenario", async () => {
    await loadExampleAreas();
    const nodeIds = new Set(pilotGraph.nodes.map((node) => node.id));
    expect(EXAMPLE_JOURNEYS).toHaveLength(6);
    expect(new Set(EXAMPLE_JOURNEYS.map((example) => example.id)).size).toBe(EXAMPLE_JOURNEYS.length);
    for (const example of EXAMPLE_JOURNEYS) {
      expect(nodeIds.has(example.originNodeId), `${example.label} origin`).toBe(true);
      if (example.destinationNodeId) expect(nodeIds.has(example.destinationNodeId), `${example.label} destination`).toBe(true);
    }
  }, 20_000);

  it("demonstrates destination, loop, wander, rain, civic, and distance intent", () => {
    const briefs = Object.fromEntries(EXAMPLE_JOURNEYS.map((example) => [
      example.id,
      compileTripBrief(example.prompt, { ...DEFAULT_BRIEF, priorities: [], destinationQuery: null, prompt: "" }),
    ]));

    expect(EXAMPLE_JOURNEYS.find((example) => example.id === "destination-shade")?.destinationNodeId).not.toBeNull();
    expect(briefs["green-loop"]).toMatchObject({ shape: "loop", walkingMinutes: 30, priorities: ["greenery", "rest"] });
    expect(briefs["transit-wander"]).toMatchObject({ shape: "wander", walkingMinutes: 30, direction: "north", endCondition: "transit" });
    expect(briefs["rain-cover-loop"]).toMatchObject({ shape: "destination", destinationQuery: "Waterside Plaza" });
    expect(briefs["civic-check-loop"]).toMatchObject({ shape: "wander", walkingMinutes: 25, civicTaskIntent: "photo", priorities: ["water"] });
    expect(briefs["shaded-run"]).toMatchObject({ shape: "loop", activity: "run", distanceMiles: 2, priorities: ["shade", "greenery"] });
  }, 30_000);

  it("keeps four typed opening prompts with visible phrase consequences and source evidence", () => {
    expect(HERO_JOURNEYS).toHaveLength(4);
    expect(HERO_PROMPT_CONTRACTS.map((contract) => contract.id)).toEqual(HERO_JOURNEYS.map((journey) => journey.id));
    for (const contract of HERO_PROMPT_CONTRACTS) {
      const brief = compileTripBrief(contract.prompt, { ...DEFAULT_BRIEF, priorities: [], destinationQuery: null, prompt: "" });
      expect(brief).toMatchObject(contract.expectedBrief);
      for (const mapping of contract.phraseConsequences) {
        expect(contract.prompt.toLowerCase(), `${contract.id}:${mapping.phrase}`).toContain(mapping.phrase.toLowerCase());
      }
      for (const sourceId of contract.evidenceSourceIds) {
        expect(getSourceRegistryEntry(sourceId), `${contract.id}:${sourceId}`).toBeTruthy();
      }
    }
  });

  it("produces substantial routes instead of tiny placeholder lines", async () => {
    await loadExampleAreas();
    const loadedNodeIds = new Set(pilotGraph.nodes.map((node) => node.id));
    const transitNodeIds = [...new Set(getPilotTransitEndpointCandidates({ maxSnapDistanceMeters: 50 }).map((candidate) => candidate.graphNodeId))]
      .filter((nodeId) => loadedNodeIds.has(nodeId));
    let civicTaskId: string | null = null;
    const results = EXAMPLE_JOURNEYS.map((example) => {
      const destinationName = example.destinationNodeId
        ? pilotGraph.nodes.find((node) => node.id === example.destinationNodeId)!.name
        : "";
      const compiled = compileTripBrief(example.prompt, { ...DEFAULT_BRIEF, priorities: [], destinationQuery: null, prompt: "" });
      const brief = example.destinationNodeId ? withDestinationOverride(compiled, destinationName) : compiled;
      const preferences: JourneyPreference[] = [
        ...(brief.priorities.includes("shade") ? [{ featureId: "shade" as const, weight: 1 }] : []),
        ...(brief.priorities.includes("greenery") ? [{ featureId: "green" as const, weight: 1 }] : []),
      ];
      const common = { originNodeId: example.originNodeId, departureHour: 14, preferences };
      const routingBrief: RoutingTripBrief = brief.shape === "destination"
        ? { ...common, journeyShape: "destination", destinationNodeId: example.destinationNodeId!, detourAllowanceMinutes: brief.detourMinutes }
        : brief.shape === "loop"
          ? { ...common, journeyShape: "loop", walkingBudgetMinutes: brief.distanceMiles === null ? brief.walkingMinutes : distanceMilesToRoutingMinutes(brief.distanceMiles) }
          : {
              ...common,
              journeyShape: "wander",
              walkingBudgetMinutes: brief.distanceMiles === null ? brief.walkingMinutes : distanceMilesToRoutingMinutes(brief.distanceMiles),
              direction: brief.direction ?? undefined,
              endCondition: brief.endCondition === "transit" ? { nodeIds: transitNodeIds, label: "near transit" } : undefined,
            };
      const planningOptions = {
        walkingTimeIntent: brief.walkingTimeIntent,
        edgePreference: example.id === "rain-cover-loop" ? { id: "mapped_overhead_cover", weight: 1, score: mappedCoverShare } : undefined,
      } as const;
      const result = planJourney(pilotGraph, routingBrief, planningOptions);
      const preferredRoute = example.id === "rain-cover-loop" ? pickRainFriendlyRoute(result, pilotGraph) : result.recommended;
      if (!brief.civicTaskIntent) return [example.id, preferredRoute] as const;
      const civicSelection = selectRouteThroughOptionalCivicTask({
        graph: pilotGraph,
        routingBrief,
        result,
        preferredRoute,
        tasks: listCivicTasks({ intent: brief.civicTaskIntent }),
        planningOptions,
      });
      civicTaskId = civicSelection.taskId;
      return [example.id, civicSelection.route] as const;
    });
    const routes = Object.fromEntries(results);

    for (const example of EXAMPLE_JOURNEYS) {
      expect(routes[example.id].distanceMeters, `${example.label} distance`).toBeGreaterThan(700);
      expect(routes[example.id].nodeIds.length, `${example.label} geometry`).toBeGreaterThan(5);
      const longitudes = routes[example.id].coordinates.map(([longitude]) => longitude);
      const latitudes = routes[example.id].coordinates.map(([, latitude]) => latitude);
      const mapSpanMeters = Math.hypot(
        (Math.max(...longitudes) - Math.min(...longitudes)) * 84_200,
        (Math.max(...latitudes) - Math.min(...latitudes)) * 111_111,
      );
      expect(mapSpanMeters, `${example.label} map span ${Math.round(mapSpanMeters)}m`).toBeLessThan(2_500);
    }
    expect(routes["destination-shade"].durationMinutes).toBeGreaterThan(15);
    expect(transitNodeIds).toContain(routes["transit-wander"].endpointNodeId);
    expect(routes["green-loop"].endpointNodeId).toBe(EXAMPLE_JOURNEYS.find((example) => example.id === "green-loop")!.originNodeId);
    expect(routes["green-loop"].repeatedEdgeRatio).toBe(0);
    expect(findCivicAssetsNearRoute(routes["green-loop"].coordinates, { kinds: ["seating"], maxDistanceMeters: 90, limit: 1 })).toHaveLength(1);
    expect(routeMappedCoverMeters(routes["rain-cover-loop"], pilotGraph)).toBeGreaterThan(25);
    expect(civicTaskId).toBe("photo-west-fourth-fountain");
    expect(metersToMiles(routes["shaded-run"].distanceMeters)).toBeGreaterThanOrEqual(1.8);
    expect(metersToMiles(routes["shaded-run"].distanceMeters)).toBeLessThanOrEqual(2.2);
    expect(routes["shaded-run"].endpointNodeId).toBe(EXAMPLE_JOURNEYS.find((example) => example.id === "shaded-run")!.originNodeId);
    expect(routes["shaded-run"].repeatedEdgeRatio).toBeLessThan(0.03);
  }, 180_000);
});
