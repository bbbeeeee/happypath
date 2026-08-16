import { describe, expect, it } from "vitest";
import { listCivicAssets, type CivicAsset, type CivicAssetKind } from "./data/civicAssets";
import {
  assetAvailabilityCopy,
  assetMarkerSvg,
  assetTypeLabel,
  assetsGeoJSON,
  endpointsGeoJSON,
  routeGeoJSON,
} from "./mapPresentation";
import type { JourneyRoute } from "./types";

function route(journeyShape: JourneyRoute["journeyShape"]): JourneyRoute {
  return {
    candidateId: `${journeyShape}-route`,
    journeyShape,
    nodeIds: ["a", "b", "a"],
    edgeIds: ["ab", "ba"],
    endpointNodeId: journeyShape === "loop" ? "a" : "b",
    coordinates: [[-74, 40.73], [-73.999, 40.731], journeyShape === "loop" ? [-74, 40.73] : [-73.998, 40.732]],
    distanceMeters: 240,
    durationMinutes: 3,
    directSunMinutes: 1,
    longestExposedMinutes: 1,
    mappedStepEdges: 0,
    greeneryPercent: 30,
    nearbyTreeCount: 2,
    adjacentParkNames: [],
    shadePercent: 60,
    streets: ["Test Street"],
    repeatedEdgeRatio: 0,
    preferenceScore: 0.6,
    extraMinutesVsBaseline: journeyShape === "destination" ? 0 : null,
  };
}

describe("route presentation GeoJSON", () => {
  it("emits route geometry and an empty line when no route exists", () => {
    expect(routeGeoJSON(route("destination")).geometry.coordinates).toHaveLength(3);
    expect(routeGeoJSON().geometry.coordinates).toEqual([]);
  });

  it("uses one start-finish marker for a loop", () => {
    const presentation = endpointsGeoJSON(route("loop"));
    expect(presentation.features).toHaveLength(1);
    expect(presentation.features[0]).toMatchObject({
      properties: { kind: "start_finish" },
      geometry: { type: "Point", coordinates: [-74, 40.73] },
    });
  });

  it.each(["destination", "wander"] as const)("uses distinct endpoints for a %s", (shape) => {
    const presentation = endpointsGeoJSON(route(shape));
    expect(presentation.features.map((feature) => feature.properties.kind)).toEqual(["origin", "destination"]);
    expect(presentation.features[0].geometry.coordinates).not.toEqual(presentation.features[1].geometry.coordinates);
  });
});

describe("asset presentation", () => {
  const seating = listCivicAssets(["seating"])[0];
  const restroom = listCivicAssets(["restroom"])[0];

  it("marks only the selected asset in GeoJSON properties", () => {
    const presentation = assetsGeoJSON([seating, restroom], restroom.id);
    expect(presentation.features.map((feature) => feature.properties)).toEqual([
      { id: seating.id, kind: "seating", name: seating.name, selected: false },
      { id: restroom.id, kind: "restroom", name: restroom.name, selected: true },
    ]);
  });

  it("returns distinct, decodable marker art for every asset kind", () => {
    const kinds: CivicAssetKind[] = ["seating", "restroom", "drinking_fountain", "transit"];
    const outputs = kinds.map((kind) => assetMarkerSvg(kind));
    expect(new Set(outputs)).toHaveLength(kinds.length);
    outputs.forEach((output, index) => {
      expect(output).toMatch(/^data:image\/svg\+xml;charset=UTF-8,/);
      const svg = decodeURIComponent(output.slice(output.indexOf(",") + 1));
      expect(svg).toContain("<svg");
      expect(svg).toContain(`data-kind="${kinds[index]}"`);
      expect(svg).toContain("<title>");
    });
  });

  it("uses friendly type labels for all four kinds", () => {
    const expected: Record<CivicAssetKind, string> = {
      seating: "Place to sit",
      restroom: "Restroom",
      drinking_fountain: "Drinking water",
      transit: "Subway entrance",
    };
    for (const kind of Object.keys(expected) as CivicAssetKind[]) {
      expect(assetTypeLabel(listCivicAssets([kind])[0])).toBe(expected[kind]);
    }
  });

  it("keeps published inventory facts friendly and qualified", () => {
    for (const kind of ["seating", "restroom", "drinking_fountain", "transit"] as CivicAssetKind[]) {
      const copy = assetAvailabilityCopy(listCivicAssets([kind])[0]);
      expect(copy).toMatch(/listed|inventory|publishes/i);
      expect(copy).toMatch(/can change|can’t confirm|haven’t checked/i);
      expect(copy).not.toMatch(/currently (?:open|available|operational)/i);
    }

    const unavailable = {
      ...restroom,
      operation: { ...restroom.operation, routingAvailability: "published_unavailable" as const },
    } as CivicAsset;
    expect(assetAvailabilityCopy(unavailable)).toMatch(/may be unavailable/i);
    expect(assetAvailabilityCopy(unavailable)).toMatch(/haven’t verified current conditions/i);
  });
});
