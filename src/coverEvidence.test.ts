import { describe, expect, it } from "vitest";
import {
  loadCoverContextGeoJSON,
  coverContextVicinityGeoJSON,
  coverEvidenceMetadata,
  mappedCoverGeoJSON,
  mappedCoverShare,
  pickRainFriendlyRoute,
  routeCoverSegmentsGeoJSON,
  routeMappedCoverMeters,
} from "./coverEvidence";
import fullGraphJson from "./data/pilot-osm.json";
import { getSourceRegistryEntry } from "./data/sourceRegistry";
import type { JourneyResult, JourneyRoute, PilotGraph } from "./types";

const graph: PilotGraph = {
  nodes: [
    { id: "a", name: "A", coordinate: [-74, 40.7] },
    { id: "b", name: "B", coordinate: [-73.999, 40.7] },
    { id: "c", name: "C", coordinate: [-73.998, 40.7] },
  ],
  edges: [
    { id: "covered", from: "a", to: "b", street: "Passage", distanceMeters: 100, orientationDegrees: 0, canyonFactor: 1, treeFactor: 0, source: "openstreetmap", osm: { wayId: 1, highway: "footway", access: null, foot: null, steps: false, covered: "arcade", tunnel: null } },
    { id: "open", from: "b", to: "c", street: "Broadway", distanceMeters: 100, orientationDegrees: 0, canyonFactor: 0, treeFactor: 0, source: "openstreetmap", osm: { wayId: 2, highway: "footway", access: null, foot: null, steps: false, covered: null, tunnel: null } },
  ],
};

function route(id: string, edgeId: string, durationMinutes = 1.25): JourneyRoute {
  return {
    candidateId: id, journeyShape: "wander", nodeIds: ["a", "b"], edgeIds: [edgeId], endpointNodeId: "b",
    coordinates: [[-74, 40.7], [-73.999, 40.7]], distanceMeters: 100, durationMinutes,
    directSunMinutes: 1, longestExposedMinutes: 1, mappedStepEdges: 0, greeneryPercent: 0,
    nearbyTreeCount: 0, adjacentParkNames: [], shadePercent: 20, streets: [], repeatedEdgeRatio: 0,
    preferenceScore: 0, extraMinutesVsBaseline: null,
  };
}

describe("real cover evidence", () => {
  it("scores only explicit path-aligned mapped cover", () => {
    expect(mappedCoverShare(graph.edges[0])).toBe(1);
    expect(mappedCoverShare(graph.edges[1])).toBe(0);
    expect(mappedCoverGeoJSON(graph).features).toHaveLength(1);
    expect(mappedCoverGeoJSON(graph).features[0].properties).toMatchObject({
      wayId: 1,
      coverType: "arcade",
      evidenceKind: "mapped_geometry",
      sourceId: "openstreetmap",
    });
  });

  it("shows only positive route evidence and never paints missing tags as open gaps", () => {
    const presentation = routeCoverSegmentsGeoJSON({
      ...route("mixed", "covered"),
      nodeIds: ["a", "b", "c"],
      edgeIds: ["covered", "open"],
      distanceMeters: 200,
    }, graph);
    expect(presentation.features).toHaveLength(1);
    expect(presentation.features[0].properties.coverBand).toBe("mapped");
  });

  it("selects more mapped cover without trading away a target-duration band", () => {
    const targetRoute = route("target", "open", 28);
    const tooShort = route("short", "covered", 15);
    const result = {
      recommended: targetRoute,
      alternatives: [tooShort],
      baseline: null,
      brief: {} as never,
      evaluatedCandidateCount: 2,
      routeValueFrontier: null,
      timing: { intent: "target" as const, requestedMinutes: 30, targetRangeMinutes: { minimum: 27, maximum: 33 } },
    };
    expect(pickRainFriendlyRoute(result, graph).candidateId).toBe("target");

    const eligibleCovered = route("covered-eligible", "covered", 29);
    const eligibleResult = { ...result, alternatives: [eligibleCovered] } as unknown as JourneyResult;
    expect(pickRainFriendlyRoute(eligibleResult, graph).candidateId).toBe("covered-eligible");
    expect(routeMappedCoverMeters(eligibleCovered, graph)).toBe(100);
  });

  it("keeps permit, arcade, and construction records as source-backed context", async () => {
    const context = await loadCoverContextGeoJSON();
    const kinds = new Set(context.features.map((feature) => feature.properties.kind));
    expect(kinds).toEqual(new Set(["sidewalk_shed_permit", "pops_arcade", "construction_closure"]));
    expect(coverEvidenceMetadata.counts.mapped_cover_edges).toBeGreaterThan(0);
    expect(coverEvidenceMetadata.counts.sidewalk_shed_permits).toBeGreaterThan(0);
    expect(coverEvidenceMetadata.boundaries.awnings).toMatch(/not inferred/i);
    context.features.forEach((feature) => expect(getSourceRegistryEntry(feature.properties.sourceId)).toBeTruthy());

    const dayStart = `${coverEvidenceMetadata.snapshotDay}T00:00:00`;
    const dayEnd = `${coverEvidenceMetadata.snapshotDay}T23:59:59`;
    context.features.filter((feature) => feature.properties.kind === "sidewalk_shed_permit").forEach((feature) => {
      expect(typeof feature.properties.validFrom).toBe("string");
      expect(typeof feature.properties.validThrough).toBe("string");
      expect(String(feature.properties.validFrom) <= dayEnd).toBe(true);
      expect(String(feature.properties.validThrough) >= dayStart).toBe(true);
    });
    context.features.filter((feature) => feature.properties.kind === "construction_closure").forEach((feature) => {
      expect(typeof feature.properties.validFrom).toBe("string");
      expect(typeof feature.properties.validThrough).toBe("string");
      expect(String(feature.properties.validFrom) <= dayEnd).toBe(true);
      expect(String(feature.properties.validThrough) >= dayStart).toBe(true);
    });
    expect(context.features.some((feature) => feature.properties.kind === "pops_arcade")).toBe(true);
    expect(context.features.some((feature) => String(feature.properties.kind).includes("awning"))).toBe(false);
  });

  it("presents point records as explicitly approximate geometric vicinities", async () => {
    const context = await loadCoverContextGeoJSON();
    const vicinities = coverContextVicinityGeoJSON(context);
    const pointCount = context.features.filter((feature) => feature.geometry.type === "Point").length;
    expect(vicinities.features).toHaveLength(pointCount);
    expect(vicinities.features.every((feature) => feature.geometry.type === "Polygon")).toBe(true);
    expect(vicinities.features.every((feature) => feature.properties.extentAccuracy === "approximate")).toBe(true);
    expect(vicinities.features.every((feature) => /not a surveyed cover footprint/i.test(feature.properties.detail))).toBe(true);
  });

  it("keeps the checked-in graph and cover snapshot aligned", () => {
    const fullGraph = fullGraphJson as unknown as PilotGraph;
    const mapped = fullGraph.edges.filter((edge) => mappedCoverShare(edge) > 0);
    expect(mapped).toHaveLength(coverEvidenceMetadata.counts.mapped_cover_edges);
    expect(mapped.reduce((sum, edge) => sum + edge.distanceMeters * mappedCoverShare(edge), 0))
      .toBeCloseTo(coverEvidenceMetadata.counts.mapped_cover_meters, 6);
  });
});
