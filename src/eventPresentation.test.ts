import { describe, expect, it } from "vitest";
import type { PermittedEvent } from "./data/permittedEvents";
import { eventBlockRunLabel, onRouteEventGeoJSON } from "./eventPresentation";
import type { OnRouteEvent } from "./planning/routeEvents";

const event: PermittedEvent = {
  id: "permit-multi",
  recordId: "multi",
  name: "Multi-block festival",
  eventType: "Street Festival",
  agency: "Street Activity Permit Office",
  startsAt: "2026-08-16T10:00:00.000",
  endsAt: "2026-08-16T18:00:00.000",
  closureType: "Full Street Closure",
  locationLabel: "FIRST AVENUE and SECOND AVENUE",
  inviting: true,
  segments: [
    { onStreet: "FIRST AVENUE", fromStreet: "WEST 1 STREET", toStreet: "WEST 2 STREET", edgeIds: ["a"], nodePairs: [["n1", "n2"]], geometry: [[[-73.99, 40.74], [-73.98, 40.75]]], meters: 100 },
    { onStreet: "SECOND AVENUE", fromStreet: "WEST 3 STREET", toStreet: "WEST 4 STREET", edgeIds: ["b"], nodePairs: [["n3", "n4"]], geometry: [[[-73.97, 40.76], [-73.96, 40.77]]], meters: 100 },
  ],
  totalMeters: 200,
  sourceId: "nyc-permitted-events",
};

describe("event presentation", () => {
  it("draws and labels only the permit segment shared with the route", () => {
    const shared = event.segments[1];
    const match: OnRouteEvent = {
      event,
      sharedSegments: 1,
      sharedGeometry: [shared.geometry[0]],
      sharedEventSegments: [shared],
      routeShare: 0.5,
      timeWindowLabel: "10:00–18:00",
    };
    const layer = onRouteEventGeoJSON([match]);
    expect(layer.features[0].geometry.coordinates).toEqual([shared.geometry[0]]);
    expect(layer.features[0].geometry.coordinates).not.toContain(event.segments[0].geometry[0]);
    expect(eventBlockRunLabel(match)).toMatch(/^SECOND Ave/);
  });
});
