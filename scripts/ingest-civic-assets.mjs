import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const NYC_API_ROOT = process.env.NYC_OPEN_DATA_API_ROOT ?? "https://data.cityofnewyork.us";
const MTA_API_ROOT = process.env.MTA_OPEN_DATA_API_ROOT ?? "https://data.ny.gov";
const GRAPH_URL = new URL("../src/data/pilot-osm.json", import.meta.url);
const OUTPUT_URL = new URL("../src/data/pilot-civic-assets.json", import.meta.url);
const REGISTRY_URL = new URL("../src/data/source-registry.json", import.meta.url);
const RETRIEVED_AT = process.env.CIVIC_ASSET_RETRIEVED_AT ?? new Date().toISOString();

const DATASETS = [
  {
    kind: "seating",
    apiRoot: NYC_API_ROOT,
    sourceId: "nyc-dot-seating",
    datasetId: "esmy-s8q5",
    datasetName: "Seating Locations",
    publisher: "NYC Department of Transportation",
    datasetUrl: "https://data.cityofnewyork.us/d/esmy-s8q5",
    termsUrl: "https://opendata.cityofnewyork.us/overview/#termsofuse",
    geometryField: "the_geom",
    order: "siteid,asset_id",
    select: [
      "the_geom",
      "category",
      "nearest_add",
      "on_street",
      "from_street",
      "to_street",
      "side_of_st",
      "installation_date",
      "asset_id",
      "asset_subtype",
      "siteid",
      "ntaname",
    ],
    allowedClaims: [
      "Mapped NYC DOT seating location",
      "Published installation date and seating type when supplied",
    ],
    prohibitedClaims: [
      "Seat is present, usable, or available now",
      "Complete seating coverage",
      "Accessible seating",
    ],
    knownLimitations: [
      "The inventory has no current operational field",
      "A mapped installation does not prove the seat is still present or usable",
    ],
  },
  {
    kind: "restroom",
    apiRoot: NYC_API_ROOT,
    sourceId: "nyc-public-restrooms",
    datasetId: "i7jb-7jku",
    datasetName: "Public Restrooms",
    publisher: "NYC Mayor's Office of Operations",
    datasetUrl: "https://data.cityofnewyork.us/d/i7jb-7jku",
    termsUrl: "https://opendata.cityofnewyork.us/overview/#termsofuse",
    geometryField: "location_1",
    order: "facility_name,latitude,longitude",
    select: [
      "facility_name",
      "location_type",
      "operator",
      "status",
      "open",
      "hours_of_operation",
      "accessibility",
      "restroom_type",
      "changing_stations",
      "additional_notes",
      "website",
      "latitude",
      "longitude",
      "location_1",
    ],
    allowedClaims: [
      "Mapped public restroom",
      "Published inventory status, season, hours, operator, and facility details",
    ],
    prohibitedClaims: [
      "Restroom is open or operational now",
      "Published hours guarantee entry",
      "An accessibility field proves an accessible route or facility",
      "Complete restroom coverage",
    ],
    knownLimitations: [
      "Published status and hours can become stale and do not verify current operation",
      "Facility accessibility does not establish an accessible journey to the restroom",
    ],
  },
  {
    kind: "drinking_fountain",
    apiRoot: NYC_API_ROOT,
    sourceId: "nyc-parks-drinking-fountains",
    datasetId: "qnv7-p7a2",
    datasetName: "NYC Parks Drinking Fountains",
    publisher: "NYC Department of Parks and Recreation",
    datasetUrl: "https://data.cityofnewyork.us/d/qnv7-p7a2",
    termsUrl: "https://opendata.cityofnewyork.us/overview/#termsofuse",
    geometryField: "the_geom",
    order: "system",
    select: [
      "system",
      "fountainty",
      "position",
      "painted",
      "gispropnum",
      "propertyna",
      "parentid",
      "borough",
      "fountainco",
      "department",
      "decription",
      "featuresta",
      "the_geom",
    ],
    allowedClaims: [
      "Mapped NYC Parks drinking fountain",
      "Published feature status and fountain details",
    ],
    prohibitedClaims: [
      "Fountain is working or available now",
      "Water availability or quality is verified now",
      "Complete drinking-fountain coverage",
    ],
    knownLimitations: [
      "Published feature status is not a live operational check",
      "Indoor fountains may depend on building access and hours",
    ],
  },
  {
    kind: "transit",
    apiRoot: MTA_API_ROOT,
    sourceId: "mta-subway-entrances-2024",
    datasetId: "i9wp-a4ja",
    datasetName: "MTA Subway Entrances and Exits: 2024",
    publisher: "Metropolitan Transportation Authority",
    datasetUrl: "https://data.ny.gov/d/i9wp-a4ja",
    termsUrl: "https://www.mta.info/open-data",
    geometryField: "entrance_georeference",
    order: "stop_name,entrance_latitude,entrance_longitude,entrance_type",
    select: [
      "division",
      "line",
      "borough",
      "stop_name",
      "complex_id",
      "constituent_station_name",
      "station_id",
      "gtfs_stop_id",
      "daytime_routes",
      "entrance_type",
      "entry_allowed",
      "exit_allowed",
      "entrance_latitude",
      "entrance_longitude",
      "entrance_georeference",
    ],
    allowedClaims: [
      "Mapped 2024 subway entrance or exit",
      "Published entrance type, entry and exit permission, station identifiers, and weekday routes",
    ],
    prohibitedClaims: [
      "Entrance is open, passable, or operating now",
      "Subway service or elevator operation is live or verified",
      "Entrance or journey is accessible or step-free",
      "Complete or current entrance coverage",
    ],
    knownLimitations: [
      "This is a static 2024 inventory and does not represent live service or entrance operation",
      "An Elevator or Ramp entrance type does not prove that equipment works or that the full journey is accessible",
    ],
  },
];

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\r\n/g, "\n").trim();
  return text || null;
}

