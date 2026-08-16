import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  coordinateInsideSupportedArea,
  geometryIntersectsSupportedArea,
  supportedArea,
  supportedAreaOverpassPolygon,
} from "./lib/supported-area.mjs";

const GRAPH_PATH = new URL("../src/data/pilot-osm.json", import.meta.url);
const OUTPUT_PATH = new URL("../src/data/pilot-cover-evidence.json", import.meta.url);
const SUMMARY_PATH = new URL("../src/data/pilot-cover-summary.json", import.meta.url);
const REGISTRY_PATH = new URL("../src/data/source-registry.json", import.meta.url);
const SOCRATA = "https://data.cityofnewyork.us";
const SHEDS_ID = "rbx6-tga4";
const POPS_ID = "rvih-nhyn";
const CONSTRUCTION_ID = "i6b5-j7bu";
const OVERPASS_URLS = [...new Set([
  process.env.OVERPASS_URL,
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter(Boolean))];

const graph = JSON.parse(await readFile(GRAPH_PATH, "utf8"));
const [south, west, north, east] = graph.metadata.pilotBbox;
const generatedAt = process.env.COVER_EVIDENCE_RETRIEVED_AT ?? new Date().toISOString();
const snapshotDay = generatedAt.slice(0, 10);
const dayStart = `${snapshotDay}T00:00:00`;
const dayEnd = `${snapshotDay}T23:59:59`;

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fetchText(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { "User-Agent": "FootnotePrototype/0.1", ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status} ${await response.text()}`);
  return response.text();
}

function resourceUrl(datasetId, extension, query) {
  const url = new URL(`/resource/${datasetId}.${extension}`, SOCRATA);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

async function fetchSocrataPages(datasetId, extension, query, pageSize = 5000) {
  const rows = [];
  const texts = [];
  const urls = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = resourceUrl(datasetId, extension, { ...query, $limit: String(pageSize), $offset: String(offset) });
    const pageText = await fetchText(url);
    const page = JSON.parse(pageText);
    if (!Array.isArray(page)) throw new Error(`${datasetId} pagination expected a JSON array`);
    rows.push(...page);
    texts.push(pageText);
    urls.push(url);
    if (page.length < pageSize) break;
  }
  return { rows, snapshotText: texts.join("\n"), urls };
}

async function metadata(datasetId) {
  return JSON.parse(await fetchText(new URL(`/api/views/${datasetId}`, SOCRATA)));
}

function sourceUpdatedAt(value) {
  return value?.rowsUpdatedAt ? new Date(value.rowsUpdatedAt * 1000).toISOString() : null;
}

function latestSequence(first, second) {
  const firstSequence = Number(first.sequence_number ?? 0);
  const secondSequence = Number(second.sequence_number ?? 0);
  if (firstSequence !== secondSequence) return firstSequence > secondSequence ? first : second;
  return String(first.issued_date ?? "").localeCompare(String(second.issued_date ?? "")) >= 0 ? first : second;
}

function shedKey(record) {
  return record.bin || `${record.house_no}|${record.street_name}|${record.latitude}|${record.longitude}`;
}

const shedQuery = {
  $select: "job_filing_number,work_permit,sequence_number,house_no,street_name,borough,bin,bbl,work_type,approved_date,issued_date,expired_date,permit_status,latitude,longitude,job_description",
  $where: `work_type=\"Sidewalk Shed\" AND work_permit like \"%-SH\" AND latitude between ${south} and ${north} AND longitude between ${west} and ${east}`,
  $order: "work_permit,sequence_number DESC,issued_date DESC,job_filing_number",
};
const shedPages = await fetchSocrataPages(SHEDS_ID, "json", shedQuery);
const shedUrl = shedPages.urls[0];
const shedText = shedPages.snapshotText;
const shedRows = shedPages.rows;
const latestShedPermits = [...shedRows.reduce((records, record) => {
  records.set(record.work_permit, records.has(record.work_permit) ? latestSequence(records.get(record.work_permit), record) : record);
  return records;
}, new Map()).values()].filter((record) => (
  record.permit_status === "Permit Issued"
  && String(record.issued_date ?? "") <= dayEnd
  && String(record.expired_date ?? "") >= dayStart
  && Number.isFinite(Number(record.latitude))
  && Number.isFinite(Number(record.longitude))
  && coordinateInsideSupportedArea([Number(record.longitude), Number(record.latitude)])
));
const dedupedSheds = [...latestShedPermits.reduce((records, record) => {
  const key = shedKey(record);
  records.set(key, records.has(key) ? latestSequence(records.get(key), record) : record);
  return records;
}, new Map()).values()];

const popsUrl = resourceUrl(POPS_ID, "json", {
  $select: "pops_number,building_address_with_zip,building_constructed,public_space_type,hour_of_access_required,amenities_required,latitude,longitude,bin,bbl",
  $where: `latitude between ${south} and ${north} AND longitude between ${west} and ${east}`,
  $order: "pops_number",
  $limit: "1000",
});
const popsText = await fetchText(popsUrl);
const popsRows = JSON.parse(popsText);
const coveredSpacePattern = /(?:^|;)\s*(?:arcade|covered pedestrian space|through[- ]block arcade)/i;
const arcadeRows = popsRows.filter((record) => (
  record.building_constructed === "Completed"
  && coveredSpacePattern.test(record.public_space_type ?? "")
  && coordinateInsideSupportedArea([Number(record.longitude), Number(record.latitude)])
));

const constructionUrl = resourceUrl(CONSTRUCTION_ID, "geojson", {
  $select: "the_geom,segmentid,onstreetname,fromstreetname,tostreetname,work_start_date,work_end_date,uniqueid,purpose",
  $where: `within_box(the_geom,${north},${west},${south},${east}) AND work_start_date <= \"${dayEnd}\" AND work_end_date >= \"${dayStart}\"`,
  $limit: "1000",
});
const constructionText = await fetchText(constructionUrl);
const construction = JSON.parse(constructionText);

function mappedCoverType(tags) {
  if (tags.tunnel === "building_passage") return { coverType: "building_passage", coverShare: 1 };
  if (["yes", "arcade", "colonnade"].includes(tags.covered)) return { coverType: tags.covered === "yes" ? "covered_way" : tags.covered, coverShare: 1 };
  if (tags.covered === "partial") return { coverType: "partial", coverShare: 0.5 };
  return null;
}

const overpassPolygon = supportedAreaOverpassPolygon();
const coverQuery = `[out:json][timeout:120];(way[highway][covered](poly:"${overpassPolygon}");way[highway][tunnel=building_passage](poly:"${overpassPolygon}"););out tags;`;
const graphCoverWays = new Map();
for (const edge of graph.edges) {
  if (!mappedCoverType(edge.osm ?? {}) || !edge.osm?.wayId) continue;
  graphCoverWays.set(edge.osm.wayId, {
    type: "way",
    id: edge.osm.wayId,
    tags: {
      highway: edge.osm.highway ?? undefined,
      covered: edge.osm.covered ?? undefined,
      tunnel: edge.osm.tunnel ?? undefined,
    },
  });
}
let osmCoverText = graphCoverWays.size > 0 ? JSON.stringify({
  version: 0.6,
  generator: "Footnote checked-in OSM graph",
  elements: [...graphCoverWays.values()],
}) : undefined;
let osmCoverUrl = graphCoverWays.size > 0 ? "https://www.openstreetmap.org/copyright" : undefined;
let osmCoverError;
for (const url of osmCoverText ? [] : OVERPASS_URLS) {
  try {
    osmCoverText = await fetchText(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: coverQuery }),
    });
    osmCoverUrl = url;
    break;
  } catch (error) {
    osmCoverError = error;
  }
}
if (!osmCoverText) throw osmCoverError;
const osmCoverSnapshot = JSON.parse(osmCoverText);
const osmCoverByWayId = new Map(osmCoverSnapshot.elements.map((way) => [way.id, way.tags ?? {}]));

