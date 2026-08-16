export type MapOverlays = {
  shade: boolean;
  greenery: boolean;
  cover: boolean;
  flood: boolean;
  amenities: boolean;
  tasks: boolean;
};

export const DEFAULT_MAP_OVERLAYS: MapOverlays = {
  shade: false,
  greenery: false,
  cover: false,
  flood: false,
  amenities: true,
  tasks: false,
};

export type RelevantRouteMapOverlays = Partial<Pick<MapOverlays, "shade" | "greenery" | "cover" | "amenities" | "tasks">>;

const ambientLayers = ["shade", "greenery", "flood"] as const;

/**
 * Derive a fresh, request-scoped map state so context from the previous walk
 * cannot silently carry into the next result.
 */
export function showRelevantRouteMapOverlays(
  _overlays: MapOverlays,
  relevant: RelevantRouteMapOverlays,
): MapOverlays {
  return {
    shade: relevant.shade === true,
    greenery: relevant.greenery === true,
    cover: relevant.cover === true,
    flood: false,
    amenities: relevant.amenities === true,
    tasks: relevant.tasks === true,
  };
}

export function toggledMapOverlay(overlays: MapOverlays, layer: keyof MapOverlays): MapOverlays {
  const enabled = !overlays[layer];
  if (enabled && ambientLayers.includes(layer as (typeof ambientLayers)[number])) {
    return { ...overlays, shade: false, greenery: false, flood: false, [layer]: true };
  }
  return { ...overlays, [layer]: enabled };
}
