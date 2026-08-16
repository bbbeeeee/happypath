import { describe, expect, it } from "vitest";
import { permittedEventSnapshot, type PermittedEvent } from "../data/permittedEvents";
import { findOnRouteEvents } from "./routeEvents";
import type { RouteResult } from "../types";

/**
 * A synthetic walk down three segments, two of which a fixture event covers.
 * Using a hand-built route keeps these assertions stable as the checked-in
 * permit snapshot is refreshed.
 */
function routeThrough(nodeIds: string[], durationMinutes = 20): RouteResult {
  return {
    nodeIds,
    coordinates: nodeIds.map((_, index) => [-73.98 + index * 0.001, 40.75]),
    distanceMeters: 800,
    durationMinutes,
    directSunMinutes: 0,
    longestExposedMinutes: 0,
    mappedStepEdges: 0,
    greeneryPercent: 0,
    nearbyTreeCount: 0,
    adjacentParkNames: [],
    shadePercent: 100,
    streets: ["6th Avenue"],
  };
}

const festival: PermittedEvent = {
  id: "permit-fixture",
  recordId: "fixture",
  name: "Fixture Street Festival",
  eventType: "Street Festival",
  agency: "Street Activity Permit Office",
  startsAt: "2026-08-16T10:00:00.000",
  endsAt: "2026-08-16T18:00:00.000",
  closureType: "Full Street Closure",
  locationLabel: "SIXTH AVENUE between WEST 42 STREET and WEST 34 STREET",
  inviting: true,
  segments: [
    {
      onStreet: "6TH AVENUE",
      fromStreet: "WEST 42ND STREET",
      toStreet: "WEST 34TH STREET",
      edgeIds: ["edge-a", "edge-b"],
      nodePairs: [["n1", "n2"], ["n2", "n3"]],
      geometry: [[[-73.98, 40.75], [-73.979, 40.751]], [[-73.979, 40.751], [-73.978, 40.752]]],
      meters: 200,
    },
  ],
  totalMeters: 200,
  sourceId: "nyc-permitted-events",
};

const tripToday = { today: "2026-08-16", departureHour: 12, events: [festival] };

describe("findOnRouteEvents", () => {
  it("surfaces an event the walk passes through", () => {
    const [match] = findOnRouteEvents(routeThrough(["n1", "n2", "n3", "n4"]), tripToday);
    expect(match.event.name).toBe("Fixture Street Festival");
    expect(match.sharedSegments).toBe(2);
    expect(match.timeWindowLabel).toBe("10:00–18:00");
  });

  it("matches regardless of which way the walk travels the block", () => {
    const reversed = findOnRouteEvents(routeThrough(["n4", "n3", "n2", "n1"]), tripToday);
    expect(reversed).toHaveLength(1);
    expect(reversed[0].sharedSegments).toBe(2);
  });

  it("ignores an event the walk never enters, however close it is", () => {
    expect(findOnRouteEvents(routeThrough(["n7", "n8", "n9"]), tripToday)).toEqual([]);
  });

  it("ignores an event that has already ended when the walk starts", () => {
    expect(findOnRouteEvents(routeThrough(["n1", "n2", "n3"]), { ...tripToday, departureHour: 19 })).toEqual([]);
  });

  it("ignores an event that has not opened by the time the walk arrives", () => {
    expect(findOnRouteEvents(routeThrough(["n1", "n2", "n3"]), { ...tripToday, departureHour: 7 })).toEqual([]);
  });

  it("counts a walk that arrives after the opening bell", () => {
    const late = findOnRouteEvents(routeThrough(["n1", "n2", "n3"], 45), { ...tripToday, departureHour: 9.5 });
    expect(late).toHaveLength(1);
  });

  it("ignores an event permitted for a different day", () => {
    expect(findOnRouteEvents(routeThrough(["n1", "n2", "n3"]), { ...tripToday, today: "2026-08-17" })).toEqual([]);
  });

  it("does not offer an occupancy permit as an invitation", () => {
    const production = { ...festival, inviting: false };
    const trip = { ...tripToday, events: [production] };
    expect(findOnRouteEvents(routeThrough(["n1", "n2", "n3"]), trip)).toEqual([]);
    expect(findOnRouteEvents(routeThrough(["n1", "n2", "n3"]), { ...trip, invitingOnly: false })).toHaveLength(1);
  });

  it("ranks the event the walk spends most of its length inside first", () => {
    const shorter: PermittedEvent = {
      ...festival,
      id: "permit-shorter",
      name: "Fixture Farmers Market",
      segments: [{ ...festival.segments[0], nodePairs: [["n3", "n4"]] }],
    };
    const matches = findOnRouteEvents(routeThrough(["n1", "n2", "n3", "n4"]), {
      ...tripToday,
      events: [shorter, festival],
    });
    expect(matches.map((match) => match.event.name)).toEqual([
      "Fixture Street Festival",
      "Fixture Farmers Market",
    ]);
  });
});

describe("permitted event snapshot", () => {
  it("resolves every stored event onto real graph segments", () => {
    for (const event of permittedEventSnapshot.events) {
      expect(event.segments.length).toBeGreaterThan(0);
      for (const segment of event.segments) {
        expect(segment.nodePairs.length).toBeGreaterThan(0);
        expect(segment.edgeIds.length).toBe(segment.nodePairs.length);
      }
    }
  });

  it("states the permit boundary rather than implying the event is happening", () => {
    expect(permittedEventSnapshot.boundaries.permitMeaning).toMatch(/does not prove/i);
    expect(permittedEventSnapshot.boundaries.routing).toMatch(/display-only/i);
  });
});
