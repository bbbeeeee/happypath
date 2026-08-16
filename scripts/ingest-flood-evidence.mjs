import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { geometryIntersectsSupportedArea, supportedArea } from "./lib/supported-area.mjs";

const OUTPUT_PATH = new URL("../src/data/pilot-flood-evidence.json", import.meta.url);
const SUMMARY_PATH = new URL("../src/data/pilot-flood-summary.json", import.meta.url);
const REGISTRY_PATH = new URL("../src/data/source-registry.json", import.meta.url);
const DATASET_ID = "9i7c-xyvv";
const SOURCE_ID = "nyc-stormwater-flood-map-2050";
const SERVICE_ITEM_ID = "af6844bff1d74fbfa85597c32b6f34c4";
const SERVICE_URL = "https://services.arcgis.com/at3rDjch5X7i9Bag/arcgis/rest/services/Moderate_Flood_SLR_2050/FeatureServer";
const ITEM_METADATA_URL = `https://www.arcgis.com/sharing/rest/content/items/${SERVICE_ITEM_ID}?f=json`;
const layerDefinitions = [
  { id: 4, code: 2 },
  { id: 5, code: 1 },
];

function layerQueryUrl(layerId) {
  const url = new URL(`${SERVICE_URL}/${layerId}/query`);
  url.search = new URLSearchParams({
    where: "1=1",
    geometry: `${supportedArea.envelope.west},${supportedArea.envelope.south},${supportedArea.envelope.east},${supportedArea.envelope.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "OBJECTID,Model",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.00001",
    geometryPrecision: "6",
    resultRecordCount: "2000",
    f: "geojson",
  }).toString();
  return url;
}

const generatedAt = process.env.FLOOD_EVIDENCE_RETRIEVED_AT ?? new Date().toISOString();

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "HappyPathPrototype/0.1" } });
  if (!response.ok) throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  return response.text();
}

function sourceUpdatedAt(layerMetadata) {
  const latest = Math.max(...layerMetadata.map((metadata) => metadata?.editingInfo?.dataLastEditDate ?? 0));
  return latest ? new Date(latest).toISOString() : null;
}

function categoryProperties(code) {
  if (code === 1) return {
    category: "nuisance_ponding",
    label: "Potential nuisance ponding",
    depthBand: "4 inches to less than 1 foot in the modeled scenario",
    detail: "DEP’s model includes this area for potential ponding of at least 4 inches and less than 1 foot during the named heavy-rain scenario. This is not a live street condition.",
  };
  if (code === 2) return {
    category: "deep_contiguous",
    label: "Potential deep, contiguous flooding",
    depthBand: "1 foot or more in the modeled scenario",
    detail: "DEP’s model includes this area for potential deep and contiguous flooding of at least 1 foot during the named heavy-rain scenario. This is not a live street condition.",
  };
  throw new Error(`Unexpected stormwater flooding category: ${code}`);
}

const queryUrls = layerDefinitions.map((layer) => layerQueryUrl(layer.id));
const [sourceTexts, itemMetadataText, layerMetadataTexts] = await Promise.all([
  Promise.all(queryUrls.map(fetchText)),
  fetchText(ITEM_METADATA_URL),
  Promise.all(layerDefinitions.map((layer) => fetchText(`${SERVICE_URL}/${layer.id}?f=json`))),
]);
const itemMetadata = JSON.parse(itemMetadataText);
const layerMetadata = layerMetadataTexts.map(JSON.parse);
if (itemMetadata.id !== SERVICE_ITEM_ID || !String(itemMetadata.owner ?? "").startsWith("NYCDEP_")) {
  throw new Error("Stormwater service item is not owned by the expected NYC DEP ArcGIS account");
}

const features = layerDefinitions.map((definition, index) => {
  const source = JSON.parse(sourceTexts[index]);
  if (source.type !== "FeatureCollection" || !Array.isArray(source.features)) {
    throw new Error(`Stormwater layer ${definition.id} did not return a GeoJSON FeatureCollection`);
  }
  const coordinates = source.features.flatMap((feature) => {
    if (feature.geometry?.type === "Polygon") return [feature.geometry.coordinates];
    if (feature.geometry?.type === "MultiPolygon") return feature.geometry.coordinates;
    throw new Error(`Stormwater layer ${definition.id} returned unsupported geometry ${feature.geometry?.type}`);
  }).filter((polygon) => geometryIntersectsSupportedArea({ type: "Polygon", coordinates: polygon }));
  const code = definition.code;
  return {
    type: "Feature",
    id: `stormwater-2050:${code}`,
    properties: {
      ...categoryProperties(code),
      categoryCode: code,
      sourceId: SOURCE_ID,
      scenarioId: "moderate-rain-2050-sea-level-rise",
      scenarioLabel: "Moderate rain · 2050 sea-level rise",
      rainfallRateInchesPerHour: 2.13,
      currentConditionsVerified: false,
    },
    geometry: { type: "MultiPolygon", coordinates },
  };
}).filter((feature) => feature.geometry.coordinates.length > 0);

const counts = {
  nuisance_ponding_areas: features.find((feature) => feature.properties.categoryCode === 1)?.geometry.coordinates.length ?? 0,
  deep_contiguous_areas: features.find((feature) => feature.properties.categoryCode === 2)?.geometry.coordinates.length ?? 0,
};
counts.total_areas = counts.nuisance_ponding_areas + counts.deep_contiguous_areas;

const fixture = {
  schemaVersion: 1,
  generatedAt,
  supportedAreaId: supportedArea.id,
  pilotBbox: [
    supportedArea.envelope.south,
    supportedArea.envelope.west,
    supportedArea.envelope.north,
    supportedArea.envelope.east,
  ],
  scenario: {
    id: "moderate-rain-2050-sea-level-rise",
    label: "Moderate rain · 2050 sea-level rise",
    rainfallRateInchesPerHour: 2.13,
    seaLevelCondition: "2050_projection",
    modeled: true,
    live: false,
  },
  counts,
  boundaries: {
    current_conditions: "The polygons show modeled potential flooding during the named rain scenario; they do not report what is flooded now.",
    routing: "Flood polygons are context only and never select, penalize, certify, or clear a walking route.",
    no_overlap: "No overlap means only that the route does not intersect this model snapshot; flooding can still occur elsewhere.",
  },
  source: {
    sourceId: SOURCE_ID,
    datasetId: DATASET_ID,
    datasetUrl: `https://data.cityofnewyork.us/d/${DATASET_ID}`,
    serviceUrl: SERVICE_URL,
    retrievedAt: generatedAt,
    serviceItemId: SERVICE_ITEM_ID,
    serviceOwner: itemMetadata.owner,
    sourceUpdatedAt: sourceUpdatedAt(layerMetadata),
    snapshotHash: sha256(sourceTexts.join("\n")),
  },
  type: "FeatureCollection",
  features,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture)}\n`);
await writeFile(SUMMARY_PATH, `${JSON.stringify({
  schemaVersion: fixture.schemaVersion,
  generatedAt: fixture.generatedAt,
  supportedAreaId: fixture.supportedAreaId,
  pilotBbox: fixture.pilotBbox,
  scenario: fixture.scenario,
  counts: fixture.counts,
  boundaries: fixture.boundaries,
  source: fixture.source,
})}\n`);

const registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
const registryEntry = {
  source_id: SOURCE_ID,
  publisher: "NYC Department of Environmental Protection",
  dataset_name: "NYC Stormwater Flood Map — moderate rain with 2050 sea-level rise",
  dataset_url: `https://data.cityofnewyork.us/d/${DATASET_ID}`,
  canonical_url: "https://www.nyc.gov/stormwater-map",
  download_url: queryUrls[0].toString(),
  related_urls: [
    queryUrls[1].toString(),
    `https://www.arcgis.com/home/item.html?id=${SERVICE_ITEM_ID}`,
    "https://www.nyc.gov/site/em/ready/flooding.page",
    "https://a858-nycnotify.nyc.gov/notifynyc/",
  ],
  dataset_id: DATASET_ID,
  asset_type: "modeled_hazard_context",
  authority: "official",
  access_method: "arcgis_feature_service",
  format: "Supported-area-intersecting GeoJSON MultiPolygon",
  terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse",
  source_updated_at: sourceUpdatedAt(layerMetadata),
  retrieved_at: generatedAt,
  last_successful_ingest: generatedAt,
  snapshot_hash: sha256(sourceTexts.join("\n")),
  geometry_type: "MultiPolygon scenario areas",
  pilot_bbox: {
    south: supportedArea.envelope.south,
    west: supportedArea.envelope.west,
    north: supportedArea.envelope.north,
    east: supportedArea.envelope.east,
  },
  supported_area_id: supportedArea.id,
  pilot_coverage: null,
  pilot_record_count: counts.total_areas,
  capability_status: "ingested",
  map_readiness: "context_only",
  validation_status: "pilot_context_only",
  method_version: "stormwater-2050-v1",
  current_conditions_verified: false,
  scenario: fixture.scenario,
  freshness_statement: "This is an annually updated planning model, not a live flood feed. The preview preserves the source update and retrieval times separately.",
  coverage_statement: `${counts.total_areas} modeled flood-area components intersect ${supportedArea.label}.`,
  known_limitations: [
    "Modeled potential flooding does not report current water, exact depth at a point, passability, drainage blockages, or site-specific conditions",
    "The layer models one 2.13-inch-per-hour rain scenario with projected 2050 sea-level rise and does not cover every cause or possible location of flooding",
    "A route with no mapped overlap is not proven safe, dry, clear, passable, or flood-free",
  ],
  allowed_claims: [
    "Area included in DEP’s modeled moderate-rain stormwater scenario with projected 2050 sea-level rise",
    "Route geometry intersects a modeled nuisance-ponding or deep-and-contiguous-flooding polygon",
  ],
  prohibited_claims: [
    "Flooded now",
    "Exact current or forecast water depth",
    "Safe, dry, clear, passable, low-risk, flood-free, or flood-avoiding route",
  ],
};
const sources = registry.sources.filter((candidate) => ![SOURCE_ID, "nyc-stormwater-flood-map-current"].includes(candidate.source_id));
sources.push(registryEntry);
await writeFile(REGISTRY_PATH, `${JSON.stringify({ sources }, null, 2)}\n`);

console.log(`Wrote ${counts.nuisance_ponding_areas} nuisance-ponding and ${counts.deep_contiguous_areas} deep-flood model areas.`);
