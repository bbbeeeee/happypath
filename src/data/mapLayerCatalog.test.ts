import { describe, expect, it } from "vitest";
import { getSourceRegistryEntry } from "./sourceRegistry";
import { getMapLayerDefinition, listMapLayerDefinitions } from "./mapLayerCatalog";

describe("map layer catalog", () => {
  it("gives every layer a unique, source-backed presentation and capability contract", () => {
    const layers = listMapLayerDefinitions();
    expect(new Set(layers.map((layer) => layer.id)).size).toBe(layers.length);
    for (const layer of layers) {
      expect(layer.iconToken).toBeTruthy();
      expect(layer.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(layer.evidenceBoundary).toBeTruthy();
      expect(layer.capabilities.visualize).toBe(true);
      layer.sourceIds.forEach((sourceId) => expect(getSourceRegistryEntry(sourceId), `${layer.id}:${sourceId}`).toBeTruthy());
    }
  });

  it("makes civic checks explicit-only for routing and planner-first by default", () => {
    expect(getMapLayerDefinition("civic_tasks")).toMatchObject({
      defaultVisibility: "planner_only",
      routingActivation: "explicit_request_only",
      capabilities: { routeEndCondition: true, plannerEvidence: true, selectableFeatures: true },
    });
  });
});
