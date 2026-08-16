import { describe, expect, it } from "vitest";
import { defaultDestination, defaultOrigin, pilotGraph } from "../data/cityGraph";
import { planJourney } from "../routing/journey";
import type { JourneyRoute, PilotGraph } from "../types";
import {
  buildShadeDetourScenario,
  describeShadeInterventionLocation,
  evaluateShadeDetourScenario,
} from "./shadeScenario";

const planningGraph: PilotGraph = {
  nodes: [
    { id: "a", name: "Point A", coordinate: [-74.001, 40.73] },
    { id: "b", name: "Point B", coordinate: [-74, 40.73] },
    { id: "c", name: "Point C", coordinate: [-73.999, 40.73] },
    { id: "d", name: "Point D", coordinate: [-73.998, 40.73] },
  ],
  edges: [
    {
      id: "walkway",
      from: "a",
      to: "b",
      street: "Unnamed pedestrian way",
      distanceMeters: 80,
      orientationDegrees: 90,
      canyonFactor: 0,
      treeFactor: 0,
      source: "openstreetmap",
      osm: { wayId: 1, highway: "footway", access: null, foot: null, steps: false },
    },
    {
      id: "broadway",
      from: "b",
      to: "c",
      street: "Broadway",
      distanceMeters: 80,
      orientationDegrees: 90,
      canyonFactor: 0,
      treeFactor: 0,
      source: "openstreetmap",
    },
    {
      id: "mercer",
      from: "c",
      to: "d",
      street: "Mercer Street",
      distanceMeters: 80,
      orientationDegrees: 90,
      canyonFactor: 0,
      treeFactor: 0,
      source: "openstreetmap",
    },
  ],
};

function route(id: string, edgeIds: string[], directSunMinutes: number): JourneyRoute {
  const coordinates = edgeIds.flatMap((edgeId, index) => {
    const edge = planningGraph.edges.find((candidate) => candidate.id === edgeId)!;
    const from = planningGraph.nodes.find((node) => node.id === edge.from)!.coordinate;
    const to = planningGraph.nodes.find((node) => node.id === edge.to)!.coordinate;
    return index === 0 ? [from, to] : [to];
  });
  return {
    candidateId: id,
    journeyShape: "destination",
    edgeIds,
    endpointNodeId: planningGraph.edges.find((edge) => edge.id === edgeIds.at(-1))!.to,
    nodeIds: [],
    coordinates,
    distanceMeters: edgeIds.length * 80,
    durationMinutes: edgeIds.length,
    directSunMinutes,
    longestExposedMinutes: directSunMinutes,
    mappedStepEdges: 0,
    greeneryPercent: 0,
    nearbyTreeCount: 0,
    adjacentParkNames: [],
    shadePercent: 0,
    streets: edgeIds.map((edgeId) => planningGraph.edges.find((edge) => edge.id === edgeId)!.street),
    repeatedEdgeRatio: 0,
    preferenceScore: 0,
    extraMinutesVsBaseline: 0,
  };
}

describe("buildShadeDetourScenario", () => {
  it("reuses a returned route and never increases direct-sun burden", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 14,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 1 }],
    });
    const scenario = buildShadeDetourScenario(pilotGraph, result.recommended, 14);
    expect(scenario).not.toBeNull();
    expect(scenario!.status).toBe("hypothetical");
    expect(scenario!.scenarioDirectSunMinutes).toBeLessThanOrEqual(scenario!.baselineDirectSunMinutes);
    expect(scenario!.sourceIds).toContain("building-shadow-model");
    expect(scenario!.journeyCounts.evaluated).toBe(1);
    expect(scenario!.journeyCounts.routesChanged).toBe(0);
  });

  it("shows no fabricated benefit when the sun is below the horizon", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 23,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 1 }],
    });
    const scenario = buildShadeDetourScenario(pilotGraph, result.recommended, 23);
    expect(scenario?.avoidedDirectSunMinutes).toBe(0);
  });

  it("evaluates an adjustable selected-edge intervention across a transparent journey sample", () => {
    const scenario = evaluateShadeDetourScenario(planningGraph, {
      departureHour: 14,
      intervention: {
        edgeIds: ["walkway"],
        targetShadePercent: 50,
        label: "Temporary summer canopy",
      },
      journeys: [
        { id: "home-library", label: "Home to library", route: route("route-a", ["walkway", "broadway"], 2), weight: 2 },
        { id: "station-park", label: "Station to park", route: route("route-b", ["broadway", "mercer"], 2) },
      ],
    });

    expect(scenario).not.toBeNull();
    expect(scenario!.modeledIntervention).toEqual({
      label: "Temporary summer canopy",
      targetShadePercent: 50,
      edgeIds: ["walkway"],
    });
    expect(scenario!.street).toBe("Walkway near Broadway");
    expect(scenario!.title).not.toMatch(/unnamed|pedestrian way|pedestrian path/i);
    expect(scenario!.selection.totalLengthMeters).toBe(80);
    expect(scenario!.selection.geojson.features[0].geometry.coordinates).toEqual([
      [-74.001, 40.73],
      [-74, 40.73],
    ]);
    expect(scenario!.burden.baseline).toBeCloseTo(6);
    expect(scenario!.burden.scenario).toBeCloseTo(5);
    expect(scenario!.burden.avoided).toBeCloseTo(1);
    expect(scenario!.journeyCounts).toMatchObject({
      evaluated: 2,
      touchingIntervention: 1,
      withChangedBurden: 1,
      unchangedBurden: 1,
      routesChanged: 0,
      routesUnchanged: 2,
      totalWeight: 3,
      improvedWeight: 2,
    });
    expect(scenario!.journeyComparisons[0]).toMatchObject({
      journeyId: "home-library",
      baselineDirectSunMinutes: 2,
      scenarioDirectSunMinutes: 1.5,
      avoidedDirectSunMinutes: 0.5,
      routeChanged: false,
    });
    expect(scenario!.summary).toBe("1 of 2 route options would spend less time in estimated direct sun.");
    expect(scenario!.caveat).toMatch(/Hypothetical shade estimate/);
  });

  it("uses friendly fallback location copy for raw map placeholders", () => {
    const edge = planningGraph.edges[0];
    expect(describeShadeInterventionLocation(planningGraph, edge)).toBe("Walkway near Broadway");
    expect(describeShadeInterventionLocation({ ...planningGraph, edges: [edge] }, edge)).toBe("the selected walkway");
  });

  it("rejects invalid target percentages and unknown selected edges", () => {
    const journey = { id: "sample", route: route("route-a", ["walkway", "broadway"], 2) };
    expect(() => evaluateShadeDetourScenario(planningGraph, {
      departureHour: 14,
      intervention: { targetShadePercent: 101 },
      journeys: [journey],
    })).toThrow(/between zero and 100/);
    expect(() => evaluateShadeDetourScenario(planningGraph, {
      departureHour: 14,
      intervention: { targetShadePercent: 80, edgeIds: ["missing"] },
      journeys: [journey],
    })).toThrow(/Unknown intervention edge/);
  });
});
