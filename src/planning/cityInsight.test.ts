import { describe, expect, it, vi } from "vitest";
import { defaultDestination, defaultOrigin, pilotGraph } from "../data/cityGraph";
import { listCivicAssets } from "../data/civicAssets";
import { evaluateShadeDetourScenario } from "../detour/shadeScenario";
import { planJourney } from "../routing/journey";
import { DEFAULT_BRIEF, mergeTripBrief } from "./tripBrief";
import { buildRouteCityInsightRequest, requestRouteCityInsight } from "./cityInsight";

describe("buildRouteCityInsightRequest", () => {
  it("builds bounded intervention choices from deterministic route and source facts", () => {
    const brief = mergeTripBrief(DEFAULT_BRIEF, {
      shape: "destination",
      destinationQuery: "Washington Square Park",
      priorities: ["shade", "rest"],
      avoidMappedSteps: true,
    }, "controls");
    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 15,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 1 }],
      requirements: { avoidMappedSteps: true },
    });
    const route = result.recommended;
    const scenario = evaluateShadeDetourScenario(pilotGraph, {
      departureHour: 15,
      journeys: [{ id: route.candidateId, route, label: "Current route", weight: 1 }],
      intervention: { targetShadePercent: 80, label: "Shade test" },
    });
    const request = buildRouteCityInsightRequest({
      brief,
      route,
      scenario,
      nearbyAssets: listCivicAssets().slice(0, 6),
      mappedCoverMeters: 47,
    });

    expect(request.route.routeId).toBe(route.candidateId);
    expect(request.candidates.map((candidate) => candidate.candidateId)).toEqual([
      "test-shade-gap",
      "test-rest-gap",
      "audit-weather-cover",
      "audit-step-free-evidence",
    ]);
    expect(request.sources.map((source) => source.sourceId)).toEqual(expect.arrayContaining([
      "openstreetmap",
      "nyc-building-footprints",
      "nyc-dot-seating",
      "nyc-pedestrian-ramps",
      "nyc-sidewalk-shed-permits",
    ]));
    expect(new Set([
      ...request.route.evidence.map((item) => item.factId),
      ...request.candidates.flatMap((candidate) => candidate.evidence.map((item) => item.factId)),
    ]).size).toBe(request.route.evidence.length + request.candidates.reduce((sum, candidate) => sum + candidate.evidence.length, 0));
    const cover = request.candidates.find((candidate) => candidate.candidateId === "audit-weather-cover")!;
    expect(cover.evidence[0].sourceIds).toEqual(["openstreetmap"]);
    expect(cover.referenceSourceIds).toEqual(["nyc-sidewalk-shed-permits", "nyc-pops", "nyc-street-construction-closures"]);
    const accessibility = request.candidates.find((candidate) => candidate.candidateId === "audit-step-free-evidence")!;
    expect(accessibility.evidence[0].sourceIds).toEqual(["openstreetmap"]);
    expect(accessibility.referenceSourceIds).toEqual(["nyc-pedestrian-ramps"]);
  });
});

describe("requestRouteCityInsight", () => {
  it("rejects a response for another route", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      insight: {
        generatedBy: "model",
        rationale: { routeId: "another-route" },
        interventions: [{}, {}],
      },
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(requestRouteCityInsight({
      route: { routeId: "route-a", journeyLabel: "Route A", evidence: [], caveat: "Caveat" },
      sources: [],
      candidates: [],
    }, fetchImpl)).rejects.toThrow(/invalid response/);
  });

  it("rejects malformed intervention cards even when the route ID matches", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      insight: {
        generatedBy: "model",
        rationale: { routeId: "route-a" },
        interventions: [{}, {}],
      },
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(requestRouteCityInsight({
      route: {
        routeId: "route-a",
        journeyLabel: "Route A",
        evidence: [{ factId: "route-time", statement: "Route A takes 20 minutes.", sourceIds: ["source-a"] }],
        caveat: "A caveat",
      },
      sources: [{ sourceId: "source-a", label: "Source A", kind: "derived" }],
      candidates: [],
    }, fetchImpl)).rejects.toThrow(/invalid response/);
  });
});
