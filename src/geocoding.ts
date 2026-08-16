import type { Coordinate } from "./types";
import { isInsideSupportedArea } from "./data/supportedArea";

interface GeoSearchFeature {
  geometry: { type: "Point"; coordinates: Coordinate };
  properties: { label?: string; name?: string };
}

export interface LocationSuggestion {
  coordinate: Coordinate;
  label: string;
}

export class GeocodingUnavailableError extends Error {
  readonly kind = "temporary-unavailable";

  constructor() {
    super("Address search is temporarily unavailable.");
    this.name = "GeocodingUnavailableError";
  }
}

export async function searchNycAddresses(query: string, limit = 5): Promise<LocationSuggestion[]> {
  const url = new URL("https://geosearch.planninglabs.nyc/v2/search");
  url.searchParams.set("text", `${query}, New York, NY`);
  url.searchParams.set("size", String(Math.max(limit, 5)));
  let data: { features?: GeoSearchFeature[] };
  try {
    const response = await fetch(url);
    if (!response.ok) throw new GeocodingUnavailableError();
    data = await response.json() as { features?: GeoSearchFeature[] };
  } catch (error) {
    if (error instanceof GeocodingUnavailableError) throw error;
    throw new GeocodingUnavailableError();
  }
  const seen = new Set<string>();
  return (data.features ?? [])
    .filter((candidate) => candidate.geometry?.type === "Point")
    .map((feature, index) => ({
      coordinate: feature.geometry.coordinates,
      label: feature.properties.label ?? feature.properties.name ?? query,
      supported: isInsideSupportedArea(feature.geometry.coordinates),
      index,
    }))
    .sort((a, b) => Number(b.supported) - Number(a.supported) || a.index - b.index)
    .filter((suggestion) => {
      const key = `${suggestion.label.toLowerCase()}|${suggestion.coordinate.join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ coordinate, label }) => ({ coordinate, label }));
}

export async function searchNycAddress(query: string): Promise<LocationSuggestion | null> {
  return (await searchNycAddresses(query, 5))[0] ?? null;
}
