import registryJson from "./source-registry.json";

export type SourceCapabilityStatus = "ingested" | "derived" | "reference_only" | "live_reference";

export interface SourceRegistryEntry {
  source_id: string;
  publisher: string;
  dataset_name: string;
  dataset_url: string;
  canonical_url?: string | null;
  download_url?: string | null;
  related_urls?: string[];
  dataset_id: string | null;
  asset_type: string;
  authority: "official" | "community" | "derived";
  access_method: string;
  format: string;
  terms_url: string;
  source_updated_at: string | null;
  retrieved_at: string;
  last_successful_ingest: string | null;
  geometry_type: string;
  pilot_coverage: number | null;
  pilot_record_count?: number;
  capability_status?: SourceCapabilityStatus;
  map_readiness?: string;
  freshness_statement?: string;
  coverage_statement?: string;
  known_limitations: string[];
  allowed_claims: string[];
  prohibited_claims: string[];
}

export interface SourceRegistryPresentation {
  id: string;
  title: string;
  publisher: string;
  officialUrl: string;
  downloadUrl: string | null;
  capabilityStatus: SourceCapabilityStatus;
  availabilityLabel: string;
  freshnessLabel: string;
  coverageLabel: string;
  geometryLabel: string;
  claimBoundary: string;
}

const sources = registryJson.sources as SourceRegistryEntry[];
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : dateFormatter.format(date);
}

function capabilityStatus(source: SourceRegistryEntry): SourceCapabilityStatus {
  if (source.capability_status) return source.capability_status;
  if (source.authority === "derived" || source.asset_type === "calculation") return "derived";
  return source.last_successful_ingest ? "ingested" : "reference_only";
}

function availabilityLabel(status: SourceCapabilityStatus): string {
  if (status === "ingested") return "Included in this preview";
  if (status === "derived") return "Estimated for this preview";
  if (status === "live_reference") return "Live city link · opens separately";
  return "City source · not used in this path";
}

function freshnessLabel(source: SourceRegistryEntry): string {
  const updated = dateLabel(source.source_updated_at);
  if (updated) return `Updated ${updated}.`;
  const retrieved = dateLabel(source.retrieved_at);
  return retrieved
    ? `Preview refreshed ${retrieved}.`
    : "No update date listed.";
}

function coverageLabel(source: SourceRegistryEntry): string {
  if (source.coverage_statement) return source.coverage_statement;
  if (typeof source.pilot_record_count === "number") {
    return `${source.pilot_record_count.toLocaleString("en-US")} nearby listings are included in this preview.`;
  }
  if (source.pilot_coverage === 1) return "Included across the Lower Manhattan preview area.";
  if (typeof source.pilot_coverage === "number") {
    return `Included across ${Math.round(source.pilot_coverage * 100)}% of the preview area.`;
  }
  return "Coverage has not been measured yet.";
}

export function listSourceRegistryEntries(): readonly SourceRegistryEntry[] {
  return sources;
}

export function getSourceRegistryEntry(sourceId: string): SourceRegistryEntry | undefined {
  return sources.find((source) => source.source_id === sourceId);
}

export function sourceRegistryPresentation(sourceId: string): SourceRegistryPresentation | null {
  const source = getSourceRegistryEntry(sourceId);
  if (!source) return null;
  const status = capabilityStatus(source);
  return {
    id: source.source_id,
    title: source.dataset_name,
    publisher: source.publisher,
    officialUrl: source.canonical_url || source.dataset_url,
    downloadUrl: source.download_url || null,
    capabilityStatus: status,
    availabilityLabel: availabilityLabel(status),
    freshnessLabel: freshnessLabel(source),
    coverageLabel: coverageLabel(source),
    geometryLabel: source.geometry_type,
    claimBoundary: source.known_limitations[0] ?? "Open the source before relying on current conditions.",
  };
}
