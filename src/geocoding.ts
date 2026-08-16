import type { Coordinate } from "./types";
import { isInsideSupportedArea } from "./data/supportedArea";

interface GeoSearchFeature {
  geometry: { type: "Point"; coordinates: Coordinate };
  properties: { label?: string; name?: string };
}

export class GeocodingUnavailableError extends Error {
  readonly kind = "temporary-unavailable";

  constructor() {
    super("Address search is temporarily unavailable.");
    this.name = "GeocodingUnavailableError";
  }
}

export async function searchNycAddress(query: string): Promise<{ coordinate: Coordinate; label: string } | null> {
  const url = new URL("https://geosearch.planninglabs.nyc/v2/search");
  url.searchParams.set("text", `${query}, New York, NY`);
  url.searchParams.set("size", "5");
  let data: { features?: GeoSearchFeature[] };
  try {
    const response = await fetch(url);
    if (!response.ok) throw new GeocodingUnavailableError();
    data = await response.json() as { features?: GeoSearchFeature[] };
  } catch (error) {
    if (error instanceof GeocodingUnavailableError) throw error;
    throw new GeocodingUnavailableError();
  }
  const points = data.features?.filter((candidate) => candidate.geometry?.type === "Point") ?? [];
  const feature = points.find((candidate) => isInsideSupportedArea(candidate.geometry.coordinates)) ?? points[0];
  if (!feature) return null;
  return {
    coordinate: feature.geometry.coordinates,
    label: feature.properties.label ?? feature.properties.name ?? query,
  };
}
