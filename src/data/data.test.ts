import { describe, expect, it } from "vitest";
import buildings from "./pilot-buildings.json";
import registry from "./source-registry.json";
import greenery from "./pilot-greenery.json";

describe("pilot data contract", () => {
  it("records complete source-registry provenance", () => {
    for (const source of registry.sources) {
      expect(source.source_id).toBeTruthy();
      expect(source.dataset_url).toMatch(/^https:/);
      expect(source.retrieved_at).toBeTruthy();
      if (source.snapshot_hash) expect(source.snapshot_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(source.validation_status).toBe("pending");
    }
  });

  it("crops official buildings and audits roof heights", () => {
    expect(buildings.features.length).toBeGreaterThan(100);
    expect(buildings.metadata.sourceIds).toContain("nyc-building-footprints");
    expect(buildings.metadata.audit.usableHeightShare).toBeGreaterThan(0.9);
    expect(buildings.metadata.audit.invalidHeightCount).toBe(0);
  });

  it("covers every edge with bounded tree and park adjacency evidence", () => {
    expect(greenery.metadata.treeCount).toBeGreaterThan(100);
    expect(greenery.metadata.parkPropertyCount).toBeGreaterThan(0);
    expect(greenery.metadata.edgeCoverage).toBe(1);
    for (const edge of Object.values(greenery.edgeGreenery)) {
      expect(edge.score).toBeGreaterThanOrEqual(0);
      expect(edge.score).toBeLessThanOrEqual(1);
    }
  });
});
