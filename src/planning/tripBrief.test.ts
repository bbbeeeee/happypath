import { describe, expect, it } from "vitest";
import { briefSummary, compileTripBrief, DEFAULT_BRIEF, mergeTripBrief, withDestinationOverride } from "./tripBrief";

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
    expect(brief.walkingMinutes).toBe(DEFAULT_BRIEF.walkingMinutes);
  });

  it("understands the conversational examples shown in the composer", () => {
    expect(compileTripBrief("I have 20 minutes. Walk me to Washington Square with less direct sun.")).toMatchObject({
      shape: "destination",
      destinationQuery: "Washington Square",
      priorities: ["shade"],
    });
    expect(compileTripBrief("I’m free for half an hour. Give me a green loop with somewhere to sit.")).toMatchObject({
      shape: "loop",
      walkingMinutes: 30,
      priorities: expect.arrayContaining(["greenery", "rest"]),
    });
    expect(compileTripBrief("I have 30 minutes. Let me wander west and finish near a train.")).toMatchObject({
      shape: "wander",
      walkingMinutes: 30,
      direction: "west",
      endCondition: "transit",
    });
    expect(compileTripBrief("It’s raining and I have 25 minutes. Find a walk with more cover.")).toMatchObject({ shape: "wander", walkingMinutes: 25 });
    expect(compileTripBrief("I have 25 minutes. Find a walk where I can help verify city data.")).toMatchObject({ shape: "wander", walkingMinutes: 25, civicTaskIntent: "verify" });
  });

  it("keeps an optional civic check separate from destination and amenity preferences", () => {
    const brief = compileTripBrief("Take me to Washington Square Park and let me photograph a fountain for city data along the way. I can add five minutes.");
    expect(brief).toMatchObject({
      shape: "destination",
      destinationQuery: "Washington Square Park",
      detourMinutes: 5,
      civicTaskIntent: "photo",
    });
    expect(brief.priorities).not.toContain("water");
  });

  it("turns an explicit city-data contribution into a task-aware wander", () => {
    expect(compileTripBrief("Route me toward something I can photograph for city data")).toMatchObject({
      shape: "wander",
      civicTaskIntent: "photo",
    });
    expect(compileTripBrief("Find me a 25-minute walk where I can help verify city data")).toMatchObject({
      shape: "wander",
      walkingMinutes: 25,
      civicTaskIntent: "verify",
    });
  });

  it("retains and explicitly removes a civic check during refinements", () => {
    const initial = compileTripBrief("Give me a 30-minute loop where I can help verify city data");
    expect(compileTripBrief("More shade, please", initial).civicTaskIntent).toBe("verify");
    expect(compileTripBrief("Skip the verification check", initial).civicTaskIntent).toBeNull();
  });

  it("parses a hyphenated loop budget independently of a destination detour", () => {
    const destination = compileTripBrief("Less direct sun. I can add five minutes.");
    const loop = compileTripBrief("A green 20-minute loop with places to sit.", destination);
    expect(loop).toMatchObject({ shape: "loop", walkingMinutes: 20, detourMinutes: 5 });
  });

  it("does not mistake transit for a request to sit", () => {
    const brief = compileTripBrief("Wander north for 25 minutes and end near transit. Avoid mapped steps.");
    expect(brief.endCondition).toBe("transit");
    expect(brief.priorities).not.toContain("rest");
  });

  it("keeps unsupported claims visible", () => {
    const brief = compileTripBrief("Find the safest wheelchair accessible route that is quiet and has a bathroom open now");
    expect(brief.unsupported).toHaveLength(4);
    expect(brief.unsupported.join(" ")).toMatch(/Safety/);
    expect(brief.unsupported.join(" ")).toMatch(/accessibility/);
    expect(brief.avoidMappedSteps).toBe(true);
  });

  it("turns broad accessibility language into a narrow mapped-step constraint", () => {
    const accessible = compileTripBrief("I need an accessible route to Washington Square Park");
    const relaxed = compileTripBrief("Steps are okay after all", accessible);

    expect(accessible).toMatchObject({
      shape: "destination",
      destinationQuery: "Washington Square Park",
      avoidMappedSteps: true,
    });
    expect(accessible.unsupported.join(" ")).toMatch(/curb ramps, slopes, obstructions/);
    expect(relaxed.avoidMappedSteps).toBe(false);
  });

  it("patches refinements without dropping retained needs", () => {
    const initial = compileTripBrief("Give me a green 25-minute loop with places to sit and water nearby");
    const refined = compileTripBrief("A little shorter, but keep the water", initial);
    expect(refined.walkingMinutes).toBe(20);
    expect(refined.priorities).toEqual(expect.arrayContaining(["greenery", "rest", "water"]));
    expect(refined.shape).toBe("loop");
  });

  it("keeps custom integer minutes instead of rounding them to presets", () => {
    const initial = compileTripBrief("Give me a shady 37-minute loop");
    const refined = compileTripBrief("Make it a little longer", initial);

    expect(initial).toMatchObject({ walkingMinutes: 37, walkingTimeIntent: "target" });
    expect(refined.walkingMinutes).toBe(42);
    expect(mergeTripBrief(initial, { walkingMinutes: 43 }, "controls").walkingMinutes).toBe(43);
  });

  it("distinguishes an ordinary target from an explicit maximum", () => {
    const target = compileTripBrief("Wander west for 30 minutes");
    const maximum = compileTripBrief("Wander west for no more than 30 minutes");

    expect(target.walkingTimeIntent).toBe("target");
    expect(maximum.walkingTimeIntent).toBe("maximum");
    expect(briefSummary(target)[0]).toBe("Wander for about 30 minutes");
    expect(briefSummary(maximum)[0]).toBe("Wander for up to 30 minutes");
  });

  it("does not mistake an unrelated nearby-distance phrase for a time limit", () => {
    const brief = compileTripBrief("Give me a 30-minute loop with seating within 100 meters");
    expect(brief.walkingTimeIntent).toBe("target");
  });

  it("treats a timed weather-aware walk without a destination as a wander", () => {
    const brief = compileTripBrief("It’s raining. Find me a 25-minute walk with more likely cover.");
    expect(brief).toMatchObject({ shape: "wander", destinationQuery: null, walkingMinutes: 25 });
  });

  it("lets the explicit To field override an otherwise destination-free prompt", () => {
    const interpreted = compileTripBrief("I need a step-free route with a place to rest.");
    expect(withDestinationOverride(interpreted, " Washington Square Park ")).toMatchObject({
      shape: "destination",
      destinationQuery: "Washington Square Park",
      avoidMappedSteps: true,
      priorities: ["rest"],
    });
  });

  it("sanitizes model patches at the domain boundary", () => {
    const merged = mergeTripBrief(DEFAULT_BRIEF, { walkingMinutes: 999, departureHour: -8, detourMinutes: 7 as 5 }, "model");
    expect(merged.walkingMinutes).toBe(60);
    expect(merged.departureHour).toBe(0);
    expect(merged.detourMinutes).toBe(5);
  });

  it("makes wander constraints visible in the plan summary", () => {
    const brief = compileTripBrief("Wander north for 25 minutes and finish near a train. Avoid mapped steps.");
    expect(briefSummary(brief)).toEqual([
      "Wander for about 25 minutes",
      "Head north",
      "Finish near transit",
      "Less direct sun",
      "Avoid mapped steps",
    ]);
  });
});
