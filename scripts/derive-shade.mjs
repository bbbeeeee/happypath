import { mkdir, readFile, writeFile } from "node:fs/promises";
import { solarPosition } from "../src/routing/solar.mjs";
import { bboxMetadata, supportedArea } from "./lib/supported-area.mjs";
import { writeShadePartitions } from "./lib/write-edge-evidence-partitions.mjs";

const DATE = process.env.SHADE_DATE ?? "2026-08-15";
const HOURS = Array.from({ length: 13 }, (_, index) => index + 7);
const UTC_OFFSET = -4;
const SAMPLE_METERS = 8;
const CELL_SIZE = 0.001;
const graph = JSON.parse(await readFile(new URL("../src/data/pilot-osm.json", import.meta.url), "utf8"));
const buildings = JSON.parse(await readFile(new URL("../src/data/pilot-buildings.json", import.meta.url), "utf8"));
const BBOX = graph.metadata.pilotBbox;
const LATITUDE = (BBOX[0] + BBOX[2]) / 2;
const LONGITUDE = (BBOX[1] + BBOX[3]) / 2;

function distance(a, b) {
  return Math.hypot((b[1] - a[1]) * 111_111, (b[0] - a[0]) * 84_200);
}

function validEdgeGeometry(edge) {
  return Array.isArray(edge.geometry)
    && edge.geometry.length >= 2
    && edge.geometry.every((coordinate) => Array.isArray(coordinate)
      && coordinate.length === 2
      && coordinate.every(Number.isFinite));
}

function samplePolyline(coordinates, spacingMeters) {
  const segments = coordinates.slice(1).map((end, index) => {
    const start = coordinates[index];
    return { start, end, length: distance(start, end) };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const sampleCount = Math.max(2, Math.ceil(totalLength / spacingMeters));
  const samples = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    let remaining = totalLength * index / sampleCount;
    let segment = segments.at(-1);
    for (const candidate of segments) {
      segment = candidate;
      if (remaining <= candidate.length) break;
      remaining -= candidate.length;
    }
    const ratio = segment.length === 0 ? 0 : Math.min(1, remaining / segment.length);
    samples.push([
      segment.start[0] + (segment.end[0] - segment.start[0]) * ratio,
      segment.start[1] + (segment.end[1] - segment.start[1]) * ratio,
    ]);
  }
  return samples;
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length <= 2) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop(); lower.push(point); }
  const upper = [];
  for (const point of sorted.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop(); upper.push(point); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function rings(feature) {
  if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates[0]];
  if (feature.geometry.type === "MultiPolygon") return feature.geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function shadowPolygons(position) {
  if (position.elevationDegrees <= 0) return [];
  const azimuth = (position.azimuthDegrees * Math.PI) / 180;
  return buildings.features.flatMap((feature) => {
    const heightMeters = feature.properties.heightRoofFeet * 0.3048;
    const length = Math.min(300, heightMeters / Math.tan((position.elevationDegrees * Math.PI) / 180));
    const eastMeters = -Math.sin(azimuth) * length;
    const northMeters = -Math.cos(azimuth) * length;
    const dx = eastMeters / 84_200;
    const dy = northMeters / 111_111;
    return rings(feature).map((ring) => {
      const clean = ring.slice(0, -1);
      const hull = convexHull([...clean, ...clean.map(([lng, lat]) => [lng + dx, lat + dy])]);
      const xs = hull.map((point) => point[0]); const ys = hull.map((point) => point[1]);
      return { polygon: hull, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], bin: feature.properties.bin };
    });
  });
}

function spatialIndex(polygons) {
  const index = new Map();
  for (const polygon of polygons) {
    const [west, south, east, north] = polygon.bbox;
    for (let x = Math.floor(west / CELL_SIZE); x <= Math.floor(east / CELL_SIZE); x++) for (let y = Math.floor(south / CELL_SIZE); y <= Math.floor(north / CELL_SIZE); y++) {
      const key = `${x}:${y}`; const entries = index.get(key) ?? []; entries.push(polygon); index.set(key, entries);
    }
  }
  return index;
}

function isShaded(point, index) {
  const candidates = index.get(`${Math.floor(point[0] / CELL_SIZE)}:${Math.floor(point[1] / CELL_SIZE)}`) ?? [];
  return candidates.some((candidate) => point[0] >= candidate.bbox[0] && point[0] <= candidate.bbox[2] && point[1] >= candidate.bbox[1] && point[1] <= candidate.bbox[3] && pointInPolygon(point, candidate.polygon));
}

