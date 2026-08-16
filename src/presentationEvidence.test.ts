import { describe, expect, it } from "vitest";
import { listCivicAssets } from "./data/civicAssets";
import {
  civicAssetEvidence,
  mappedCoverEvidence,
  formatHour,
  shadeEvidence,
} from "./presentationEvidence";

describe("presentation evidence copy", () => {
  it("turns actual source dates into concise, qualified amenity detail", () => {
    const evidence = civicAssetEvidence(listCivicAssets(["seating"])[0]);
    expect(evidence.statusLabel).toMatch(/city listing/i);
    expect(evidence.freshnessLabel).toMatch(/last refreshed/i);
    expect(evidence.currentConditionsVerified).toBe(false);
    expect(evidence.sourceIds).toEqual(["nyc-dot-seating"]);
  });

  it("keeps modeled shade and mapped cover honest without burying the product copy", () => {
    const shade = shadeEvidence(14);
    expect(shade.freshnessLabel).toMatch(/2 PM/);
    expect(shade.summary).toMatch(/sun and nearby buildings/i);
    expect(shade.currentConditionsVerified).toBe(false);

    expect(mappedCoverEvidence.statusLabel).toMatch(/community-mapped/i);
    expect(mappedCoverEvidence.detail).toMatch(/unassessed/i);
    expect(mappedCoverEvidence.detail).toMatch(/dry route/i);
    expect(mappedCoverEvidence.sourceIds).toEqual(["openstreetmap"]);
  });

  it("formats compact hour labels", () => {
    expect(formatHour(0)).toBe("12 AM");
    expect(formatHour(7)).toBe("7 AM");
    expect(formatHour(12)).toBe("12 PM");
    expect(formatHour(19)).toBe("7 PM");
  });
});
