import {
  getSourceRegistryEntry,
  listSourceRegistryEntries,
  sourceRegistryPresentation,
  type SourceRegistryEntry,
  type SourceRegistryPresentation,
} from "./sourceRegistry";

export type DataSourceAuditGroup = "current" | "derived" | "future";
export type DataSourceProductRole = "route" | "context" | "lookup" | "future";

interface DataSourceAuditDefinition {
  id: string;
  group: DataSourceAuditGroup;
  productRole: DataSourceProductRole;
  contribution: string;
}

export interface AuditedDataSource extends DataSourceAuditDefinition {
  registry: SourceRegistryEntry;
  presentation: SourceRegistryPresentation;
}

const auditDefinitions = [
  { id: "openstreetmap", group: "current", productRole: "route", contribution: "Pedestrian streets, distance and time, mapped stairs, and explicit covered passages." },
  { id: "nyc-planning-geosearch", group: "current", productRole: "lookup", contribution: "Turns a submitted NYC address into a point that can be snapped to the walking graph." },
  { id: "nyc-building-footprints", group: "current", productRole: "route", contribution: "Building geometry and roof height feed the time-aware shade estimate." },
  { id: "nyc-forestry-tree-points", group: "current", productRole: "route", contribution: "Nearby mapped trees contribute to a street edge’s greenery signal." },
  { id: "nyc-parks-properties", group: "current", productRole: "route", contribution: "Park boundaries add park-adjacency context and bounded wander endpoints." },
  { id: "nyc-dot-seating", group: "current", productRole: "route", contribution: "Mapped places to sit can shape a route or appear along the way." },
  { id: "nyc-public-restrooms", group: "current", productRole: "route", contribution: "Published public restroom locations can shape a route or destination." },
  { id: "nyc-parks-drinking-fountains", group: "current", productRole: "route", contribution: "Mapped drinking fountains support water-aware routes and nearby stops." },
  { id: "mta-subway-entrances-2024", group: "current", productRole: "route", contribution: "Mapped subway entrances support transit-oriented endpoints and context." },
  { id: "nyc-sidewalk-shed-permits", group: "current", productRole: "context", contribution: "Dated sidewalk-shed permit locations add nearby rain-cover research context." },
  { id: "nyc-pops", group: "current", productRole: "context", contribution: "Published arcade-like public spaces add nearby cover and public-space context." },
  { id: "nyc-street-construction-closures", group: "current", productRole: "context", contribution: "Dated construction records show where current street verification may matter." },
  { id: "nyc-stormwater-flood-map-2050", group: "current", productRole: "context", contribution: "A static 2050 stormwater scenario adds planner context and route-overlap measurement." },
  { id: "building-shadow-model", group: "derived", productRole: "route", contribution: "Combines sun position, building height, and street geometry into hourly shade estimates." },
  { id: "greenery-edge-model", group: "derived", productRole: "route", contribution: "Combines tree proximity and park adjacency into a bounded greenery score." },
  { id: "happy-path-civic-checks-demo", group: "derived", productRole: "route", contribution: "Simulated partner checks can become optional stops only when someone explicitly asks to help." },
  { id: "nyc-pedestrian-ramps", group: "future", productRole: "future", contribution: "Historical ramp survey points could support crossing audits, not an accessibility guarantee." },
  { id: "nyc-dot-pedestrian-plazas", group: "future", productRole: "future", contribution: "Plaza boundaries could support public-space destinations after entrances are resolved." },
  { id: "nyc-parks-spray-showers", group: "future", productRole: "future", contribution: "Seasonal spray-shower locations could support cooling routes with live operation checks." },
  { id: "nyc-cool-options", group: "future", productRole: "future", contribution: "The live City finder is the official place to check heat-event cooling options." },
  { id: "nyc-facilities-database", group: "future", productRole: "future", contribution: "A broad facility inventory could supply carefully filtered public destinations." },
] as const satisfies readonly DataSourceAuditDefinition[];

export function listAuditedDataSources(): readonly AuditedDataSource[] {
  return auditDefinitions.map((definition) => {
    const registry = getSourceRegistryEntry(definition.id);
    const presentation = sourceRegistryPresentation(definition.id);
    if (!registry || !presentation) throw new Error(`Missing audited data source: ${definition.id}`);
    return { ...definition, registry, presentation };
  });
}

export function dataSourceAuditSummary() {
  const sources = listAuditedDataSources();
  return {
    total: sources.length,
    current: sources.filter((source) => source.group === "current").length,
    derived: sources.filter((source) => source.group === "derived").length,
    future: sources.filter((source) => source.group === "future").length,
    route: sources.filter((source) => source.productRole === "route").length,
    context: sources.filter((source) => source.productRole === "context").length,
    registered: listSourceRegistryEntries().length,
  } as const;
}
