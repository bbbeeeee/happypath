import { describe, expect, it } from "vitest";
import { listCivicAssets, type TransitAsset } from "./civicAssets";
import {
  getPilotTransitEndpointCandidates,
  resolveTransitAssetsToGraphNodes,
} from "./transitEndpoints";

describe("transit endpoint resolution", () => {
  it("maps pilot transit entrances to nearby graph nodes with bounded geometric snaps", () => {
    const candidates = getPilotTransitEndpointCandidates();
    expect(candidates).toHaveLength(listCivicAssets(["transit"]).length);
    for (const candidate of candidates) {
      expect(candidate.asset.kind).toBe("transit");
      expect(candidate.graphNodeId).toBeTruthy();
      expect(candidate.snapDistanceMeters).toBeLessThanOrEqual(120);
      expect(candidate.snapBasis).toBe("straight_line_to_graph_node");
      expect(candidate.currentEntranceState).toBe("unknown");
      expect(candidate.liveServiceState).toBe("unknown");
      expect(candidate.accessibilityState).toBe("unknown");
    }
  });

  it("uses published entry permission only as an inventory filter", () => {
    const source = listCivicAssets(["transit"])[0] as TransitAsset;
    const graphNode = { id: "nearby", coordinate: source.coordinate };

    const entryCandidates = getPilotTransitEndpointCandidates({ requirePublishedEntry: true });
    const inventoryCandidates = getPilotTransitEndpointCandidates({ requirePublishedEntry: false });
    expect(entryCandidates.every(
      (candidate) => candidate.publishedEntryState !== "not_allowed",
    )).toBe(true);
    expect(entryCandidates.length).toBeLessThanOrEqual(inventoryCandidates.length);
    expect(resolveTransitAssetsToGraphNodes([graphNode], { maxSnapDistanceMeters: 0 })[0]?.graphNodeId).toBe("nearby");
  });

  it("handles missing graph coverage and invalid limits safely", () => {
    expect(resolveTransitAssetsToGraphNodes([])).toEqual([]);
    expect(getPilotTransitEndpointCandidates({ limit: 0 })).toEqual([]);
    expect(() => getPilotTransitEndpointCandidates({ maxSnapDistanceMeters: -1 })).toThrow("maxSnapDistanceMeters");
  });
});
