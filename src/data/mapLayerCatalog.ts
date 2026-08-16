export type MapLayerId = "shade" | "simulated_cover" | "civic_assets" | "civic_tasks";
export type MapLayerIconToken = "sun" | "umbrella" | "place" | "check";

export interface MapLayerDefinition {
  id: MapLayerId;
  label: string;
  description: string;
  sourceIds: readonly string[];
  iconToken: MapLayerIconToken;
  color: string;
  defaultVisibility: "contextual" | "planner_only";
  routingActivation: "contextual" | "explicit_request_only";
  capabilities: {
    visualize: true;
    routePreference: boolean;
    routeEndCondition: boolean;
    plannerEvidence: boolean;
    selectableFeatures: boolean;
  };
  evidenceBoundary: string;
}

const definitions = [
  {
    id: "shade",
    label: "Shade",
    description: "Estimated building shade by time of day",
    sourceIds: ["nyc-building-footprints", "building-shadow-model"],
    iconToken: "sun",
    color: "#294E43",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "A modeled sun-and-building signal, not measured temperature.",
  },
  {
    id: "simulated_cover",
    label: "Likely cover",
    description: "Proof-of-concept rain cover pattern",
    sourceIds: ["demo-cover-simulation", "nyc-sidewalk-shed-permits"],
    iconToken: "umbrella",
    color: "#536A91",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "A simulated pattern that needs current shed, awning, arcade, and construction data in production.",
  },
  {
    id: "civic_assets",
    label: "Places nearby",
    description: "Public amenities from official inventories",
    sourceIds: ["nyc-dot-seating", "nyc-public-restrooms", "nyc-parks-drinking-fountains", "mta-subway-entrances-2024"],
    iconToken: "place",
    color: "#4F8963",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: true, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Official inventory does not prove current presence, operation, or access.",
  },
  {
    id: "civic_tasks",
    label: "Data checks",
    description: "Optional partner-authored checks that can refresh city data",
    sourceIds: ["happy-path-civic-checks-demo"],
    iconToken: "check",
    color: "#C65343",
    defaultVisibility: "planner_only",
    routingActivation: "explicit_request_only",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: true, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Simulated partner requests, not official work orders or proof that a problem exists.",
  },
] as const satisfies readonly MapLayerDefinition[];

export function listMapLayerDefinitions(): readonly MapLayerDefinition[] {
  return definitions;
}

export function getMapLayerDefinition(id: MapLayerId): MapLayerDefinition {
  const definition = definitions.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown map layer: ${id}`);
  return definition;
}
