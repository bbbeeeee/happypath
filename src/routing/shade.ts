import shadeSnapshot from "../data/shade/bootstrap.json";
import type { GraphEdge } from "../types";
import { solarPosition } from "./solar.mjs";

const shadeByEdge = shadeSnapshot.edgeShadeByHour as Record<string, Record<string, number | null>>;
type ShadePartitionMetadata = typeof shadeSnapshot.metadata & {
  graphGeneratedAt?: string;
  graphEdgeCount?: number;
  partitionId?: string;
};

export const shadeMetadata = shadeSnapshot.metadata as ShadePartitionMetadata;
const shadeModules = import.meta.glob(["../data/shade/*.json", "!../data/shade/bootstrap.json"]);
const loadedPartitions = new Set<string>();
const loadedPartitionMetadata = new Map<string, ShadePartitionMetadata>([["bootstrap", shadeMetadata]]);

function shadeDataError(detail: string) {
  return new Error(`Shade data is updating (${detail}). Reload the preview, or regenerate it with npm run data:shade.`);
}

export async function loadShadePartitions(partitionIds: readonly string[]) {
  await Promise.all(partitionIds.map(async (partitionId) => {
    if (loadedPartitions.has(partitionId)) return;
    const load = shadeModules[`../data/shade/${partitionId}.json`];
    if (!load) throw new Error(`Missing shade partition: ${partitionId}`);
    const module = await load() as { default: { metadata: ShadePartitionMetadata; edgeShadeByHour: typeof shadeByEdge } };
    if (module.default.metadata.graphGeneratedAt !== shadeMetadata.graphGeneratedAt) {
      throw shadeDataError(`${partitionId} belongs to a different graph snapshot`);
    }
    Object.assign(shadeByEdge, module.default.edgeShadeByHour);
    loadedPartitionMetadata.set(partitionId, module.default.metadata);
    loadedPartitions.add(partitionId);
  }));
}

export function assertShadeEvidenceCoverage(
  edges: readonly GraphEdge[],
  graphGeneratedAt?: string,
) {
  if (!shadeMetadata.graphGeneratedAt || shadeMetadata.graphGeneratedAt !== graphGeneratedAt) {
    throw shadeDataError("the walking graph and shade snapshot do not match");
  }
  const missingCount = edges.reduce((count, edge) => (
    Object.prototype.hasOwnProperty.call(shadeByEdge, edge.id) ? count : count + 1
  ), 0);
  if (missingCount) {
    throw shadeDataError(`${missingCount} walking segments have no matching shade evidence`);
  }
  if ([...loadedPartitionMetadata.values()].some((metadata) => metadata.graphGeneratedAt !== graphGeneratedAt)) {
    throw shadeDataError("loaded shade partitions do not share one graph snapshot");
  }
}

export function edgeShade(edge: GraphEdge, hour: number): number {
  const position = solarPosition(shadeMetadata.date, hour, shadeMetadata.latitude, shadeMetadata.longitude, shadeMetadata.utcOffsetHours);
  if (position.elevationDegrees <= 0) return 1;
  const value = shadeByEdge[edge.id]?.[String(Math.round(hour))];
  // Missing or invalid evidence cannot make an edge look shadier.
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
