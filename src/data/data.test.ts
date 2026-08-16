import { describe, expect, it } from "vitest";
import buildings from "./pilot-buildings.json";
import graph from "./pilot-osm.json";
import registry from "./source-registry.json";
import greenery from "./pilot-greenery.json";

function distance(a: number[], b: number[]) {
  return Math.hypot((b[1] - a[1]) * 111_111, (b[0] - a[0]) * 84_200);
}

describe("pilot data contract", () => {
  it("records complete source-registry provenance", () => {
    for (const source of registry.sources) {
      expect(source.source_id).toBeTruthy();
      expect(source.dataset_url).toMatch(/^https:/);
      expect(source.retrieved_at).toBeTruthy();
      if (source.snapshot_hash) expect(source.snapshot_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(["pending", "cataloged"]).toContain(source.validation_status);
      if (source.validation_status === "cataloged") {
        expect(["reference_only", "live_reference"]).toContain(source.capability_status);
        expect(source.last_successful_ingest).toBeNull();
      }
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
    expect(greenery.metadata.methodVersion).toBe("tree-park-polyline-adjacency-v2");
    expect(greenery.metadata.sourceIds).toContain("openstreetmap");
    for (const edge of Object.values(greenery.edgeGreenery)) {
      expect(edge.score).toBeGreaterThanOrEqual(0);
      expect(edge.score).toBeLessThanOrEqual(1);
    }
  });

  it("preserves complete OSM way geometry and derives edge length from the polyline", () => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    expect(graph.metadata.graphEvidence).toBe("community");
    expect(graph.metadata.shadeEvidence).toBe("derived");
    expect(graph.metadata.audit.edgesWithGeometry).toBe(graph.edges.length);
    expect(graph.metadata.audit.geometryPointCount).toBeGreaterThan(graph.edges.length * 2);
    expect(graph.metadata.audit.curvedEdges).toBeGreaterThan(0);

    let meaningfullyCurvedEdges = 0;
    for (const edge of graph.edges) {
      expect(edge.source).toBe("openstreetmap");
      expect(edge.geometry.length).toBeGreaterThanOrEqual(2);
      expect(edge.geometry[0]).toEqual(nodeById.get(edge.from)!.coordinate);
      expect(edge.geometry.at(-1)).toEqual(nodeById.get(edge.to)!.coordinate);
      const polylineMeters = edge.geometry.slice(1).reduce(
        (sum, coordinate, index) => sum + distance(edge.geometry[index], coordinate),
        0,
      );
      expect(polylineMeters).toBeCloseTo(edge.distanceMeters, 5);
      if (polylineMeters - distance(edge.geometry[0], edge.geometry.at(-1)!) > 0.5) meaningfullyCurvedEdges += 1;
    }
    expect(meaningfullyCurvedEdges).toBeGreaterThan(0);
  });
});
