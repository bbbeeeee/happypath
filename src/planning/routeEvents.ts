import {
  permittedEvents,
  segmentKey,
  type PermittedEvent,
  type PermittedEventSegment,
} from "../data/permittedEvents";
import type { RouteResult } from "../types";

/**
 * An event is surfaced only when the walk actually goes through it.
 *
 * "On your way" is asserted from a shared run of graph segments between the
 * chosen route and the permit's resolved block run. There is deliberately no
 * proximity tier: an event one block over is not on your way, and saying so
 * would be the kind of claim this product does not make.
 */

export interface OnRouteEvent {
  event: PermittedEvent;
  /** Segments shared by the route and the event's block run. */
  sharedSegments: number;
  /** Exact permit edge geometries shared with the route. */
  sharedGeometry: readonly (readonly (readonly [longitude: number, latitude: number])[])[];
  /** Permit clauses containing the shared edges, for truthful location copy. */
  sharedEventSegments: readonly PermittedEventSegment[];
  /** Share of the route that runs through the event, 0 to 1. */
  routeShare: number;
  /** Local clock window, formatted for display. */
  timeWindowLabel: string;
}

/** Decimal local hour, matching TripBrief.departureHour. */
function decimalHour(timestamp: string): number | null {
  const match = /T(\d{2}):(\d{2})/.exec(timestamp);
  if (!match) return null;
  return Number(match[1]) + Number(match[2]) / 60;
}

function timestampMinuteOffset(timestamp: string, today: string): number | null {
  const timestampParts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(timestamp);
  const todayParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!timestampParts || !todayParts) return null;
  const timestampDay = Date.UTC(Number(timestampParts[1]), Number(timestampParts[2]) - 1, Number(timestampParts[3]));
  const todayDay = Date.UTC(Number(todayParts[1]), Number(todayParts[2]) - 1, Number(todayParts[3]));
  const dayOffset = Math.round((timestampDay - todayDay) / 86_400_000);
  return dayOffset * 24 * 60 + Number(timestampParts[4]) * 60 + Number(timestampParts[5]);
}

function formatClock(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function overlapsSharedRouteSegments(
  event: PermittedEvent,
  departureHour: number,
  durationMinutes: number,
  today: string,
  sharedRouteSegmentIndexes: readonly number[],
  routeSegmentCount: number,
): boolean {
  if (!event.startsAt || !event.endsAt) return false;
  const eventStart = timestampMinuteOffset(event.startsAt, today);
  const eventEnd = timestampMinuteOffset(event.endsAt, today);
  if (eventStart === null || eventEnd === null || eventEnd <= eventStart || routeSegmentCount === 0) return false;

  const departureMinute = departureHour * 60;
  return sharedRouteSegmentIndexes.some((index) => {
    // RouteResult has total duration but no per-edge timings. Segment position
    // is the narrowest honest estimate available and avoids using the whole
    // trip window for a block the walker reaches much earlier or later.
    const segmentStart = departureMinute + durationMinutes * index / routeSegmentCount;
    const segmentEnd = departureMinute + durationMinutes * (index + 1) / routeSegmentCount;
    return segmentStart < eventEnd && segmentEnd > eventStart;
  });
}

function routeSegments(route: RouteResult): string[] {
  const keys: string[] = [];
  for (let index = 0; index + 1 < route.nodeIds.length; index += 1) {
    keys.push(segmentKey(route.nodeIds[index], route.nodeIds[index + 1]));
  }
  return keys;
}

export function calendarDateForTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export interface RouteEventOptions {
  /** ISO calendar day the trip happens on, for example "2026-08-16". */
  today: string;
  departureHour: number;
  /** Defaults to the full snapshot; injectable for tests. */
  events?: readonly PermittedEvent[];
  /** Occupancy permits are matched but not offered as invitations. */
  invitingOnly?: boolean;
}

export function findOnRouteEvents(
  route: RouteResult,
  { today, departureHour, events = permittedEvents, invitingOnly = true }: RouteEventOptions,
): OnRouteEvent[] {
  const orderedRouteKeys = routeSegments(route);
  const routeKeys = new Set(orderedRouteKeys);
  if (routeKeys.size === 0) return [];

  const matches: OnRouteEvent[] = [];
  for (const event of events) {
    if (invitingOnly && !event.inviting) continue;
    const sharedKeys = new Set<string>();
    const sharedGeometry: Array<PermittedEventSegment["geometry"][number]> = [];
    const sharedEventSegments: PermittedEventSegment[] = [];
    for (const eventSegment of event.segments) {
      let segmentShared = false;
      eventSegment.nodePairs.forEach(([from, to], index) => {
        const key = segmentKey(from, to);
        if (!routeKeys.has(key) || sharedKeys.has(key)) return;
        sharedKeys.add(key);
        segmentShared = true;
        const geometry = eventSegment.geometry[index];
        if (geometry) sharedGeometry.push(geometry);
      });
      if (segmentShared) sharedEventSegments.push(eventSegment);
    }
    if (sharedKeys.size === 0) continue;
    const sharedRouteSegmentIndexes = orderedRouteKeys
      .map((key, index) => sharedKeys.has(key) ? index : -1)
      .filter((index) => index >= 0);
    if (!overlapsSharedRouteSegments(
      event,
      departureHour,
      route.durationMinutes,
      today,
      sharedRouteSegmentIndexes,
      orderedRouteKeys.length,
    )) continue;

    const startHour = decimalHour(event.startsAt ?? "");
    const endHour = decimalHour(event.endsAt ?? "");
    matches.push({
      event,
      sharedSegments: sharedKeys.size,
      sharedGeometry,
      sharedEventSegments,
      routeShare: sharedKeys.size / routeKeys.size,
      timeWindowLabel:
        startHour !== null && endHour !== null
          ? `${formatClock(startHour)}–${formatClock(endHour)}`
          : "Times not published",
    });
  }

  // The event the walk spends most of its length inside is the one worth offering.
  return matches.sort((left, right) => right.sharedSegments - left.sharedSegments);
}
