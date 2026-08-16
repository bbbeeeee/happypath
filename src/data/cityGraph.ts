import graphSnapshot from "./graph/bootstrap.json";
import type { Coordinate, PilotGraph } from "../types";
import { isInsideSupportedArea, partitionForCoordinate, supportedArea } from "./supportedArea";
import { loadGreeneryPartitions } from "../routing/greenery";
import { assertShadeEvidenceCoverage, loadShadePartitions } from "../routing/shade";

export const pilotGraph = graphSnapshot as unknown as PilotGraph;
const graphModules = import.meta.glob(["./graph/*.json", "!./graph/bootstrap.json"]);
const loadedPartitions = new Set<string>();
const nodeIndex = new Map(pilotGraph.nodes.map((node) => [node.id, node]));
const edgeIds = new Set(pilotGraph.edges.map((edge) => edge.id));

export function graphCoordinateDistanceMeters(a: Coordinate, b: Coordinate) {
  return Math.hypot((b[1] - a[1]) * 111_111, (b[0] - a[0]) * 84_200);
}

const selectableNodes = pilotGraph.nodes.filter((node) => node.name.includes(" & "));
export const defaultOrigin = nearestGraphNode(supportedArea.defaultJourney.origin).id;
export const defaultDestination = nearestGraphNode(supportedArea.defaultJourney.destination).id;

export const endpointNodes = selectableNodes.length > 10 ? selectableNodes : pilotGraph.nodes;

export function graphNodeById(nodeId: string) {
  return nodeIndex.get(nodeId);
}

export function loadedGraphPartitionIds() {
  return [...loadedPartitions];
}

function partitionIdsForCoordinates(coordinates: readonly Coordinate[], paddingPartitions: number) {
  const indexes = coordinates
    .map((coordinate) => partitionForCoordinate(coordinate))
    .filter((partition): partition is NonNullable<typeof partition> => Boolean(partition))
    .map((partition) => supportedArea.partitions.findIndex((candidate) => candidate.id === partition.id));
  if (!indexes.length) return [];
  const first = Math.max(0, Math.min(...indexes) - paddingPartitions);
  const last = Math.min(supportedArea.partitions.length - 1, Math.max(...indexes) + paddingPartitions);
  return supportedArea.partitions.slice(first, last + 1).map((partition) => partition.id);
}

export async function ensureGraphCoverage(coordinates: readonly Coordinate[], paddingPartitions = 0) {
  const partitionIds = partitionIdsForCoordinates(coordinates, paddingPartitions);
  await Promise.all([loadGreeneryPartitions(partitionIds), loadShadePartitions(partitionIds), ...partitionIds.map(async (partitionId) => {
    if (loadedPartitions.has(partitionId)) return;
    const load = graphModules[`./graph/${partitionId}.json`];
    if (!load) throw new Error(`Missing walking-network partition: ${partitionId}`);
    const module = await load() as { default: PilotGraph };
    for (const node of module.default.nodes) {
      if (!nodeIndex.has(node.id)) {
        nodeIndex.set(node.id, node);
        pilotGraph.nodes.push(node);
      }
    }
    for (const edge of module.default.edges) {
      if (!edgeIds.has(edge.id)) {
        edgeIds.add(edge.id);
        pilotGraph.edges.push(edge);
      }
    }
    loadedPartitions.add(partitionId);
  })]);
  assertShadeEvidenceCoverage(pilotGraph.edges, pilotGraph.metadata?.generatedAt);
  return partitionIds;
}

export function nearestGraphNode(coordinate: Coordinate) {
  return pilotGraph.nodes.reduce(
    (best, node) => graphCoordinateDistanceMeters(coordinate, node.coordinate) < graphCoordinateDistanceMeters(coordinate, best.coordinate) ? node : best,
    pilotGraph.nodes[0],
  );
}

export function nearestGraphNodeWithin(coordinate: Coordinate, maximumDistanceMeters = 180) {
  const node = nearestGraphNode(coordinate);
  return graphCoordinateDistanceMeters(coordinate, node.coordinate) <= maximumDistanceMeters ? node : null;
}

export function isInsidePilot([lng, lat]: Coordinate) {
  return isInsideSupportedArea([lng, lat]);
}
