import type { CivicAsset, CivicAssetKind } from "./data/civicAssets";
import type { CivicTask, CivicTaskAction } from "./data/civicTasks";
import type { CoverContextKind } from "./coverEvidence";
import type { Coordinate, JourneyRoute } from "./types";

export interface SetupEndpoints {
  origin: Coordinate | null;
  destination?: Coordinate | null;
  active?: "origin" | "destination" | null;
}

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

export function endpointsGeoJSON(route?: JourneyRoute | null, setup?: SetupEndpoints) {
  const coordinates = route?.coordinates ?? [];
  if (!route || coordinates.length === 0) {
    const features = ([
      ["origin", setup?.origin],
      ["destination", setup?.destination],
    ] as const).flatMap(([kind, coordinate]) => coordinate ? [{
      type: "Feature" as const,
      properties: { kind, active: setup?.active === kind },
      geometry: { type: "Point" as const, coordinates: [...coordinate] as Coordinate },
    }] : []);
    return { type: "FeatureCollection" as const, features };
  }

  if (route.journeyShape === "loop") {
    return {
      type: "FeatureCollection" as const,
      features: [{
        type: "Feature" as const,
        properties: { kind: "start_finish" as const, active: false },
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
        properties: { kind: "origin" as const, active: false },
        geometry: { type: "Point" as const, coordinates: coordinates[0] },
      },
      {
        type: "Feature" as const,
        properties: { kind: "destination" as const, active: false },
        geometry: { type: "Point" as const, coordinates: coordinates.at(-1)! },
      },
    ],
  };
}

export type EndpointFeatureCollection = ReturnType<typeof endpointsGeoJSON>;

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
      geometry: { type: "Point" as const, coordinates: [...asset.coordinate] as [number, number] },
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
    features: tasks.map((task) => {
      const selected = task.id === options.selectedTaskId;
      return {
        type: "Feature" as const,
        properties: {
          id: task.id,
          action: task.action,
          title: task.title,
          selected,
          focusLabel: selected ? "Open check" : "",
          completed: completed.has(task.id),
        },
        geometry: { type: "Point" as const, coordinates: [...task.coordinate] as [number, number] },
      };
    }),
  };
}

export function civicTaskLayerVisible(layerEnabled: boolean, selectedTaskId?: string | null): boolean {
  return layerEnabled || Boolean(selectedTaskId);
}

const taskMarkerArt: Record<CivicTaskAction, { title: string; art: string }> = {
  verify: {
    title: "Quick verification",
    art: '<path d="m9.5 15 4.1 4.1 8.9-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
  observe: {
    title: "Quick observation",
    art: '<path d="M7.5 15.5s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="15.5" r="2.6" fill="currentColor"/><path d="M11 24h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
  photo: {
    title: "Focused photo check",
    art: '<path d="M8 12h4l1.5-2h5l1.5 2h4v10H8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
};

export function civicTaskMarkerSvg(action: CivicTaskAction = "verify"): string {
  const marker = taskMarkerArt[action];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 32 38" data-kind="civic-task-${action}"><title>${marker.title}</title><path d="M16 1C7.7 1 1 7.4 1 15.3 1 26.2 16 37 16 37s15-10.8 15-21.7C31 7.4 24.3 1 16 1z" fill="#FFFDF8" stroke="#C65343" stroke-width="2"/><g style="color:#C65343">${marker.art}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const coverContextArt: Record<Exclude<CoverContextKind, "construction_closure">, { title: string; color: string; art: string }> = {
  sidewalk_shed_permit: {
    title: "Sidewalk-shed permit nearby",
    color: "#806A3E",
    art: '<path d="M6 11h16l-2.5-4h-11zM8 11v11M20 11v11M6 16h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  pops_arcade: {
    title: "Listed arcade nearby",
    color: "#3D587F",
    art: '<path d="M6 22V7h16v15M10 22V14a4 4 0 0 1 8 0v8M6 11h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
};

/** Point-only context gets a distinct record glyph, never a fabricated footprint. */
export function coverContextMarkerSvg(kind: Exclude<CoverContextKind, "construction_closure">): string {
  const marker = coverContextArt[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 28 28" data-kind="${kind}"><title>${marker.title}</title><rect x="1" y="1" width="26" height="26" rx="7" fill="#FFFDF8" fill-opacity=".94" stroke="${marker.color}" stroke-width="1.5"/><g style="color:${marker.color}">${marker.art}</g></svg>`;
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

export function assetTransitLinesLabel(asset: CivicAsset): string | null {
  if (asset.kind !== "transit" || asset.details.daytimeRoutes.length === 0) return null;
  return `Listed lines: ${asset.details.daytimeRoutes.join(", ")}`;
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
