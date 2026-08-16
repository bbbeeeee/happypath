import type { FeatureCollection, Point } from "geojson";

export type AccessContextKind = "ramp_survey" | "accessible_signal" | "exclusive_signal" | "transit_elevator";

export interface AccessContextProperties {
  id: string;
  kind: AccessContextKind;
  label: string;
  sourceId: string;
  [key: string]: string | number | boolean | null;
}

export type AccessContextCollection = FeatureCollection<Point, AccessContextProperties>;

export const EMPTY_ACCESS_CONTEXT: AccessContextCollection = { type: "FeatureCollection", features: [] };

export async function loadAccessContext(fetchImpl: typeof fetch = fetch): Promise<AccessContextCollection> {
  const response = await fetchImpl("/data/pilot-access-context.json");
  if (!response.ok) throw new Error("Access records are unavailable");
  const payload = await response.json() as Partial<AccessContextCollection>;
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) throw new Error("Access records could not be read");
  return payload as AccessContextCollection;
}