const edgeShadeByHour = Object.fromEntries(graph.edges.map((edge) => [edge.id, {}]));
const shadowDirectory = new URL("../src/data/shadows/", import.meta.url);
await mkdir(shadowDirectory, { recursive: true });
const shadowLongitudeBoundaries = [supportedArea.envelope.west, ...supportedArea.shadowTileLongitudeCuts, supportedArea.envelope.east];
const shadowTiles = supportedArea.partitions.flatMap((partition) => shadowLongitudeBoundaries.slice(0, -1).map((west, column) => ({
  id: `${partition.id}-col-${column}`,
  partition,
  west,
  east: shadowLongitudeBoundaries[column + 1],
})));
for (const tile of shadowTiles) await mkdir(new URL(`${tile.id}/`, shadowDirectory), { recursive: true });
for (const hour of HOURS) {
  const position = solarPosition(DATE, hour, LATITUDE, LONGITUDE, UTC_OFFSET);
  const polygons = shadowPolygons(position);
  const index = spatialIndex(polygons);
  for (const tile of shadowTiles) {
    const partitionShadows = polygons.filter((shadow) => {
      const latitude = (shadow.bbox[1] + shadow.bbox[3]) / 2;
      const longitude = (shadow.bbox[0] + shadow.bbox[2]) / 2;
      return latitude >= tile.partition.south
        && (latitude < tile.partition.north || tile.partition.id === supportedArea.partitions.at(-1).id && latitude <= tile.partition.north)
        && longitude >= tile.west
        && (longitude < tile.east || tile.east === supportedArea.envelope.east && longitude <= tile.east);
    });
    const shadowCollection = {
      type: "FeatureCollection",
      features: partitionShadows.map((shadow) => ({ type: "Feature", properties: { bin: shadow.bin }, geometry: { type: "Polygon", coordinates: [[...shadow.polygon, shadow.polygon[0]]] } })),
      metadata: { date: DATE, hour, supportedAreaId: supportedArea.id, partitionId: tile.partition.id, tileId: tile.id, validationStatus: "pending" },
    };
    await writeFile(new URL(`${tile.id}/hour-${hour}.json`, shadowDirectory), `${JSON.stringify(shadowCollection)}\n`);
  }
  for (const edge of graph.edges) {
    if (!validEdgeGeometry(edge)) {
      edgeShadeByHour[edge.id][hour] = null;
      continue;
    }
    const samples = samplePolyline(edge.geometry, SAMPLE_METERS);
    let shaded = 0;
    for (const sample of samples) if (isShaded(sample, index)) shaded++;
    edgeShadeByHour[edge.id][hour] = Number((shaded / samples.length).toFixed(3));
  }
  console.log(`${hour}:00 — ${polygons.length} projected shadows`);
}

const output = {
  metadata: { date: DATE, hours: HOURS, latitude: LATITUDE, longitude: LONGITUDE, utcOffsetHours: UTC_OFFSET, supportedAreaId: supportedArea.id, pilotBbox: BBOX, graphGeneratedAt: graph.metadata.generatedAt, graphEdgeCount: graph.edges.length, methodVersion: "building-shadow-polyline-sampling-v4-coherent-partitions", solarMethod: "noaa-solar-approx-v1", sampleSpacingMeters: SAMPLE_METERS, sourceIds: ["nyc-building-footprints", "openstreetmap"], edgeCoverage: graph.edges.filter(validEdgeGeometry).length / graph.edges.length, validationStatus: "pending" },
  edgeShadeByHour,
};
await writeFile(new URL("../src/data/pilot-shade.json", import.meta.url), `${JSON.stringify(output)}\n`);
await writeShadePartitions();
const registryUrl = new URL("../src/data/source-registry.json", import.meta.url);
const registry = JSON.parse(await readFile(registryUrl, "utf8"));
const otherSources = registry.sources.filter((source) => source.source_id !== "building-shadow-model");
otherSources.push({
  source_id: "building-shadow-model",
  publisher: "Happy Path",
  dataset_name: "Pilot projected building shadows",
  dataset_url: "https://data.cityofnewyork.us/d/5zhs-2jue",
  canonical_url: "https://data.cityofnewyork.us/d/5zhs-2jue",
  dataset_id: null,
  asset_type: "calculation",
  authority: "derived",
  access_method: "calculation",
  format: "JSON and GeoJSON",
  terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse",
  attribution: "Derived from NYC BUILDING",
  refresh_target: "after building snapshot or method changes",
  source_updated_at: null,
  retrieved_at: new Date().toISOString(),
  last_successful_ingest: new Date().toISOString(),
  snapshot_hash: null,
  geometry_type: "Polygon and edge samples",
  source_crs: "EPSG:4326",
  pilot_bbox: bboxMetadata(BBOX),
  supported_area_id: supportedArea.id,
  pilot_coverage: 1,
  derived_from: ["nyc-building-footprints", "openstreetmap"],
  method_version: "building-shadow-polyline-sampling-v4-coherent-partitions",
  known_limitations: ["Uses a solar approximation pending SPA-library review", "Samples preserved OSM edge polylines every 8 meters", "Edges without valid stored geometry receive no favorable shade evidence", "Convex shadow hulls may overstate shadows for concave footprints", "Overlapping display polygons can appear darker even though route scoring treats shade as binary", "Does not model trees, clouds, facade detail, or measured temperature"],
  allowed_claims: ["Estimated direct-sun exposure", "Projected building shade"],
  prohibited_claims: ["Measured temperature", "Guaranteed shade", "Cooler street"],
  validation_status: "pending"
});
await writeFile(registryUrl, `${JSON.stringify({ sources: otherSources }, null, 2)}\n`);
console.log(`Wrote shade for ${graph.edges.length} edges across ${HOURS.length} hours`);