const mappedCoverEdges = graph.edges.flatMap((edge) => {
  const mapped = mappedCoverType(osmCoverByWayId.get(edge.osm?.wayId) ?? {});
  return mapped ? [{ edgeId: edge.id, wayId: edge.osm.wayId, ...mapped }] : [];
});

const shedFeatures = dedupedSheds.map((record) => ({
  type: "Feature",
  id: `shed:${record.work_permit ?? shedKey(record)}`,
  properties: {
    kind: "sidewalk_shed_permit",
    label: "Sidewalk-shed permit nearby",
    locationLabel: `${record.house_no ?? ""} ${record.street_name ?? ""}`.trim() || "Published permit location",
    detail: "A currently dated DOB permit record is near this point. It does not confirm a shed is present, above this sidewalk, passable, or dry.",
    sourceId: "nyc-sidewalk-shed-permits",
    evidenceClass: "permit_nearby",
    validFrom: record.issued_date ?? null,
    validThrough: record.expired_date ?? null,
    recordId: record.work_permit ?? record.job_filing_number ?? null,
  },
  geometry: { type: "Point", coordinates: [Number(record.longitude), Number(record.latitude)] },
}));

const arcadeFeatures = arcadeRows.map((record) => ({
  type: "Feature",
  id: `pops:${record.pops_number}`,
  properties: {
    kind: "pops_arcade",
    label: "Arcade listed at this public space",
    locationLabel: record.building_address_with_zip || "POPS development address",
    detail: "The City lists an arcade at this development. The point does not map its entrance, walking path, present access, or rain protection.",
    sourceId: "nyc-pops",
    evidenceClass: "listed_space_nearby",
    publicSpaceType: record.public_space_type ?? null,
    publishedHours: record.hour_of_access_required ?? null,
    recordId: record.pops_number,
  },
  geometry: { type: "Point", coordinates: [Number(record.longitude), Number(record.latitude)] },
}));

