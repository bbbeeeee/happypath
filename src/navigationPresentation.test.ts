import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  coordinateDistanceMeters,
  navigationCursorGeoJSON,
  navigationProgressLabel,
  navigationTrailGeoJSON,
  positionAlongRoute,
} from "./navigationPresentation";
import type { Coordinate, JourneyRoute } from "./types";

/** Three points forming an L: north for ~111m, then east. */
const north: Coordinate = [-73.98, 40.75];
const corner: Coordinate = [-73.98, 40.751];
const east: Coordinate = [-73.979, 40.751];
const legs: Coordinate[] = [north, corner, east];

function journey(coordinates: Coordinate[], durationMinutes = 10): JourneyRoute {
  return {
    nodeIds: coordinates.map((_, index) => `n${index}`),
    coordinates,
    distanceMeters: 200,
    durationMinutes,
    directSunMinutes: 0,
    longestExposedMinutes: 0,
    mappedStepEdges: 0,
    greeneryPercent: 0,
    nearbyTreeCount: 0,
    adjacentParkNames: [],
    shadePercent: 100,
    streets: [],
    candidateId: "candidate",
    journeyShape: "destination",
    edgeIds: [],
    endpointNodeId: "n2",
    repeatedEdgeRatio: 0,
    preferenceScore: 1,
    extraMinutesVsBaseline: null,
  };
}

describe("bearingDegrees", () => {
  it("reads due north as zero", () => {
    expect(bearingDegrees(north, corner)).toBeCloseTo(0, 1);
  });

  it("reads due east as ninety", () => {
    expect(bearingDegrees(corner, east)).toBeCloseTo(90, 1);
  });

  it("wraps westward headings into the positive range", () => {
    expect(bearingDegrees(east, corner)).toBeCloseTo(270, 1);
  });

  it("returns zero rather than NaN for a zero-length step", () => {
    expect(bearingDegrees(north, north)).toBe(0);
  });
});

describe("coordinateDistanceMeters", () => {
  it("measures a tenth of a degree of latitude as about 111 metres", () => {
    expect(coordinateDistanceMeters(north, corner)).toBeGreaterThan(105);
    expect(coordinateDistanceMeters(north, corner)).toBeLessThan(118);
  });

  it("shrinks longitude degrees at Manhattan's latitude", () => {
    expect(coordinateDistanceMeters(corner, east)).toBeLessThan(coordinateDistanceMeters(north, corner));
  });
});

describe("positionAlongRoute", () => {
  it("starts at the origin", () => {
    const position = positionAlongRoute(legs, 0)!;
    expect(position.coordinate[0]).toBeCloseTo(north[0], 6);
    expect(position.coordinate[1]).toBeCloseTo(north[1], 6);
    expect(position.metersTravelled).toBe(0);
  });

  it("finishes at the destination", () => {
    const position = positionAlongRoute(legs, 1)!;
    expect(position.coordinate[0]).toBeCloseTo(east[0], 6);
    expect(position.coordinate[1]).toBeCloseTo(east[1], 6);
    expect(position.metersRemaining).toBeCloseTo(0, 3);
  });

  it("interpolates inside a step rather than snapping to vertices", () => {
    const position = positionAlongRoute([north, corner], 0.5)!;
    expect(position.coordinate[1]).toBeCloseTo((north[1] + corner[1]) / 2, 6);
  });

  it("turns the heading when the walk turns", () => {
    expect(positionAlongRoute(legs, 0.05)!.bearing).toBeCloseTo(0, 0);
    expect(positionAlongRoute(legs, 0.95)!.bearing).toBeCloseTo(90, 0);
  });

  it("clamps progress outside zero to one", () => {
    expect(positionAlongRoute(legs, -3)!.metersTravelled).toBe(0);
    expect(positionAlongRoute(legs, 4)!.metersRemaining).toBeCloseTo(0, 3);
  });

  it("handles a degenerate route without dividing by zero", () => {
    const stationary = positionAlongRoute([north, north], 0.5)!;
    expect(stationary.coordinate).toEqual(north);
    expect(Number.isNaN(stationary.bearing)).toBe(false);
  });

  it("returns null for an empty route", () => {
    expect(positionAlongRoute([], 0.5)).toBeNull();
  });
});

describe("navigationCursorGeoJSON", () => {
  it("emits one rotated point", () => {
    const collection = navigationCursorGeoJSON(journey(legs), 0.95);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.bearing).toBeCloseTo(90, 0);
  });

  it("emits nothing without a route", () => {
    expect(navigationCursorGeoJSON(null, 0.5).features).toEqual([]);
  });
});

describe("navigationTrailGeoJSON", () => {
  it("grows as the walk advances", () => {
    const early = navigationTrailGeoJSON(journey(legs), 0.2).features[0];
    const late = navigationTrailGeoJSON(journey(legs), 0.9).features[0];
    expect(late.geometry.coordinates.length).toBeGreaterThanOrEqual(early.geometry.coordinates.length);
  });

  it("is empty before the walk starts moving", () => {
    expect(navigationTrailGeoJSON(journey(legs), 0).features[0].geometry.coordinates).toHaveLength(2);
  });
});

describe("navigationProgressLabel", () => {
  it("counts down as the walk advances", () => {
    expect(navigationProgressLabel(journey(legs, 20), 0)).toMatch(/20 min left/);
    expect(navigationProgressLabel(journey(legs, 20), 0.5)).toMatch(/10 min left/);
  });

  it("says arrived at the end", () => {
    expect(navigationProgressLabel(journey(legs, 20), 1)).toBe("Arrived");
  });

  it("is empty without a route", () => {
    expect(navigationProgressLabel(null, 0.5)).toBe("");
  });
});
