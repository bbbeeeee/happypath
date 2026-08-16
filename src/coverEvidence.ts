import summaryJson from "./data/pilot-cover-summary.json";
import { orientedEdgeCoordinates } from "./routing/geometry";
import type { GraphEdge, JourneyResult, JourneyRoute, PilotGraph } from "./types";

export type CoverContextKind = "sidewalk_shed_permit" | "pops_arcade" | "construction_closure";

interface CoverContextProperties {
  kind: CoverContextKind;
  label: string;
  locationLabel: string;
  detail: string;
  sourceId: string;
  evidenceClass: "permit_nearby" | "listed_space_nearby" | "dated_construction_context";
  validFrom?: string | null;
  validThrough?: string | null;
  purpose?: string | null;
  recordId: string | null;
}

export interface CoverContextFeature {
  type: "Feature";
  id: string;
  properties: CoverContextProperties;
  geometry:
    | { type: "Point"; coordinates: [number, number] }
    | { type: "MultiLineString"; coordinates: [number, number][][] };
}

export interface CoverContextVicinityFeature {
  type: "Feature";
  id: string;
  properties: CoverContextProperties & {
    extentClass: "record_vicinity";
    extentAccuracy: "approximate";
  };
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
}

interface CoverEvidenceSummary {
  schemaVersion: 1;
  generatedAt: string;
  snapshotDay: string;
  pilotBbox: [number, number, number, number];
  counts: {
    mapped_cover_edges: number;
    mapped_cover_meters: number;
    sidewalk_shed_permits: number;
    sidewalk_shed_permit_records: number;
    pops_arcades: number;
    construction_closures: number;
  };
  boundaries: {
    mapped_cover: string;
    candidate_context: string;
    awnings: string;
  };
  mappedCover: {
    sourceId: "openstreetmap";
    sourceUrl: string;
    retrievedAt: string;
    snapshotHash: string;
    edges: Array<{
      edgeId: string;
      wayId: number;
      coverType: "building_passage" | "arcade" | "colonnade" | "partial" | "covered_way";
      coverShare: number;
    }>;
  };
}

const summary = summaryJson as unknown as CoverEvidenceSummary;
const fullCoverValues = new Set(["yes", "arcade", "colonnade"]);
const mappedCoverByEdgeId = new Map(summary.mappedCover.edges.map((record) => [record.edgeId, record]));

export const coverEvidenceMetadata = {
  generatedAt: summary.generatedAt,
  snapshotDay: summary.snapshotDay,
  counts: summary.counts,
  boundaries: summary.boundaries,
  sourceIds: ["openstreetmap", "nyc-sidewalk-shed-permits", "nyc-pops", "nyc-street-construction-closures"] as const,
  mappedCover: summary.mappedCover,
};

/**
 * Returns favorable route evidence only for path-aligned OSM tags. Permit and
 * public-space points remain context because they do not locate exact cover.
 */
export function mappedCoverShare(edge: GraphEdge) {
  const snapshotRecord = mappedCoverByEdgeId.get(edge.id);
  if (snapshotRecord) return snapshotRecord.coverShare;
  if (edge.osm?.tunnel === "building_passage") return 1;
  if (edge.osm?.covered && fullCoverValues.has(edge.osm.covered)) return 1;
  if (edge.osm?.covered === "partial") return 0.5;
  return 0;
}

function coverType(edge: GraphEdge) {
  const snapshotRecord = mappedCoverByEdgeId.get(edge.id);
  if (snapshotRecord) return snapshotRecord.coverType;
  if (edge.osm?.tunnel === "building_passage") return "building_passage" as const;
  if (edge.osm?.covered === "arcade") return "arcade" as const;
  if (edge.osm?.covered === "colonnade") return "colonnade" as const;
  if (edge.osm?.covered === "partial") return "partial" as const;
  return "covered_way" as const;
}

function coverLabel(edge: GraphEdge) {
  const type = coverType(edge);
  if (type === "building_passage") return "Mapped building passage";
  if (type === "arcade") return "Mapped arcade";
  if (type === "colonnade") return "Mapped colonnade";
  if (type === "partial") return "Partly covered in the community map";
  return "Mapped overhead cover";
}

export function mappedCoverGeoJSON(graph: PilotGraph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    type: "FeatureCollection" as const,
    features: graph.edges.flatMap((edge) => {
      const coverShare = mappedCoverShare(edge);
      if (coverShare === 0) return [];
      return [{
        type: "Feature" as const,
        id: edge.id,
        properties: {
          edgeId: edge.id,
          wayId: edge.osm?.wayId ?? null,
          street: friendlyStreet(edge.street),
          coverShare,
          coverType: coverType(edge),
          label: coverLabel(edge),
          sourceLabel: "OpenStreetMap contributors",
          sourceId: "openstreetmap",
          proofLabel: "Community-mapped geometry; current access and rain protection are not verified",
          evidenceKind: "mapped_geometry" as const,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: orientedEdgeCoordinates(edge, edge.from, nodeById),
        },
      }];
    }),
  };
}

let coverContextPromise: Promise<{ type: "FeatureCollection"; features: CoverContextFeature[] }> | null = null;

export function loadCoverContextGeoJSON() {
  if (!coverContextPromise) {
    coverContextPromise = import("./data/pilot-cover-evidence.json").then((module) => {
      const fixture = module.default as unknown as CoverEvidenceSummary & { features: CoverContextFeature[] };
      return { type: "FeatureCollection" as const, features: fixture.features };
    });
  }
  return coverContextPromise;
}

