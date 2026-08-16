import { describe, expect, it } from "vitest";
import registry from "./source-registry.json";
import {
  findCivicAssetsNearRoute,
  getCivicAssetSource,
  listCivicAssets,
  loadCivicAssetFixture,
} from "./civicAssets";

const fixture = loadCivicAssetFixture();

describe("pilot civic asset fixture", () => {
  it("contains all three official pilot asset layers with provenance", () => {
    expect(fixture.counts.seating).toBeGreaterThan(0);
    expect(fixture.counts.restroom).toBeGreaterThan(0);
    expect(fixture.counts.drinking_fountain).toBeGreaterThan(0);
    expect(fixture.counts.transit).toBeGreaterThan(0);
    expect(fixture.assets).toHaveLength(
      fixture.counts.seating + fixture.counts.restroom + fixture.counts.drinking_fountain + fixture.counts.transit,
    );

    for (const [sourceId, datasetId] of [
      ["nyc-dot-seating", "esmy-s8q5"],
      ["nyc-public-restrooms", "i7jb-7jku"],
      ["nyc-parks-drinking-fountains", "qnv7-p7a2"],
      ["mta-subway-entrances-2024", "i9wp-a4ja"],
    ]) {
      const source = getCivicAssetSource(sourceId);
      expect(source?.datasetId).toBe(datasetId);
      expect(source?.authority).toBe("official");
      expect(source?.sourceUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(source?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(source?.snapshotHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(source?.allowedClaims.length).toBeGreaterThan(0);
      expect(source?.prohibitedClaims.join(" ")).toMatch(/now|guarantee|complete/i);
      expect(source?.currentOperationVerified).toBe(false);
      expect(registry.sources.find((entry) => entry.source_id === sourceId)?.dataset_id).toBe(datasetId);
    }
  });

  it("keeps every normalized point unique and inside the pilot bbox", () => {
    const [south, west, north, east] = fixture.pilotBbox;
    expect(new Set(fixture.assets.map((asset) => asset.id)).size).toBe(fixture.assets.length);
    for (const asset of fixture.assets) {
      expect(asset.coordinate[0]).toBeGreaterThanOrEqual(west);
      expect(asset.coordinate[0]).toBeLessThanOrEqual(east);
      expect(asset.coordinate[1]).toBeGreaterThanOrEqual(south);
      expect(asset.coordinate[1]).toBeLessThanOrEqual(north);
      expect(fixture.sources[asset.sourceId]).toBeTruthy();
    }
  });

  it("never turns a published inventory status into current operation", () => {
    const restroom = listCivicAssets(["restroom"]).find((asset) => asset.kind === "restroom");
    const fountain = listCivicAssets(["drinking_fountain"]).find((asset) => asset.kind === "drinking_fountain");
    const seating = listCivicAssets(["seating"]).find((asset) => asset.kind === "seating");
    const transit = listCivicAssets(["transit"]).find((asset) => asset.kind === "transit");

    expect(restroom?.operation.publishedState).toBe("Operational");
    expect(fountain?.operation.publishedState).toBe("Active");
    expect(seating?.operation.publishedState).toBeNull();
    expect(transit?.operation.publishedState).toBeNull();
    for (const asset of fixture.assets) {
      expect(asset.operation.currentState).toBe("unknown");
      expect(asset.operation.satisfiesHardRequirement).toBe(false);
      expect(asset.operation.note).toMatch(/not|unknown|does not/i);
    }
  });

  it("preserves static transit entrance facts without creating accessibility or live-service claims", () => {
    const transit = listCivicAssets(["transit"]);
    expect(transit.length).toBe(fixture.counts.transit);
    for (const asset of transit) {
      if (asset.kind !== "transit") throw new Error("Expected a transit asset");
      expect(asset.details.inventoryYear).toBe("2024");
      expect(asset.details.stopName).toBeTruthy();
      expect(asset.details.daytimeRoutes.length).toBeGreaterThan(0);
      expect(asset.details.entranceType).toBeTruthy();
      expect(asset.operation.currentState).toBe("unknown");
      expect(asset.operation.satisfiesHardRequirement).toBe(false);
    }
    expect(getCivicAssetSource("mta-subway-entrances-2024")?.dataTimePeriod).toBe("2024");
    expect(getCivicAssetSource("mta-subway-entrances-2024")?.prohibitedClaims.join(" ")).toMatch(
      /live|accessible|step-free/i,
    );
  });
});

describe("route-near civic asset queries", () => {
  it("returns filtered assets in geometric-distance order without implying walk access", () => {
    const seating = listCivicAssets(["seating"])[0];
    const results = findCivicAssetsNearRoute([seating.coordinate], {
      maxDistanceMeters: 150,
      kinds: ["seating"],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].asset.id).toBe(seating.id);
    expect(results[0].routeGeometryDistanceMeters).toBeCloseTo(0, 5);
    expect(results.every((result) => result.asset.kind === "seating")).toBe(true);
    expect(results.every((result) => result.distanceBasis === "route_geometry")).toBe(true);
    expect(results.map((result) => result.routeGeometryDistanceMeters)).toEqual(
      [...results].map((result) => result.routeGeometryDistanceMeters).sort((a, b) => a - b),
    );
  });

  it("handles empty routes, limits, and invalid radii predictably", () => {
    expect(findCivicAssetsNearRoute([], { maxDistanceMeters: 50 })).toEqual([]);
    expect(findCivicAssetsNearRoute([fixture.assets[0].coordinate], { maxDistanceMeters: 50, limit: 0 })).toEqual([]);
    expect(() => findCivicAssetsNearRoute([fixture.assets[0].coordinate], { maxDistanceMeters: -1 })).toThrow(
      "maxDistanceMeters",
    );
  });
});
