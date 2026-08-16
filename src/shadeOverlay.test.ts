import { describe, expect, it } from "vitest";
import {
  BUILDING_SHADOW_FULL_ZOOM,
  BUILDING_SHADOW_LAYER,
  BUILDING_SHADOW_MAX_OPACITY,
  BUILDING_SHADOW_MIN_ZOOM,
  buildingShadeDetailVisible,
  buildingShadowOpacityAtZoom,
} from "./shadeOverlay";

describe("building shade overlay", () => {
  it("hides the cropped pilot snapshot at Manhattan scale", () => {
    expect(buildingShadeDetailVisible(12)).toBe(false);
    expect(buildingShadowOpacityAtZoom(12)).toBe(0);
    expect(BUILDING_SHADOW_LAYER.minzoom).toBe(BUILDING_SHADOW_MIN_ZOOM);
  });

  it("fades detailed shadows in between neighborhood and block scale", () => {
    const middleZoom = (BUILDING_SHADOW_MIN_ZOOM + BUILDING_SHADOW_FULL_ZOOM) / 2;
    expect(buildingShadeDetailVisible(middleZoom)).toBe(true);
    expect(buildingShadowOpacityAtZoom(middleZoom)).toBeCloseTo(BUILDING_SHADOW_MAX_OPACITY / 2);
    expect(buildingShadowOpacityAtZoom(BUILDING_SHADOW_FULL_ZOOM)).toBe(BUILDING_SHADOW_MAX_OPACITY);
  });
});
