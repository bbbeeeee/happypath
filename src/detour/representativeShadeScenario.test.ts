import { beforeAll, describe, expect, it } from "vitest";
import frozenResultJson from "../data/detour/seward-park-shade-result.json";
import { ensureGraphCoverage, pilotGraph } from "../data/cityGraph";
import type { GraphEdge, PilotGraph } from "../types";
import {
  classifyRepresentativeBurdenEffect,
  generateRepresentativeShadeScenario,
  representativeShadeFixture,
  selectRepeatedShadeGap,
  type RepresentativeShadeScenarioResult,
} from "./representativeShadeScenario";

const frozenResult = frozenResultJson as unknown as RepresentativeShadeScenarioResult;

beforeAll(async () => {
  const coordinates = representativeShadeFixture.journeys.flatMap((journey) => [
    journey.origin.coordinate,
    representativeShadeFixture.destination.coordinate,
  ]);
  await ensureGraphCoverage(coordinates, 1);
}, 60_000);

describe("representative shade scenario", () => {
  it("regenerates the checked-in result deterministically", () => {
    expect(generateRepresentativeShadeScenario(pilotGraph)).toEqual(frozenResult);
  }, 60_000);

  it("uses the same frozen cohort and route policy before and after", () => {
    const expectedJourneyIds = representativeShadeFixture.journeys.map((journey) => journey.id);
    expect(frozenResult.cohort).toMatchObject({
      type: "frozen public-anchor cohort",
      journeyIds: expectedJourneyIds,
      journeyCount: 6,
      totalWeight: 6,
    });
    expect(frozenResult.interventions).toHaveLength(2);
    for (const intervention of frozenResult.interventions) {
      expect(intervention.cohortJourneyIds).toEqual(expectedJourneyIds);
      expect(intervention.routePolicy).toEqual(representativeShadeFixture.routePolicy);
      expect(intervention.journeys.map((journey) => journey.journeyId)).toEqual(expectedJourneyIds);
      expect(intervention.journeys.every((journey) => journey.baselineRoute.edgeIds.length > 0)).toBe(true);
      expect(intervention.summary.remaining).toBe(intervention.summary.scenario);
    }
  });

  it("reports primary and lower-impact outcomes without hiding route changes", () => {
    const primary = frozenResult.interventions.find((intervention) => intervention.role === "primary")!;
    const alternative = frozenResult.interventions.find((intervention) => intervention.role === "alternative")!;
    expect(primary.targetShadePercent).toBe(80);
    expect(alternative.targetShadePercent).toBe(60);
    expect(primary.summary).toMatchObject({
      evaluated: 6,
      improved: 6,
      unchanged: 0,
      worsened: 0,
      routesChanged: 2,
      routesUnchanged: 4,
    });
    expect(primary.summary.avoided).toBeGreaterThan(alternative.summary.avoided);
    expect(primary.summary.remaining).toBeLessThan(alternative.summary.remaining);
    const changed = primary.journeys.filter((journey) => journey.routeChanged);
    expect(changed).toHaveLength(primary.summary.routesChanged);
    expect(changed.every((journey) => journey.baselineRoute.edgeIds.join("|")
      !== journey.scenarioRoute.edgeIds.join("|"))).toBe(true);
  });

  it("keeps evidence provenance and material limitations beside the result", () => {
    expect(frozenResult.evidence.sourceIds).toEqual([
      "mta-subway-entrances-2024",
      "nyc-parks-drinking-fountains",
      "openstreetmap",
      "nyc-building-footprints",
      "building-shadow-model",
    ]);
    expect(frozenResult.evidence.limitations.join(" ")).toMatch(/not observed individual app usage/i);
    expect(frozenResult.evidence.limitations.join(" ")).toMatch(/operation and water availability are unknown/i);
    expect(frozenResult.evidence.limitations.join(" ")).toMatch(/validation status is pending/i);
    expect(frozenResult.selectedGap.label).toBe("Rutgers Street entrance and central path through Seward Park");
    expect(frozenResult.selectedGap.label).not.toMatch(/unnamed|unknown|unmapped/i);
  });

  it("classifies improved, unchanged, and worsened journey burdens explicitly", () => {
    expect(classifyRepresentativeBurdenEffect(5, 4)).toBe("improved");
    expect(classifyRepresentativeBurdenEffect(5, 5)).toBe("unchanged");
    expect(classifyRepresentativeBurdenEffect(5, 6)).toBe("worsened");
  });

  it("breaks otherwise equal gap-selection ties by stable edge ID", () => {
    const edge = (id: string, from: string, to: string): GraphEdge => ({
      id,
      from,
      to,
      street: "Test Street",
      distanceMeters: 80,
      orientationDegrees: 0,
      canyonFactor: 0,
      treeFactor: 0,
      source: "modeled-demo",
    });
    const graph: PilotGraph = {
      nodes: ["a1", "a2", "b1", "b2"].map((id, index) => ({ id, name: id, coordinate: [index, 0] })),
      edges: [edge("b-edge", "b1", "b2"), edge("a-edge", "a1", "a2")],
    };
    const routes = [
      { journeyId: "journey-b", edgeIds: ["b-edge", "a-edge"], weight: 1 },
      { journeyId: "journey-a", edgeIds: ["a-edge", "b-edge"], weight: 1 },
    ];
    expect(selectRepeatedShadeGap(graph, routes, 15, 80, 2, 0.01)?.edgeIds).toEqual(["a-edge"]);
    expect(selectRepeatedShadeGap(graph, [...routes].reverse(), 15, 80, 2, 0.01)?.edgeIds).toEqual(["a-edge"]);
  });
});
