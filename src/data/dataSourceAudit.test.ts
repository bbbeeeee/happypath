import { describe, expect, it } from "vitest";
import { dataSourceAuditSummary, listAuditedDataSources } from "./dataSourceAudit";
import { listSourceRegistryEntries } from "./sourceRegistry";

describe("public data source audit", () => {
  it("accounts for every registered source exactly once", () => {
    const audited = listAuditedDataSources();
    const ids = audited.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(listSourceRegistryEntries().map((source) => source.source_id).sort());
  });

  it("keeps current, derived, future, route, and context counts explicit", () => {
    expect(dataSourceAuditSummary()).toMatchObject({
      total: 27,
      registered: 27,
      current: 21,
      derived: 3,
      future: 3,
      route: 11,
      context: 12,
    });
  });

  it("keeps weather, cooling, and mobility records contextual", () => {
    const byId = new Map(listAuditedDataSources().map((source) => [source.id, source]));
    for (const id of ["nws-manhattan-weather", "nyc-cool-options", "nyc-permitted-events", "nyc-ramp-program-progress", "nyc-pedestrian-ramps", "nyc-accessible-pedestrian-signals", "nyc-exclusive-pedestrian-signals", "mta-elevator-assets"]) {
      expect(byId.get(id)).toMatchObject({ group: "current", productRole: "context" });
    }
  });

  it("does not present flood, construction, sheds, or POPS as routing inputs", () => {
    const byId = new Map(listAuditedDataSources().map((source) => [source.id, source]));
    for (const id of ["nyc-stormwater-flood-map-2050", "nyc-street-construction-closures", "nyc-sidewalk-shed-permits", "nyc-pops"]) {
      expect(byId.get(id)?.productRole).toBe("context");
    }
  });

  it("records GeoSearch as an active lookup rather than a future source", () => {
    const geosearch = listAuditedDataSources().find((source) => source.id === "nyc-planning-geosearch");
    expect(geosearch).toMatchObject({ group: "current", productRole: "lookup" });
    expect(geosearch?.presentation.capabilityStatus).toBe("live_service");
  });
});
