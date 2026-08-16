import type { CivicAsset } from "./data/civicAssets";
import { getCivicAssetSource } from "./data/civicAssets";
import { shadeMetadata } from "./routing/shade";

export interface PresentationEvidence {
  title: string;
  statusLabel: string;
  freshnessLabel: string;
  summary: string;
  detail: string;
  sourceIds: readonly string[];
  currentConditionsVerified: boolean;
  proofOfConcept: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatSourceDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : dateFormatter.format(date);
}

export function civicAssetEvidence(asset: CivicAsset): PresentationEvidence {
  const source = getCivicAssetSource(asset.sourceId);
  const updated = formatSourceDate(source?.sourceUpdatedAt ?? null);
  return {
    title: source?.datasetName ?? "City amenity listing",
    statusLabel: "From a city listing · may have changed",
    freshnessLabel: updated
      ? `Last refreshed ${updated}`
      : "Refresh date unavailable",
    summary: asset.operation.note,
    detail: source?.knownLimitations[0]
      ?? "This listing may not reflect today’s access or condition.",
    sourceIds: [asset.sourceId],
    currentConditionsVerified: false,
    proofOfConcept: true,
  };
}

export function shadeEvidence(resolvedHour: number): PresentationEvidence {
  return {
    title: "Shade around this time",
    statusLabel: "Estimated for this time of day",
    freshnessLabel: `Set for ${formatHour(resolvedHour)} on ${shadeMetadata.date}`,
    summary: "Estimated from the sun and nearby buildings.",
    detail: "Treat this as a helpful guide, not a street-level temperature reading.",
    sourceIds: shadeMetadata.sourceIds,
    currentConditionsVerified: false,
    proofOfConcept: true,
  };
}

export const mappedCoverEvidence: PresentationEvidence = {
  title: "Mapped overhead cover",
  statusLabel: "Community-mapped · conditions may have changed",
  freshnessLabel: "From the checked-in OpenStreetMap pilot snapshot",
  summary: "Your request can favor walking stretches explicitly mapped with overhead cover.",
  detail: "Most streets are unassessed. Mapped cover does not confirm present access, lighting, usable width, or a dry route.",
  sourceIds: ["openstreetmap"],
  currentConditionsVerified: false,
  proofOfConcept: true,
};

export function formatHour(hour: number): string {
  const normalized = ((Math.round(hour) % 24) + 24) % 24;
  if (normalized === 0) return "12 AM";
  if (normalized === 12) return "12 PM";
  return `${normalized % 12} ${normalized < 12 ? "AM" : "PM"}`;
}
