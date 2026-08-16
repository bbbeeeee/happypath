import { describe, expect, it } from "vitest";
import {
  getSourceRegistryEntry,
  listSourceRegistryEntries,
  sourceRegistryPresentation,
} from "./sourceRegistry";

const addedSources = [
  ["nyc-pedestrian-ramps", "ufzp-rrqu", "https://data.cityofnewyork.us/resource/ufzp-rrqu.geojson"],
  ["nyc-sidewalk-shed-permits", "ipu4-2q9a", "https://data.cityofnewyork.us/resource/ipu4-2q9a.json"],
  ["nyc-pops", "rvih-nhyn", "https://data.cityofnewyork.us/resource/rvih-nhyn.geojson"],
  ["nyc-dot-pedestrian-plazas", "k5k6-6jex", "https://data.cityofnewyork.us/resource/k5k6-6jex.geojson"],
  ["nyc-parks-spray-showers", "ckaz-6gaa", "https://data.cityofnewyork.us/resource/ckaz-6gaa.geojson"],
  ["nyc-facilities-database", "ji82-xba5", "https://data.cityofnewyork.us/resource/ji82-xba5.json"],
] as const;

describe("source registry presentation", () => {
  it("gives every source a clickable official URL and plain evidence labels", () => {
    for (const source of listSourceRegistryEntries()) {
      const presentation = sourceRegistryPresentation(source.source_id);
      expect(presentation?.officialUrl).toMatch(/^https:\/\//);
      expect(presentation?.availabilityLabel).toBeTruthy();
      expect(presentation?.freshnessLabel).toBeTruthy();
      expect(presentation?.coverageLabel).toBeTruthy();
      expect(presentation?.claimBoundary).toBeTruthy();
    }
  });

  it.each(addedSources)("catalogs %s against the verified official source", (sourceId, datasetId, downloadUrl) => {
    const source = getSourceRegistryEntry(sourceId);
    expect(source).toMatchObject({
      dataset_id: datasetId,
      download_url: downloadUrl,
      authority: "official",
      capability_status: "reference_only",
    });
    expect(source?.freshness_statement).toBeTruthy();
    expect(source?.coverage_statement).toBeTruthy();
    expect(source?.prohibited_claims.length).toBeGreaterThan(0);
  });

  it("keeps the event-driven cooling finder separate from bundled map data", () => {
    expect(sourceRegistryPresentation("nyc-cool-options")).toMatchObject({
      officialUrl: "https://finder.nyc.gov/coolingcenters/",
      downloadUrl: null,
      capabilityStatus: "live_reference",
      availabilityLabel: "Live official reference · not bundled",
    });
  });

  it("does not claim the currently broken sidewalk-shed view is a mapped cover layer", () => {
    const source = getSourceRegistryEntry("nyc-sidewalk-shed-permits");
    expect(source?.related_urls).toContain("https://data.cityofnewyork.us/d/2jy7-cddj");
    expect(source?.known_limitations.join(" ")).toMatch(/saved view currently fails/i);
    expect(source?.prohibited_claims.join(" ")).toMatch(/present now|covered or dry path/i);
    expect(sourceRegistryPresentation("nyc-sidewalk-shed-permits")?.availabilityLabel).toMatch(/not mapped/i);
  });

  it("continues to label already bundled civic assets and greenery as mapped", () => {
    for (const sourceId of [
      "nyc-dot-seating",
      "nyc-public-restrooms",
      "nyc-parks-drinking-fountains",
      "nyc-forestry-tree-points",
      "nyc-parks-properties",
    ]) {
      expect(sourceRegistryPresentation(sourceId)?.capabilityStatus).toBe("ingested");
      expect(sourceRegistryPresentation(sourceId)?.availabilityLabel).toBe("Mapped in this demo");
    }
  });

  it("labels the rain-routing signal as a synthetic method rather than City evidence", () => {
    expect(sourceRegistryPresentation("demo-cover-simulation")).toMatchObject({
      capabilityStatus: "derived",
      availabilityLabel: "Modeled in this demo",
    });
    expect(getSourceRegistryEntry("demo-cover-simulation")?.prohibited_claims.join(" ")).toMatch(/Dry path|Current rain protection/);
  });

  it("labels civic checks as simulated partner prompts rather than official requests", () => {
    expect(sourceRegistryPresentation("happy-path-civic-checks-demo")).toMatchObject({
      capabilityStatus: "derived",
      availabilityLabel: "Modeled in this demo",
    });
    const source = getSourceRegistryEntry("happy-path-civic-checks-demo");
    expect(source?.known_limitations.join(" ")).toMatch(/simulated/i);
    expect(source?.prohibited_claims.join(" ")).toMatch(/Official NYC task|Verified current condition/);
  });
});