function cleanWebsite(value) {
  if (typeof value === "string") return cleanText(value);
  if (value && typeof value === "object") return cleanText(value.url);
  return null;
}

function stableId(parts) {
  return createHash("sha256")
    .update(parts.map((part) => cleanText(part) ?? "").join("\u001f"))
    .digest("hex")
    .slice(0, 16);
}

function coordinateFrom(row, geometryField) {
  const geometry = row[geometryField];
  const raw = geometry?.type === "Point" ? geometry.coordinates : [row.longitude, row.latitude];
  const coordinate = raw?.map(Number);
  if (!coordinate || coordinate.length !== 2 || coordinate.some((value) => !Number.isFinite(value))) return null;
  return coordinate.map((value) => Number(value.toFixed(6)));
}

function operationEvidence(publishedState, unavailableValues, note) {
  const sourceValue = cleanText(publishedState);
  const normalized = sourceValue?.toLowerCase() ?? "";
  return {
    currentState: "unknown",
    publishedState: sourceValue,
    routingAvailability: unavailableValues.some((value) => normalized.includes(value))
      ? "published_unavailable"
      : "unverified",
    satisfiesHardRequirement: false,
    note,
  };
}

function normalizeSeating(row, dataset) {
  const coordinate = coordinateFrom(row, dataset.geometryField);
  if (!coordinate) return null;
  const siteId = cleanText(row.siteid);
  const assetId = cleanText(row.asset_id);
  const street = cleanText(row.on_street);
  const address = cleanText(row.nearest_add);
  return {
    id: `seating:${siteId ?? stableId([assetId, ...coordinate])}`,
    kind: "seating",
    coordinate,
    name: street ? `NYC DOT seating on ${street}` : "NYC DOT seating",
    locationLabel: address ?? street ?? "Mapped NYC DOT seating",
    sourceId: dataset.sourceId,
    sourceRecordId: assetId ?? siteId,
    operation: operationEvidence(
      null,
      [],
      "NYC DOT lists this installation, but the dataset does not verify that it is present or usable now.",
    ),
    details: {
      siteId,
      assetId,
      subtype: cleanText(row.asset_subtype),
      category: cleanText(row.category),
      installedOn: cleanText(row.installation_date)?.slice(0, 10) ?? null,
      onStreet: street,
      fromStreet: cleanText(row.from_street),
      toStreet: cleanText(row.to_street),
      sideOfStreet: cleanText(row.side_of_st),
      neighborhood: cleanText(row.ntaname),
    },
  };
}

function normalizeRestroom(row, dataset) {
  const coordinate = coordinateFrom(row, dataset.geometryField);
  if (!coordinate) return null;
  const name = cleanText(row.facility_name) ?? "Mapped public restroom";
  const operator = cleanText(row.operator);
  return {
    id: `restroom:${stableId([name, operator, ...coordinate])}`,
    kind: "restroom",
    coordinate,
    name,
    locationLabel: cleanText(row.location_type) ?? "Mapped public restroom",
    sourceId: dataset.sourceId,
    sourceRecordId: null,
    operation: operationEvidence(
      row.status,
      ["not operational", "closed", "inactive"],
      "Status and hours are published inventory values; current entry and operation are not verified.",
    ),
    details: {
      locationType: cleanText(row.location_type),
      operator,
      season: cleanText(row.open),
      publishedHours: cleanText(row.hours_of_operation),
      publishedAccessibility: cleanText(row.accessibility),
      restroomType: cleanText(row.restroom_type),
      changingStations: cleanText(row.changing_stations),
      notes: cleanText(row.additional_notes),
      website: cleanWebsite(row.website),
    },
  };
}

