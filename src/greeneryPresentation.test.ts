import { describe, expect, it, vi } from "vitest";
import type { JourneyRoute, PilotGraph } from "./types";

vi.mock("./routing/greenery", () => ({
  edgeGreenery: (edge: { id: string }) => edge.id === "green"
    ? { score: 0.9, nearbyTreeIds: ["tree-1"], parkNames: ["Pocket Park"] }
    : { score: 0.4, nearbyTreeIds: ["tree-2"], parkNames: [] },
}));

import { ambientGreeneryGeoJSON, routeGreeneryGeoJSON } from "./greeneryPresentation";

const graph = {
  nodes: [
    { id: "a", name: "A", coordinate: [-74, 40.7] },
    { id: "b", name: "B", coordinate: [-73.99, 40.71] },
    { id: "c", name: "C", coordinate: [-73.98, 40.72] },
  ],
  edges: [
    { id: "green", from: "a", to: "b", distanceMeters: 10, durationMinutes: 1, street: "Green Way", shadeByHour: {}, osm: { wayId: 1, highway: "footway", access: null, foot: null, steps: false } },
    { id: "some", from: "b", to: "c", distanceMeters: 10, durationMinutes: 1, street: "Some Way", shadeByHour: {}, osm: { wayId: 2, highway: "footway", access: null, foot: null, steps: false } },
  ],
} as unknown as PilotGraph;

const route = {
  edgeIds: ["green", "some"],
} as unknown as JourneyRoute;

describe("greenery map presentation", () => {
  it("keeps the ambient field sparse while retaining park context", () => {
    const collection = ambientGreeneryGeoJSON(graph);
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties).toMatchObject({ edgeId: "green", greeneryBand: "park_edge", parkNames: "Pocket Park" });
  });

  it("shows every positive greenery segment on the selected route", () => {
    expect(routeGreeneryGeoJSON(route, graph).features.map((feature) => feature.properties.edgeId)).toEqual(["green", "some"]);
  });
});
