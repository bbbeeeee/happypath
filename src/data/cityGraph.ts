import graphSnapshot from "./pilot-osm.json";
import type { Coordinate, PilotGraph } from "../types";

export const pilotGraph = graphSnapshot as unknown as PilotGraph;

function distance(a: Coordinate, b: Coordinate) {
  return Math.hypot((b[1] - a[1]) * 111_111, (b[0] - a[0]) * 84_200);
}

const selectableNodes = pilotGraph.nodes.filter((node) => node.name.includes(" & "));
export const defaultOrigin = selectableNodes[0]?.id ?? pilotGraph.nodes[0].id;
const originNode = pilotGraph.nodes.find((node) => node.id === defaultOrigin)!;
export const defaultDestination = selectableNodes.reduce(
  (best, node) => distance(originNode.coordinate, node.coordinate) > distance(originNode.coordinate, best.coordinate) ? node : best,
  selectableNodes[0] ?? pilotGraph.nodes.at(-1)!,
).id;

export const endpointNodes = selectableNodes.length > 10 ? selectableNodes : pilotGraph.nodes;

export function nearestGraphNode(coordinate: Coordinate) {
  return pilotGraph.nodes.reduce(
    (best, node) => distance(coordinate, node.coordinate) < distance(coordinate, best.coordinate) ? node : best,
    pilotGraph.nodes[0],
  );
}

export function isInsidePilot([lng, lat]: Coordinate) {
  const [south, west, north, east] = pilotGraph.metadata!.pilotBbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}
