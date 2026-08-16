import type { CivicAsset, CivicAssetKind } from "./data/civicAssets";

export const amenityOverviewLegend: Record<CivicAssetKind, {
  label: string;
  colorToken: string;
  iconToken: string;
}> = {
  seating: { label: "Places to sit", colorToken: "amenity-green", iconToken: "bench" },
  restroom: { label: "Restrooms", colorToken: "amenity-indigo", iconToken: "restroom" },
  drinking_fountain: { label: "Drinking water", colorToken: "amenity-blue", iconToken: "water" },
  transit: { label: "Subway entrances", colorToken: "amenity-coral", iconToken: "subway" },
};

export interface AmenityOverviewOptions {
  selectedAssetId?: string | null;
  requiredAssetIds?: readonly string[];
  /** Route-adjacent or otherwise important assets that should remain visible. */
  prominentAssetIds?: readonly string[];
  /** Grid size for same-category clustering. Defaults to 72 meters. */
  clusterCellMeters?: number;
  /** Defaults to two assets. */
  minimumClusterSize?: number;
}

export interface AmenityViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

/** Shrink overview clusters as the map moves from neighborhood to block scale. */
export function amenityClusterCellMeters(zoom: number) {
  if (!Number.isFinite(zoom)) return 96;
  if (zoom >= 16.25) return 14;
  return Math.max(28, Math.round(150 / 2 ** Math.max(0, zoom - 13.5)));
}

/** A small, category-balanced viewport sample for the ambient map. */
export function amenitiesForViewport(
  assets: readonly CivicAsset[],
  viewport: AmenityViewport,
  options: { prominentAssetIds?: readonly string[]; selectedAssetId?: string | null; maximumAssets?: number } = {},
) {
  const maximumAssets = Math.max(1, Math.floor(options.maximumAssets ?? 24));
  const importantIds = new Set([
    ...(options.prominentAssetIds ?? []),
    ...(options.selectedAssetId ? [options.selectedAssetId] : []),
  ]);
  const center: readonly [number, number] = [
    (viewport.west + viewport.east) / 2,
    (viewport.south + viewport.north) / 2,
  ];
  const distance = (asset: CivicAsset) => (
    (asset.coordinate[0] - center[0]) ** 2 + (asset.coordinate[1] - center[1]) ** 2
  );
  const important = assets.filter((asset) => importantIds.has(asset.id));
  const visible = assets.filter((asset) => (
    !importantIds.has(asset.id)
    && asset.coordinate[0] >= viewport.west
    && asset.coordinate[0] <= viewport.east
    && asset.coordinate[1] >= viewport.south
    && asset.coordinate[1] <= viewport.north
  ));
  const groups = new Map<CivicAssetKind, CivicAsset[]>();
  for (const kind of Object.keys(amenityOverviewLegend) as CivicAssetKind[]) {
    groups.set(kind, visible.filter((asset) => asset.kind === kind).sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id)));
  }
  const sampled: CivicAsset[] = [];
  while (sampled.length + important.length < maximumAssets && [...groups.values()].some((group) => group.length)) {
    for (const kind of Object.keys(amenityOverviewLegend) as CivicAssetKind[]) {
      const asset = groups.get(kind)?.shift();
      if (asset) sampled.push(asset);
      if (sampled.length + important.length >= maximumAssets) break;
    }
  }
  return [...new Map([...important, ...sampled].map((asset) => [asset.id, asset])).values()];
}

type AssetPointProperties = {
  featureType: "asset";
  id: string;
  kind: CivicAssetKind;
  categoryLabel: string;
  colorToken: string;
  iconToken: string;
  name: string;
  selected: boolean;
  required: boolean;
  prominent: boolean;
  clusterEligible: boolean;
  displayPriority: 1 | 2 | 3;
  evidenceStatus: "mapped_not_live";
  sourceId: string;
};

type ClusterPointProperties = {
  featureType: "cluster";
  id: string;
  kind: CivicAssetKind;
  categoryLabel: string;
  colorToken: string;
  iconToken: string;
  count: number;
  assetIds: string[];
  selected: false;
  required: false;
  prominent: false;
  clusterEligible: false;
  displayPriority: 0;
  evidenceStatus: "mapped_not_live";
};

type AmenityOverviewFeature = {
  type: "Feature";
  id: string;
  properties: AssetPointProperties | ClusterPointProperties;
  geometry: {
    type: "Point";
    coordinates: readonly [number, number];
  };
};

const METERS_PER_LATITUDE_DEGREE = 110_574;

function projectedCell(asset: CivicAsset, cellMeters: number, latitudeReference: number): string {
  const metersPerLongitudeDegree = 111_320 * Math.cos(latitudeReference * Math.PI / 180);
  const x = Math.floor(asset.coordinate[0] * metersPerLongitudeDegree / cellMeters);
  const y = Math.floor(asset.coordinate[1] * METERS_PER_LATITUDE_DEGREE / cellMeters);
  return `${asset.kind}:${x}:${y}`;
}

