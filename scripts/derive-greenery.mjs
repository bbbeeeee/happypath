import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const BBOX = [40.726, -74.006, 40.736, -73.988];
const graphUrl = new URL("../src/data/pilot-osm.json", import.meta.url);
const registryUrl = new URL("../src/data/source-registry.json", import.meta.url);
const outputUrl = new URL("../src/data/pilot-greenery.json", import.meta.url);
const graph = JSON.parse(await readFile(graphUrl, "utf8"));

async function fetchGeoJson(datasetId, geometryField, fields) {
  const url = new URL(`https://data.cityofnewyork.us/resource/${datasetId}.geojson`);
  url.searchParams.set("$limit", "50000");
  url.searchParams.set("$select", [geometryField, ...fields].join(","));
  url.searchParams.set("$where", `within_box(${geometryField},${BBOX.join(",")})`);
  const response = await fetch(url, { headers: { "User-Agent": "HappyPathPrototype/0.1" } });
  if (!response.ok) throw new Error(`${datasetId} request failed: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return { collection: JSON.parse(text), hash: createHash("sha256").update(text).digest("hex") };
}

const treesResponse = await fetchGeoJson("hn5i-inap", "location", ["objectid", "dbh", "tpstructure", "tpcondition", "updateddate", "genusspecies"]);
const parksResponse = await fetchGeoJson("enfh-gkve", "multipolygon", ["gispropnum", "signname", "name311", "retired"]);
const trees = treesResponse.collection.features.filter((feature) => feature.geometry?.type === "Point").map((feature) => ({ id: String(feature.properties.objectid), coordinate: feature.geometry.coordinates, dbh: Number(feature.properties.dbh) || null, condition: feature.properties.tpcondition ?? null }));

function parkRings(feature) {
  if (feature.geometry?.type === "Polygon") return [feature.geometry.coordinates[0]];
  if (feature.geometry?.type === "MultiPolygon") return feature.geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}
const parks = parksResponse.collection.features.flatMap((feature) => parkRings(feature).map((ring) => ({ ring, name: feature.properties.signname ?? feature.properties.name311 ?? "Mapped park" })));

function toMeters(coordinate) { return [coordinate[0] * 84_200, coordinate[1] * 111_111]; }
function pointSegmentDistance(point, start, end) {
  const p = toMeters(point); const a = toMeters(start); const b = toMeters(end);
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function coordinateDistance(start, end) {
  const a = toMeters(start); const b = toMeters(end);
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
function validEdgeGeometry(edge) {
  return Array.isArray(edge.geometry)
    && edge.geometry.length >= 2
    && edge.geometry.every((coordinate) => Array.isArray(coordinate)
      && coordinate.length === 2
      && coordinate.every(Number.isFinite));
}
function pointPolylineDistance(point, coordinates) {
  return Math.min(...coordinates.slice(1).map((end, index) => pointSegmentDistance(point, coordinates[index], end)));
}
function polylineMidpoint(coordinates) {
  const segments = coordinates.slice(1).map((end, index) => {
    const start = coordinates[index];
    return { start, end, length: coordinateDistance(start, end) };
  });
  let remaining = segments.reduce((sum, segment) => sum + segment.length, 0) / 2;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length === 0 ? 0 : remaining / segment.length;
      return [
        segment.start[0] + (segment.end[0] - segment.start[0]) * ratio,
        segment.start[1] + (segment.end[1] - segment.start[1]) * ratio,
      ];
    }
    remaining -= segment.length;
  }
  return coordinates.at(-1);
}
function pointInPolygon(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const edgeGreenery = {};
for (const edge of graph.edges) {
  if (!validEdgeGeometry(edge)) {
    edgeGreenery[edge.id] = { score: 0, nearbyTreeIds: [], parkNames: [] };
    continue;
  }
  const nearby = trees.filter((tree) => pointPolylineDistance(tree.coordinate, edge.geometry) <= 18);
  const midpoint = polylineMidpoint(edge.geometry);
  const adjacentParks = parks.filter((park) => pointInPolygon(midpoint, park.ring)
    || park.ring.some((point) => pointPolylineDistance(point, edge.geometry) <= 12));
  const expectedTrees = Math.max(1, edge.distanceMeters / 20);
  const treeScore = Math.min(1, nearby.length / expectedTrees);
  const parkScore = adjacentParks.length ? 1 : 0;
  edgeGreenery[edge.id] = { score: Number((treeScore * 0.72 + parkScore * 0.28).toFixed(3)), nearbyTreeIds: nearby.map((tree) => tree.id), parkNames: [...new Set(adjacentParks.map((park) => park.name))] };
}

const scoredEdges = Object.values(edgeGreenery).filter((edge) => edge.score > 0).length;
const retrievedAt = new Date().toISOString();
const metadata = { generatedAt: retrievedAt, methodVersion: "tree-park-polyline-adjacency-v2", sourceIds: ["nyc-forestry-tree-points", "nyc-parks-properties", "openstreetmap"], edgeCoverage: graph.edges.filter(validEdgeGeometry).length / graph.edges.length, positiveEvidenceShare: scoredEdges / graph.edges.length, treeCount: trees.length, parkPropertyCount: parksResponse.collection.features.length, validationStatus: "pending" };
await writeFile(outputUrl, `${JSON.stringify({ metadata, edgeGreenery })}\n`);

const registry = JSON.parse(await readFile(registryUrl, "utf8"));
const other = registry.sources.filter((source) => !["nyc-forestry-tree-points", "nyc-parks-properties", "greenery-edge-model"].includes(source.source_id));
const common = { asset_type: "dataset", authority: "official", access_method: "socrata_api", format: "GeoJSON", terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse", refresh_target: "deliberate pilot refresh", source_updated_at: null, retrieved_at: retrievedAt, last_successful_ingest: retrievedAt, source_crs: "EPSG:4326", pilot_bbox: { south: BBOX[0], west: BBOX[1], north: BBOX[2], east: BBOX[3] }, derived_from: [], validation_status: "pending" };
other.push({ ...common, source_id: "nyc-forestry-tree-points", publisher: "NYC Department of Parks and Recreation", dataset_name: "Forestry Tree Points", dataset_url: "https://data.cityofnewyork.us/d/hn5i-inap", canonical_url: "https://data.cityofnewyork.us/d/hn5i-inap", dataset_id: "hn5i-inap", attribution: "NYC Parks", snapshot_hash: `sha256:${treesResponse.hash}`, geometry_type: "Point", pilot_coverage: trees.length > 0 ? 1 : 0, method_version: "nyc-tree-crop-v1", known_limitations: ["A mapped tree does not establish canopy size, present condition, or shade"], allowed_claims: ["Nearby mapped trees", "Greener ranking input"], prohibited_claims: ["Tree canopy", "Current tree shade", "Current tree health"] });
other.push({ ...common, source_id: "nyc-parks-properties", publisher: "NYC Department of Parks and Recreation", dataset_name: "Parks Properties", dataset_url: "https://data.cityofnewyork.us/d/enfh-gkve", canonical_url: "https://data.cityofnewyork.us/d/enfh-gkve", dataset_id: "enfh-gkve", attribution: "NYC Parks", snapshot_hash: `sha256:${parksResponse.hash}`, geometry_type: "MultiPolygon", pilot_coverage: parks.length > 0 ? 1 : 0, method_version: "nyc-park-crop-v1", known_limitations: ["A property boundary does not prove current access, hours, or entrance location"], allowed_claims: ["Adjacent to a mapped park property"], prohibited_claims: ["Park is open", "Entrance is accessible"] });
other.push({ ...common, source_id: "greenery-edge-model", publisher: "Happy Path", dataset_name: "Pilot tree and park adjacency", dataset_url: "https://data.cityofnewyork.us/d/hn5i-inap", canonical_url: "https://data.cityofnewyork.us/d/hn5i-inap", dataset_id: null, asset_type: "calculation", authority: "derived", access_method: "calculation", attribution: "Derived from NYC Parks data", snapshot_hash: null, geometry_type: "edge metrics", pilot_coverage: metadata.edgeCoverage, derived_from: ["nyc-forestry-tree-points", "nyc-parks-properties", "openstreetmap"], method_version: metadata.methodVersion, known_limitations: ["Tree adjacency is not canopy or shade", "Park proximity does not prove an open entrance", "Edges without valid stored geometry receive no favorable greenery evidence"], allowed_claims: ["More mapped tree and park adjacency than baseline"], prohibited_claims: ["Shadier", "Cooler", "Park access guaranteed"] });
await writeFile(registryUrl, `${JSON.stringify({ sources: other }, null, 2)}\n`);
console.log(`Wrote greenery for ${graph.edges.length} edges from ${trees.length} trees and ${parks.length} park polygons; ${(metadata.positiveEvidenceShare * 100).toFixed(1)}% positive evidence`);
