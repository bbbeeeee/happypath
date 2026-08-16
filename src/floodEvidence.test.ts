import { describe, expect, it } from "vitest";
import {
  floodEvidenceMetadata,
  floodOverlapForCoordinates,
  loadFloodContextGeoJSON,
  type FloodContextCollection,
  type FloodFeature,
} from "./floodEvidence";

function square(category: "nuisance_ponding" | "deep_contiguous", west: number, south: number, east: number, north: number): FloodFeature {
  return {
    type: "Feature" as const,
    id: `test:${category}`,
    properties: {
      category,
      categoryCode: category === "nuisance_ponding" ? 1 as const : 2 as const,
      label: "Test model area",
      depthBand: "Test band",
      detail: "Modeled, not live.",
      sourceId: "nyc-stormwater-flood-map-2050" as const,
      scenarioId: "moderate-rain-2050-sea-level-rise" as const,
      scenarioLabel: "Moderate rain · 2050 sea-level rise",
      rainfallRateInchesPerHour: 2.13,
      currentConditionsVerified: false as const,
    },
    geometry: { type: "MultiPolygon" as const, coordinates: [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]] },
  };
}

describe("modeled flood context", () => {
  it("preserves the official scenario and both depth categories without claiming live conditions", async () => {
    const context = await loadFloodContextGeoJSON();
    expect(floodEvidenceMetadata.source.datasetId).toBe("9i7c-xyvv");
    expect(floodEvidenceMetadata.source.sourceId).toBe("nyc-stormwater-flood-map-2050");
    expect(floodEvidenceMetadata.scenario).toMatchObject({ rainfallRateInchesPerHour: 2.13, seaLevelCondition: "2050_projection", live: false });
    expect(floodEvidenceMetadata.counts.nuisance_ponding_areas).toBeGreaterThan(0);
    expect(floodEvidenceMetadata.counts.deep_contiguous_areas).toBeGreaterThan(0);
    expect(floodEvidenceMetadata.counts.total_areas).toBe(
      floodEvidenceMetadata.counts.nuisance_ponding_areas + floodEvidenceMetadata.counts.deep_contiguous_areas,
    );
    expect(context.features.map((feature) => feature.properties.category).sort()).toEqual(["deep_contiguous", "nuisance_ponding"]);
    context.features.forEach((feature) => {
      expect(feature.properties.currentConditionsVerified).toBe(false);
      expect(feature.properties.detail).toMatch(/not a live street condition/i);
    });
  }, 30_000);

  it("measures line-polygon overlap without double-counting the route total", () => {
    const context: FloodContextCollection = {
      type: "FeatureCollection",
      features: [
        square("nuisance_ponding", -74.001, 40.729, -73.999, 40.731),
        square("deep_contiguous", -74.0005, 40.7295, -73.9995, 40.7305),
      ],
    };
    const overlap = floodOverlapForCoordinates([[-74.002, 40.73], [-73.998, 40.73]], context);
    expect(overlap.totalMeters).toBeGreaterThan(160);
    expect(overlap.totalMeters).toBeLessThan(180);
    expect(overlap.nuisancePondingMeters).toBeCloseTo(overlap.totalMeters, 4);
    expect(overlap.deepContiguousMeters).toBeGreaterThan(80);
    expect(overlap.deepContiguousMeters).toBeLessThan(90);
  });

  it("treats no model overlap as unknown rather than evidence of a dry route", () => {
    const context: FloodContextCollection = { type: "FeatureCollection", features: [square("nuisance_ponding", -74.01, 40.7, -74.009, 40.701)] };
    expect(floodOverlapForCoordinates([[-74.002, 40.73], [-73.998, 40.73]], context)).toEqual({
      totalMeters: 0,
      nuisancePondingMeters: 0,
      deepContiguousMeters: 0,
    });
    expect(floodEvidenceMetadata.boundaries.no_overlap).toMatch(/flooding can still occur/i);
  });
});
