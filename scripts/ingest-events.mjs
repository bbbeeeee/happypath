/**
 * Permitted event ingest.
 *
 * NYC Permitted Event Information (tvpp-9vvx) publishes no coordinates. A street
 * event names its location as prose — "AVENUE OF THE AMERICAS between WEST 42
 * STREET and WEST 34 STREET" — so this script resolves that prose against the
 * routing graph and stores the run of edges the closure actually covers.
 *
 * Storing edges rather than a point is what lets the app say "on your way"
 * truthfully: the claim becomes a segment overlap against the chosen route,
 * not a radius guess around a dropped pin.
 *
 * A permit records an approval. It does not record that the event is happening,
 * so nothing here is route-affecting.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { normalizeStreetAliases, parseLocationClauses } from "./lib/street-names.mjs";
import { coordinateInsideSupportedArea, supportedArea } from "./lib/supported-area.mjs";

const NYC_API_ROOT = process.env.NYC_OPEN_DATA_API_ROOT ?? "https://data.cityofnewyork.us";
const DATASET_ID = "tvpp-9vvx";
const SOURCE_ID = "nyc-permitted-events";
const OUTPUT_URL = new URL("../src/data/pilot-events.json", import.meta.url);
const REGISTRY_URL = new URL("../src/data/source-registry.json", import.meta.url);
const GRAPH_DIR = new URL("../src/data/graph/", import.meta.url);
const GRAPH_PARTITIONS = ["bootstrap", "chelsea", "downtown", "fidi", "midtown-60", "midtown-south", "village"];
const RETRIEVED_AT = process.env.EVENT_RETRIEVED_AT ?? new Date().toISOString();

/** How far ahead a permit is worth keeping in the checked-in snapshot. */
const HORIZON_DAYS = Number(process.env.EVENT_HORIZON_DAYS ?? 30);

/**
 * Event types a resident would plausibly want to be invited to. Production
 * events and filming are permitted occupancy, not public invitations, so they
 * are ingested but marked non-inviting rather than dropped.
 */
const INVITING_TYPES = new Set([
  "Street Festival", "Block Party", "Farmers Market", "Parade",
  "Single Block Festival", "Street Event", "Plaza Event",
  "Plaza Partner Event", "Open Street Partner Event", "Special Event",
]);

/** Latitude tolerance when deciding whether an edge falls inside a block run. */
const SPAN_TOLERANCE_DEGREES = 0.00035;

async function loadGraph() {
  const nodes = new Map();
  const edges = [];
  for (const partition of GRAPH_PARTITIONS) {
    const raw = await readFile(new URL(`${partition}.json`, GRAPH_DIR), "utf8");
    const parsed = JSON.parse(raw);
    for (const node of parsed.nodes ?? []) nodes.set(node.id, node);
    for (const edge of parsed.edges ?? []) edges.push(edge);
  }
  return { nodes, edges };
}

function indexGraph({ nodes, edges }) {
  const edgesByStreet = new Map();
  const streetsByNode = new Map();
  for (const edge of edges) {
    const aliases = normalizeStreetAliases(edge.street);
    for (const alias of aliases) {
      if (!edgesByStreet.has(alias)) edgesByStreet.set(alias, []);
      edgesByStreet.get(alias).push(edge);
    }
    for (const nodeId of [edge.from, edge.to]) {
      if (!streetsByNode.has(nodeId)) streetsByNode.set(nodeId, new Set());
      for (const alias of aliases) streetsByNode.get(nodeId).add(alias);
    }
  }
  return { nodes, edgesByStreet, streetsByNode };
}

function findCrossing(index, onStreet, crossStreet) {
  for (const [nodeId, streets] of index.streetsByNode) {
    if (streets.has(onStreet) && streets.has(crossStreet)) {
      const node = index.nodes.get(nodeId);
      if (node) return node;
    }
  }
  return null;
}

/**
 * Resolve one "A between B and C" clause to the run of edges on A that lies
 * between the two crossings. Returns null when either crossing is outside the
 * supported area, which is the common and expected case for uptown permits.
 */
function resolveClause(index, clause) {
  const onEdges = index.edgesByStreet.get(clause.onStreet);
  if (!onEdges?.length) return null;

  const fromNode = findCrossing(index, clause.onStreet, clause.fromStreet);
  const toNode = findCrossing(index, clause.onStreet, clause.toStreet);
  if (!fromNode || !toNode) return null;

  // Avenues run north-south and streets run east-west; comparing along the
  // dominant axis of the two crossings picks the right one without hardcoding.
  const deltaLongitude = Math.abs(fromNode.coordinate[0] - toNode.coordinate[0]);
  const deltaLatitude = Math.abs(fromNode.coordinate[1] - toNode.coordinate[1]);
  const axis = deltaLatitude >= deltaLongitude ? 1 : 0;
  const low = Math.min(fromNode.coordinate[axis], toNode.coordinate[axis]) - SPAN_TOLERANCE_DEGREES;
  const high = Math.max(fromNode.coordinate[axis], toNode.coordinate[axis]) + SPAN_TOLERANCE_DEGREES;

  const span = onEdges.filter((edge) =>
    edge.geometry.every((coordinate) => coordinate[axis] >= low && coordinate[axis] <= high));
  if (!span.length) return null;

  const coordinates = span.flatMap((edge) => edge.geometry);
  if (!coordinates.some((coordinate) => coordinateInsideSupportedArea(coordinate))) return null;

  return {
    onStreet: clause.onStreet,
    fromStreet: clause.fromStreet,
    toStreet: clause.toStreet,
    edgeIds: span.map((edge) => edge.id),
    nodePairs: span.map((edge) => [edge.from, edge.to]),
    // Rounded to about 0.1m, which is well past what the map draws and keeps
    // the checked-in snapshot inside the payload budget.
    geometry: span.map((edge) => edge.geometry.map(([lng, lat]) => [
      Number(lng.toFixed(6)),
      Number(lat.toFixed(6)),
    ])),
    meters: Math.round(span.reduce((total, edge) => total + edge.distanceMeters, 0)),
  };
}

