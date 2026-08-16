import { describe, expect, it } from "vitest";
import {
  getSourceRegistryEntry,
  listSourceRegistryEntries,
  sourceRegistryPresentation,
} from "./sourceRegistry";

const addedSources = [
  ["nyc-pedestrian-ramps", "ufzp-rrqu", "https://data.cityofnewyork.us/resource/ufzp-rrqu.geojson"],
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
      availabilityLabel: "Live city link · opens separately",
    });
  });

  it("labels submitted address lookup as an active live service", () => {
    expect(sourceRegistryPresentation("nyc-planning-geosearch")).toMatchObject({
      capabilityStatus: "live_service",
      availabilityLabel: "Used when you submit an address",
    });
  });

  it("uses current DOB NOW shed candidates without turning points into mapped cover", () => {
    const source = getSourceRegistryEntry("nyc-sidewalk-shed-permits");
    expect(source).toMatchObject({ dataset_id: "rbx6-tga4", capability_status: "ingested" });
    expect(source?.related_urls).toContain("https://data.cityofnewyork.us/d/2jy7-cddj");
    expect(source?.known_limitations.join(" ")).toMatch(/does not prove.*present|does not establish exact shed footprint/i);
    expect(source?.prohibited_claims.join(" ")).toMatch(/present now|covered or dry path/i);
    expect(sourceRegistryPresentation("nyc-sidewalk-shed-permits")?.availabilityLabel).toBe("Included in this preview");
  });

  it("ingests arcade and construction context without using either as covered route geometry", () => {
    expect(getSourceRegistryEntry("nyc-pops")).toMatchObject({ dataset_id: "rvih-nhyn", capability_status: "ingested" });
    expect(getSourceRegistryEntry("nyc-pops")?.pilot_record_count).toBeGreaterThan(0);
    expect(getSourceRegistryEntry("nyc-street-construction-closures")).toMatchObject({ dataset_id: "i6b5-j7bu", capability_status: "ingested" });
    expect(getSourceRegistryEntry("nyc-street-construction-closures")?.pilot_record_count).toBeGreaterThan(0);
    expect(getSourceRegistryEntry("nyc-pops")?.prohibited_claims.join(" ")).toMatch(/covered route segment/i);
    expect(getSourceRegistryEntry("nyc-street-construction-closures")?.prohibited_claims.join(" ")).toMatch(/covered route/i);
  });

  it("continues to label already included civic assets and greenery clearly", () => {
    for (const sourceId of [
      "nyc-dot-seating",
      "nyc-public-restrooms",
      "nyc-parks-drinking-fountains",
      "nyc-forestry-tree-points",
      "nyc-parks-properties",
    ]) {
      expect(sourceRegistryPresentation(sourceId)?.capabilityStatus).toBe("ingested");
      expect(sourceRegistryPresentation(sourceId)?.availabilityLabel).toBe("Included in this preview");
    }
  });

  it("removes the synthetic cover source and bounds community mapped cover", () => {
    expect(getSourceRegistryEntry("demo-cover-simulation")).toBeUndefined();
    expect(getSourceRegistryEntry("openstreetmap")?.allowed_claims.join(" ")).toMatch(/covered ways/i);
    expect(getSourceRegistryEntry("openstreetmap")?.prohibited_claims.join(" ")).toMatch(/rainproof|Complete covered-way/i);
  });

  it("labels civic checks as simulated partner prompts rather than official requests", () => {
    expect(sourceRegistryPresentation("happy-path-civic-checks-demo")).toMatchObject({
      capabilityStatus: "derived",
      availabilityLabel: "Estimated for this preview",
    });
    const source = getSourceRegistryEntry("happy-path-civic-checks-demo");
    expect(source?.known_limitations.join(" ")).toMatch(/simulated/i);
    expect(source?.prohibited_claims.join(" ")).toMatch(/Official NYC task|Verified current condition/);
  });

  it("labels stormwater polygons as a static model rather than present route safety", () => {
    const source = getSourceRegistryEntry("nyc-stormwater-flood-map-2050");
    expect(source).toMatchObject({
      dataset_id: "9i7c-xyvv",
      capability_status: "ingested",
      map_readiness: "context_only",
    });
    expect(source?.pilot_record_count).toBeGreaterThan(0);
    expect(source?.scenario).toMatchObject({ seaLevelCondition: "2050_projection", live: false });
    expect(source?.known_limitations.join(" ")).toMatch(/does not report current water/i);
    expect(source?.prohibited_claims.join(" ")).toMatch(/safe, dry, clear, passable/i);
    expect(sourceRegistryPresentation("nyc-stormwater-flood-map-2050")?.availabilityLabel).toBe("Included in this preview");
  });
});
