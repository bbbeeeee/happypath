export type MapOverlays = {
  shade: boolean;
  cover: boolean;
  amenities: boolean;
  tasks: boolean;
};

export const DEFAULT_MAP_OVERLAYS: MapOverlays = {
  shade: false,
  cover: false,
  amenities: true,
  tasks: false,
};

export function toggledMapOverlay(overlays: MapOverlays, layer: keyof MapOverlays): MapOverlays {
  return { ...overlays, [layer]: !overlays[layer] };
}
