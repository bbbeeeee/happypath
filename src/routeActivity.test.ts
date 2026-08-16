import { describe, expect, it } from "vitest";
import { DEFAULT_BRIEF } from "./planning/tripBrief";
import {
  MAX_ROUTE_ACTIVITY,
  MAX_ROUTE_COORDINATES,
  MAX_ROUTE_FEEDBACK_CHARACTERS,
  ROUTE_ACTIVITY_STORAGE_KEY,
  addRouteFeedback,
  clearRouteActivity,
  loadRouteActivity,
  recordMappedRoute,
  routeActivityGeoJSON,
  sampleRouteCoordinates,
  saveRouteActivity,
  summarizeRouteActivity,
} from "./routeActivity";
import type { JourneyRoute } from "./types";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

function route(candidateId = "route-a", coordinates: JourneyRoute["coordinates"] = [[-74, 40.73], [-73.99, 40.74]]): JourneyRoute {
  return {
    candidateId,
    journeyShape: "destination",
    nodeIds: ["a", "b"],
    edgeIds: [`${candidateId}-edge`],
    endpointNodeId: "b",
    coordinates,
    distanceMeters: 1609.344,
    durationMinutes: 20,
    directSunMinutes: 4,
    longestExposedMinutes: 2,
    mappedStepEdges: 0,
    greeneryPercent: 45,
    nearbyTreeCount: 3,
    adjacentParkNames: [],
    shadePercent: 70,
    streets: ["Test Street"],
    repeatedEdgeRatio: 0,
    preferenceScore: 0.8,
    extraMinutesVsBaseline: 2,
  };
}

function oneLog() {
  return recordMappedRoute([], route(), { ...DEFAULT_BRIEF, activity: "walk", priorities: ["shade"] }, { origin: "Chelsea", destination: "Union Square" }, { id: "log-a", now: "2026-08-16T12:00:00.000Z" });
}

describe("route activity storage", () => {
  it("round-trips a versioned route log without storing raw prompts", () => {
    const storage = memoryStorage();
    const logs = oneLog();
    expect(saveRouteActivity(logs, storage)).toBe(true);
    expect(loadRouteActivity(storage)).toEqual(logs);
    const serialized = storage.value(ROUTE_ACTIVITY_STORAGE_KEY) ?? "";
    expect(JSON.parse(serialized)).toMatchObject({ version: 1 });
    expect(serialized).not.toContain("prompt");
  });

  it("ignores malformed versions and fails safely when storage is blocked", () => {
    expect(loadRouteActivity(memoryStorage({ [ROUTE_ACTIVITY_STORAGE_KEY]: JSON.stringify({ version: 9, routes: oneLog() }) }))).toEqual([]);
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadRouteActivity(broken)).toEqual([]);
    expect(saveRouteActivity(oneLog(), broken)).toBe(false);
    expect(clearRouteActivity(broken)).toBe(false);
  });

  it("deduplicates the same path, counts maps, and retains the newest distinct paths", () => {
    let logs = oneLog();
    logs = recordMappedRoute(logs, route(), DEFAULT_BRIEF, { origin: "A", destination: "B" }, { now: "2026-08-16T13:00:00.000Z" });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: "log-a", timesMapped: 2, lastMappedAt: "2026-08-16T13:00:00.000Z" });

    for (let index = 0; index < MAX_ROUTE_ACTIVITY + 5; index += 1) {
      logs = recordMappedRoute(logs, route(`route-${index}`), DEFAULT_BRIEF, { origin: "A", destination: "B" }, { id: `log-${index}` });
    }
    expect(logs).toHaveLength(MAX_ROUTE_ACTIVITY);
    expect(logs[0].candidateId).toBe(`route-${MAX_ROUTE_ACTIVITY + 4}`);
    expect(logs.some((item) => item.candidateId === "route-a")).toBe(false);
  });

  it("samples long geometry while preserving valid endpoints", () => {
    const coordinates = Array.from({ length: 500 }, (_, index) => [-74 + index / 10000, 40.7 + index / 10000] as [number, number]);
    const sampled = sampleRouteCoordinates(coordinates);
    expect(sampled.length).toBeLessThanOrEqual(MAX_ROUTE_COORDINATES);
    expect(sampled[0]).toEqual(coordinates[0]);
    expect(sampled.at(-1)).toEqual(coordinates.at(-1));
  });
});

describe("route feedback and planner summaries", () => {
  it("adds bounded feedback to a specific route and summarizes categories separately from routes", () => {
    let logs = oneLog();
    logs = addRouteFeedback(logs, "log-a", {
      sentiment: "needs_attention",
      category: "access",
      body: `  ${"step ".repeat(140)}  `,
    }, { id: "note-a", now: "2026-08-16T12:30:00.000Z" });

    expect(logs[0].feedback[0].body).toHaveLength(MAX_ROUTE_FEEDBACK_CHARACTERS);
    expect(summarizeRouteActivity(logs)).toMatchObject({
      uniqueRoutes: 1,
      mappedEvents: 1,
      feedbackCount: 1,
      needsAttentionCount: 1,
      totalMiles: 1,
      averageDurationMinutes: 20,
      categories: [{ category: "access", count: 1, share: 1 }],
    });
  });

  it("does not add empty or orphaned feedback", () => {
    const logs = oneLog();
    expect(addRouteFeedback(logs, "log-a", { sentiment: "general", category: null, body: "   " })).toEqual(logs);
    expect(addRouteFeedback(logs, "missing", { sentiment: "general", category: null, body: "Useful note" })).toEqual(logs);
  });

  it("builds one route trace and one aggregated note marker per annotated route", () => {
    const logs = addRouteFeedback(oneLog(), "log-a", { sentiment: "worked_well", category: "comfort", body: "Cool and quiet." }, { id: "note-a" });
    const geojson = routeActivityGeoJSON(logs, "log-a");
    expect(geojson.features).toHaveLength(2);
    expect(geojson.features.map((feature) => feature.properties)).toEqual([
      expect.objectContaining({ kind: "route", routeId: "log-a", selected: true, feedbackCount: 1 }),
      expect.objectContaining({ kind: "feedback", routeId: "log-a", selected: true, feedbackCount: 1 }),
    ]);
    expect(geojson.features[1].geometry.type).toBe("Point");
  });

  it("filters malformed stored records and feedback without crashing", () => {
    const [valid] = oneLog();
    const malformed = {
      ...valid,
      feedback: [
        { id: "good", createdAt: "now", sentiment: "general", category: "comfort", body: "Keep" },
        { id: "bad", createdAt: "now", sentiment: "invented", category: "comfort", body: "Drop" },
      ],
    } as unknown;
    const storage = memoryStorage({ [ROUTE_ACTIVITY_STORAGE_KEY]: JSON.stringify({ version: 1, routes: [malformed, { id: "broken" }] }) });
    const loaded = loadRouteActivity(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].feedback.map((item) => item.id)).toEqual(["good"]);
  });
});
