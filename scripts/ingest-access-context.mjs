import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { coordinateInsideSupportedArea, socrataWithinBox, supportedArea } from "./lib/supported-area.mjs";

const NYC_ROOT = process.env.NYC_OPEN_DATA_API_ROOT ?? "https://data.cityofnewyork.us";
const MTA_ROOT = process.env.MTA_OPEN_DATA_API_ROOT ?? "https://data.ny.gov";
const OUTPUT_URL = new URL("../public/data/pilot-access-context.json", import.meta.url);
const REGISTRY_URL = new URL("../src/data/source-registry.json", import.meta.url);
const RETRIEVED_AT = process.env.ACCESS_CONTEXT_RETRIEVED_AT ?? new Date().toISOString();

function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text && text !== "999" && text !== "999.0" ? text : null;
}

function numberOrNull(value) {
  const text = clean(value);
  const parsed = text === null ? Number.NaN : Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function point(row, field = "the_geom") {
  const coordinates = row[field]?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const coordinate = [Number(coordinates[0]), Number(coordinates[1])];
  return coordinate.every(Number.isFinite) && coordinateInsideSupportedArea(coordinate) ? coordinate : null;
}

function hashId(parts) {
  return createHash("sha256").update(parts.map((part) => clean(part) ?? "").join("\u001f")).digest("hex").slice(0, 16);
}

async function fetchRows(root, datasetId, select, where, order) {
  const url = new URL(`/resource/${datasetId}.json`, root);
  url.searchParams.set("$select", select.join(","));
  url.searchParams.set("$where", where);
  url.searchParams.set("$order", order);
  url.searchParams.set("$limit", "50000");
  const response = await fetch(url, { headers: { "User-Agent": "Footnote data audit (https://github.com/bbbeeeee/happypath)" } });
  if (!response.ok) throw new Error(`${datasetId} returned ${response.status}`);
  return response.json();
}

const nycBox = socrataWithinBox("the_geom", supportedArea.bounds);
const mtaBox = socrataWithinBox("georeference", supportedArea.bounds);

const [rampRows, progressRows, apsRows, signalRows, elevatorRows] = await Promise.all([
  fetchRows(NYC_ROOT, "ufzp-rrqu", ["the_geom", "cornerid", "rampid", "ramp_onstr", "stname1", "geocyclora", "ramp_width", "lnd_width", "ramp_running_slope_total", "ramp_cross_slope", "lnd_cross_slope", "counter_slope", "dws_conditions", "ponding", "obstacles_ramp", "obstacles_landing"], nycBox, "cornerid,rampid"),
  fetchRows(NYC_ROOT, "e7gc-ub6z", ["the_geom", "cornerid", "street_nam", "street_n_1", "construc_2"], nycBox, "cornerid"),
  fetchRows(NYC_ROOT, "de3m-c5p4", ["the_geom", "location", "date_insta", "ntaname"], nycBox, "location,date_insta"),
  fetchRows(NYC_ROOT, "8kuj-2n3u", ["the_geom", "main_stree", "cross_stre", "barnes_dan", "modified_b", "mid_block_", "t_oneway_1", "t_oneway_a", "installati", "ntaname"], nycBox, "main_stree,cross_stre"),
  fetchRows(MTA_ROOT, "94fv-bak7", ["georeference", "equipment_code", "station_name", "station_description", "subway_line", "service_status", "street_access", "ada_compliant", "elevator_order", "notes"], `${mtaBox} AND elevator_or_escalator='Elevator'`, "station_name,equipment_code"),
]);

const features = [];

const measuredRampsByCorner = new Map();
for (const row of rampRows) {
  const cornerId = clean(row.cornerid);
  if (!cornerId) continue;
  const rows = measuredRampsByCorner.get(cornerId) ?? [];
  rows.push(row);
  measuredRampsByCorner.set(cornerId, rows);
}

function numericSummary(rows, field, mode) {
  const values = rows.map((row) => numberOrNull(row[field])).filter((value) => value !== null && value >= 0);
  if (!values.length) return null;
  return mode === "min" ? Math.min(...values) : Math.max(...values);
}

for (const row of progressRows) {
  const coordinate = point(row);
  const cornerId = clean(row.cornerid);
  if (!coordinate || !cornerId) continue;
  const measured = measuredRampsByCorner.get(cornerId) ?? [];
  const latestCapture = measured.map((candidate) => clean(candidate.geocyclora)).filter(Boolean).sort().at(-1) ?? null;
  const obstacles = [...new Set(measured.flatMap((candidate) => [clean(candidate.obstacles_ramp), clean(candidate.obstacles_landing)]).filter((value) => value && !/^none$/i.test(value)))].slice(0, 3);
  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: coordinate },
    properties: {
      id: `curb-${cornerId}`,
      kind: "ramp_survey",
      label: [clean(row.street_nam), clean(row.street_n_1)].filter(Boolean).join(" & ") || "Curb-ramp program corner",
      programStatus: clean(row.construc_2),
      surveyedRamps: measured.length,
      capturedAt: latestCapture,
      minimumRampWidthInches: numericSummary(measured, "ramp_width", "min"),
      minimumLandingWidthInches: numericSummary(measured, "lnd_width", "min"),
      maximumRunningSlopePct: numericSummary(measured, "ramp_running_slope_total", "max"),
      maximumRampCrossSlopePct: numericSummary(measured, "ramp_cross_slope", "max"),
      maximumLandingCrossSlopePct: numericSummary(measured, "lnd_cross_slope", "max"),
      maximumCounterSlopePct: numericSummary(measured, "counter_slope", "max"),
      pondingObserved: measured.some((candidate) => /^yes$/i.test(clean(candidate.ponding) ?? "")),
      obstacles: obstacles.join(" · ") || null,
      sourceId: "nyc-ramp-program-progress",
      measurementSourceId: measured.length ? "nyc-pedestrian-ramps" : null,
    },
  });
}

