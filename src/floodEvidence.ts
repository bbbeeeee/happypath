import summaryJson from "./data/pilot-flood-summary.json";
import type { Coordinate, JourneyRoute } from "./types";

export type FloodCategory = "nuisance_ponding" | "deep_contiguous";

export interface FloodFeature {
  type: "Feature";
  id: string;
  properties: {
    category: FloodCategory;
    categoryCode: 1 | 2;
    label: string;
    depthBand: string;
    detail: string;
    sourceId: "nyc-stormwater-flood-map-2050";
    scenarioId: "moderate-rain-2050-sea-level-rise";
    scenarioLabel: string;
    rainfallRateInchesPerHour: number;
    currentConditionsVerified: false;
  };
  geometry: { type: "MultiPolygon"; coordinates: Coordinate[][][] };
}

export interface FloodContextCollection {
  type: "FeatureCollection";
  features: FloodFeature[];
}

interface FloodEvidenceSummary {
  schemaVersion: 1;
  generatedAt: string;
  supportedAreaId: string;
  pilotBbox: [number, number, number, number];
  scenario: {
    id: "moderate-rain-2050-sea-level-rise";
    label: string;
    rainfallRateInchesPerHour: number;
    seaLevelCondition: "2050_projection";
    modeled: true;
    live: false;
  };
  counts: {
    nuisance_ponding_areas: number;
    deep_contiguous_areas: number;
    total_areas: number;
  };
  boundaries: {
    current_conditions: string;
    routing: string;
    no_overlap: string;
  };
  source: {
    sourceId: "nyc-stormwater-flood-map-2050";
    datasetId: "9i7c-xyvv";
    datasetUrl: string;
    serviceUrl: string;
    serviceItemId: "af6844bff1d74fbfa85597c32b6f34c4";
    serviceOwner: "NYCDEP_KarolinaR";
    retrievedAt: string;
    sourceUpdatedAt: string;
    snapshotHash: string;
  };
}

export interface FloodRouteOverlap {
  totalMeters: number;
  nuisancePondingMeters: number;
  deepContiguousMeters: number;
}

const summary = summaryJson as unknown as FloodEvidenceSummary;
export const floodEvidenceMetadata = summary;

let floodContextPromise: Promise<FloodContextCollection> | null = null;

export function loadFloodContextGeoJSON() {
  if (!floodContextPromise) {
    floodContextPromise = import("./data/pilot-flood-evidence.json").then((module) => {
      const fixture = module.default as unknown as FloodContextCollection;
      return { type: "FeatureCollection" as const, features: fixture.features };
    });
  }
  return floodContextPromise;
}

interface PreparedPolygon {
  category: FloodCategory;
  rings: Coordinate[][];
  bbox: { west: number; south: number; east: number; north: number };
}

const preparedCollections = new WeakMap<object, PreparedPolygon[]>();

function prepare(collection: FloodContextCollection) {
  const cached = preparedCollections.get(collection);
  if (cached) return cached;
  const polygons = collection.features.flatMap((feature) => feature.geometry.coordinates.map((rings) => {
    const points = rings.flat();
    return {
      category: feature.properties.category,
      rings,
      bbox: {
        west: Math.min(...points.map(([longitude]) => longitude)),
        south: Math.min(...points.map(([, latitude]) => latitude)),
        east: Math.max(...points.map(([longitude]) => longitude)),
        north: Math.max(...points.map(([, latitude]) => latitude)),
      },
    };
  }));
  preparedCollections.set(collection, polygons);
  return polygons;
}

function pointOnSegment(point: Coordinate, start: Coordinate, end: Coordinate) {
  const cross = (point[1] - start[1]) * (end[0] - start[0])
    - (point[0] - start[0]) * (end[1] - start[1]);
  return Math.abs(cross) <= 1e-10
    && point[0] >= Math.min(start[0], end[0]) && point[0] <= Math.max(start[0], end[0])
    && point[1] >= Math.min(start[1], end[1]) && point[1] <= Math.max(start[1], end[1]);
}

