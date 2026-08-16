import { describe, expect, it } from "vitest";
import { AMENITY_CLUSTER_COUNT_LAYOUT } from "./amenityOverview";

describe("amenity cluster rendering", () => {
  it("keeps every cluster count visible when other map labels overlap it", () => {
    expect(AMENITY_CLUSTER_COUNT_LAYOUT["text-field"]).toEqual(["to-string", ["get", "count"]]);
    expect(AMENITY_CLUSTER_COUNT_LAYOUT["text-allow-overlap"]).toBe(true);
    expect(AMENITY_CLUSTER_COUNT_LAYOUT["text-ignore-placement"]).toBe(true);
  });
});
