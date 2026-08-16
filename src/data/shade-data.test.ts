import { describe, expect, it } from "vitest";
import graph from "./pilot-osm.json";
import shade from "./pilot-shade.json";
import morningShadows from "./shadows/hour-7.json";
import eveningShadows from "./shadows/hour-19.json";

describe("derived shade snapshot", () => {
  it("covers every graph edge at every declared hour", () => {
    expect(shade.metadata.edgeCoverage).toBe(1);
    expect(shade.metadata.methodVersion).toBe("building-shadow-polyline-sampling-v2");
    expect(shade.metadata.sourceIds).toContain("openstreetmap");
    expect(Object.keys(shade.edgeShadeByHour)).toHaveLength(graph.edges.length);
    for (const edge of graph.edges) {
      expect(Object.keys(shade.edgeShadeByHour[edge.id as keyof typeof shade.edgeShadeByHour])).toHaveLength(shade.metadata.hours.length);
    }
  });

  it("contains bounded, time-varying derived values", () => {
    const values = Object.values(shade.edgeShadeByHour).flatMap((hours) => Object.values(hours));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(new Set(values).size).toBeGreaterThan(20);
  });

  it("provides distinct lazy overlay snapshots across the slider range", () => {
    expect(morningShadows.metadata.hour).toBe(7);
    expect(eveningShadows.metadata.hour).toBe(19);
    expect(morningShadows.features[0].geometry.coordinates).not.toEqual(eveningShadows.features[0].geometry.coordinates);
  });
});