function normalizeFountain(row, dataset) {
  const coordinate = coordinateFrom(row, dataset.geometryField);
  if (!coordinate) return null;
  const systemId = cleanText(row.system);
  const propertyName = cleanText(row.propertyna);
  return {
    id: `drinking-fountain:${systemId ?? stableId([row.gispropnum, row.decription, ...coordinate])}`,
    kind: "drinking_fountain",
    coordinate,
    name: propertyName ? `${propertyName} drinking fountain` : "NYC Parks drinking fountain",
    locationLabel: cleanText(row.position) ?? propertyName ?? "Mapped drinking fountain",
    sourceId: dataset.sourceId,
    sourceRecordId: systemId,
    operation: operationEvidence(
      row.featuresta,
      ["inactive", "removed", "closed"],
      "Feature status comes from the Parks inventory and is not a live check that water is available.",
    ),
    details: {
      systemId,
      fountainType: cleanText(row.fountainty),
      position: cleanText(row.position),
      propertyId: cleanText(row.gispropnum),
      propertyName,
      parentId: cleanText(row.parentid),
      fountainCount: Number(row.fountainco) || null,
      department: cleanText(row.department),
      description: cleanText(row.decription),
    },
  };
}

function publishedBoolean(value) {
  const normalized = cleanText(value)?.toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

function normalizeTransit(row, dataset) {
  const coordinate = coordinateFrom(row, dataset.geometryField);
  if (!coordinate) return null;
  const stopName = cleanText(row.stop_name) ?? "Mapped subway station";
  const entranceType = cleanText(row.entrance_type);
  const routes = cleanText(row.daytime_routes)?.split(/\s+/).filter(Boolean) ?? [];
  return {
    id: `transit:${stableId([
      row.complex_id,
      row.station_id,
      row.gtfs_stop_id,
      entranceType,
      row.entry_allowed,
      row.exit_allowed,
      ...coordinate,
    ])}`,
    kind: "transit",
    coordinate,
    name: `${stopName} subway entrance`,
    locationLabel: [entranceType, routes.length ? routes.join(" ") : null].filter(Boolean).join(" · ") || "Mapped subway entrance",
    sourceId: dataset.sourceId,
    sourceRecordId: null,
    operation: operationEvidence(
      null,
      [],
      "This 2024 inventory maps an entrance or exit; current access, equipment, and train service are not verified.",
    ),
    details: {
      stopName,
      constituentStationName: cleanText(row.constituent_station_name),
      complexId: cleanText(row.complex_id),
      stationId: cleanText(row.station_id),
      gtfsStopId: cleanText(row.gtfs_stop_id),
      division: cleanText(row.division),
      line: cleanText(row.line),
      daytimeRoutes: routes,
      entranceType,
      publishedEntryAllowed: publishedBoolean(row.entry_allowed),
      publishedExitAllowed: publishedBoolean(row.exit_allowed),
      inventoryYear: "2024",
    },
  };
}

const NORMALIZERS = {
  seating: normalizeSeating,
  restroom: normalizeRestroom,
  drinking_fountain: normalizeFountain,
  transit: normalizeTransit,
};

function bboxWhere(geometryField, [south, west, north, east]) {
  return `within_box(${geometryField},${south},${west},${north},${east})`;
}

async function fetchDataset(dataset, bbox) {
  const dataUrl = new URL(`/resource/${dataset.datasetId}.json`, dataset.apiRoot);
  dataUrl.searchParams.set("$limit", "50000");
  dataUrl.searchParams.set("$select", dataset.select.join(","));
  dataUrl.searchParams.set("$where", bboxWhere(dataset.geometryField, bbox));
  dataUrl.searchParams.set("$order", dataset.order);

  const metadataUrl = new URL(`/api/views/${dataset.datasetId}`, dataset.apiRoot);
  const headers = { "User-Agent": "HappyPathPrototype/0.1 civic-assets" };
  const [dataResponse, metadataResponse] = await Promise.all([
    fetch(dataUrl, { headers }),
    fetch(metadataUrl, { headers }),
  ]);
  if (!dataResponse.ok) throw new Error(`${dataset.datasetId} request failed: ${dataResponse.status} ${await dataResponse.text()}`);
  if (!metadataResponse.ok) throw new Error(`${dataset.datasetId} metadata request failed: ${metadataResponse.status} ${await metadataResponse.text()}`);

  const snapshotText = await dataResponse.text();
  const rows = JSON.parse(snapshotText);
  const metadata = await metadataResponse.json();
  const sourceUpdatedAt = metadata.rowsUpdatedAt
    ? new Date(metadata.rowsUpdatedAt * 1000).toISOString()
    : null;
  const updateMetadata = metadata.metadata?.custom_fields?.Update ?? {};
  const datasetSummary = metadata.metadata?.custom_fields?.["Dataset Summary"] ?? {};
  const normalize = NORMALIZERS[dataset.kind];
  const assets = rows
    .map((row) => normalize(row, dataset))
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    source: {
      sourceId: dataset.sourceId,
      datasetId: dataset.datasetId,
      datasetName: metadata.name ?? dataset.datasetName,
      publisher: dataset.publisher,
      datasetUrl: dataset.datasetUrl,
      termsUrl: dataset.termsUrl,
      authority: "official",
      evidenceClass: "official_inventory",
      capabilityStatus: "ingested",
      sourceUpdatedAt,
      retrievedAt: RETRIEVED_AT,
      updateFrequency: cleanText(updateMetadata["Update Frequency"] ?? datasetSummary["Posting Frequency"]),
      dataTimePeriod: cleanText(datasetSummary["Time Period"]),
      snapshotHash: `sha256:${createHash("sha256").update(snapshotText).digest("hex")}`,
      recordCount: assets.length,
      currentOperationVerified: false,
      allowedClaims: dataset.allowedClaims,
      prohibitedClaims: dataset.prohibitedClaims,
      knownLimitations: dataset.knownLimitations,
    },
    assets,
  };
}

