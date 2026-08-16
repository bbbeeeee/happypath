export type MapLayerId = "shade" | "greenery" | "mapped_cover" | "flood_context" | "civic_assets" | "access_context" | "street_work" | "cool_options" | "civic_tasks";
export type MapLayerIconToken = "sun" | "leaf" | "umbrella" | "flood" | "place" | "access" | "work" | "cooling" | "check";
export type LayerSourceRole = "route_affecting" | "display_only" | "reference_only" | "simulated_publisher" | "fixed_route_planner";

export interface RouteValidationException {
  boundary: string;
  resolution: string;
}

export interface MapLayerDefinition {
  id: MapLayerId;
  label: string;
  description: string;
  sourceIds: readonly string[];
  sourceRoles: Readonly<Record<string, readonly LayerSourceRole[]>>;
  routeValidationExceptions: Readonly<Record<string, RouteValidationException>>;
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
    sourceRoles: {
      "nyc-building-footprints": ["route_affecting", "fixed_route_planner"],
      "building-shadow-model": ["route_affecting", "fixed_route_planner"],
    },
    routeValidationExceptions: {
      "nyc-building-footprints": { boundary: "Official geometry feeds an estimated shadow model; it does not measure sidewalk temperature.", resolution: "Complete the representative shadow visual and field-validation sample." },
      "building-shadow-model": { boundary: "Deterministic estimate pending broader comparison against observed shadows.", resolution: "Complete SPA review and the representative hourly shadow audit." },
    },
    iconToken: "sun",
    color: "#294E43",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "A modeled sun-and-building signal, not measured temperature.",
  },
  {
    id: "greenery",
    label: "Trees & parks",
    description: "Street edges with nearby tree or park listings",
    sourceIds: ["nyc-forestry-tree-points", "nyc-parks-properties", "greenery-edge-model"],
    sourceRoles: {
      "nyc-forestry-tree-points": ["route_affecting"],
      "nyc-parks-properties": ["route_affecting"],
      "greenery-edge-model": ["route_affecting"],
    },
    routeValidationExceptions: {
      "nyc-forestry-tree-points": { boundary: "Nearby inventory points do not prove present canopy or sidewalk conditions.", resolution: "Review representative edge joins and preserve current-condition caveats." },
      "nyc-parks-properties": { boundary: "Park adjacency does not prove a usable entrance on this edge.", resolution: "Validate representative access points before making entrance claims." },
      "greenery-edge-model": { boundary: "The score is a proximity signal, not a streetscape quality measurement.", resolution: "Compare representative scores with field observations." },
    },
    iconToken: "leaf",
    color: "#4F8963",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: true, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Nearby tree and park listings are a greenery signal, not proof of canopy, access, or current street conditions.",
  },
  {
    id: "mapped_cover",
    label: "Cover evidence",
    description: "Mapped passages plus nearby arcade records",
    sourceIds: ["openstreetmap", "nyc-pops"],
    sourceRoles: {
      openstreetmap: ["route_affecting"],
      "nyc-pops": ["display_only", "reference_only"],
    },
    routeValidationExceptions: {
      openstreetmap: { boundary: "Only explicit path-aligned covered and building-passage tags affect the experimental preference.", resolution: "Expand exact-geometry review and keep missing tags unassessed." },
    },
    iconToken: "umbrella",
    color: "#536A91",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Only explicit path-aligned map tags affect routing; nearby arcade records remain context, and awnings are not inferred.",
  },
  {
    id: "flood_context",
    label: "Heavy-rain flood potential",
    description: "Modeled stormwater areas for moderate rain with projected 2050 sea-level rise",
    sourceIds: ["nyc-stormwater-flood-map-2050"],
    sourceRoles: { "nyc-stormwater-flood-map-2050": ["display_only", "reference_only"] },
    routeValidationExceptions: {},
    iconToken: "flood",
    color: "#426A7C",
    defaultVisibility: "planner_only",
    routingActivation: "explicit_request_only",
    capabilities: { visualize: true, routePreference: false, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "A static DEP planning model, not live flooding, street passability, exact water depth, or proof that a route is safe or dry.",
  },
  {
    id: "civic_assets",
    label: "Places nearby",
    description: "Public amenities from official inventories",
    sourceIds: ["nyc-dot-seating", "nyc-public-restrooms", "nyc-parks-drinking-fountains", "mta-subway-entrances-2024"],
    sourceRoles: {
      "nyc-dot-seating": ["route_affecting"],
      "nyc-public-restrooms": ["route_affecting"],
      "nyc-parks-drinking-fountains": ["route_affecting"],
      "mta-subway-entrances-2024": ["route_affecting"],
    },
    routeValidationExceptions: {
      "nyc-dot-seating": { boundary: "Inventory proximity may select a route; current presence and availability remain unknown.", resolution: "Add network-access review and representative current-condition checks." },
      "nyc-public-restrooms": { boundary: "Inventory proximity may select a route; published hours do not prove current operation.", resolution: "Validate network access, schedules, and representative operating state." },
      "nyc-parks-drinking-fountains": { boundary: "Inventory proximity may select a route; current operation remains unknown.", resolution: "Validate network access and representative operating state." },
      "mta-subway-entrances-2024": { boundary: "Entrance points may end a wander; service, entry, and accessibility remain unknown.", resolution: "Audit graph snaps and add freshness-aware service and equipment context." },
    },
    iconToken: "place",
    color: "#4F8963",
    defaultVisibility: "contextual",
    routingActivation: "contextual",
    capabilities: { visualize: true, routePreference: true, routeEndCondition: true, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Official inventory does not prove current presence, operation, or access.",
  },
  {
    id: "access_context",
    label: "Access records",
    description: "Curb-ramp, pedestrian-signal, crossing-phase, and subway-elevator evidence",
    sourceIds: ["nyc-ramp-program-progress", "nyc-pedestrian-ramps", "nyc-accessible-pedestrian-signals", "nyc-exclusive-pedestrian-signals", "mta-elevator-assets"],
    sourceRoles: {
      "nyc-ramp-program-progress": ["display_only", "reference_only"],
      "nyc-pedestrian-ramps": ["display_only", "reference_only"],
      "nyc-accessible-pedestrian-signals": ["display_only", "reference_only"],
      "nyc-exclusive-pedestrian-signals": ["display_only", "reference_only"],
      "mta-elevator-assets": ["display_only", "reference_only"],
    },
    routeValidationExceptions: {},
    iconToken: "access",
    color: "#6D5F91",
    defaultVisibility: "planner_only",
    routingActivation: "explicit_request_only",
    capabilities: { visualize: true, routePreference: false, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Disconnected records expose known evidence and unknown gaps; they do not establish a continuous accessible or step-free route.",
  },
  {
    id: "street_work",
    label: "Street work",
    description: "Dated construction lines and sidewalk-shed permit locations",
    sourceIds: ["nyc-sidewalk-shed-permits", "nyc-street-construction-closures"],
    sourceRoles: {
      "nyc-sidewalk-shed-permits": ["display_only", "reference_only"],
      "nyc-street-construction-closures": ["display_only", "reference_only"],
    },
    routeValidationExceptions: {},
    iconToken: "work",
    color: "#A15F43",
    defaultVisibility: "planner_only",
    routingActivation: "explicit_request_only",
    capabilities: { visualize: true, routePreference: false, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Permits and closure windows indicate possible disruption, not a live blocked or impassable sidewalk.",
  },
  {
    id: "cool_options",
    label: "Cool options",
    description: "Cooling centers, pools, spray showers, and other official cool options",
    sourceIds: ["nyc-cool-options"],
    sourceRoles: { "nyc-cool-options": ["display_only", "reference_only"] },
    routeValidationExceptions: {},
    iconToken: "cooling",
    color: "#2E7182",
    defaultVisibility: "planner_only",
    routingActivation: "explicit_request_only",
    capabilities: { visualize: true, routePreference: false, routeEndCondition: false, plannerEvidence: true, selectableFeatures: true },
    evidenceBoundary: "Finder records are live context; activation, hours, access, and availability must still be checked in the official finder.",
  },
  {
    id: "civic_tasks",
    label: "Data checks",
    description: "Optional partner-authored checks that can refresh city data",
    sourceIds: ["footnote-civic-checks-demo"],
    sourceRoles: { "footnote-civic-checks-demo": ["route_affecting", "simulated_publisher"] },
    routeValidationExceptions: {
      "footnote-civic-checks-demo": { boundary: "A check affects routing only after an explicit help request and is never official evidence.", resolution: "Replace the demo publisher only after a trusted publishing and moderation workflow exists." },
    },
    iconToken: "check",
    color: "#C65343",
    defaultVisibility: "contextual",
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

export function sourceCanAffectRoutes(layerId: MapLayerId, sourceId: string): boolean {
  const roles = getMapLayerDefinition(layerId).sourceRoles[sourceId] ?? [];
  return roles.includes("route_affecting");
}
