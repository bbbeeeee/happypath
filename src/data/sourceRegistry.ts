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
  if (status === "ingested") return "Mapped in this demo";
  if (status === "derived") return "Modeled in this demo";
  if (status === "live_reference") return "Live official reference · not bundled";
  return "Official source · not mapped in this demo";
}

function freshnessLabel(source: SourceRegistryEntry): string {
  if (source.freshness_statement) return source.freshness_statement;
  const updated = dateLabel(source.source_updated_at);
  if (updated) return `Official source updated ${updated}.`;
  const retrieved = dateLabel(source.retrieved_at);
  return retrieved
    ? `No source update date is published; this demo snapshot was retrieved ${retrieved}.`
    : "No source update date is published.";
}

function coverageLabel(source: SourceRegistryEntry): string {
  if (source.coverage_statement) return source.coverage_statement;
  if (typeof source.pilot_record_count === "number") {
    return `${source.pilot_record_count.toLocaleString("en-US")} records are bundled in the Lower Manhattan demo snapshot.`;
  }
  if (source.pilot_coverage === 1) return "The bundled layer covers the current Lower Manhattan demo graph or pilot bounds.";
  if (typeof source.pilot_coverage === "number") {
    return `${Math.round(source.pilot_coverage * 100)}% measured pilot coverage in the bundled snapshot.`;
  }
  return "Coverage has not been measured for this demo.";
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
    claimBoundary: source.known_limitations[0] ?? "Review the source detail before making a current-condition claim.",
  };
}
