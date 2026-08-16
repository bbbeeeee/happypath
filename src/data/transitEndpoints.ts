import graphJson from "./pilot-osm.json";
import {
  distanceBetweenCoordinatesMeters,
  listCivicAssets,
  type CivicCoordinate,
  type TransitAsset,
} from "./civicAssets";

export interface TransitEndpointGraphNode {
  id: string;
  coordinate: CivicCoordinate;
}

export interface TransitEndpointResolutionOptions {
  maxSnapDistanceMeters?: number;
  requirePublishedEntry?: boolean;
  limit?: number;
}

export interface TransitEndpointCandidate {
  asset: TransitAsset;
  graphNodeId: string;
  snapDistanceMeters: number;
  snapBasis: "straight_line_to_graph_node";
  publishedEntryState: "allowed" | "not_allowed" | "unknown";
  currentEntranceState: "unknown";
  liveServiceState: "unknown";
  accessibilityState: "unknown";
}

const pilotGraphNodes = (graphJson as unknown as { nodes: TransitEndpointGraphNode[] }).nodes;

function validateOptions(options: TransitEndpointResolutionOptions) {
  const maxSnapDistanceMeters = options.maxSnapDistanceMeters ?? 120;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(maxSnapDistanceMeters) || maxSnapDistanceMeters < 0) {
    throw new Error("maxSnapDistanceMeters must be a non-negative finite number");
  }
  if (limit !== Number.POSITIVE_INFINITY && (!Number.isInteger(limit) || limit < 0)) {
    throw new Error("limit must be a non-negative integer");
  }
  return { maxSnapDistanceMeters, limit };
}

function publishedEntryState(asset: TransitAsset): TransitEndpointCandidate["publishedEntryState"] {
  if (asset.details.publishedEntryAllowed === true) return "allowed";
  if (asset.details.publishedEntryAllowed === false) return "not_allowed";
  return "unknown";
}

/**
 * Resolves official entrance points to graph nodes for deterministic Wander
 * endpoint generation. A geometric snap does not establish access, live service,
 * elevator operation, or a step-free journey.
 */
export function resolveTransitAssetsToGraphNodes(
  graphNodes: readonly TransitEndpointGraphNode[],
  options: TransitEndpointResolutionOptions = {},
): TransitEndpointCandidate[] {
  const { maxSnapDistanceMeters, limit } = validateOptions(options);
  if (graphNodes.length === 0 || limit === 0) return [];
  const requirePublishedEntry = options.requirePublishedEntry ?? true;
  const transitAssets = listCivicAssets(["transit"]) as TransitAsset[];

  return transitAssets
    .filter((asset) => !requirePublishedEntry || asset.details.publishedEntryAllowed !== false)
    .map((asset) => {
      let nearestNode = graphNodes[0];
      let snapDistanceMeters = distanceBetweenCoordinatesMeters(asset.coordinate, nearestNode.coordinate);
      for (let index = 1; index < graphNodes.length; index += 1) {
        const distance = distanceBetweenCoordinatesMeters(asset.coordinate, graphNodes[index].coordinate);
        if (distance < snapDistanceMeters) {
          nearestNode = graphNodes[index];
          snapDistanceMeters = distance;
        }
      }
      return {
        asset,
        graphNodeId: nearestNode.id,
        snapDistanceMeters,
        snapBasis: "straight_line_to_graph_node" as const,
        publishedEntryState: publishedEntryState(asset),
        currentEntranceState: "unknown" as const,
        liveServiceState: "unknown" as const,
        accessibilityState: "unknown" as const,
      };
    })
    .filter((candidate) => candidate.snapDistanceMeters <= maxSnapDistanceMeters)
    .sort((a, b) => a.snapDistanceMeters - b.snapDistanceMeters || a.asset.id.localeCompare(b.asset.id))
    .slice(0, limit);
}

export function getPilotTransitEndpointCandidates(
  options: TransitEndpointResolutionOptions = {},
): TransitEndpointCandidate[] {
  return resolveTransitAssetsToGraphNodes(pilotGraphNodes, options);
}