function registryRecord(source, bbox) {
  return {
    source_id: source.sourceId,
    publisher: source.publisher,
    dataset_name: source.datasetName,
    dataset_url: source.datasetUrl,
    canonical_url: source.datasetUrl,
    dataset_id: source.datasetId,
    asset_type: "dataset",
    authority: source.authority,
    access_method: "socrata_api",
    format: "JSON",
    terms_url: source.termsUrl,
    attribution: source.publisher,
    refresh_target: source.updateFrequency ?? "as published",
    source_updated_at: source.sourceUpdatedAt,
    retrieved_at: source.retrievedAt,
    last_successful_ingest: source.retrievedAt,
    snapshot_hash: source.snapshotHash,
    geometry_type: "Point",
    source_crs: "EPSG:4326",
    pilot_bbox: { south: bbox[0], west: bbox[1], north: bbox[2], east: bbox[3] },
    pilot_coverage: null,
    pilot_record_count: source.recordCount,
    derived_from: [],
    method_version: "civic-asset-normalization-v1",
    capability_status: source.capabilityStatus,
    current_operation_verified: false,
    known_limitations: source.knownLimitations,
    allowed_claims: source.allowedClaims,
    prohibited_claims: source.prohibitedClaims,
    validation_status: "pending",
  };
}

export async function ingestCivicAssets() {
  const graph = JSON.parse(await readFile(GRAPH_URL, "utf8"));
  const bbox = graph.metadata?.pilotBbox;
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
    throw new Error("pilot-osm.json does not contain a valid metadata.pilotBbox");
  }

  const results = await Promise.all(DATASETS.map((dataset) => fetchDataset(dataset, bbox)));
  const sources = Object.fromEntries(results.map(({ source }) => [source.sourceId, source]));
  const assets = results.flatMap((result) => result.assets).sort((a, b) => a.id.localeCompare(b.id));
  const counts = Object.fromEntries(DATASETS.map((dataset) => [
    dataset.kind,
    assets.filter((asset) => asset.kind === dataset.kind).length,
  ]));
  const fixture = {
    schemaVersion: 1,
    generatedAt: RETRIEVED_AT,
    pilotBbox: bbox,
    counts,
    sources,
    assets,
  };
  await writeFile(OUTPUT_URL, `${JSON.stringify(fixture)}\n`);

  const registry = JSON.parse(await readFile(REGISTRY_URL, "utf8"));
  const replacedIds = new Set(Object.keys(sources));
  const retainedSources = registry.sources.filter((source) => !replacedIds.has(source.source_id));
  const civicSources = Object.values(sources).map((source) => registryRecord(source, bbox));
  await writeFile(REGISTRY_URL, `${JSON.stringify({ ...registry, sources: [...retainedSources, ...civicSources] }, null, 2)}\n`);

  console.log(`Wrote ${assets.length} civic assets (${counts.seating} seating, ${counts.restroom} restrooms, ${counts.drinking_fountain} drinking fountains, ${counts.transit} transit entrances)`);
  return fixture;
}

const isDirectRun = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  ingestCivicAssets().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