function pointInRing(point: Coordinate, ring: Coordinate[]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const start = ring[previous];
    const end = ring[index];
    if (pointOnSegment(point, start, end)) return true;
    if ((start[1] > point[1]) !== (end[1] > point[1])
      && point[0] < ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0]) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Coordinate, polygon: PreparedPolygon) {
  return pointInRing(point, polygon.rings[0])
    && !polygon.rings.slice(1).some((hole) => pointInRing(point, hole));
}

function segmentIntersectionT(start: Coordinate, end: Coordinate, ringStart: Coordinate, ringEnd: Coordinate) {
  const routeX = end[0] - start[0];
  const routeY = end[1] - start[1];
  const ringX = ringEnd[0] - ringStart[0];
  const ringY = ringEnd[1] - ringStart[1];
  const denominator = routeX * ringY - routeY * ringX;
  if (Math.abs(denominator) <= 1e-14) return null;
  const offsetX = ringStart[0] - start[0];
  const offsetY = ringStart[1] - start[1];
  const routeT = (offsetX * ringY - offsetY * ringX) / denominator;
  const ringT = (offsetX * routeY - offsetY * routeX) / denominator;
  return routeT >= 0 && routeT <= 1 && ringT >= 0 && ringT <= 1 ? routeT : null;
}

function segmentLengthMeters(start: Coordinate, end: Coordinate) {
  const radians = Math.PI / 180;
  const latitude1 = start[1] * radians;
  const latitude2 = end[1] * radians;
  const latitudeDelta = (end[1] - start[1]) * radians;
  const longitudeDelta = (end[0] - start[0]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/** Measures geometric overlap with the static model. It never certifies present conditions. */
export function floodOverlapForCoordinates(coordinates: readonly Coordinate[], collection: FloodContextCollection): FloodRouteOverlap {
  const overlap: FloodRouteOverlap = { totalMeters: 0, nuisancePondingMeters: 0, deepContiguousMeters: 0 };
  const polygons = prepare(collection);
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentBbox = {
      west: Math.min(start[0], end[0]), south: Math.min(start[1], end[1]),
      east: Math.max(start[0], end[0]), north: Math.max(start[1], end[1]),
    };
    const candidates = polygons.filter((polygon) => (
      polygon.bbox.east >= segmentBbox.west && polygon.bbox.west <= segmentBbox.east
      && polygon.bbox.north >= segmentBbox.south && polygon.bbox.south <= segmentBbox.north
    ));
    if (candidates.length === 0) continue;
    const breakpoints = [0, 1];
    for (const polygon of candidates) {
      for (const ring of polygon.rings) {
        for (let ringIndex = 1; ringIndex < ring.length; ringIndex += 1) {
          const intersection = segmentIntersectionT(start, end, ring[ringIndex - 1], ring[ringIndex]);
          if (intersection !== null) breakpoints.push(intersection);
        }
      }
    }
    const sorted = [...new Set(breakpoints.map((value) => Math.round(value * 1e9) / 1e9))].sort((a, b) => a - b);
    const segmentMeters = segmentLengthMeters(start, end);
    for (let part = 1; part < sorted.length; part += 1) {
      const from = sorted[part - 1];
      const to = sorted[part];
      if (to - from <= 1e-9) continue;
      const midpoint = (from + to) / 2;
      const point: Coordinate = [
        start[0] + (end[0] - start[0]) * midpoint,
        start[1] + (end[1] - start[1]) * midpoint,
      ];
      const categories = new Set(candidates.filter((polygon) => pointInPolygon(point, polygon)).map((polygon) => polygon.category));
      if (categories.size === 0) continue;
      const meters = segmentMeters * (to - from);
      overlap.totalMeters += meters;
      if (categories.has("nuisance_ponding")) overlap.nuisancePondingMeters += meters;
      if (categories.has("deep_contiguous")) overlap.deepContiguousMeters += meters;
    }
  }
  return overlap;
}

export function floodOverlapForRoute(route: JourneyRoute | null | undefined, collection: FloodContextCollection) {
  return floodOverlapForCoordinates(route?.coordinates ?? [], collection);
}
