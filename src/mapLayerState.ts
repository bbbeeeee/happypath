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
  return { ...overlays, [layer]: !overlays[layer] };
}
