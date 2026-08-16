import { describe, expect, it } from "vitest";
import { amenitiesForViewport, amenityClusterCellMeters, amenityOverviewGeoJSON } from "./amenityOverview";
import { listCivicAssets, type CivicAsset } from "./data/civicAssets";

function move(asset: CivicAsset, id: string, longitudeOffset: number): CivicAsset {
  return {
    ...asset,
    id,
    coordinate: [asset.coordinate[0] + longitudeOffset, asset.coordinate[1]],
  } as CivicAsset;
}

describe("amenity overview presentation", () => {
  const seating = listCivicAssets(["seating"])[0];
  const restroom = listCivicAssets(["restroom"])[0];
  const nearbySeats = [
    move(seating, "seat-a", 0),
    move(seating, "seat-b", 0.00001),
    move(seating, "seat-c", 0.00002),
  ];

  it("clusters nearby same-category assets with deterministic category styling", () => {
    const first = amenityOverviewGeoJSON([...nearbySeats].reverse(), { clusterCellMeters: 500 });
    const second = amenityOverviewGeoJSON(nearbySeats, { clusterCellMeters: 500 });
    expect(first).toEqual(second);
    expect(first.features).toHaveLength(1);
    expect(first.features[0].properties).toMatchObject({
      featureType: "cluster",
      kind: "seating",
      categoryLabel: "Places to sit",
      iconToken: "bench",
      count: 3,
      selected: false,
      required: false,
    });
  });

  it("never clusters selected, required, or route-prominent assets", () => {
    const presentation = amenityOverviewGeoJSON(nearbySeats, {
      selectedAssetId: "seat-a",
      requiredAssetIds: ["seat-b"],
      prominentAssetIds: ["seat-c"],
      clusterCellMeters: 500,
    });
    expect(presentation.features).toHaveLength(3);
    expect(presentation.features.every((feature) => feature.properties.featureType === "asset")).toBe(true);
    expect(presentation.features.at(-1)?.properties).toMatchObject({
      id: "seat-a",
      selected: true,
      clusterEligible: false,
      displayPriority: 3,
    });
    expect(presentation.features.find((feature) => feature.id === "seat-b")?.properties).toMatchObject({
      required: true,
      clusterEligible: false,
    });
    expect(presentation.features.find((feature) => feature.id === "seat-c")?.properties).toMatchObject({
      prominent: true,
      clusterEligible: false,
    });
  });

  it("does not merge different amenity categories into an ambiguous cluster", () => {
    const nearbyRestroom = {
      ...restroom,
      id: "restroom-near-seats",
      coordinate: seating.coordinate,
    } as CivicAsset;
    const presentation = amenityOverviewGeoJSON([...nearbySeats, nearbyRestroom], { clusterCellMeters: 500 });
    expect(presentation.features).toHaveLength(2);
    expect(presentation.features.map((feature) => feature.properties.kind).sort()).toEqual(["restroom", "seating"]);
  });

  it("validates clustering inputs and reports proof metadata", () => {
    expect(() => amenityOverviewGeoJSON([], { clusterCellMeters: 0 })).toThrow("clusterCellMeters");
    expect(() => amenityOverviewGeoJSON([], { minimumClusterSize: 1 })).toThrow("minimumClusterSize");
    expect(amenityOverviewGeoJSON(nearbySeats).metadata.proofLabel).toMatch(/current conditions may vary/i);
  });

  it("shrinks cluster cells with zoom and separates records at block scale", () => {
    expect(amenityClusterCellMeters(13.5)).toBe(150);
    expect(amenityClusterCellMeters(15.5)).toBeLessThan(50);
    expect(amenityClusterCellMeters(17)).toBe(14);
  });

  it("samples the viewport by category while retaining important route records", () => {
    const outside = move(seating, "outside", -0.03);
    const assets = amenitiesForViewport([...nearbySeats, restroom, outside], {
      west: seating.coordinate[0] - 0.005,
      south: seating.coordinate[1] - 0.005,
      east: seating.coordinate[0] + 0.005,
      north: seating.coordinate[1] + 0.005,
      zoom: 14,
    }, { maximumAssets: 2, prominentAssetIds: [outside.id] });
    expect(assets.map((asset) => asset.id)).toContain(outside.id);
    expect(assets).toHaveLength(2);
    expect(assets.some((asset) => asset.id !== outside.id)).toBe(true);
  });
});
