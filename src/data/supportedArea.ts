import supportedAreaJson from "../../config/supported-area.json";
import type { Coordinate } from "../types";

export interface GeographicBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface SupportedAreaPartition {
  id: string;
  label: string;
  south: number;
  north: number;
}

interface SupportedAreaConfig {
  schemaVersion: 1;
  id: string;
  label: string;
  shortLabel: string;
  envelope: GeographicBounds;
  polygon: Coordinate[];
  defaultView: { center: Coordinate; zoom: number };
  defaultJourney: { origin: Coordinate; destination: Coordinate };
  bootstrapBbox: GeographicBounds;
  shadowTileLongitudeCuts: number[];
  partitions: SupportedAreaPartition[];
}

export const supportedArea = supportedAreaJson as SupportedAreaConfig;

function isPointOnSegment(point: Coordinate, start: Coordinate, end: Coordinate) {
  const cross = (point[1] - start[1]) * (end[0] - start[0])
    - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 1e-10) return false;
  return point[0] >= Math.min(start[0], end[0])
    && point[0] <= Math.max(start[0], end[0])
    && point[1] >= Math.min(start[1], end[1])
    && point[1] <= Math.max(start[1], end[1]);
}

export function isInsideSupportedArea([lng, lat]: Coordinate) {
  const { envelope, polygon } = supportedArea;
  if (lat < envelope.south || lat > envelope.north || lng < envelope.west || lng > envelope.east) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous];
    const end = polygon[index];
    if (isPointOnSegment([lng, lat], start, end)) return true;
    if ((start[1] > lat) !== (end[1] > lat)
      && lng < ((end[0] - start[0]) * (lat - start[1])) / (end[1] - start[1]) + start[0]) {
      inside = !inside;
    }
  }
  return inside;
}

export function partitionForCoordinate(coordinate: Coordinate) {
  if (!isInsideSupportedArea(coordinate)) return null;
  const lat = coordinate[1];
  return supportedArea.partitions.find((partition, index) => (
    lat >= partition.south
    && (lat < partition.north || (index === supportedArea.partitions.length - 1 && lat <= partition.north))
  )) ?? null;
}

export function partitionsIntersectingBounds(bounds: GeographicBounds) {
  return supportedArea.partitions.filter((partition) => (
    bounds.north >= partition.south
    && bounds.south <= partition.north
    && bounds.east >= supportedArea.envelope.west
    && bounds.west <= supportedArea.envelope.east
  ));
}

export function shadowTilesIntersectingBounds(bounds: GeographicBounds) {
  const boundaries = [supportedArea.envelope.west, ...supportedArea.shadowTileLongitudeCuts, supportedArea.envelope.east];
  return partitionsIntersectingBounds(bounds).flatMap((partition) => boundaries.slice(0, -1).flatMap((west, column) => (
    bounds.east >= west && bounds.west <= boundaries[column + 1]
      ? [`${partition.id}-col-${column}`]
      : []
  )));
}

export function supportedAreaBbox(): [south: number, west: number, north: number, east: number] {
  const { south, west, north, east } = supportedArea.envelope;
  return [south, west, north, east];
}
