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
    title: source?.datasetName ?? "Mapped public amenity",
    statusLabel: "Official inventory · not a live check",
    freshnessLabel: updated
      ? `Source updated ${updated}`
      : "Source update date unavailable",
    summary: asset.operation.note,
    detail: source?.knownLimitations[0]
      ?? "A mapped record does not confirm current access or condition.",
    sourceIds: [asset.sourceId],
    currentConditionsVerified: false,
    proofOfConcept: true,
  };
}

export function shadeEvidence(resolvedHour: number): PresentationEvidence {
  return {
    title: "Estimated building shade",
    statusLabel: "Modeled · proof of concept",
    freshnessLabel: `Modeled for ${shadeMetadata.date} at ${formatHour(resolvedHour)}`,
    summary: "Estimated from nearby building shapes, heights, and sun position.",
    detail: "This is a planning estimate, not a street-level shade or temperature measurement.",
    sourceIds: shadeMetadata.sourceIds,
    currentConditionsVerified: false,
    proofOfConcept: true,
  };
}

export const demoLikelyCoverEvidence: PresentationEvidence = {
  title: "Likely cover",
  statusLabel: "Demo signal · not live",
  freshnessLabel: "Prompt-based for this proof of concept",
  summary: "Your request can ask the demo to favor places with more likely overhead cover.",
  detail: "Production accuracy would need current sidewalk-shed, arcade, awning, and construction data. Likely cover does not promise a dry route.",
  sourceIds: [],
  currentConditionsVerified: false,
  proofOfConcept: true,
};

export function formatHour(hour: number): string {
  const normalized = ((Math.round(hour) % 24) + 24) % 24;
  if (normalized === 0) return "12 AM";
  if (normalized === 12) return "12 PM";
  return `${normalized % 12} ${normalized < 12 ? "AM" : "PM"}`;
}
