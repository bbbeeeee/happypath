import { describe, expect, it } from "vitest";
import { defaultDestination, defaultOrigin, pilotGraph } from "../data/cityGraph";
import { planJourney } from "../routing/journey";
import { buildShadeDetourScenario } from "./shadeScenario";

describe("buildShadeDetourScenario", () => {
  it("reuses a returned route and never increases direct-sun burden", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 14,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 1 }],
    });
    const scenario = buildShadeDetourScenario(pilotGraph, result.recommended, 14);
    expect(scenario).not.toBeNull();
    expect(scenario!.status).toBe("hypothetical");
    expect(scenario!.scenarioDirectSunMinutes).toBeLessThanOrEqual(scenario!.baselineDirectSunMinutes);
    expect(scenario!.sourceIds).toContain("building-shadow-model");
  });

  it("shows no fabricated benefit when the sun is below the horizon", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 23,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 1 }],
    });
    const scenario = buildShadeDetourScenario(pilotGraph, result.recommended, 23);
    expect(scenario?.avoidedDirectSunMinutes).toBe(0);
  });
});
