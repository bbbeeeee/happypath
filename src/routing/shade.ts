import shadeSnapshot from "../data/pilot-shade.json";
import type { GraphEdge } from "../types";
import { solarPosition } from "./solar.mjs";

const shadeByEdge = shadeSnapshot.edgeShadeByHour as Record<string, Record<string, number>>;
export const shadeMetadata = shadeSnapshot.metadata;

export function edgeShade(edge: GraphEdge, hour: number): number {
  const position = solarPosition(shadeMetadata.date, hour, shadeMetadata.latitude, shadeMetadata.longitude, shadeMetadata.utcOffsetHours);
  if (position.elevationDegrees <= 0) return 1;
  return shadeByEdge[edge.id]?.[String(Math.round(hour))] ?? 0;
}
