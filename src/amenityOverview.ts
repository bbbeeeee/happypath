import type { SymbolLayerSpecification } from "maplibre-gl";
import type { CivicAsset, CivicAssetKind } from "./data/civicAssets";

/** Keep the count attached to its cluster disk even when map labels compete for space. */
export const AMENITY_CLUSTER_COUNT_LAYOUT = {
  "text-field": ["to-string", ["get", "count"]],
  "text-size": 11,
  "text-font": ["Open Sans Bold"],
  "text-allow-overlap": true,
  "text-ignore-placement": true,
  visibility: "none",
} satisfies SymbolLayerSpecification["layout"];

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
  /** At city scale, combine categories into a single neutral "places" cluster. */
  clusterAcrossCategories?: boolean;
}

export interface AmenityViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

export type AmenityMapContext = "nearby" | "route" | "planner";

/** Use a few more records at whole-area scale, where the sheet and map labels hide part of the sample. */
export function amenityViewportSampleLimit(zoom: number, context: AmenityMapContext) {
  const neighborhoodLimit = context === "planner" ? 36 : context === "route" ? 28 : 20;
  if (!Number.isFinite(zoom) || zoom >= 13.5) return neighborhoodLimit;
  return context === "planner" ? 48 : context === "route" ? 44 : 36;
}

function spreadAcrossViewport(assets: readonly CivicAsset[], viewport: AmenityViewport, limit: number) {
  if (assets.length < 2) return [...assets];
  const longitudeSpan = Math.max(Number.EPSILON, viewport.east - viewport.west);
  const latitudeSpan = Math.max(Number.EPSILON, viewport.north - viewport.south);
  const normalizedCoordinate = (asset: CivicAsset) => [
    (asset.coordinate[0] - viewport.west) / longitudeSpan,
    (asset.coordinate[1] - viewport.south) / latitudeSpan,
  ] as const;
  const centerDistance = (asset: CivicAsset) => {
    const [x, y] = normalizedCoordinate(asset);
    return (x - 0.5) ** 2 + (y - 0.5) ** 2;
  };
  const remaining = [...assets].sort((a, b) => centerDistance(a) - centerDistance(b) || a.id.localeCompare(b.id));
  const selected = [remaining.shift()!];

  while (remaining.length && selected.length < limit) {
    let nextIndex = 0;
    let nextDistance = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const [candidateX, candidateY] = normalizedCoordinate(remaining[index]);
      const nearestSelected = selected.reduce((nearest, asset) => {
        const [selectedX, selectedY] = normalizedCoordinate(asset);
        return Math.min(nearest, (candidateX - selectedX) ** 2 + (candidateY - selectedY) ** 2);
      }, Number.POSITIVE_INFINITY);
      if (nearestSelected > nextDistance) {
        nextDistance = nearestSelected;
        nextIndex = index;
      }
    }
    selected.push(remaining.splice(nextIndex, 1)[0]);
  }

  return selected;
}

/** Shrink overview clusters as the map moves from neighborhood to block scale. */
export function amenityClusterCellMeters(zoom: number) {
  if (!Number.isFinite(zoom)) return 96;
  if (zoom >= 16.25) return 14;
  if (zoom < 13.5) return Math.min(1_200, Math.round(150 * 6 ** (13.5 - zoom)));
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
    groups.set(kind, spreadAcrossViewport(visible.filter((asset) => asset.kind === kind), viewport, maximumAssets));
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

/**
 * Full viewport membership for truthful cluster counts. Rendering may collapse
 * these records into clusters, but the count must not be based on a sample.
 */
export function amenitiesWithinViewport(
  assets: readonly CivicAsset[],
  viewport: AmenityViewport,
  options: { prominentAssetIds?: readonly string[]; selectedAssetId?: string | null } = {},
) {
  const importantIds = new Set([
    ...(options.prominentAssetIds ?? []),
    ...(options.selectedAssetId ? [options.selectedAssetId] : []),
  ]);
  return assets.filter((asset) => importantIds.has(asset.id) || (
    asset.coordinate[0] >= viewport.west
    && asset.coordinate[0] <= viewport.east
    && asset.coordinate[1] >= viewport.south
    && asset.coordinate[1] <= viewport.north
  ));
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
  kind: CivicAssetKind | "mixed";
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
    coordinates: [number, number];
  };
};

const METERS_PER_LATITUDE_DEGREE = 110_574;

function projectedCell(asset: CivicAsset, cellMeters: number, latitudeReference: number, clusterAcrossCategories: boolean): string {
  const metersPerLongitudeDegree = 111_320 * Math.cos(latitudeReference * Math.PI / 180);
  const x = Math.floor(asset.coordinate[0] * metersPerLongitudeDegree / cellMeters);
  const y = Math.floor(asset.coordinate[1] * METERS_PER_LATITUDE_DEGREE / cellMeters);
  return `${clusterAcrossCategories ? "mixed" : asset.kind}:${x}:${y}`;
}

function averageCoordinate(assets: readonly CivicAsset[]): [number, number] {
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
    geometry: { type: "Point", coordinates: [...asset.coordinate] as [number, number] },
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
  const clusterAcrossCategories = options.clusterAcrossCategories ?? false;
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
    const cell = projectedCell(asset, cellMeters, latitudeReference, clusterAcrossCategories);
    cells.set(cell, [...(cells.get(cell) ?? []), asset]);
  }

  const features: AmenityOverviewFeature[] = [];
  for (const [cell, cellAssets] of [...cells.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (cellAssets.length < minimumClusterSize) {
      features.push(...cellAssets.map((asset) => assetFeature(asset, selectedIds, requiredIds, prominentIds)));
      continue;
    }
    const kind = clusterAcrossCategories ? "mixed" as const : cellAssets[0].kind;
    const legend = kind === "mixed"
      ? { label: "Nearby places", colorToken: "amenity-mixed", iconToken: "map" }
      : amenityOverviewLegend[kind];
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
      clustering: clusterAcrossCategories ? "mixed_category_grid" as const : "same_category_grid" as const,
      clusterCellMeters: cellMeters,
      inputAssetCount: assets.length,
      visibleFeatureCount: features.length,
      proofLabel: "Mapped inventories · current conditions may vary",
    },
  };
}
