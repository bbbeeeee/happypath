import { beforeAll, describe, expect, it } from "vitest";
import { ensureGraphCoverage, pilotGraph } from "../data/cityGraph";
import type { Coordinate } from "../types";
import { permittedEvents } from "../data/permittedEvents";
import { compareRoutes } from "../routing/route";
import { findOnRouteEvents } from "./routeEvents";

/**
 * The pinned demo: Madison Avenue & East 34th Street to Bryant Park.
 *
 * These assertions run against the checked-in permit snapshot, so they describe
 * what the snapshot can support rather than asserting a specific permit that a
 * refresh would retire.
 */
const MADISON_AND_34TH = "42445365";
const BRYANT_PARK_SOUTHWEST = "42430333";

/** Midtown lives in lazily loaded partitions, exactly as the running app loads them. */
const MADISON_AND_34TH_COORDINATE: Coordinate = [-73.982961, 40.747771];
const BRYANT_PARK_COORDINATE: Coordinate = [-73.984118, 40.754842];

describe("Madison to Bryant Park demo", () => {
  beforeAll(async () => {
    await ensureGraphCoverage([MADISON_AND_34TH_COORDINATE, BRYANT_PARK_COORDINATE], 1);
  });

  const routeToBryantPark = () =>
    compareRoutes(pilotGraph, MADISON_AND_34TH, BRYANT_PARK_SOUTHWEST, 12);

  it("routes between the two pinned endpoints", () => {
    const comparison = routeToBryantPark();
    expect(comparison.recommended.nodeIds[0]).toBe(MADISON_AND_34TH);
    expect(comparison.recommended.nodeIds.at(-1)).toBe(BRYANT_PARK_SOUTHWEST);
  });

  it("only reports an event when the walk shares segments with it", () => {
    const matches = findOnRouteEvents(routeToBryantPark().recommended, {
      today: "2026-08-16",
      departureHour: 12,
      events: permittedEvents,
      invitingOnly: false,
    });
    for (const match of matches) {
      expect(match.sharedSegments).toBeGreaterThan(0);
      expect(match.routeShare).toBeGreaterThan(0);
      expect(match.routeShare).toBeLessThanOrEqual(1);
    }
  });

  it("keeps at least one 6th Avenue block run available to demo against", () => {
    // The hero permit is a one-off, so the durable assertion is that the
    // snapshot still resolves block runs on the avenue the demo walks.
    const sixthAvenueRuns = permittedEvents.filter((event) =>
      event.segments.some((segment) => segment.onStreet === "6TH AVENUE"));
    expect(sixthAvenueRuns.length).toBeGreaterThan(0);
  });
});
