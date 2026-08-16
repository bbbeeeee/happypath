import { readFile } from "node:fs/promises";

const configUrl = new URL("../../config/supported-area.json", import.meta.url);
export const supportedArea = JSON.parse(await readFile(configUrl, "utf8"));

if (supportedArea.schemaVersion !== 1
  || !Array.isArray(supportedArea.polygon)
  || supportedArea.polygon.length < 4
  || !Array.isArray(supportedArea.partitions)
  || supportedArea.partitions.length === 0) {
  throw new Error("config/supported-area.json is invalid");
}

export const SUPPORTED_AREA_BBOX = [
  supportedArea.envelope.south,
  supportedArea.envelope.west,
  supportedArea.envelope.north,
  supportedArea.envelope.east,
];

function pointOnSegment(point, start, end) {
  const cross = (point[1] - start[1]) * (end[0] - start[0])
    - (point[0] - start[0]) * (end[1] - start[1]);
  return Math.abs(cross) <= 1e-10
    && point[0] >= Math.min(start[0], end[0])
    && point[0] <= Math.max(start[0], end[0])
    && point[1] >= Math.min(start[1], end[1])
    && point[1] <= Math.max(start[1], end[1]);
}

export function coordinateInsideSupportedArea([lng, lat]) {
  const { envelope, polygon } = supportedArea;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)
    || lat < envelope.south || lat > envelope.north
    || lng < envelope.west || lng > envelope.east) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous];
    const end = polygon[index];
    if (pointOnSegment([lng, lat], start, end)) return true;
    if ((start[1] > lat) !== (end[1] > lat)
      && lng < ((end[0] - start[0]) * (lat - start[1])) / (end[1] - start[1]) + start[0]) inside = !inside;
  }
  return inside;
}

function flattenCoordinates(value, output = []) {
  if (!Array.isArray(value)) return output;
  if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    output.push([value[0], value[1]]);
    return output;
  }
  for (const item of value) flattenCoordinates(item, output);
  return output;
}

export function geometryIntersectsSupportedArea(geometry) {
  const coordinates = flattenCoordinates(geometry?.coordinates);
  if (!coordinates.length) return false;
  if (coordinates.some(coordinateInsideSupportedArea)) return true;
  const center = coordinates.reduce((sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]], [0, 0])
    .map((value) => value / coordinates.length);
  return coordinateInsideSupportedArea(center);
}

export function supportedAreaOverpassPolygon() {
  return supportedArea.polygon.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
}

export function bboxForPartition(partition, padding = 0) {
  return [
    Math.max(supportedArea.envelope.south, partition.south - padding),
    supportedArea.envelope.west,
    Math.min(supportedArea.envelope.north, partition.north + padding),
    supportedArea.envelope.east,
  ];
}

export function partitionForCoordinate(coordinate) {
  if (!coordinateInsideSupportedArea(coordinate)) return null;
  const latitude = coordinate[1];
  return supportedArea.partitions.find((partition, index) => (
    latitude >= partition.south
    && (latitude < partition.north || (index === supportedArea.partitions.length - 1 && latitude <= partition.north))
  )) ?? null;
}

export function socrataWithinBox(field, bbox = SUPPORTED_AREA_BBOX) {
  return `within_box(${field},${bbox.join(",")})`;
}

export function bboxMetadata(bbox = SUPPORTED_AREA_BBOX) {
  return { south: bbox[0], west: bbox[1], north: bbox[2], east: bbox[3] };
}
