import fixtureJson from "./pilot-civic-assets.json";

export type CivicAssetKind = "seating" | "restroom" | "drinking_fountain" | "transit";
export type CivicCoordinate = readonly [longitude: number, latitude: number];

export interface CivicAssetOperation {
  currentState: "unknown";
  publishedState: string | null;
  routingAvailability: "unverified" | "published_unavailable";
  satisfiesHardRequirement: false;
  note: string;
}

interface CivicAssetBase {
  id: string;
  kind: CivicAssetKind;
  coordinate: CivicCoordinate;
  name: string;
  locationLabel: string;
  sourceId: string;
  sourceRecordId: string | null;
  operation: CivicAssetOperation;
}

export interface SeatingAsset extends CivicAssetBase {
  kind: "seating";
  details: {
    siteId: string | null;
    assetId: string | null;
    subtype: string | null;
    category: string | null;
    installedOn: string | null;
    onStreet: string | null;
    fromStreet: string | null;
    toStreet: string | null;
    sideOfStreet: string | null;
    neighborhood: string | null;
  };
}

export interface RestroomAsset extends CivicAssetBase {
  kind: "restroom";
  details: {
    locationType: string | null;
    operator: string | null;
    season: string | null;
    publishedHours: string | null;
    publishedAccessibility: string | null;
    restroomType: string | null;
    changingStations: string | null;
    notes: string | null;
    website: string | null;
  };
}

export interface DrinkingFountainAsset extends CivicAssetBase {
  kind: "drinking_fountain";
  details: {
    systemId: string | null;
    fountainType: string | null;
    position: string | null;
    propertyId: string | null;
    propertyName: string | null;
    parentId: string | null;
    fountainCount: number | null;
    department: string | null;
    description: string | null;
  };
}

export interface TransitAsset extends CivicAssetBase {
  kind: "transit";
  details: {
    stopName: string;
    constituentStationName: string | null;
    complexId: string | null;
    stationId: string | null;
    gtfsStopId: string | null;
    division: string | null;
    line: string | null;
    daytimeRoutes: string[];
    entranceType: string | null;
    publishedEntryAllowed: boolean | null;
    publishedExitAllowed: boolean | null;
    inventoryYear: "2024";
  };
}

export type CivicAsset = SeatingAsset | RestroomAsset | DrinkingFountainAsset | TransitAsset;

export interface CivicAssetSource {
  sourceId: string;
  datasetId: string;
  datasetName: string;
  publisher: string;
  datasetUrl: string;
  termsUrl: string;
  authority: "official";
  evidenceClass: "official_inventory";
  capabilityStatus: "ingested";
  sourceUpdatedAt: string | null;
  retrievedAt: string;
  updateFrequency: string | null;
  dataTimePeriod: string | null;
  snapshotHash: string;
  recordCount: number;
  currentOperationVerified: false;
  allowedClaims: string[];
  prohibitedClaims: string[];
  knownLimitations: string[];
}

export interface CivicAssetFixture {
  schemaVersion: 1;
  generatedAt: string;
  pilotBbox: readonly [south: number, west: number, north: number, east: number];
  counts: Record<CivicAssetKind, number>;
  sources: Record<string, CivicAssetSource>;
  assets: CivicAsset[];
}

export interface NearbyCivicAsset {
  asset: CivicAsset;
  routeGeometryDistanceMeters: number;
  distanceBasis: "route_geometry";
}

export interface CivicAssetRouteQuery {
  maxDistanceMeters: number;
  kinds?: readonly CivicAssetKind[];
  limit?: number;
}

const fixture = fixtureJson as unknown as CivicAssetFixture;

function validateFixture(value: CivicAssetFixture) {
  if (value.schemaVersion !== 1) throw new Error(`Unsupported civic asset schema version: ${value.schemaVersion}`);
  if (value.pilotBbox.length !== 4 || value.pilotBbox.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error("Civic asset fixture has an invalid pilot bbox");
  }
  const ids = new Set<string>();
  for (const asset of value.assets) {
    if (ids.has(asset.id)) throw new Error(`Duplicate civic asset id: ${asset.id}`);
    ids.add(asset.id);
    if (asset.coordinate.length !== 2 || asset.coordinate.some((coordinate) => !Number.isFinite(coordinate))) {
      throw new Error(`Civic asset ${asset.id} has invalid coordinates`);
    }
    if (!value.sources[asset.sourceId]) throw new Error(`Civic asset ${asset.id} has an unknown source`);
  }
  return value;
}

const validatedFixture = validateFixture(fixture);

export function loadCivicAssetFixture(): CivicAssetFixture {
  return validatedFixture;
}

export function getCivicAssetSource(sourceId: string): CivicAssetSource | undefined {
  return validatedFixture.sources[sourceId];
}

export function listCivicAssets(kinds?: readonly CivicAssetKind[]): CivicAsset[] {
  if (!kinds?.length) return [...validatedFixture.assets];
  const allowedKinds = new Set(kinds);
  return validatedFixture.assets.filter((asset) => allowedKinds.has(asset.kind));
}

function project(coordinate: CivicCoordinate, latitudeReference: number) {
  const latitudeRadians = latitudeReference * Math.PI / 180;
  return [
    coordinate[0] * 111_320 * Math.cos(latitudeRadians),
    coordinate[1] * 110_574,
  ] as const;
}

function pointToSegmentMeters(point: CivicCoordinate, start: CivicCoordinate, end: CivicCoordinate) {
  const latitudeReference = (point[1] + start[1] + end[1]) / 3;
  const [px, py] = project(point, latitudeReference);
  const [ax, ay] = project(start, latitudeReference);
  const [bx, by] = project(end, latitudeReference);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy));
}

export function distanceBetweenCoordinatesMeters(start: CivicCoordinate, end: CivicCoordinate): number {
  return pointToSegmentMeters(start, end, end);
}

export function distanceFromRouteGeometryMeters(asset: CivicAsset, route: readonly CivicCoordinate[]): number {
  if (route.length === 0) return Number.POSITIVE_INFINITY;
  if (route.length === 1) return pointToSegmentMeters(asset.coordinate, route[0], route[0]);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    nearest = Math.min(nearest, pointToSegmentMeters(asset.coordinate, route[index - 1], route[index]));
  }
  return nearest;
}

/**
 * Finds mapped assets near a route polyline. The returned distance is geometric,
 * not walking-network distance, and therefore does not prove access or operation.
 */
export function findCivicAssetsNearRoute(
  route: readonly CivicCoordinate[],
  query: CivicAssetRouteQuery,
): NearbyCivicAsset[] {
  if (!Number.isFinite(query.maxDistanceMeters) || query.maxDistanceMeters < 0) {
    throw new Error("maxDistanceMeters must be a non-negative finite number");
  }
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) {
    throw new Error("limit must be a non-negative integer");
  }
  if (route.length === 0 || query.limit === 0) return [];

  return listCivicAssets(query.kinds)
    .map((asset) => ({
      asset,
      routeGeometryDistanceMeters: distanceFromRouteGeometryMeters(asset, route),
      distanceBasis: "route_geometry" as const,
    }))
    .filter((result) => result.routeGeometryDistanceMeters <= query.maxDistanceMeters)
    .sort((a, b) => a.routeGeometryDistanceMeters - b.routeGeometryDistanceMeters || a.asset.id.localeCompare(b.asset.id))
    .slice(0, query.limit);
}
