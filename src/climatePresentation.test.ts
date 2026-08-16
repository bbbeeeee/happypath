import { describe, expect, it } from "vitest";
import { pilotGraph } from "./data/cityGraph";
import {
  rainContextFromPrompt,
  rainPromptIntent,
  resolveShadeHour,
  routeShadeSegmentsGeoJSON,
} from "./climatePresentation";
import type { JourneyRoute } from "./types";

function routeFromFirstEdge(): JourneyRoute {
  const edge = pilotGraph.edges[0];
  const start = pilotGraph.nodes.find((node) => node.id === edge.from)!;
  const end = pilotGraph.nodes.find((node) => node.id === edge.to)!;
  return {
    candidateId: "test-route",
    journeyShape: "destination",
    nodeIds: [start.id, end.id],
    edgeIds: [edge.id],
    endpointNodeId: end.id,
    coordinates: [start.coordinate, end.coordinate],
    distanceMeters: edge.distanceMeters,
    durationMinutes: edge.distanceMeters / 80,
    directSunMinutes: 0,
    longestExposedMinutes: 0,
    mappedStepEdges: 0,
    greeneryPercent: 0,
    nearbyTreeCount: 0,
    adjacentParkNames: [],
    shadePercent: 0,
    streets: [edge.street],
    repeatedEdgeRatio: 0,
    preferenceScore: 0,
    extraMinutesVsBaseline: 0,
  };
}

describe("demo climate context", () => {
  it.each([
    "It's raining—find me a more comfortable walk.",
    "A rainy 20-minute wander, please.",
    "Keep me dry on the way to the park.",
    "I brought an umbrella; favor cover.",
  ])("recognizes rain intent without inventing live weather: %s", (prompt) => {
    const context = rainContextFromPrompt(prompt);
    expect(context).toMatchObject({
      condition: "rain",
      source: "user_prompt",
      routePreference: { id: "likely_cover" },
    });
    expect(context?.evidence.currentConditionsVerified).toBe(false);
    expect(context?.evidence.detail).toMatch(/live version/i);
    expect(context?.evidence.detail).not.toMatch(/stay dry|keeps? you dry/i);
  });

  it("does not confuse train with rain or add weather to an ordinary request", () => {
    expect(rainContextFromPrompt("Wander toward the train for 25 minutes.")).toBeNull();
    expect(rainContextFromPrompt("Find a shady route to the park.")).toBeNull();
  });

  it("distinguishes removing rain from an unrelated refinement", () => {
    expect(rainPromptIntent("It is not raining anymore")).toBe("off");
    expect(rainPromptIntent("No rain now—make it greener instead")).toBe("off");
    expect(rainPromptIntent("Keep the bathroom")).toBe("unspecified");
    expect(rainContextFromPrompt("It is not raining anymore")).toBeNull();
  });
});

describe("shade segment presentation", () => {
  it("resolves the nearest available hour deterministically", () => {
    expect(resolveShadeHour(6)).toBe(7);
    expect(resolveShadeHour(15.7)).toBe(16);
    expect(resolveShadeHour(22)).toBe(19);
  });

  it("emits one visual feature per traversal with bounded evidence", () => {
    const route = routeFromFirstEdge();
    const presentation = routeShadeSegmentsGeoJSON(route, pilotGraph, 14.2);
    expect(presentation.features).toHaveLength(route.edgeIds.length);
    expect(presentation.metadata).toMatchObject({
      requestedHour: 14.2,
      resolvedHour: 14,
      timeLabel: "2 PM",
    });
    const feature = presentation.features[0];
    expect(feature.id).toBe("test-route:0");
    expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(feature.properties.shadeShare).toBeGreaterThanOrEqual(0);
    expect(feature.properties.shadeShare).toBeLessThanOrEqual(1);
    expect(feature.properties.directSunShare).toBeCloseTo(1 - feature.properties.shadeShare, 8);
    expect(feature.properties.label).toMatch(/estimated shade at 2 PM/i);
    expect(["mostly_shaded", "mixed", "mostly_sunny"]).toContain(feature.properties.shadeBand);
  });

  it("keeps repeated traversals and makes missing graph evidence explicit", () => {
    const base = routeFromFirstEdge();
    const repeated = {
      ...base,
      journeyShape: "loop" as const,
      nodeIds: [base.nodeIds[0], base.nodeIds[1], base.nodeIds[0]],
      edgeIds: [base.edgeIds[0], base.edgeIds[0]],
    };
    const presentation = routeShadeSegmentsGeoJSON(repeated, pilotGraph, 12);
    expect(presentation.features.map((feature) => feature.id)).toEqual(["test-route:0", "test-route:1"]);
    expect(presentation.features[1].geometry.coordinates).toEqual(
      [...presentation.features[0].geometry.coordinates].reverse(),
    );

    expect(() => routeShadeSegmentsGeoJSON(
      { ...base, edgeIds: ["missing-edge"] },
      pilotGraph,
      12,
    )).toThrow("unknown edge missing-edge");
  });
});
