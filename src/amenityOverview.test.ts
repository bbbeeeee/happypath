import { describe, expect, it } from "vitest";
import { amenitiesForViewport, amenitiesWithinViewport, amenityClusterCellMeters, amenityOverviewGeoJSON, amenityViewportSampleLimit } from "./amenityOverview";
import { listCivicAssets, type CivicAsset } from "./data/civicAssets";

function move(asset: CivicAsset, id: string, longitudeOffset: number): CivicAsset {
  return {
    ...asset,
    id,
    coordinate: [asset.coordinate[0] + longitudeOffset, asset.coordinate[1]],
  } as CivicAsset;
}

function place(asset: CivicAsset, id: string, longitude: number, latitude: number): CivicAsset {
  return { ...asset, id, coordinate: [longitude, latitude] } as CivicAsset;
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

  it("uses one neutral places cluster when city-scale density calls for it", () => {
    const nearbyRestroom = {
      ...restroom,
      id: "restroom-near-seats",
      coordinate: seating.coordinate,
    } as CivicAsset;
    const presentation = amenityOverviewGeoJSON([...nearbySeats, nearbyRestroom], {
      clusterCellMeters: 500,
      clusterAcrossCategories: true,
    });
    expect(presentation.features).toHaveLength(1);
    expect(presentation.features[0].properties).toMatchObject({
      featureType: "cluster",
      kind: "mixed",
      categoryLabel: "Nearby places",
      count: 4,
    });
  });

  it("validates clustering inputs and reports proof metadata", () => {
    expect(() => amenityOverviewGeoJSON([], { clusterCellMeters: 0 })).toThrow("clusterCellMeters");
    expect(() => amenityOverviewGeoJSON([], { minimumClusterSize: 1 })).toThrow("minimumClusterSize");
    expect(amenityOverviewGeoJSON(nearbySeats).metadata.proofLabel).toMatch(/current conditions may vary/i);
  });

  it("shrinks cluster cells with zoom and separates records at block scale", () => {
    expect(amenityClusterCellMeters(12.4)).toBeGreaterThan(900);
    expect(amenityClusterCellMeters(13.5)).toBe(150);
    expect(amenityClusterCellMeters(15.5)).toBeLessThan(50);
    expect(amenityClusterCellMeters(17)).toBe(14);
  });

  it("uses a moderately denser sample for the whole-area overview", () => {
    expect(amenityViewportSampleLimit(12.4, "nearby")).toBe(36);
    expect(amenityViewportSampleLimit(12.4, "route")).toBe(44);
    expect(amenityViewportSampleLimit(12.4, "planner")).toBe(48);
    expect(amenityViewportSampleLimit(14, "nearby")).toBe(20);
    expect(amenityViewportSampleLimit(14, "route")).toBe(28);
    expect(amenityViewportSampleLimit(14, "planner")).toBe(36);
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

  it("keeps every in-view record when computing cluster counts", () => {
    const outside = move(seating, "outside-full", -0.03);
    const viewport = {
      west: seating.coordinate[0] - 0.005,
      south: seating.coordinate[1] - 0.005,
      east: seating.coordinate[0] + 0.005,
      north: seating.coordinate[1] + 0.005,
      zoom: 14,
    };
    const visible = amenitiesWithinViewport([...nearbySeats, outside], viewport, { prominentAssetIds: [outside.id] });
    expect(visible.map((asset) => asset.id).sort()).toEqual(["outside-full", "seat-a", "seat-b", "seat-c"]);
    expect(amenityOverviewGeoJSON(visible, { clusterCellMeters: 500 }).features.find((feature) => feature.properties.featureType === "cluster")?.properties).toMatchObject({ count: 3 });
  });

  it("spreads a wide-view sample across the viewport instead of collapsing around its center", () => {
    const viewport = { west: 0, south: 0, east: 10, north: 10, zoom: 12 };
    const candidates = [
      place(seating, "center", 5, 5),
      place(seating, "north-west", 1, 9),
      place(seating, "north-east", 9, 9),
      place(seating, "south-west", 1, 1),
      place(seating, "south-east", 9, 1),
      place(seating, "near-center-a", 4.9, 5),
      place(seating, "near-center-b", 5.1, 5),
    ];

    const sampled = amenitiesForViewport(candidates, viewport, { maximumAssets: 5 });
    const longitudes = sampled.map((asset) => asset.coordinate[0]);
    const latitudes = sampled.map((asset) => asset.coordinate[1]);

    expect(sampled.map((asset) => asset.id)).toEqual(
      amenitiesForViewport([...candidates].reverse(), viewport, { maximumAssets: 5 }).map((asset) => asset.id),
    );
    expect(Math.max(...longitudes) - Math.min(...longitudes)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...latitudes) - Math.min(...latitudes)).toBeGreaterThanOrEqual(8);
  });
});
