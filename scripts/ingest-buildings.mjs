import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const DATASET_ID = "5zhs-2jue";
const BBOX = [40.726, -74.006, 40.736, -73.988];
const OUTPUT = new URL("../src/data/pilot-buildings.json", import.meta.url);
const REGISTRY_OUTPUT = new URL("../src/data/source-registry.json", import.meta.url);
const api = new URL(`https://data.cityofnewyork.us/resource/${DATASET_ID}.geojson`);
api.searchParams.set("$limit", "50000");
api.searchParams.set("$select", "the_geom,bin,height_roof,last_edited_date,geom_source");
api.searchParams.set("$where", `within_box(the_geom,${BBOX.join(",")})`);

const response = await fetch(api, { headers: { "User-Agent": "HappyPathPrototype/0.1" } });
if (!response.ok) throw new Error(`NYC OpenData request failed: ${response.status} ${await response.text()}`);
const snapshotText = await response.text();
const collection = JSON.parse(snapshotText);
const retrievedAt = new Date().toISOString();
const snapshotHash = createHash("sha256").update(snapshotText).digest("hex");

const features = collection.features.map((feature) => ({
  type: "Feature",
  geometry: feature.geometry,
  properties: {
    bin: feature.properties.bin ?? null,
    heightRoofFeet: Number(feature.properties.height_roof) || null,
    lastEditedDate: feature.properties.last_edited_date ?? null,
    geometrySource: feature.properties.geom_source ?? null,
  },
}));
const heights = features.map((feature) => feature.properties.heightRoofFeet).filter((height) => height > 0 && height < 2000);
const invalidHeights = features.filter((feature) => feature.properties.heightRoofFeet !== null && (feature.properties.heightRoofFeet <= 0 || feature.properties.heightRoofFeet >= 2000)).length;
const usableHeightShare = features.length ? heights.length / features.length : 0;
const audit = {
  featureCount: features.length,
  usableHeightCount: heights.length,
  usableHeightShare,
  missingHeightCount: features.filter((feature) => feature.properties.heightRoofFeet === null).length,
  invalidHeightCount: invalidHeights,
  minimumHeightFeet: heights.length ? Math.min(...heights) : null,
  maximumHeightFeet: heights.length ? Math.max(...heights) : null,
};
await writeFile(OUTPUT, `${JSON.stringify({ type: "FeatureCollection", features, metadata: { generatedAt: retrievedAt, sourceIds: ["nyc-building-footprints"], audit } }, null, 2)}\n`);

const registry = await readFile(REGISTRY_OUTPUT, "utf8").then(JSON.parse).catch(() => ({ sources: [] }));
const otherSources = registry.sources.filter((source) => source.source_id !== "nyc-building-footprints");
otherSources.push({
  source_id: "nyc-building-footprints",
  publisher: "NYC Office of Technology and Innovation",
  dataset_name: "BUILDING",
  dataset_url: "https://data.cityofnewyork.us/d/5zhs-2jue",
  canonical_url: "https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue",
  dataset_id: DATASET_ID,
  asset_type: "dataset",
  authority: "official",
  access_method: "socrata_api",
  format: "GeoJSON",
  terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse",
  attribution: "NYC OpenData",
  refresh_target: "deliberate pilot refresh",
  source_updated_at: features.map((feature) => feature.properties.lastEditedDate).filter(Boolean).sort().at(-1) ?? null,
  retrieved_at: retrievedAt,
  last_successful_ingest: retrievedAt,
  snapshot_hash: `sha256:${snapshotHash}`,
  geometry_type: "MultiPolygon",
  source_crs: "EPSG:4326",
  pilot_bbox: { south: BBOX[0], west: BBOX[1], north: BBOX[2], east: BBOX[3] },
  pilot_coverage: usableHeightShare,
  derived_from: [],
  method_version: "nyc-building-crop-v1",
  known_limitations: ["Roof heights may be missing, zero, anomalous, or stale", "Building geometry does not measure sidewalk temperature"],
  allowed_claims: ["Estimated building shade after shadow-model validation"],
  prohibited_claims: ["Measured temperature", "Guaranteed shade", "Cooler street"],
  validation_status: "pending"
});
await writeFile(REGISTRY_OUTPUT, `${JSON.stringify({ sources: otherSources }, null, 2)}\n`);
console.log(`Wrote ${features.length} buildings; ${(usableHeightShare * 100).toFixed(1)}% have usable roof heights`);
