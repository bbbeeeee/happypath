import { describe, expect, it } from "vitest";
import { getSourceRegistryEntry } from "./sourceRegistry";
import { getMapLayerDefinition, listMapLayerDefinitions, sourceCanAffectRoutes } from "./mapLayerCatalog";

describe("map layer catalog", () => {
  it("gives every layer a unique, source-backed presentation and capability contract", () => {
    const layers = listMapLayerDefinitions();
    expect(new Set(layers.map((layer) => layer.id)).size).toBe(layers.length);
    for (const layer of layers) {
      expect(layer.iconToken).toBeTruthy();
      expect(layer.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(layer.evidenceBoundary).toBeTruthy();
      expect(layer.capabilities.visualize).toBe(true);
      layer.sourceIds.forEach((sourceId) => {
        expect(getSourceRegistryEntry(sourceId), `${layer.id}:${sourceId}`).toBeTruthy();
        expect(layer.sourceRoles[sourceId], `${layer.id}:${sourceId} roles`).toBeTruthy();
      });
      Object.keys(layer.sourceRoles).forEach((sourceId) => expect(layer.sourceIds).toContain(sourceId));
      Object.keys(layer.routeValidationExceptions).forEach((sourceId) => {
        expect(layer.sourceRoles[sourceId]).toContain("route_affecting");
        expect(layer.routeValidationExceptions[sourceId].boundary).toBeTruthy();
        expect(layer.routeValidationExceptions[sourceId].resolution).toBeTruthy();
      });
    }
  });

  it("shows relevant civic checks contextually while keeping route activation explicit", () => {
    expect(getMapLayerDefinition("civic_tasks")).toMatchObject({
      defaultVisibility: "contextual",
      routingActivation: "explicit_request_only",
      capabilities: { routeEndCondition: true, plannerEvidence: true, selectableFeatures: true },
    });
  });

  it("keeps exact mapped cover separate from nearby contextual records", () => {
    expect(getMapLayerDefinition("mapped_cover")).toMatchObject({
      label: "Cover evidence",
      sourceIds: ["openstreetmap", "nyc-sidewalk-shed-permits", "nyc-pops", "nyc-street-construction-closures"],
      capabilities: { routePreference: true, plannerEvidence: true, selectableFeatures: true },
    });
    expect(getMapLayerDefinition("mapped_cover").evidenceBoundary).toMatch(/only explicit path-aligned map tags affect routing/i);
    expect(getMapLayerDefinition("mapped_cover").evidenceBoundary).toMatch(/awnings are not inferred/i);
    expect(sourceCanAffectRoutes("mapped_cover", "openstreetmap")).toBe(true);
    expect(sourceCanAffectRoutes("mapped_cover", "nyc-sidewalk-shed-permits")).toBe(false);
    expect(sourceCanAffectRoutes("mapped_cover", "nyc-pops")).toBe(false);
    expect(sourceCanAffectRoutes("mapped_cover", "nyc-street-construction-closures")).toBe(false);
  });

  it("exposes route-affecting greenery as continuous map evidence", () => {
    expect(getMapLayerDefinition("greenery")).toMatchObject({
      sourceIds: ["nyc-forestry-tree-points", "nyc-parks-properties", "greenery-edge-model"],
      iconToken: "leaf",
      capabilities: { visualize: true, routePreference: true, plannerEvidence: true },
    });
    expect(getMapLayerDefinition("greenery").evidenceBoundary).toMatch(/not proof of canopy/i);
  });

  it("keeps modeled flood potential contextual and unable to change a route", () => {
    expect(getMapLayerDefinition("flood_context")).toMatchObject({
      sourceIds: ["nyc-stormwater-flood-map-2050"],
      defaultVisibility: "planner_only",
      routingActivation: "explicit_request_only",
      capabilities: { visualize: true, routePreference: false, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    });
    expect(getMapLayerDefinition("flood_context").evidenceBoundary).toMatch(/not live flooding/i);
    expect(getMapLayerDefinition("flood_context").evidenceBoundary).toMatch(/safe or dry/i);
    expect(sourceCanAffectRoutes("flood_context", "nyc-stormwater-flood-map-2050")).toBe(false);
  });
});
