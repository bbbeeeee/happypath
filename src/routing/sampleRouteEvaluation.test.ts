import { describe, expect, it } from "vitest";
import { evaluateSampleRoutes } from "./sampleRouteEvaluation";

const report = evaluateSampleRoutes();

describe("sample route evaluation", () => {
  it("covers the product scenarios deterministically", () => {
    const first = report;
    const second = evaluateSampleRoutes();

    expect(first).toEqual(second);
    expect(first.map((scenario) => scenario.id)).toEqual([
      "destination",
      "thirty_minute_wander",
      "custom_time_loop",
      "two_mile_shaded_run",
      "rain_cover",
      "avoid_mapped_steps",
    ]);
    expect(first.every((scenario) => scenario.metrics.evaluatedCandidateCount > 0)).toBe(true);
  });

  it("targets the requested two-mile route geometry for a shaded run", () => {
    const scenario = report.find((item) => item.id === "two_mile_shaded_run")!;
    const miles = scenario.metrics.distanceMeters / 1609.344;

    expect(scenario.metrics.timing.status).toBe("within-target");
    expect(miles).toBeGreaterThanOrEqual(1.8);
    expect(miles).toBeLessThanOrEqual(2.2);
    expect(scenario.metrics.shadePercent).toBeGreaterThan(0);
    expect(scenario.evidenceBoundary).toMatch(/not a claimed running pace/i);
  });

  it("keeps the destination recommendation inside its detour allowance", () => {
    const scenario = report.find((item) => item.id === "destination")!;

    expect(scenario.metrics.timing.status).toBe("destination");
    expect(scenario.comparison).toBeDefined();
    expect(scenario.comparison!.durationDifferenceMinutes).toBeLessThanOrEqual(5);
    expect(scenario.comparison!.directSunMinutesSaved).toBeGreaterThanOrEqual(0);
  });

  it("uses the requested duration for the 30-minute wander", () => {
    const scenario = report.find((item) => item.id === "thirty_minute_wander")!;

    expect(scenario.metrics.timing).toMatchObject({
      intent: "target",
      requestedMinutes: 30,
      status: "within-target",
      targetRangeMinutes: { minimum: 27, maximum: 33 },
    });
    expect(scenario.metrics.durationMinutes).toBeGreaterThanOrEqual(27);
    expect(scenario.metrics.durationMinutes).toBeLessThanOrEqual(33);
  });

  it("preserves and targets a non-preset loop duration", () => {
    const scenario = report.find((item) => item.id === "custom_time_loop")!;

    expect(scenario.metrics.timing.requestedMinutes).toBe(23);
    expect(scenario.metrics.timing.status).toBe("within-target");
    expect(scenario.metrics.durationMinutes).toBeGreaterThanOrEqual(20.7);
    expect(scenario.metrics.durationMinutes).toBeLessThanOrEqual(25.3);
    expect(scenario.metrics.repeatedEdgeRatio).toBeLessThanOrEqual(0.2);
  });

  it("reports sparse mapped cover without leaving the time band", () => {
    const scenario = report.find((item) => item.id === "rain_cover")!;

    expect(scenario.metrics.timing.status).toBe("within-target");
    expect(scenario.comparison!.coverGainPoints).toBeGreaterThanOrEqual(0);
    expect(scenario.metrics.coverPercent).toBeGreaterThanOrEqual(scenario.comparison!.baselineCoverPercent);
    expect(scenario.evidenceBoundary).toMatch(/community map evidence/i);
    expect(scenario.evidenceBoundary).toMatch(/not.*current|not.*promise/i);
  });

  it("hard-excludes mapped steps without claiming accessibility", () => {
    const scenario = report.find((item) => item.id === "avoid_mapped_steps")!;

    expect(scenario.metrics.mappedStepEdges).toBe(0);
    expect(scenario.evidenceBoundary).toMatch(/not a guarantee/i);
    expect(scenario.evidenceBoundary).toMatch(/accessible/i);
  });
});
