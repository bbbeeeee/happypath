import { describe, expect, it } from "vitest";
import { normalizeCoolOptions } from "./coolOptions";

describe("cool options", () => {
  it("keeps only supported-area points and preserves published status as context", () => {
    const normalized = normalizeCoolOptions({ features: [
      { geometry: { type: "Point", coordinates: [-73.99, 40.72] }, properties: { OBJECTID: 1, Facility_name: "Library", Space_type: "Cooling Center", Finder_status: "OPEN", Accessible: "Yes" } },
      { geometry: { type: "Point", coordinates: [-73.9, 40.82] }, properties: { OBJECTID: 2, Facility_name: "Outside pilot", Space_type: "Pool" } },
    ] });
    expect(normalized.features).toHaveLength(1);
    expect(normalized.features[0].properties).toMatchObject({ label: "Library", kind: "cooling_center", finderStatus: "OPEN", accessible: "Yes" });
  });
});
