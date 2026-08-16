import { describe, expect, it } from "vitest";
import { briefSummary, compileTripBrief, DEFAULT_BRIEF, distanceMilesToRoutingMinutes, mergeTripBrief, withDestinationOverride, type TripBrief } from "./tripBrief";

describe("compileTripBrief", () => {
  it("keeps saved route qualities unless the current request names its own", () => {
    const savedDefaults: TripBrief = { ...DEFAULT_BRIEF, priorities: ["shade", "rest"], detourMinutes: 10 };

    expect(compileTripBrief("Walk me to Washington Square Park", savedDefaults)).toMatchObject({
      priorities: ["shade", "rest"],
      detourMinutes: 10,
    });
    expect(compileTripBrief("Walk me to Washington Square Park on greener streets", savedDefaults)).toMatchObject({
      priorities: ["greenery"],
      detourMinutes: 10,
    });
    expect(compileTripBrief("Take the fastest way to Washington Square Park", savedDefaults).detourMinutes).toBe(0);
    expect(compileTripBrief("Walk me to Washington Square Park; no need for water", { ...savedDefaults, priorities: ["shade", "water"] }).priorities).toEqual(["shade"]);
  });

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

  it("turns a distance-based run into a route-distance target", () => {
    const run = compileTripBrief("Map me a shaded 2-mile run through greener streets that loops back here.");
    expect(run).toMatchObject({
      shape: "loop",
      activity: "run",
      distanceMiles: 2,
      priorities: ["shade", "greenery"],
    });
    expect(briefSummary(run)[0]).toBe("2-mile run, back to your start");
    expect(distanceMilesToRoutingMinutes(2)).toBeCloseTo(40.2336, 3);
  });

  it("normalizes kilometers and lets a later time request replace distance", () => {
    const metric = compileTripBrief("Walk 3 kilometers west with more shade");
    const timed = compileTripBrief("Make it a 30-minute walk instead", metric);

    expect(metric).toMatchObject({ shape: "wander", activity: "walk", direction: "west" });
    expect(metric.distanceMiles).toBe(1.86);
    expect(timed).toMatchObject({ distanceMiles: null, walkingMinutes: 30, activity: "walk" });
  });

  it("treats an exact distance as a target and adjusts distance refinements", () => {
    const priorMaximum = compileTripBrief("Wander for up to 30 minutes");
    const distance = compileTripBrief("Make it a 2-mile run", priorMaximum);
    const shorter = compileTripBrief("A little shorter", distance);

    expect(distance).toMatchObject({ distanceMiles: 2, walkingTimeIntent: "target", activity: "run" });
    expect(shorter).toMatchObject({ distanceMiles: 1.75, walkingTimeIntent: "target" });
  });

  it("bounds distance safely and ignores amenity radii", () => {
    const longRun = compileTripBrief("Give me a shaded 20-mile run");

    expect(longRun.distanceMiles).toBe(5);
    expect(longRun.unsupported).toContain("This preview supports route distances from 0.25 to 5 miles");
    expect(compileTripBrief("Give me a -2 mile run").distanceMiles).toBeNull();
    expect(compileTripBrief("Find seating within 2 miles").distanceMiles).toBeNull();
  });

  it("understands timed runs and running to a fixed destination", () => {
    expect(compileTripBrief("Take me on a shaded run for 30 minutes")).toMatchObject({ shape: "loop", activity: "run", walkingMinutes: 30 });
    expect(compileTripBrief("Run to Washington Square Park with more shade")).toMatchObject({ shape: "destination", activity: "run", destinationQuery: "Washington Square Park" });
  });

  it("uses a typed destination instead of an incompatible distance target", () => {
    const run = compileTripBrief("Give me a shaded 2-mile run");
    expect(withDestinationOverride(run, "Washington Square Park")).toMatchObject({
      shape: "destination",
      destinationQuery: "Washington Square Park",
      distanceMiles: null,
      activity: "run",
    });
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
    expect(brief.unsupported.join(" ")).toMatch(/safety/i);
    expect(brief.unsupported.join(" ")).toMatch(/curb ramps/i);
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
    expect(accessible.unsupported.join(" ")).toMatch(/curb ramps, slopes, and temporary obstacles/);
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

  it("matches direction as a complete word and keeps unsupported calm language visible", () => {
    const unrelated = compileTripBrief("Wander southeastern calmly for at least 30 minutes");

    expect(unrelated.direction).toBeNull();
    expect(unrelated.priorities).not.toContain("greenery");
    expect(unrelated.unsupported.join(" ")).toMatch(/calm, crowd, and noise/i);
    expect(unrelated.unsupported.join(" ")).toMatch(/minimum walking time is not enforced/i);
  });

  it("does not infer route amenities from words that merely contain their names", () => {
    const brief = compileTripBrief("Take me to Waterside Plaza through Forest Street");
    expect(brief.priorities).not.toContain("water");
    expect(brief.priorities).not.toContain("rest");
    expect(brief.priorities).not.toContain("greenery");
  });

  it("does not silently treat a fixed-destination duration as a route budget", () => {
    const brief = compileTripBrief("Walk me to Union Square in 25 minutes");

    expect(brief).toMatchObject({ shape: "destination", destinationQuery: "Union Square" });
    expect(brief.unsupported.join(" ")).toMatch(/fixed-destination time is not enforced/i);
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
      "Avoid known stairs",
    ]);
  });
});
