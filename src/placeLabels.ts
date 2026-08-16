import type { GraphNode } from "./types";

export interface EndpointLandmark {
  name: string;
  coordinate: readonly [number, number];
}

const TECHNICAL_PLACE_NAME = /^(?:osm\s+(?:node|way)\s+\d+|node\s+\d+|unnamed\b|unknown\b|unmapped\b|-?\d+(?:\.\d+)?\s*,)/i;

function distanceMeters(
  a: readonly [number, number],
  b: readonly [number, number],
) {
  return Math.hypot((b[1] - a[1]) * 111_111, (b[0] - a[0]) * 84_200);
}

export function isHumanReadablePlaceName(value: string | undefined) {
  const name = value?.trim();
  return Boolean(name && !TECHNICAL_PLACE_NAME.test(name));
}

export function cleanPlaceName(value: string) {
  const name = value.trim();
  const eastWestJoin = name.match(/^(?:West|East) (.+?) & (?:East|West) \1$/i);
  return eastWestJoin ? `${eastWestJoin[1]} & 5th Avenue` : name;
}

/**
 * Keeps routing identifiers internal and turns a graph point into resident copy.
 * Nearby landmarks and intersections are presentation hints, not proof that the
 * selected point is an entrance or directly accessible from that place.
 */
export function humanReadableEndpointName(
  node: Pick<GraphNode, "id" | "name" | "coordinate"> | undefined,
  graphNodes: readonly Pick<GraphNode, "id" | "name" | "coordinate">[],
  landmarks: readonly EndpointLandmark[] = [],
) {
  if (!node) return "Pinned on the map";
  if (isHumanReadablePlaceName(node.name)) return cleanPlaceName(node.name);

  const candidates = [
    ...landmarks
      .filter((landmark) => isHumanReadablePlaceName(landmark.name))
      .map((landmark) => {
        const distance = distanceMeters(node.coordinate, landmark.coordinate);
        return { name: cleanPlaceName(landmark.name), distance, score: distance - 35 };
      })
      .filter((candidate) => candidate.distance <= 180),
    ...graphNodes
      .filter((candidate) => candidate.id !== node.id && isHumanReadablePlaceName(candidate.name))
      .map((candidate) => {
        const distance = distanceMeters(node.coordinate, candidate.coordinate);
        const name = cleanPlaceName(candidate.name);
        return { name, distance, score: distance + (name.includes(" & ") ? 0 : 40) };
      })
      .filter((candidate) => candidate.distance <= 220),
  ].sort((a, b) => a.score - b.score || a.distance - b.distance || a.name.localeCompare(b.name));

  return candidates[0] ? `Near ${candidates[0].name}` : "Pinned on the map";
}
