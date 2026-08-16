import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OVERLAYS, showRelevantRouteMapOverlays, toggledMapOverlay } from "./mapLayerState";

describe("contextual map layers", () => {
  it("starts with useful nearby places and quiet evidence layers before a route exists", () => {
    expect(DEFAULT_MAP_OVERLAYS).toMatchObject({ amenities: true, shade: false, greenery: false, cover: false, flood: false, tasks: false });
  });

  it("toggles one layer without replacing the other active layers", () => {
    const allVisible = { shade: true, greenery: false, cover: true, flood: false, amenities: true, tasks: true };
    expect(toggledMapOverlay(allVisible, "shade")).toEqual({ ...allVisible, shade: false });
    expect(toggledMapOverlay(allVisible, "tasks")).toEqual({ ...allVisible, tasks: false });
    expect(toggledMapOverlay(allVisible, "cover")).toEqual({ ...allVisible, cover: false });
  });

  it("lets environmental fields stack while preserving context layers", () => {
    const shade = { ...DEFAULT_MAP_OVERLAYS, shade: true, cover: true };
    const shadeAndGreenery = toggledMapOverlay(shade, "greenery");
    expect(shadeAndGreenery).toEqual({ ...shade, greenery: true });
    expect(toggledMapOverlay(shadeAndGreenery, "flood")).toEqual({ ...shade, greenery: true, flood: true });
  });

  it("replaces stale context with only the layers relevant to the new route", () => {
    const residentSelection = { ...DEFAULT_MAP_OVERLAYS, cover: true };

    expect(showRelevantRouteMapOverlays(residentSelection, {
      shade: true,
      greenery: false,
      cover: false,
      amenities: false,
      tasks: true,
    })).toEqual({
      shade: true,
      greenery: false,
      cover: false,
      flood: false,
      amenities: false,
      tasks: true,
    });
  });
});
