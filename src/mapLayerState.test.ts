import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_OVERLAYS, toggledMapOverlay } from "./mapLayerState";

describe("additive map layers", () => {
  it("shows nearby places before a route exists", () => {
    expect(DEFAULT_MAP_OVERLAYS).toMatchObject({ amenities: true, shade: false, cover: false, tasks: false });
  });

  it("toggles one layer without replacing the other active layers", () => {
    const allVisible = { shade: true, cover: true, amenities: true, tasks: true };
    expect(toggledMapOverlay(allVisible, "shade")).toEqual({ ...allVisible, shade: false });
    expect(toggledMapOverlay(allVisible, "tasks")).toEqual({ ...allVisible, tasks: false });
  });
});
