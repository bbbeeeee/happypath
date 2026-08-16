import { describe, expect, it } from "vitest";
import { demoCoverGeoJSON, pickRainFriendlyRoute, routeCoverShare } from "./demoCover";
import type { JourneyResult, JourneyRoute, PilotGraph } from "./types";

const graph: PilotGraph = {
  nodes: [
    { id: "a", name: "A", coordinate: [-74, 40.7] },
    { id: "b", name: "B", coordinate: [-73.999, 40.7] },
    { id: "c", name: "C", coordinate: [-73.998, 40.7] },
  ],
  edges: [
    { id: "covered-9", from: "a", to: "b", street: "", distanceMeters: 100, orientationDegrees: 0, canyonFactor: 1, treeFactor: 0, source: "modeled-demo" },
    { id: "open-1", from: "b", to: "c", street: "Broadway", distanceMeters: 100, orientationDegrees: 0, canyonFactor: 0, treeFactor: 0, source: "modeled-demo" },
  ],
};

function route(id: string, edgeId: string): JourneyRoute {
  return {
    candidateId: id, journeyShape: "wander", nodeIds: ["a", "b"], edgeIds: [edgeId], endpointNodeId: "b",
    coordinates: [[-74, 40.7], [-73.999, 40.7]], distanceMeters: 100, durationMinutes: 1.25,
    directSunMinutes: 1, longestExposedMinutes: 1, mappedStepEdges: 0, greeneryPercent: 0,
    nearbyTreeCount: 0, adjacentParkNames: [], shadePercent: 20, streets: [], repeatedEdgeRatio: 0,
    preferenceScore: 0, extraMinutesVsBaseline: null,
  };
}

describe("demo cover presentation", () => {
  it("builds a deterministic and plain-language cover layer", () => {
    const first = demoCoverGeoJSON(graph);
    expect(first).toEqual(demoCoverGeoJSON(graph));
    expect(first.features.every((feature) => !feature.properties.street.toLowerCase().includes("unnamed"))).toBe(true);
  });

  it("selects the route with more demo cover", () => {
    const routes = graph.edges.map((edge) => route(edge.id, edge.id));
    const result = { recommended: routes[0], alternatives: [routes[1]], baseline: null, brief: {} as never, evaluatedCandidateCount: 2 } as JourneyResult;
    const picked = pickRainFriendlyRoute(result, graph);
    expect(routeCoverShare(picked, graph)).toBeGreaterThanOrEqual(routeCoverShare(routes[0], graph));
  });

  it("never trades away a target-duration band for cover", () => {
    const targetRoute = { ...route("target", "open-1"), durationMinutes: 28 };
    const tooShort = { ...route("short", "covered-9"), durationMinutes: 15 };
    const result = {
      recommended: targetRoute,
      alternatives: [tooShort],
      baseline: null,
      brief: {} as never,
      evaluatedCandidateCount: 2,
      timing: {
        intent: "target" as const,
        requestedMinutes: 30,
        targetRangeMinutes: { minimum: 27, maximum: 33 },
      },
    };

    expect(pickRainFriendlyRoute(result, graph).candidateId).toBe("target");
  });
});