/**
 * Turn point-only permit and arcade records into small, explicitly approximate
 * vicinity shapes. These aid spatial scanning but never claim a surveyed
 * footprint or route-quality evidence.
 */
export function coverContextVicinityGeoJSON(context: { features: readonly CoverContextFeature[] }) {
  return {
    type: "FeatureCollection" as const,
    features: context.features.flatMap((feature): CoverContextVicinityFeature[] => {
      if (feature.geometry.type !== "Point") return [];
      const [longitude, latitude] = feature.geometry.coordinates;
      const radiusMeters = feature.properties.kind === "pops_arcade" ? 30 : 20;
      const sides = feature.properties.kind === "pops_arcade" ? 6 : 4;
      const angleOffset = feature.properties.kind === "pops_arcade" ? Math.PI / 6 : Math.PI / 4;
      const latitudeDegrees = radiusMeters / 110_574;
      const longitudeDegrees = radiusMeters / (111_320 * Math.cos(latitude * Math.PI / 180));
      const ring = Array.from({ length: sides + 1 }, (_, index) => {
        const angle = angleOffset + index / sides * Math.PI * 2;
        return [
          longitude + Math.cos(angle) * longitudeDegrees,
          latitude + Math.sin(angle) * latitudeDegrees,
        ] as [number, number];
      });
      return [{
        type: "Feature",
        id: `vicinity:${String(feature.id)}`,
        properties: {
          ...feature.properties,
          detail: `${feature.properties.detail} Shown as an approximate record vicinity, not a surveyed cover footprint.`,
          extentClass: "record_vicinity",
          extentAccuracy: "approximate",
        },
        geometry: { type: "Polygon", coordinates: [ring] },
      }];
    }),
  };
}

export function routeMappedCoverMeters(route: JourneyRoute, graph: PilotGraph) {
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return route.edgeIds.reduce((meters, edgeId) => {
    const edge = edgeById.get(edgeId);
    return edge ? meters + edge.distanceMeters * mappedCoverShare(edge) : meters;
  }, 0);
}

export function routeCoverShare(route: JourneyRoute, graph: PilotGraph) {
  return route.distanceMeters === 0 ? 0 : routeMappedCoverMeters(route, graph) / route.distanceMeters;
}

type TimedJourneyResult = JourneyResult & {
  timing?: {
    intent: "destination" | "target" | "maximum";
    requestedMinutes: number | null;
    targetRangeMinutes: { minimum: number; maximum: number } | null;
  };
};

export function pickRainFriendlyRoute(result: TimedJourneyResult, graph: PilotGraph) {
  const candidates = [result.recommended, ...result.alternatives];
  const requestedMinutes = result.timing?.requestedMinutes;
  const targetRange = result.timing?.targetRangeMinutes;
  let timeEligible = candidates;
  if (targetRange) {
    const inTarget = candidates.filter((route) => route.durationMinutes >= targetRange.minimum - 0.0001
      && route.durationMinutes <= targetRange.maximum + 0.0001);
    if (inTarget.length > 0) {
      timeEligible = inTarget;
    } else if (requestedMinutes !== null && requestedMinutes !== undefined) {
      const closestDifference = Math.min(...candidates.map((route) => Math.abs(route.durationMinutes - requestedMinutes)));
      timeEligible = candidates.filter((route) => Math.abs(route.durationMinutes - requestedMinutes) <= closestDifference + 0.25);
    }
  } else if (result.timing?.intent === "maximum" && requestedMinutes !== null && requestedMinutes !== undefined) {
    timeEligible = candidates.filter((route) => route.durationMinutes <= requestedMinutes + 0.0001);
  }
  return timeEligible.sort((a, b) => (
    routeMappedCoverMeters(b, graph) - routeMappedCoverMeters(a, graph)
      || routeCoverShare(b, graph) - routeCoverShare(a, graph)
      || b.preferenceScore - a.preferenceScore
      || a.durationMinutes - b.durationMinutes
  ))[0];
}

export function routeCoverSegmentsGeoJSON(route: JourneyRoute | null | undefined, graph: PilotGraph) {
  if (!route) return { type: "FeatureCollection" as const, features: [] };
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    type: "FeatureCollection" as const,
    features: route.edgeIds.flatMap((edgeId, index) => {
      const edge = edgeById.get(edgeId);
      if (!edge) throw new Error(`Route references unknown edge ${edgeId}`);
      const coverShare = mappedCoverShare(edge);
      if (coverShare === 0) return [];
      return [{
        type: "Feature" as const,
        id: `${route.candidateId}:cover:${index}`,
        properties: {
          edgeId,
          wayId: edge.osm?.wayId ?? null,
          order: index,
          street: friendlyStreet(edge.street),
          coverShare,
          coverBand: coverShare === 1 ? "mapped" : "partial",
          coverType: coverType(edge),
          label: coverLabel(edge),
          sourceId: "openstreetmap",
          proofLabel: "Mapped overhead geometry; conditions may have changed",
        },
        geometry: {
          type: "LineString" as const,
          coordinates: orientedEdgeCoordinates(edge, route.nodeIds[index], nodeById),
        },
      }];
    }),
  };
}

function friendlyStreet(value: string) {
  const street = value.trim();
  if (!street || /^unnamed|pedestrian way|path$/i.test(street)) return "Pedestrian connection";
  return street;
}
