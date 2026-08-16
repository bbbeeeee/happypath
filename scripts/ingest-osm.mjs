import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  SUPPORTED_AREA_BBOX,
  bboxMetadata,
  coordinateInsideSupportedArea,
  supportedArea,
  supportedAreaOverpassPolygon,
} from "./lib/supported-area.mjs";
import { writeGraphPartitions } from "./lib/write-graph-partitions.mjs";

const BBOX = SUPPORTED_AREA_BBOX;
const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const OUTPUT = new URL("../src/data/pilot-osm.json", import.meta.url);
const REGISTRY_OUTPUT = new URL("../src/data/source-registry.json", import.meta.url);
const excludedHighways = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "raceway", "construction"]);
const query = `[out:json][timeout:180];way[highway](poly:"${supportedAreaOverpassPolygon()}");out body;>;out skel qt;`;

async function fetchOverpass() {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "FootnotePrototype/0.1" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(210_000),
      });
      if (response.ok || attempt === 3) return response;
      lastError = new Error(`Overpass request failed: ${response.status} ${await response.text()}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
  }
  throw lastError;
}

const response = await fetchOverpass();
if (!response.ok) throw new Error(`Overpass request failed: ${response.status} ${await response.text()}`);
const snapshotText = await response.text();
const snapshot = JSON.parse(snapshotText);
const retrievedAt = new Date().toISOString();
const snapshotHash = createHash("sha256").update(snapshotText).digest("hex");
const rawNodes = new Map(snapshot.elements.filter((item) => item.type === "node").map((item) => [item.id, item]));
const inputWays = snapshot.elements.filter((item) => item.type === "way");

function isWalkable(way) {
  const tags = way.tags ?? {};
  return Boolean(tags.highway && !excludedHighways.has(tags.highway) && !["no", "private"].includes(tags.access) && !["no", "private"].includes(tags.foot) && way.nodes?.length > 1);
}

const ways = inputWays.filter(isWalkable);
const degree = new Map();
for (const way of ways) for (const id of way.nodes) degree.set(id, (degree.get(id) ?? 0) + 1);
const graphNodeIds = new Set();
for (const way of ways) {
  graphNodeIds.add(way.nodes[0]);
  graphNodeIds.add(way.nodes.at(-1));
  for (const id of way.nodes) if ((degree.get(id) ?? 0) > 1) graphNodeIds.add(id);
}

const nodeStreetNames = new Map();
for (const way of ways) {
  if (!way.tags?.name) continue;
  for (const id of way.nodes) {
    const names = nodeStreetNames.get(id) ?? new Set();
    names.add(way.tags.name);
    nodeStreetNames.set(id, names);
  }
}

function distance(a, b) {
  return Math.hypot((b[1] - a[1]) * 111_111, (b[0] - a[0]) * 84_200);
}

function bearing(a, b) {
  return (Math.atan2((b[0] - a[0]) * 84_200, (b[1] - a[1]) * 111_111) * 180) / Math.PI;
}

function provisionalFactor(id, low, range) {
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return low + (((hash >>> 0) % 1000) / 1000) * range;
}

const rawEdges = [];
for (const way of ways) {
  let startIndex = 0;
  for (let index = 1; index < way.nodes.length; index += 1) {
    if (!graphNodeIds.has(way.nodes[index])) continue;
    const path = way.nodes.slice(startIndex, index + 1).map((id) => rawNodes.get(id)).filter(Boolean);
    startIndex = index;
    if (path.length < 2) continue;
    const from = path[0];
    const to = path.at(-1);
    const meters = path.slice(1).reduce((sum, node, i) => sum + distance([path[i].lon, path[i].lat], [node.lon, node.lat]), 0);
    const edgeId = `osm-${way.id}-${rawEdges.length}`;
    rawEdges.push({
      id: edgeId,
      from: String(from.id),
      to: String(to.id),
      geometry: path.map((node) => [node.lon, node.lat]),
      street: way.tags?.name ?? (way.tags?.highway === "steps" ? "Mapped steps" : "Unnamed pedestrian way"),
      distanceMeters: meters,
      orientationDegrees: bearing([from.lon, from.lat], [to.lon, to.lat]),
      canyonFactor: provisionalFactor(edgeId, 0.2, 0.55),
      treeFactor: provisionalFactor(`${edgeId}-tree`, 0.06, 0.28),
      source: "openstreetmap",
      osm: {
        wayId: way.id,
        highway: way.tags?.highway,
        access: way.tags?.access ?? null,
        foot: way.tags?.foot ?? null,
        steps: way.tags?.highway === "steps",
        covered: way.tags?.covered ?? null,
        tunnel: way.tags?.tunnel ?? null,
      },
    });
  }
}

const areaEdges = rawEdges.filter((edge) => {
  const from = rawNodes.get(Number(edge.from));
  const to = rawNodes.get(Number(edge.to));
  return from && to
    && coordinateInsideSupportedArea([from.lon, from.lat])
    && coordinateInsideSupportedArea([to.lon, to.lat]);
});
const adjacency = new Map();
for (const edge of areaEdges) {
  if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
  if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
  adjacency.get(edge.from).push(edge.to);
  adjacency.get(edge.to).push(edge.from);
}
const components = [];
const unseen = new Set(adjacency.keys());
while (unseen.size) {
  const seed = unseen.values().next().value;
  const component = new Set([seed]);
  const queue = [seed];
  unseen.delete(seed);
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()) ?? []) {
      if (unseen.delete(next)) { component.add(next); queue.push(next); }
    }
  }
  components.push(component);
}
components.sort((a, b) => b.size - a.size);
const largest = components[0] ?? new Set();
const edges = areaEdges.filter((edge) => largest.has(edge.from) && largest.has(edge.to));
const usedNodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
const nodes = [...usedNodeIds].map((id) => {
  const node = rawNodes.get(Number(id));
  const streets = [...(nodeStreetNames.get(Number(id)) ?? [])].slice(0, 2);
  return { id, name: streets.length > 1 ? streets.join(" & ") : streets[0] ?? `OSM node ${id}`, coordinate: [node.lon, node.lat] };
});

const metadata = {
  generatedAt: retrievedAt,
  pilotBbox: BBOX,
  supportedAreaId: supportedArea.id,
  supportedAreaLabel: supportedArea.label,
  supportedAreaPolygon: supportedArea.polygon,
  partitions: supportedArea.partitions,
  sourceIds: ["openstreetmap"],
  graphEvidence: "community",
  shadeEvidence: "derived",
  audit: {
    inputWays: inputWays.length,
    routableWays: ways.length,
    nodes: nodes.length,
    edges: edges.length,
    mappedStairEdges: edges.filter((edge) => edge.osm.steps).length,
    mappedCoveredEdges: edges.filter((edge) => ["yes", "arcade", "colonnade"].includes(edge.osm.covered) || edge.osm.tunnel === "building_passage").length,
    accessTaggedEdges: edges.filter((edge) => edge.osm.access || edge.osm.foot).length,
    outsideAreaEdgesRemoved: rawEdges.length - areaEdges.length,
    largestComponentShare: areaEdges.length ? edges.length / areaEdges.length : 0,
    edgesWithGeometry: edges.filter((edge) => edge.geometry?.length >= 2).length,
    geometryPointCount: edges.reduce((sum, edge) => sum + (edge.geometry?.length ?? 0), 0),
    curvedEdges: edges.filter((edge) => edge.geometry?.length > 2).length,
  },
};

await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ nodes, edges, metadata }, null, 2)}\n`);
await writeGraphPartitions({ nodes, edges, metadata });
const existingRegistry = await readFile(REGISTRY_OUTPUT, "utf8").then(JSON.parse).catch(() => ({ sources: [] }));
const otherSources = existingRegistry.sources.filter((source) => source.source_id !== "openstreetmap");
await writeFile(REGISTRY_OUTPUT, `${JSON.stringify({ sources: [{
  source_id: "openstreetmap",
  publisher: "OpenStreetMap contributors",
  dataset_name: `OpenStreetMap walking graph — ${supportedArea.shortLabel}`,
  dataset_url: "https://www.openstreetmap.org/export",
  canonical_url: "https://www.openstreetmap.org/copyright",
  dataset_id: null,
  asset_type: "dataset",
  authority: "community",
  access_method: "bulk_download",
  format: "Overpass JSON",
  terms_url: "https://www.openstreetmap.org/copyright",
  attribution: "© OpenStreetMap contributors",
  refresh_target: "deliberate pilot refresh",
  source_updated_at: null,
  retrieved_at: retrievedAt,
  last_successful_ingest: retrievedAt,
  snapshot_hash: `sha256:${snapshotHash}`,
  geometry_type: "ways, nodes, and edge LineStrings",
  source_crs: "EPSG:4326",
  pilot_bbox: bboxMetadata(BBOX),
  supported_area_id: supportedArea.id,
  supported_area_polygon: supportedArea.polygon,
  pilot_coverage: metadata.audit.largestComponentShare,
  derived_from: [],
  method_version: "osm-pedestrian-graph-v3-supported-area-polygon",
  known_limitations: ["Mapped access, crossings, and covered-way tags vary in completeness", "Snapshot is not proof of legal completeness, current access, dryness, or step-free access", "Turn restrictions are not yet modeled", "Edge geometry preserves mapped OSM shape nodes but does not establish sidewalk-side topology"],
  allowed_claims: ["Uses mapped pedestrian ways", "Avoids mapped steps when the hard constraint is enabled", "Identifies path-aligned covered ways when explicitly mapped"],
  prohibited_claims: ["Legally complete", "Accessible", "Guaranteed step-free", "Current or rainproof overhead cover"],
  validation_status: "pending"
}, ...otherSources] }, null, 2)}\n`);
console.log(`Wrote ${nodes.length} nodes and ${edges.length} edges; largest component ${(metadata.audit.largestComponentShare * 100).toFixed(1)}%`);