for (const row of apsRows) {
  const coordinate = point(row);
  if (!coordinate) continue;
  features.push({ type: "Feature", geometry: { type: "Point", coordinates: coordinate }, properties: {
    id: `aps-${hashId([row.location, row.date_insta, ...coordinate])}`,
    kind: "accessible_signal",
    label: clean(row.location) || "Accessible pedestrian signal",
    installedAt: clean(row.date_insta),
    neighborhood: clean(row.ntaname),
    sourceId: "nyc-accessible-pedestrian-signals",
  } });
}

for (const row of signalRows) {
  const coordinate = point(row);
  if (!coordinate) continue;
  const treatment = clean(row.barnes_dan) ? "Barnes Dance"
    : clean(row.modified_b) ? "Modified Barnes Dance"
    : clean(row.mid_block_) ? "Mid-block pedestrian phase"
    : "Exclusive pedestrian phase";
  features.push({ type: "Feature", geometry: { type: "Point", coordinates: coordinate }, properties: {
    id: `signal-${hashId([row.main_stree, row.cross_stre, ...coordinate])}`,
    kind: "exclusive_signal",
    label: [clean(row.main_stree), clean(row.cross_stre)].filter(Boolean).join(" & ") || "Exclusive pedestrian signal",
    treatment,
    installedAt: clean(row.installati),
    neighborhood: clean(row.ntaname),
    sourceId: "nyc-exclusive-pedestrian-signals",
  } });
}

for (const row of elevatorRows) {
  const coordinate = point(row, "georeference");
  if (!coordinate) continue;
  features.push({ type: "Feature", geometry: { type: "Point", coordinates: coordinate }, properties: {
    id: `elevator-${clean(row.equipment_code) ?? hashId([row.station_name, ...coordinate])}`,
    kind: "transit_elevator",
    label: clean(row.station_description) || clean(row.station_name) || "Subway elevator",
    equipmentCode: clean(row.equipment_code),
    routes: clean(row.subway_line),
    serviceStatus: clean(row.service_status),
    streetAccess: clean(row.street_access),
    adaCompliant: clean(row.ada_compliant),
    elevatorOrder: clean(row.elevator_order),
    detail: clean(row.notes),
    sourceId: "mta-elevator-assets",
  } });
}

const collection = {
  type: "FeatureCollection",
  metadata: {
    retrievedAt: RETRIEVED_AT,
    supportedAreaId: supportedArea.id,
    contextOnly: true,
    limitations: [
      "Point records do not establish a continuous accessible path.",
      "Ramp measurements are historical survey observations and do not establish ADA compliance.",
      "Signal and elevator records do not verify live operation along a journey.",
    ],
    counts: Object.fromEntries(["ramp_survey", "accessible_signal", "exclusive_signal", "transit_elevator"].map((kind) => [kind, features.filter((feature) => feature.properties.kind === kind).length])),
  },
  features,
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT_URL, `${JSON.stringify(collection)}\n`);

const registry = JSON.parse(await readFile(REGISTRY_URL, "utf8"));
for (const source of registry.sources) {
  const count = source.source_id === "nyc-pedestrian-ramps" ? features.filter((feature) => feature.properties.kind === "ramp_survey" && feature.properties.surveyedRamps > 0).length
    : source.source_id === "nyc-ramp-program-progress" ? collection.metadata.counts.ramp_survey
    : source.source_id === "nyc-accessible-pedestrian-signals" ? collection.metadata.counts.accessible_signal
    : source.source_id === "nyc-exclusive-pedestrian-signals" ? collection.metadata.counts.exclusive_signal
    : source.source_id === "mta-elevator-assets" ? collection.metadata.counts.transit_elevator
    : null;
  if (count === null) continue;
  source.retrieved_at = RETRIEVED_AT;
  source.last_successful_ingest = RETRIEVED_AT;
  source.pilot_record_count = count;
  source.capability_status = "ingested";
  source.validation_status = "pilot_context_only";
  source.map_readiness = "pilot_points_ingested_context_only";
}
await writeFile(REGISTRY_URL, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Wrote ${features.length} access-context points to ${OUTPUT_URL.pathname}`);
