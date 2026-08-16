import { describe, expect, it } from "vitest";
import { compileTripBrief, DEFAULT_BRIEF, mergeTripBrief } from "./tripBrief";

describe("compileTripBrief", () => {
  it.each([
    ["Walk me to Washington Square Park with less direct sun. I can add five minutes.", "destination", "shade"],
    ["Give me a green 25-minute loop with places to sit.", "loop", "greenery"],
    ["I have 40 minutes. Help me wander north and finish near a subway.", "wander", null],
    ["Walk me to Bryant Park with water nearby.", "destination", "water"],
    ["Give me a 20 minute loop with a bathroom.", "loop", "restroom"],
    ["Wander west for 35 minutes and avoid mapped steps.", "wander", null],
  ] as const)("compiles %s", (prompt, shape, priority) => {
    const brief = compileTripBrief(prompt);
    expect(brief.shape).toBe(shape);
    if (priority) expect(brief.priorities).toContain(priority);
  });

  it("extracts the destination without swallowing preferences", () => {
    const brief = compileTripBrief("Get me to Washington Square Park with less direct sun. I can add five minutes.");
    expect(brief.destinationQuery).toBe("Washington Square Park");
    expect(brief.detourMinutes).toBe(5);
  });

  it("keeps unsupported claims visible", () => {
    const brief = compileTripBrief("Find the safest wheelchair accessible route that is quiet and has a bathroom open now");
    expect(brief.unsupported).toHaveLength(4);
    expect(brief.unsupported.join(" ")).toMatch(/Safety/);
    expect(brief.unsupported.join(" ")).toMatch(/accessibility/);
  });

  it("patches refinements without dropping retained needs", () => {
    const initial = compileTripBrief("Give me a green 25-minute loop with places to sit and water nearby");
    const refined = compileTripBrief("A little shorter, but keep the water", initial);
    expect(refined.walkingMinutes).toBe(20);
    expect(refined.priorities).toEqual(expect.arrayContaining(["greenery", "rest", "water"]));
    expect(refined.shape).toBe("loop");
  });

  it("sanitizes model patches at the domain boundary", () => {
    const merged = mergeTripBrief(DEFAULT_BRIEF, { walkingMinutes: 999, departureHour: -8, detourMinutes: 7 as 5 }, "model");
    expect(merged.walkingMinutes).toBe(60);
    expect(merged.departureHour).toBe(0);
    expect(merged.detourMinutes).toBe(5);
  });
});
