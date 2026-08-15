import type { GraphEdge, PilotGraph, RouteComparison, RouteMode, RouteResult } from "../types";
import { edgeShade } from "./shade";
import { edgeGreenery } from "./greenery";

const WALKING_METERS_PER_MINUTE = 80;

interface AdjacentEdge {
  nodeId: string;
  edge: GraphEdge;
}

class MinQueue {
  private values: { nodeId: string; cost: number }[] = [];

  get size() { return this.values.length; }

  push(value: { nodeId: string; cost: number }) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].cost <= value.cost) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (!last || this.values.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child = right < this.values.length && this.values[right].cost < this.values[left].cost ? right : left;
      if (this.values[child].cost >= last.cost) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

function adjacency(graph: PilotGraph) {
  const result = new Map<string, AdjacentEdge[]>();
  for (const node of graph.nodes) result.set(node.id, []);
  for (const edge of graph.edges) {
    result.get(edge.from)?.push({ nodeId: edge.to, edge });
    result.get(edge.to)?.push({ nodeId: edge.from, edge });
  }
  return result;
}

function shortestPath(
  graph: PilotGraph,
  origin: string,
  destination: string,
  cost: (edge: GraphEdge) => number,
) {
  const neighbors = adjacency(graph);
  const distance = new Map(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const previous = new Map<string, { nodeId: string; edge: GraphEdge }>();
  const settled = new Set<string>();
  const queue = new MinQueue();
  distance.set(origin, 0);
  queue.push({ nodeId: origin, cost: 0 });

  while (queue.size > 0) {
    const next = queue.pop();
    if (!next || settled.has(next.nodeId)) continue;
    const current = next.nodeId;
    const best = next.cost;
    settled.add(current);
    if (current === destination) break;
    for (const adjacent of neighbors.get(current) ?? []) {
      if (settled.has(adjacent.nodeId)) continue;
      const edgeCost = cost(adjacent.edge);
      if (!Number.isFinite(edgeCost)) continue;
      const candidate = best + edgeCost;
      if (candidate < (distance.get(adjacent.nodeId) ?? Number.POSITIVE_INFINITY)) {
        distance.set(adjacent.nodeId, candidate);
        previous.set(adjacent.nodeId, { nodeId: current, edge: adjacent.edge });
        queue.push({ nodeId: adjacent.nodeId, cost: candidate });
      }
    }
  }

  if (!previous.has(destination) && origin !== destination) throw new Error("No route found");
  const nodeIds = [destination];
  const edges: GraphEdge[] = [];
  let cursor = destination;
  while (cursor !== origin) {
    const step = previous.get(cursor);
    if (!step) throw new Error("Route reconstruction failed");
    edges.unshift(step.edge);
    cursor = step.nodeId;
    nodeIds.unshift(cursor);
  }
  return { nodeIds, edges };
}

function summarize(graph: PilotGraph, path: ReturnType<typeof shortestPath>, hour: number): RouteResult {
  const distanceMeters = path.edges.reduce((sum, edge) => sum + edge.distanceMeters, 0);
  const durationMinutes = distanceMeters / WALKING_METERS_PER_MINUTE;
  const exposedMeters = path.edges.reduce(
    (sum, edge) => sum + edge.distanceMeters * (1 - edgeShade(edge, hour)),
    0,
  );
  let exposedRunMeters = 0;
  let longestExposedMeters = 0;
  for (const edge of path.edges) {
    const shade = edgeShade(edge, hour);
    const exposed = edge.distanceMeters * (1 - shade);
    exposedRunMeters = shade < 0.5 ? exposedRunMeters + exposed : 0;
    longestExposedMeters = Math.max(longestExposedMeters, exposedRunMeters);
  }
  const greeneryTotal = path.edges.reduce((sum, edge) => sum + edge.distanceMeters * edgeGreenery(edge).score, 0);
  const nearbyTreeCount = new Set(path.edges.flatMap((edge) => edgeGreenery(edge).nearbyTreeIds)).size;
  const adjacentParkNames = [...new Set(path.edges.flatMap((edge) => edgeGreenery(edge).parkNames))];
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    nodeIds: path.nodeIds,
    coordinates: path.nodeIds.map((id) => nodeMap.get(id)!.coordinate),
    distanceMeters,
    durationMinutes,
    directSunMinutes: exposedMeters / WALKING_METERS_PER_MINUTE,
    longestExposedMinutes: longestExposedMeters / WALKING_METERS_PER_MINUTE,
    mappedStepEdges: path.edges.filter((edge) => edge.osm?.steps).length,
    greeneryPercent: distanceMeters ? (greeneryTotal / distanceMeters) * 100 : 0,
    nearbyTreeCount,
    adjacentParkNames,
    shadePercent: distanceMeters === 0 ? 100 : (1 - exposedMeters / distanceMeters) * 100,
    streets: [...new Set(path.edges.map((edge) => edge.street))],
  };
}

export function compareRoutes(
  graph: PilotGraph,
  origin: string,
  destination: string,
  hour: number,
  detourLimit = 0.25,
  avoidMappedSteps = false,
  mode: RouteMode = "shade",
): RouteComparison {
  const allowedCost = (edge: GraphEdge, value: number) => avoidMappedSteps && edge.osm?.steps ? Number.POSITIVE_INFINITY : value;
  const fastestPath = shortestPath(graph, origin, destination, (edge) => allowedCost(edge, edge.distanceMeters));
  const fastest = summarize(graph, fastestPath, hour);
  const maximumDistance = fastest.distanceMeters * (1 + detourLimit);
  const candidates = [0.35, 0.55, 0.75, 0.9].map((shadePreference) => {
    const path = shortestPath(graph, origin, destination, (edge) => {
      const fit = mode === "green" ? edgeGreenery(edge).score : edgeShade(edge, hour);
      return allowedCost(edge, edge.distanceMeters * ((1 - shadePreference) + shadePreference * (1 - fit)));
    });
    return summarize(graph, path, hour);
  });
  const valid = candidates.filter((route) => route.distanceMeters <= maximumDistance + 0.01);
  const recommended = valid.reduce((best, route) => mode === "green"
    ? (route.greeneryPercent > best.greeneryPercent ? route : best)
    : (route.directSunMinutes < best.directSunMinutes ? route : best), fastest);
  return {
    fastest,
    recommended,
    extraMinutes: Math.max(0, recommended.durationMinutes - fastest.durationMinutes),
    sunMinutesSaved: Math.max(0, fastest.directSunMinutes - recommended.directSunMinutes),
    greeneryGainPoints: Math.max(0, recommended.greeneryPercent - fastest.greeneryPercent),
  };
}
