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
  { id: "openstreetmap", group: "current", productRole: "route", contribution: "Plans routes using mapped walkable streets, stairs, distances, and covered passages." },
  { id: "nyc-planning-geosearch", group: "current", productRole: "lookup", contribution: "Finds the location you enter and connects it to the walking map." },
  { id: "nyc-building-footprints", group: "current", productRole: "route", contribution: "Helps estimate how much shade a street may have at different times of day." },
  { id: "nyc-forestry-tree-points", group: "current", productRole: "route", contribution: "Helps favor streets with mapped trees nearby." },
  { id: "nyc-parks-properties", group: "current", productRole: "route", contribution: "Helps plan routes near parks or end a walk at one." },
  { id: "nyc-dot-seating", group: "current", productRole: "route", contribution: "Helps find a route with places to sit along the way." },
  { id: "nyc-public-restrooms", group: "current", productRole: "route", contribution: "Helps plan a route near a listed public restroom." },
  { id: "nyc-parks-drinking-fountains", group: "current", productRole: "route", contribution: "Helps plan a route near a listed drinking fountain." },
  { id: "mta-subway-entrances-2024", group: "current", productRole: "route", contribution: "Helps end a walk near a mapped subway entrance." },
  { id: "nyc-sidewalk-shed-permits", group: "current", productRole: "context", contribution: "Shows permitted sidewalk sheds that may offer nearby cover; conditions can change." },
  { id: "nyc-pops", group: "current", productRole: "context", contribution: "Shows public spaces that may have covered areas nearby." },
  { id: "nyc-street-construction-closures", group: "current", productRole: "context", contribution: "Shows recent construction records worth checking before a walk." },
  { id: "nyc-stormwater-flood-map-2050", group: "current", productRole: "context", contribution: "Shows where a route crosses areas in DEP’s long-term flood model. It does not show current flooding." },
  { id: "nws-manhattan-weather", group: "current", productRole: "context", contribution: "Shows representative Manhattan temperature, apparent temperature, rain chance, and heat-risk forecast." },
  { id: "nyc-ramp-program-progress", group: "current", productRole: "context", contribution: "Shows current curb-ramp program status at mapped street corners." },
  { id: "nyc-pedestrian-ramps", group: "current", productRole: "context", contribution: "Adds historical ramp width, slope, ponding, and obstacle observations without scoring compliance." },
  { id: "nyc-accessible-pedestrian-signals", group: "current", productRole: "context", contribution: "Shows installed accessible pedestrian signals at mapped intersections." },
  { id: "nyc-exclusive-pedestrian-signals", group: "current", productRole: "context", contribution: "Shows exclusive pedestrian phases and other published crossing treatments." },
  { id: "mta-elevator-assets", group: "current", productRole: "context", contribution: "Shows subway elevator assets and their daily-published inventory status." },
  { id: "nyc-cool-options", group: "current", productRole: "context", contribution: "Loads cooling centers, pools, spray showers, and other options from the official finder feed." },
  { id: "nyc-permitted-events", group: "current", productRole: "context", contribution: "Shows permitted events on route blocks during their published permit windows without treating them as live closures." },
  { id: "building-shadow-model", group: "derived", productRole: "route", contribution: "Estimates hourly street shade from building height, sun position, and the street map." },
  { id: "greenery-edge-model", group: "derived", productRole: "route", contribution: "Estimates which streets are near mapped trees and parks." },
  { id: "footnote-civic-checks-demo", group: "derived", productRole: "route", contribution: "Adds optional stops where a partner could ask someone to check a public-space detail." },
  { id: "nyc-dot-pedestrian-plazas", group: "future", productRole: "future", contribution: "Could add plazas as public-space destinations once entrances are mapped." },
  { id: "nyc-parks-spray-showers", group: "future", productRole: "future", contribution: "Could help plan a cooling stop when current hours and operation are known." },
  { id: "nyc-facilities-database", group: "future", productRole: "future", contribution: "Could add more useful public destinations after the listings are reviewed." },
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
