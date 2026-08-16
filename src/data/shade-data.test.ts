import { describe, expect, it } from "vitest";
import graph from "./pilot-osm.json";
import shade from "./pilot-shade.json";
import bootstrapGraph from "./graph/bootstrap.json";
import bootstrapShade from "./shade/bootstrap.json";
import villageGraph from "./graph/village.json";
import villageShade from "./shade/village.json";
import morningShadows from "./shadows/village-col-1/hour-7.json";
import eveningShadows from "./shadows/village-col-1/hour-19.json";
import { assertShadeEvidenceCoverage } from "../routing/shade";
import { defaultOrigin, pilotGraph } from "./cityGraph";
import { planJourney } from "../routing/journey";
import { evaluateShadeDetourScenario } from "../detour/shadeScenario";
import type { GraphEdge } from "../types";

describe("derived shade snapshot", () => {
  it("covers every graph edge at every declared hour", () => {
    expect(shade.metadata.edgeCoverage).toBe(1);
    expect(shade.metadata.methodVersion).toBe("building-shadow-polyline-sampling-v4-coherent-partitions");
    expect(shade.metadata.graphGeneratedAt).toBe(graph.metadata.generatedAt);
    expect(shade.metadata.graphEdgeCount).toBe(graph.edges.length);
    expect(shade.metadata.sourceIds).toContain("openstreetmap");
    expect(Object.keys(shade.edgeShadeByHour)).toHaveLength(graph.edges.length);
    for (const edge of graph.edges) {
      expect(Object.keys(shade.edgeShadeByHour[edge.id as keyof typeof shade.edgeShadeByHour])).toHaveLength(shade.metadata.hours.length);
    }
  });

  it("contains bounded, time-varying derived values", () => {
    const values = Object.values(shade.edgeShadeByHour).flatMap((hours) => Object.values(hours));
    const bounds = values.reduce((result, value) => ({
      minimum: Math.min(result.minimum, value),
      maximum: Math.max(result.maximum, value),
    }), { minimum: Number.POSITIVE_INFINITY, maximum: Number.NEGATIVE_INFINITY });
    expect(bounds.minimum).toBeGreaterThanOrEqual(0);
    expect(bounds.maximum).toBeLessThanOrEqual(1);
    expect(new Set(values).size).toBeGreaterThan(20);
  });

  it.each([
    ["bootstrap", bootstrapGraph, bootstrapShade],
    ["village", villageGraph, villageShade],
  ])("keeps the %s route graph and shade evidence on the same generation", (_name, partitionGraph, partitionShade) => {
    expect(partitionShade.metadata.graphGeneratedAt).toBe(partitionGraph.metadata.generatedAt);
    expect(partitionShade.metadata.edgeCount).toBe(partitionGraph.edges.length);
    expect(Object.keys(partitionShade.edgeShadeByHour).sort()).toEqual(partitionGraph.edges.map((edge) => edge.id).sort());
  });

  it("refuses to present a route when one segment lacks shade evidence", () => {
    expect(() => assertShadeEvidenceCoverage([
      ...(bootstrapGraph.edges as unknown as GraphEdge[]),
      { ...(bootstrapGraph.edges[0] as unknown as GraphEdge), id: "stale-edge-from-another-graph" },
    ], bootstrapGraph.metadata.generatedAt)).toThrow(/1 walking segment/i);
  });

  it("keeps the 7 PM planning sample consistent with the visible shadow field", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "loop",
      originNodeId: defaultOrigin,
      departureHour: 19,
      walkingBudgetMinutes: 30,
      preferences: [{ featureId: "shade", weight: 1 }],
    }, { walkingTimeIntent: "target" });
    const routes = [result.recommended, result.baseline, ...result.alternatives]
      .filter((route, index, candidates) => route
        && candidates.findIndex((candidate) => candidate?.candidateId === route.candidateId) === index);
    const scenario = evaluateShadeDetourScenario(pilotGraph, {
      departureHour: 19,
      journeys: routes.map((route, index) => ({ id: route!.candidateId, label: `Route ${index + 1}`, route: route! })),
      intervention: { targetShadePercent: 45 },
    });
    const averageDirectSunMinutes = scenario!.burden.baseline / scenario!.journeyCounts.totalWeight;

    expect(routes.every((route) => route!.shadePercent > 95)).toBe(true);
    expect(averageDirectSunMinutes).toBeLessThan(2);
  });

  it("provides distinct lazy overlay snapshots across the slider range", () => {
    expect(morningShadows.metadata.hour).toBe(7);
    expect(eveningShadows.metadata.hour).toBe(19);
    expect(morningShadows.features[0].geometry.coordinates).not.toEqual(eveningShadows.features[0].geometry.coordinates);
  });
});
