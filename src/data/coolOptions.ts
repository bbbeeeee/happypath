import type { Feature, FeatureCollection, Point } from "geojson";
import { isInsideSupportedArea } from "./supportedArea";

const COOL_OPTIONS_URL = "https://services6.arcgis.com/yG5s3afENB5iO9fj/arcgis/rest/services/Cool_Options/FeatureServer/0/query?where=Borough_name%3D%27Manhattan%27&outFields=OBJECTID%2CFacility_name%2CLocation_type%2CSpace_type%2CAddress%2CPhone%2CFinder_status%2CAccessible%2CEntrance_information%2CPet_friendly%2CAge_restriction%2CNYCEM_ID&returnGeometry=true&outSR=4326&f=geojson";

export interface CoolOptionProperties {
  id: string;
  label: string;
  kind: "cooling_center" | "pool" | "spray_shower" | "indoor_option" | "cool_option";
  category: string;
  address: string | null;
  finderStatus: string | null;
  accessible: string | null;
  entranceInformation: string | null;
  petFriendly: string | null;
  ageRestriction: string | null;
  phone: string | null;
  sourceId: "nyc-cool-options";
}

export type CoolOptionsCollection = FeatureCollection<Point, CoolOptionProperties>;
export const EMPTY_COOL_OPTIONS: CoolOptionsCollection = { type: "FeatureCollection", features: [] };

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function kindFrom(category: string): CoolOptionProperties["kind"] {
  const lower = category.toLowerCase();
  if (lower.includes("spray")) return "spray_shower";
  if (lower.includes("pool")) return "pool";
  if (lower.includes("cooling center")) return "cooling_center";
  if (lower.includes("indoor")) return "indoor_option";
  return "cool_option";
}

export function normalizeCoolOptions(payload: unknown): CoolOptionsCollection {
  const features = payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
    ? (payload as { features: unknown[] }).features
    : [];
  const normalized = features.flatMap((candidate): Feature<Point, CoolOptionProperties>[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const feature = candidate as { geometry?: { type?: unknown; coordinates?: unknown }; properties?: Record<string, unknown> };
    const coordinates = feature.geometry?.coordinates;
    if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length < 2) return [];
    const coordinate = [Number(coordinates[0]), Number(coordinates[1])] as [number, number];
    if (!coordinate.every(Number.isFinite) || !isInsideSupportedArea(coordinate)) return [];
    const properties = feature.properties ?? {};
    const category = text(properties.Space_type) || text(properties.Location_type) || "Cool option";
    return [{ type: "Feature", geometry: { type: "Point", coordinates: coordinate }, properties: {
      id: `cool-${text(properties.OBJECTID) || text(properties.NYCEM_ID) || coordinate.join("-")}`,
      label: text(properties.Facility_name) || category,
      kind: kindFrom(category),
      category,
      address: text(properties.Address),
      finderStatus: text(properties.Finder_status),
      accessible: text(properties.Accessible),
      entranceInformation: text(properties.Entrance_information),
      petFriendly: text(properties.Pet_friendly),
      ageRestriction: text(properties.Age_restriction),
      phone: text(properties.Phone),
      sourceId: "nyc-cool-options",
    } }];
  });
  return { type: "FeatureCollection", features: normalized };
}

export async function loadCoolOptions(fetchImpl: typeof fetch = fetch): Promise<CoolOptionsCollection> {
  const response = await fetchImpl(COOL_OPTIONS_URL);
  if (!response.ok) throw new Error("Cool options are unavailable");
  return normalizeCoolOptions(await response.json());
}