/** Title-case the shouted permit text without mangling short connecting words. */
function titleCase(text) {
  const minor = new Set(["of", "the", "and", "at", "on", "in", "to", "for", "a", "an"]);
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && minor.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .trim();
}

async function fetchPermits(windowStart, windowEnd) {
  const url = new URL(`/resource/${DATASET_ID}.json`, NYC_API_ROOT);
  url.searchParams.set("$limit", "5000");
  url.searchParams.set("$order", "start_date_time");
  url.searchParams.set(
    "$where",
    `event_borough='Manhattan' AND start_date_time between '${windowStart}' and '${windowEnd}'`,
  );
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Permitted event request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function buildEventSnapshot() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const graph = await loadGraph();
  const index = indexGraph(graph);
  const permits = await fetchPermits(
    windowStart.toISOString().slice(0, 19),
    windowEnd.toISOString().slice(0, 19),
  );

  const events = [];
  const stats = { fetched: permits.length, resolved: 0, unresolvedLocation: 0, outsideArea: 0 };

  for (const permit of permits) {
    const clauses = parseLocationClauses(permit.event_location ?? "");
    if (!clauses.length) {
      stats.unresolvedLocation += 1;
      continue;
    }
    const segments = clauses
      .map((clause) => resolveClause(index, clause))
      .filter((segment) => segment !== null);
    if (!segments.length) {
      stats.outsideArea += 1;
      continue;
    }

    stats.resolved += 1;
    events.push({
      id: `permit-${permit.event_id}`,
      recordId: permit.event_id ?? null,
      name: titleCase(permit.event_name ?? "Permitted event"),
      eventType: permit.event_type ?? null,
      agency: permit.event_agency ?? null,
      startsAt: permit.start_date_time ?? null,
      endsAt: permit.end_date_time ?? null,
      closureType: permit.street_closure_type ?? null,
      locationLabel: permit.event_location ?? "",
      inviting: INVITING_TYPES.has(permit.event_type ?? ""),
      segments,
      totalMeters: segments.reduce((total, segment) => total + segment.meters, 0),
      sourceId: SOURCE_ID,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: RETRIEVED_AT,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    source: {
      id: SOURCE_ID,
      datasetId: DATASET_ID,
      datasetName: "NYC Permitted Event Information",
      publisher: "NYC Street Activity Permit Office",
      datasetUrl: `https://data.cityofnewyork.us/d/${DATASET_ID}`,
      termsUrl: "https://opendata.cityofnewyork.us/overview/#termsofuse",
      retrievedAt: RETRIEVED_AT,
    },
    boundaries: {
      permitMeaning:
        "A permit records an approved application. It does not prove the event is set up, staffed, or happening.",
      geometry:
        "Event extent is resolved from permit street prose onto graph edges. It reflects the named block run, not a surveyed closure boundary.",
      routing:
        "Permitted events are display-only. They never change routing cost, and never gate a route.",
    },
    stats,
    events,
  };
}

function registryRecord(snapshot, serialized) {
  return {
    source_id: SOURCE_ID,
    publisher: snapshot.source.publisher,
    dataset_name: snapshot.source.datasetName,
    dataset_url: snapshot.source.datasetUrl,
    canonical_url: snapshot.source.datasetUrl,
    dataset_id: DATASET_ID,
    asset_type: "dataset",
    authority: "official",
    access_method: "socrata_api",
    format: "JSON",
    terms_url: snapshot.source.termsUrl,
    attribution: snapshot.source.publisher,
    refresh_target: "Daily during the preview window",
    source_updated_at: null,
    retrieved_at: snapshot.source.retrievedAt,
    last_successful_ingest: snapshot.source.retrievedAt,
    snapshot_hash: `sha256:${createHash("sha256").update(serialized).digest("hex")}`,
    geometry_type: "Graph edge runs resolved from permit street prose",
    source_crs: "EPSG:4326",
    supported_area_id: supportedArea.id,
    pilot_coverage: null,
    pilot_record_count: snapshot.events.length,
    derived_from: ["openstreetmap"],
    method_version: "permit-block-run-resolution-v1",
    capability_status: "ingested",
    current_operation_verified: false,
    known_limitations: [
      "A permit records an approved application, not an event that is set up or happening",
      "Event extent is resolved from street prose onto graph edges, not from a surveyed closure boundary",
      "Permits naming streets outside the supported area are dropped rather than approximated",
    ],
    allowed_claims: [
      "A permitted event is on record for a block this route uses",
      "Published permit window, event type, and closure type",
    ],
    prohibited_claims: [
      "The event is happening now",
      "The street is currently closed",
      "Complete coverage of events in the area",
    ],
    validation_status: "pending",
  };
}

async function main() {
  const snapshot = await buildEventSnapshot();
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(OUTPUT_URL, serialized);

  const registry = JSON.parse(await readFile(REGISTRY_URL, "utf8"));
  const retained = registry.sources.filter((source) => source.source_id !== SOURCE_ID);
  await writeFile(
    REGISTRY_URL,
    `${JSON.stringify({ ...registry, sources: [...retained, registryRecord(snapshot, serialized)] }, null, 2)}\n`,
  );
  const { fetched, resolved, unresolvedLocation, outsideArea } = snapshot.stats;
  console.log(
    `Permitted events: ${resolved} resolved of ${fetched} fetched ` +
    `(${outsideArea} outside supported area, ${unresolvedLocation} without a parsable block run).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
