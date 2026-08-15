import { describe, expect, it } from "vitest";
import { defaultDestination, defaultOrigin, pilotGraph } from "../data/cityGraph";
import { compareRoutes } from "./route";
import type { PilotGraph } from "../types";

describe("compareRoutes", () => {
  it("returns connected routes between the requested points", () => {
    const result = compareRoutes(pilotGraph, defaultOrigin, defaultDestination, 15);
    expect(result.fastest.nodeIds[0]).toBe(defaultOrigin);
    expect(result.fastest.nodeIds.at(-1)).toBe(defaultDestination);
    expect(result.recommended.nodeIds[0]).toBe(defaultOrigin);
    expect(result.recommended.nodeIds.at(-1)).toBe(defaultDestination);
  });

  it("keeps the recommendation inside the detour limit", () => {
    const result = compareRoutes(pilotGraph, defaultOrigin, defaultDestination, 15, 0.25);
    expect(result.recommended.distanceMeters).toBeLessThanOrEqual(result.fastest.distanceMeters * 1.25 + 0.01);
    expect(result.recommended.directSunMinutes).toBeLessThanOrEqual(result.fastest.directSunMinutes);
  });

  it("treats nighttime walking as fully shaded", () => {
    const result = compareRoutes(pilotGraph, defaultOrigin, defaultDestination, 22);
    expect(result.fastest.directSunMinutes).toBe(0);
    expect(result.fastest.shadePercent).toBe(100);
  });

  it("uses a connected grounded graph snapshot", () => {
    expect(pilotGraph.metadata?.sourceIds).toContain("openstreetmap");
    expect(pilotGraph.metadata?.audit.edges).toBe(pilotGraph.edges.length);
    expect(pilotGraph.metadata?.audit.largestComponentShare).toBeGreaterThan(0.8);
  });

  it("treats mapped-step avoidance as a hard exclusion", () => {
    const graph: PilotGraph = {
      nodes: [
        { id: "a", name: "A", coordinate: [-74, 40.73] },
        { id: "b", name: "B", coordinate: [-73.999, 40.73] },
        { id: "c", name: "C", coordinate: [-73.9995, 40.731] },
      ],
      edges: [
        { id: "steps", from: "a", to: "b", street: "Mapped steps", distanceMeters: 100, orientationDegrees: 90, canyonFactor: 0, treeFactor: 0, source: "modeled-demo", osm: { wayId: 1, highway: "steps", access: null, foot: null, steps: true } },
        { id: "alternate-1", from: "a", to: "c", street: "Ramp way", distanceMeters: 80, orientationDegrees: 0, canyonFactor: 0, treeFactor: 0, source: "modeled-demo" },
        { id: "alternate-2", from: "c", to: "b", street: "Ramp way", distanceMeters: 80, orientationDegrees: 180, canyonFactor: 0, treeFactor: 0, source: "modeled-demo" },
      ],
    };
    expect(compareRoutes(graph, "a", "b", 15).fastest.mappedStepEdges).toBe(1);
    const avoided = compareRoutes(graph, "a", "b", 15, 0.25, true);
    expect(avoided.fastest.nodeIds).toEqual(["a", "c", "b"]);
    expect(avoided.fastest.mappedStepEdges).toBe(0);
  });

  it("reports an unavailable constrained route instead of relaxing it", () => {
    const graph: PilotGraph = {
      nodes: [{ id: "a", name: "A", coordinate: [-74, 40.73] }, { id: "b", name: "B", coordinate: [-73.999, 40.73] }],
      edges: [{ id: "only-steps", from: "a", to: "b", street: "Mapped steps", distanceMeters: 100, orientationDegrees: 90, canyonFactor: 0, treeFactor: 0, source: "modeled-demo", osm: { wayId: 1, highway: "steps", access: null, foot: null, steps: true } }],
    };
    expect(() => compareRoutes(graph, "a", "b", 15, 0.25, true)).toThrow("No route found");
  });

  it("ranks Greener separately from Shade inside the detour cap", () => {
    const result = compareRoutes(pilotGraph, defaultOrigin, defaultDestination, 15, 0.25, false, "green");
    expect(result.recommended.greeneryPercent).toBeGreaterThanOrEqual(result.fastest.greeneryPercent);
    expect(result.recommended.distanceMeters).toBeLessThanOrEqual(result.fastest.distanceMeters * 1.25 + 0.01);
    expect(result.greeneryGainPoints).toBeGreaterThanOrEqual(0);
  });
});
