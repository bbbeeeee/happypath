import type { Coordinate } from "./types";

interface GeoSearchFeature {
  geometry: { type: "Point"; coordinates: Coordinate };
  properties: { label?: string; name?: string };
}

export async function searchNycAddress(query: string): Promise<{ coordinate: Coordinate; label: string } | null> {
  const url = new URL("https://geosearch.planninglabs.nyc/v2/search");
  url.searchParams.set("text", `${query}, New York, NY`);
  url.searchParams.set("size", "5");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Address search is temporarily unavailable.");
  const data = await response.json() as { features?: GeoSearchFeature[] };
  const feature = data.features?.find((candidate) => candidate.geometry?.type === "Point");
  if (!feature) return null;
  return {
    coordinate: feature.geometry.coordinates,
    label: feature.properties.label ?? feature.properties.name ?? query,
  };
}
