import { describe, expect, it } from "vitest";
import type { GraphEdge, JourneyRoute, PilotGraph } from "../types";
import { compareJourneyRoutes, routeComparisonDeltaGeoJSON } from "./routeComparisonPresentation";

function edge(id: string, from: string, to: string): GraphEdge {
  return {
    id,
    from,
    to,
    street: id,
    distanceMeters: 80,
    orientationDegrees: 0,
    canyonFactor: 0,
    treeFactor: 0,
    source: "modeled-demo",
  };
}

const graph: PilotGraph = {
  nodes: [
    { id: "a", name: "A", coordinate: [-74, 40.73] },
    { id: "shared", name: "Shared", coordinate: [-73.999, 40.73] },
    { id: "happy", name: "Happy", coordinate: [-73.998, 40.731] },
    { id: "fast", name: "Fast", coordinate: [-73.998, 40.729] },
    { id: "d", name: "D", coordinate: [-73.997, 40.73] },
  ],
  edges: [
    edge("shared-edge", "a", "shared"),
    edge("happy-1", "shared", "happy"),
    edge("happy-2", "happy", "d"),
    edge("fast-1", "shared", "fast"),
    edge("fast-2", "fast", "d"),
  ],
};

function route(overrides: Partial<JourneyRoute>): JourneyRoute {
  return {
    candidateId: "route",
    journeyShape: "destination",
    nodeIds: ["a", "shared", "d"],
    edgeIds: ["shared-edge"],
    endpointNodeId: "d",
    coordinates: [],
    distanceMeters: 0,
    durationMinutes: 10,
    directSunMinutes: 5,
    longestExposedMinutes: 3,
    mappedStepEdges: 0,
    greeneryPercent: 20,
    nearbyTreeCount: 0,
    adjacentParkNames: [],
    shadePercent: 50,
    streets: [],
    repeatedEdgeRatio: 0,
    preferenceScore: 0,
    extraMinutesVsBaseline: 0,
    ...overrides,
  };
}

describe("deterministic route comparison presentation", () => {
  it("recomputes paired metrics and retained hard requirements", () => {
    const baseline = route({ candidateId: "baseline", durationMinutes: 10, directSunMinutes: 6, longestExposedMinutes: 4, greeneryPercent: 20 });
    const recommended = route({ candidateId: "recommended", durationMinutes: 13, directSunMinutes: 2, longestExposedMinutes: 1.5, greeneryPercent: 27 });

    expect(compareJourneyRoutes(recommended, baseline, { avoidMappedSteps: true })).toEqual({
      recommendedCandidateId: "recommended",
      baselineCandidateId: "baseline",
      sameRoute: false,
      extraMinutes: 3,
      directSunMinutesSaved: 4,
      longestExposedMinutesSaved: 2.5,
      greeneryGainPoints: 7,
      mappedStepEdgeChange: 0,
      hardRequirements: {
        avoidMappedSteps: {
          requested: true,
          baselineSatisfied: true,
          recommendedSatisfied: true,
          retained: true,
        },
      },
    });
  });

  it("emits only the changed recommended and baseline traversals", () => {
    const baseline = route({
      candidateId: "baseline",
      nodeIds: ["a", "shared", "fast", "d"],
      edgeIds: ["shared-edge", "fast-1", "fast-2"],
    });
    const recommended = route({
      candidateId: "recommended",
      nodeIds: ["a", "shared", "happy", "d"],
      edgeIds: ["shared-edge", "happy-1", "happy-2"],
    });
    const delta = routeComparisonDeltaGeoJSON(recommended, baseline, graph);

    expect(delta.features.map((feature) => [feature.properties.routeRole, feature.properties.edgeId])).toEqual([
      ["recommended_only", "happy-1"],
      ["recommended_only", "happy-2"],
      ["baseline_only", "fast-1"],
      ["baseline_only", "fast-2"],
    ]);
    expect(delta.features.every((feature) => feature.geometry.coordinates.length >= 2)).toBe(true);
  });
});
