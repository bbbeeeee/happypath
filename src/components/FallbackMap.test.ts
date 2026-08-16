import { describe, expect, it } from "vitest";
import { fallbackMapBounds } from "./FallbackMap";
import type { JourneyRoute, PilotGraph } from "../types";

describe("fallbackMapBounds", () => {
  it("frames the generated route even when it crosses a lazily loaded graph partition", () => {
    const graph = { metadata: { pilotBbox: [40.728, -74.0195, 40.742, -73.958] }, nodes: [], edges: [] } as unknown as PilotGraph;
    const route = {
      coordinates: [[-73.994, 40.7272], [-73.988, 40.7264], [-73.991, 40.731]],
    } as unknown as JourneyRoute;

    const [south, west, north, east] = fallbackMapBounds(graph, route);

    expect(south).toBeLessThan(40.7264);
    expect(north).toBeGreaterThan(40.731);
    expect(west).toBeLessThan(-73.994);
    expect(east).toBeGreaterThan(-73.988);
    expect(north - south).toBeLessThan(0.02);
  });
});
