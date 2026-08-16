import type { FillLayerSpecification } from "maplibre-gl";

export const BUILDING_SHADOW_MIN_ZOOM = 13.4;
export const BUILDING_SHADOW_FULL_ZOOM = 14.2;
export const BUILDING_SHADOW_MAX_OPACITY = 0.24;

export function buildingShadeDetailVisible(zoom: number) {
  return Number.isFinite(zoom) && zoom >= BUILDING_SHADOW_MIN_ZOOM;
}

export function buildingShadowOpacityAtZoom(zoom: number) {
  if (!buildingShadeDetailVisible(zoom)) return 0;
  if (zoom >= BUILDING_SHADOW_FULL_ZOOM) return BUILDING_SHADOW_MAX_OPACITY;
  return BUILDING_SHADOW_MAX_OPACITY
    * ((zoom - BUILDING_SHADOW_MIN_ZOOM) / (BUILDING_SHADOW_FULL_ZOOM - BUILDING_SHADOW_MIN_ZOOM));
}

/**
 * Detailed polygons are intentionally block-scale. At island scale, exposing
 * the raw edge of the checked-in pilot snapshot looks like a broken map tile.
 */
export const BUILDING_SHADOW_LAYER = {
  id: "building-shadows",
  type: "fill",
  source: "building-shadows",
  minzoom: BUILDING_SHADOW_MIN_ZOOM,
  paint: {
    "fill-color": "#516785",
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      BUILDING_SHADOW_MIN_ZOOM,
      0,
      BUILDING_SHADOW_FULL_ZOOM,
      BUILDING_SHADOW_MAX_OPACITY,
    ],
    "fill-opacity-transition": { duration: 140, delay: 0 },
  },
  layout: { visibility: "none" },
} satisfies FillLayerSpecification;
