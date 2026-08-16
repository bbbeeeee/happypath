import type { CivicAsset, CivicAssetKind } from "./data/civicAssets";
import type { CivicTask } from "./data/civicTasks";
import type { JourneyRoute } from "./types";

export function routeGeoJSON(route?: JourneyRoute | null) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: route?.coordinates ?? [],
    },
  };
}

export function endpointsGeoJSON(route?: JourneyRoute | null) {
  const coordinates = route?.coordinates ?? [];
  if (!route || coordinates.length === 0) {
    return { type: "FeatureCollection" as const, features: [] };
  }

  if (route.journeyShape === "loop") {
    return {
      type: "FeatureCollection" as const,
      features: [{
        type: "Feature" as const,
        properties: { kind: "start_finish" as const },
        geometry: { type: "Point" as const, coordinates: coordinates[0] },
      }],
    };
  }

  if (coordinates.length < 2) {
    return { type: "FeatureCollection" as const, features: [] };
  }

  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { kind: "origin" as const },
        geometry: { type: "Point" as const, coordinates: coordinates[0] },
      },
      {
        type: "Feature" as const,
        properties: { kind: "destination" as const },
        geometry: { type: "Point" as const, coordinates: coordinates.at(-1)! },
      },
    ],
  };
}

export function assetsGeoJSON(assets: readonly CivicAsset[], selectedAssetId?: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: assets.map((asset) => ({
      type: "Feature" as const,
      properties: {
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        selected: asset.id === selectedAssetId,
      },
      geometry: { type: "Point" as const, coordinates: asset.coordinate },
    })),
  };
}

export function civicTasksGeoJSON(
  tasks: readonly CivicTask[],
  options: { selectedTaskId?: string | null; completedTaskIds?: readonly string[] } = {},
) {
  const completed = new Set(options.completedTaskIds ?? []);
  return {
    type: "FeatureCollection" as const,
    features: tasks.map((task) => ({
      type: "Feature" as const,
      properties: {
        id: task.id,
        action: task.action,
        title: task.title,
        selected: task.id === options.selectedTaskId,
        completed: completed.has(task.id),
      },
      geometry: { type: "Point" as const, coordinates: task.coordinate },
    })),
  };
}

export function civicTaskMarkerSvg(): string {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 32 38" data-kind="civic-task"><title>Optional city data check</title><path d="M16 1C7.7 1 1 7.4 1 15.3 1 26.2 16 37 16 37s15-10.8 15-21.7C31 7.4 24.3 1 16 1z" fill="#FFFDF8" stroke="#C65343" stroke-width="2"/><path d="m9.5 15 4.1 4.1 8.9-9" fill="none" stroke="#C65343" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24h12" fill="none" stroke="#C65343" stroke-width="2" stroke-linecap="round"/></svg>';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const markerArt: Record<CivicAssetKind, { title: string; color: string; art: string }> = {
  seating: {
    title: "Public seating",
    color: "#4F8963",
    art: '<path d="M8 12h16v5H8zM10 8v4M22 8v4M10 17v5M22 17v5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  restroom: {
    title: "Public restroom",
    color: "#6478B8",
    art: '<circle cx="11" cy="8" r="2.2" fill="currentColor"/><path d="M8 13c0-1.7 1.3-3 3-3s3 1.3 3 3v3h-1.5v6h-3v-6H8z" fill="currentColor"/><circle cx="21" cy="8" r="2.2" fill="currentColor"/><path d="M18.2 13c0-1.7 1.2-3 2.8-3s2.8 1.3 2.8 3l1.2 5h-2.3v4h-3.4v-4H17z" fill="currentColor"/>',
  },
  drinking_fountain: {
    title: "Drinking fountain",
    color: "#2E6F85",
    art: '<path d="M16 6c3.2 4 5.5 6.8 5.5 10A5.5 5.5 0 1 1 10.5 16c0-3.2 2.3-6 5.5-10z" fill="currentColor"/><path d="M13.2 17.2c.5 1.2 1.5 1.8 2.8 1.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  },
  transit: {
    title: "Subway entrance",
    color: "#D94C3B",
    art: '<rect x="8" y="7" width="16" height="16" rx="4" fill="currentColor"/><path d="M11 18V9h3l2 4 2-4h3v9h-2.5v-5l-1.7 3.2h-1.6L13.5 13v5z" fill="#fff"/><path d="M11 23l-2 3M21 23l2 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
};

export function assetMarkerSvg(kind: CivicAssetKind): string {
  const marker = markerArt[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 32 38" data-kind="${kind}"><title>${marker.title}</title><path d="M16 1C7.7 1 1 7.4 1 15.3 1 26.2 16 37 16 37s15-10.8 15-21.7C31 7.4 24.3 1 16 1z" fill="#FFFDF8" stroke="${marker.color}" stroke-width="2"/><g style="color:${marker.color}">${marker.art}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function assetTypeLabel(asset: CivicAsset): string {
  if (asset.kind === "seating") return "Place to sit";
  if (asset.kind === "restroom") return "Restroom";
  if (asset.kind === "drinking_fountain") return "Drinking water";
  return "Subway entrance";
}

export function assetAvailabilityCopy(asset: CivicAsset): string {
  if (asset.operation.routingAvailability === "published_unavailable") {
    return "The city listing says this may be unavailable. Check before relying on it.";
  }
  if (asset.kind === "transit") {
    return `Included in MTA’s ${asset.details.inventoryYear} entrance list. Service and access can change.`;
  }
  if (asset.kind === "seating") {
    return "Included in a city seating list. Its condition may have changed.";
  }
  if (asset.kind === "restroom") {
    return asset.details.publishedHours
      ? "The city publishes hours for this restroom. Check before relying on them."
      : "Included in a city restroom list. It may not be open right now.";
  }
  return "Included in a Parks drinking-water list. It may not be running right now.";
}