function averageCoordinate(assets: readonly CivicAsset[]): readonly [number, number] {
  const [longitude, latitude] = assets.reduce(
    ([lng, lat], asset) => [lng + asset.coordinate[0], lat + asset.coordinate[1]],
    [0, 0],
  );
  return [longitude / assets.length, latitude / assets.length];
}

function assetFeature(
  asset: CivicAsset,
  selectedIds: ReadonlySet<string>,
  requiredIds: ReadonlySet<string>,
  prominentIds: ReadonlySet<string>,
): AmenityOverviewFeature {
  const selected = selectedIds.has(asset.id);
  const required = requiredIds.has(asset.id);
  const prominent = prominentIds.has(asset.id);
  const legend = amenityOverviewLegend[asset.kind];
  return {
    type: "Feature",
    id: asset.id,
    properties: {
      featureType: "asset",
      id: asset.id,
      kind: asset.kind,
      categoryLabel: legend.label,
      colorToken: legend.colorToken,
      iconToken: legend.iconToken,
      name: asset.name,
      selected,
      required,
      prominent,
      clusterEligible: !selected && !required && !prominent,
      displayPriority: selected ? 3 : required || prominent ? 2 : 1,
      evidenceStatus: "mapped_not_live",
      sourceId: asset.sourceId,
    },
    geometry: { type: "Point", coordinates: asset.coordinate },
  };
}

/**
 * Produces a small deterministic feature collection for the overview map.
 * Only same-category assets cluster, preserving recognizable icon and color
 * meaning. Selected, required, and route-prominent assets always stay visible.
 */
export function amenityOverviewGeoJSON(
  assets: readonly CivicAsset[],
  options: AmenityOverviewOptions = {},
) {
  const cellMeters = options.clusterCellMeters ?? 72;
  const minimumClusterSize = options.minimumClusterSize ?? 2;
  if (!Number.isFinite(cellMeters) || cellMeters <= 0) {
    throw new Error("clusterCellMeters must be a positive finite number");
  }
  if (!Number.isInteger(minimumClusterSize) || minimumClusterSize < 2) {
    throw new Error("minimumClusterSize must be an integer of at least two");
  }

  const selectedIds = new Set(options.selectedAssetId ? [options.selectedAssetId] : []);
  const requiredIds = new Set(options.requiredAssetIds ?? []);
  const prominentIds = new Set(options.prominentAssetIds ?? []);
  const sortedAssets = [...assets].sort((a, b) => a.id.localeCompare(b.id));
  const latitudeReference = sortedAssets.length
    ? sortedAssets.reduce((sum, asset) => sum + asset.coordinate[1], 0) / sortedAssets.length
    : 40.73;

  const independent = sortedAssets.filter((asset) => (
    selectedIds.has(asset.id) || requiredIds.has(asset.id) || prominentIds.has(asset.id)
  ));
  const clusterable = sortedAssets.filter((asset) => !independent.includes(asset));
  const cells = new Map<string, CivicAsset[]>();
  for (const asset of clusterable) {
    const cell = projectedCell(asset, cellMeters, latitudeReference);
    cells.set(cell, [...(cells.get(cell) ?? []), asset]);
  }

  const features: AmenityOverviewFeature[] = [];
  for (const [cell, cellAssets] of [...cells.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (cellAssets.length < minimumClusterSize) {
      features.push(...cellAssets.map((asset) => assetFeature(asset, selectedIds, requiredIds, prominentIds)));
      continue;
    }
    const kind = cellAssets[0].kind;
    const legend = amenityOverviewLegend[kind];
    const id = `cluster:${cell}`;
    features.push({
      type: "Feature",
      id,
      properties: {
        featureType: "cluster",
        id,
        kind,
        categoryLabel: legend.label,
        colorToken: legend.colorToken,
        iconToken: legend.iconToken,
        count: cellAssets.length,
        assetIds: cellAssets.map((asset) => asset.id),
        selected: false,
        required: false,
        prominent: false,
        clusterEligible: false,
        displayPriority: 0,
        evidenceStatus: "mapped_not_live",
      },
      geometry: { type: "Point", coordinates: averageCoordinate(cellAssets) },
    });
  }
  features.push(...independent.map((asset) => assetFeature(asset, selectedIds, requiredIds, prominentIds)));
  features.sort((a, b) => (
    a.properties.displayPriority - b.properties.displayPriority || a.id.localeCompare(b.id)
  ));

  return {
    type: "FeatureCollection" as const,
    features,
    metadata: {
      clustering: "same_category_grid" as const,
      clusterCellMeters: cellMeters,
      inputAssetCount: assets.length,
      visibleFeatureCount: features.length,
      proofLabel: "Mapped inventories · current conditions may vary",
    },
  };
}