const constructionFeatures = construction.features.filter((feature) => geometryIntersectsSupportedArea(feature.geometry)).map((feature) => ({
  type: "Feature",
  id: `construction:${feature.properties.uniqueid}`,
  properties: {
    kind: "construction_closure",
    label: "Construction closure record",
    locationLabel: [feature.properties.onstreetname, feature.properties.fromstreetname && `from ${feature.properties.fromstreetname}`, feature.properties.tostreetname && `to ${feature.properties.tostreetname}`].filter(Boolean).join(" "),
    detail: "This published date window concerns through traffic. It does not confirm a pedestrian closure, obstruction, or covered path for the whole window.",
    sourceId: "nyc-street-construction-closures",
    evidenceClass: "dated_construction_context",
    validFrom: feature.properties.work_start_date ?? null,
    validThrough: feature.properties.work_end_date ?? null,
    purpose: feature.properties.purpose ?? null,
    recordId: feature.properties.uniqueid,
  },
  geometry: feature.geometry,
}));

const fixture = {
  schemaVersion: 1,
  generatedAt,
  snapshotDay,
  supportedAreaId: supportedArea.id,
  pilotBbox: graph.metadata.pilotBbox,
  counts: {
    mapped_cover_edges: mappedCoverEdges.length,
    mapped_cover_meters: mappedCoverEdges.reduce((sum, record) => {
      const edge = graph.edges.find((candidate) => candidate.id === record.edgeId);
      return sum + (edge?.distanceMeters ?? 0) * record.coverShare;
    }, 0),
    sidewalk_shed_permits: shedFeatures.length,
    sidewalk_shed_permit_records: latestShedPermits.length,
    pops_arcades: arcadeFeatures.length,
    construction_closures: constructionFeatures.length,
  },
  features: [...shedFeatures, ...arcadeFeatures, ...constructionFeatures],
  boundaries: {
    mapped_cover: "Only explicit OpenStreetMap covered-way or building-passage tags can influence routing.",
    candidate_context: "Permit, POPS, and construction records are displayed as nearby context and do not create covered route meters.",
    awnings: "No complete current public awning geometry was found, so awnings are not inferred.",
  },
  mappedCover: {
    sourceId: "openstreetmap",
    sourceUrl: osmCoverUrl,
    retrievedAt: generatedAt,
    snapshotHash: sha256(osmCoverText),
    edges: mappedCoverEdges,
  },
};
await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture)}\n`);
await writeFile(SUMMARY_PATH, `${JSON.stringify({
  schemaVersion: fixture.schemaVersion,
  generatedAt: fixture.generatedAt,
  snapshotDay: fixture.snapshotDay,
  pilotBbox: fixture.pilotBbox,
  counts: fixture.counts,
  boundaries: fixture.boundaries,
  mappedCover: fixture.mappedCover,
})}\n`);

const [shedMetadata, popsMetadata, constructionMetadata] = await Promise.all([
  metadata(SHEDS_ID),
  metadata(POPS_ID),
  metadata(CONSTRUCTION_ID),
]);
const existingRegistry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
const bbox = { south, west, north, east };
const replacements = new Map([
  ["nyc-sidewalk-shed-permits", {
    source_id: "nyc-sidewalk-shed-permits",
    publisher: "NYC Department of Buildings",
    dataset_name: "DOB NOW: Build – currently dated sidewalk-shed permit candidates",
    dataset_url: `https://data.cityofnewyork.us/d/${SHEDS_ID}`,
    canonical_url: "https://www.nyc.gov/assets/buildings/html/sidewalk-shed-map.html",
    download_url: shedUrl.toString(),
    related_urls: ["https://data.cityofnewyork.us/d/2jy7-cddj"],
    dataset_id: SHEDS_ID,
    asset_type: "dataset",
    authority: "official",
    access_method: "socrata_api",
    format: "JSON with numeric latitude and longitude fields",
    terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse",
    source_updated_at: sourceUpdatedAt(shedMetadata),
    retrieved_at: generatedAt,
    last_successful_ingest: generatedAt,
    snapshot_hash: sha256(shedText),
    geometry_type: "Geocoded permit point",
    pilot_bbox: bbox,
    supported_area_id: supportedArea.id,
    pilot_coverage: null,
    pilot_record_count: shedFeatures.length,
    capability_status: "ingested",
    map_readiness: "pilot_points_ingested",
    freshness_statement: `The checked-in pilot includes issued sidewalk-shed permits whose published expiration was on or after ${snapshotDay}.`,
    coverage_statement: `${shedFeatures.length} deduplicated permit locations fall inside the pilot bounds.`,
    known_limitations: ["A permit does not prove that a shed is installed, present today, above the mapped sidewalk, passable, or dry", "The point represents a permit address and does not establish exact shed footprint or sidewalk side"],
    allowed_claims: ["Currently dated official sidewalk-shed permit candidate near this point"],
    prohibited_claims: ["Shed is present now", "Covered or dry path", "Clear or accessible sidewalk width"],
    validation_status: "pilot_ingested",
  }],
  ["nyc-pops", {
    source_id: "nyc-pops",
    publisher: "NYC Department of City Planning",
    dataset_name: "Privately Owned Public Spaces (POPS) – arcade candidates",
    dataset_url: `https://data.cityofnewyork.us/d/${POPS_ID}`,
    canonical_url: "https://www.nyc.gov/pops",
    download_url: popsUrl.toString(),
    dataset_id: POPS_ID,
    asset_type: "dataset",
    authority: "official",
    access_method: "socrata_api",
    format: "JSON",
    terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse",
    source_updated_at: sourceUpdatedAt(popsMetadata),
    retrieved_at: generatedAt,
    last_successful_ingest: generatedAt,
    snapshot_hash: sha256(popsText),
    geometry_type: "Point at the development address",
    pilot_bbox: bbox,
    supported_area_id: supportedArea.id,
    pilot_coverage: null,
    pilot_record_count: arcadeFeatures.length,
    capability_status: "ingested",
    map_readiness: "filtered_pilot_points_ingested",
    freshness_statement: "The pilot snapshot filters official POPS records whose published public-space type names an arcade or covered pedestrian space.",
    coverage_statement: `${arcadeFeatures.length} arcade-like POPS ${arcadeFeatures.length === 1 ? "record falls" : "records fall"} inside the supported area.`,
    known_limitations: ["The point represents the development, not the public-space entrance or arcade footprint", "Required access hours and space type do not verify current access, path continuity, or rain protection"],
    allowed_claims: ["Official POPS record lists an arcade-like public-space type at this development"],
    prohibited_claims: ["Open now", "Covered route segment", "Accessible entrance or dry path"],
    validation_status: "pilot_ingested",
  }],
  ["nyc-street-construction-closures", {
    source_id: "nyc-street-construction-closures",
    publisher: "NYC Department of Transportation",
    dataset_name: "Street Closures due to Construction Activities by Block",
    dataset_url: `https://data.cityofnewyork.us/d/${CONSTRUCTION_ID}`,
    canonical_url: `https://data.cityofnewyork.us/d/${CONSTRUCTION_ID}`,
    download_url: constructionUrl.toString(),
    related_urls: ["https://data.cityofnewyork.us/d/tqtj-sjs8"],
    dataset_id: CONSTRUCTION_ID,
    asset_type: "dataset",
    authority: "official",
    access_method: "socrata_api",
    format: "GeoJSON",
    terms_url: "https://opendata.cityofnewyork.us/overview/#termsofuse",
    source_updated_at: sourceUpdatedAt(constructionMetadata),
    retrieved_at: generatedAt,
    last_successful_ingest: generatedAt,
    snapshot_hash: sha256(constructionText),
    geometry_type: "MultiLineString by street block",
    pilot_bbox: bbox,
    supported_area_id: supportedArea.id,
    pilot_coverage: null,
    pilot_record_count: constructionFeatures.length,
    capability_status: "ingested",
    map_readiness: "dated_pilot_lines_ingested",
    freshness_statement: `The pilot snapshot includes records whose published work window contains ${snapshotDay}.`,
    coverage_statement: `${constructionFeatures.length} dated closure records intersect the pilot bounds.`,
    known_limitations: ["The source concerns closures to through traffic and may apply only during part of the published permit window", "A record does not prove pedestrian closure, obstruction, exact active setup, or overhead cover"],
    allowed_claims: ["Published construction-closure record whose date window includes the snapshot date"],
    prohibited_claims: ["Sidewalk is closed", "Pedestrians cannot pass", "Covered route", "Work is active at this moment"],
    validation_status: "pilot_ingested",
  }],
]);

const sources = existingRegistry.sources
  .filter((source) => source.source_id !== "demo-cover-simulation")
  .map((source) => replacements.get(source.source_id) ?? source);
for (const [sourceId, replacement] of replacements) {
  if (!sources.some((source) => source.source_id === sourceId)) sources.push(replacement);
}
const osm = sources.find((source) => source.source_id === "openstreetmap");
if (osm) {
  osm.known_limitations = [...new Set([...osm.known_limitations, "Covered-way mapping is incomplete and does not verify current access, lighting, usable width, or dryness"])];
  osm.allowed_claims = [...new Set([...osm.allowed_claims, "Identifies path-aligned covered ways when explicitly mapped"])];
  osm.prohibited_claims = [...new Set([...osm.prohibited_claims, "Current or rainproof overhead cover", "Complete covered-way inventory"])];
}
await writeFile(REGISTRY_PATH, `${JSON.stringify({ sources }, null, 2)}\n`);

console.log(`Wrote ${mappedCoverEdges.length} mapped cover edges, ${shedFeatures.length} shed permit points, ${arcadeFeatures.length} POPS arcade ${arcadeFeatures.length === 1 ? "point" : "points"}, and ${constructionFeatures.length} construction closure lines.`);
