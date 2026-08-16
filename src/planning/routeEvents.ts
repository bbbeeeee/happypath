import {
  eventSegmentKeys,
  permittedEvents,
  segmentKey,
  type PermittedEvent,
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

function calendarDay(timestamp: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp);
  return match ? match[1] : null;
}

function formatClock(hour: number): string {
  const whole = Math.floor(hour);
  const minutes = Math.round((hour - whole) * 60);
  return `${String(whole).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * A walk that reaches the block while the permit is live. The arrival estimate
 * uses the route's own duration, so a long walk that arrives after the event
 * ends is correctly treated as a miss.
 */
function overlapsTrip(
  event: PermittedEvent,
  departureHour: number,
  durationMinutes: number,
  today: string,
): boolean {
  if (!event.startsAt || !event.endsAt) return false;
  if (calendarDay(event.startsAt) !== today) return false;

  const startHour = decimalHour(event.startsAt);
  const endHour = decimalHour(event.endsAt);
  if (startHour === null || endHour === null) return false;

  const arrivalHour = departureHour + durationMinutes / 60;
  return departureHour <= endHour && arrivalHour >= startHour;
}

function routeSegmentKeys(route: RouteResult): Set<string> {
  const keys = new Set<string>();
  for (let index = 0; index + 1 < route.nodeIds.length; index += 1) {
    keys.add(segmentKey(route.nodeIds[index], route.nodeIds[index + 1]));
  }
  return keys;
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
  const routeKeys = routeSegmentKeys(route);
  if (routeKeys.size === 0) return [];

  const matches: OnRouteEvent[] = [];
  for (const event of events) {
    if (invitingOnly && !event.inviting) continue;
    if (!overlapsTrip(event, departureHour, route.durationMinutes, today)) continue;

    let sharedSegments = 0;
    for (const key of eventSegmentKeys(event)) {
      if (routeKeys.has(key)) sharedSegments += 1;
    }
    if (sharedSegments === 0) continue;

    const startHour = decimalHour(event.startsAt ?? "");
    const endHour = decimalHour(event.endsAt ?? "");
    matches.push({
      event,
      sharedSegments,
      routeShare: sharedSegments / routeKeys.size,
      timeWindowLabel:
        startHour !== null && endHour !== null
          ? `${formatClock(startHour)}–${formatClock(endHour)}`
          : "Times not published",
    });
  }

  // The event the walk spends most of its length inside is the one worth offering.
  return matches.sort((left, right) => right.sharedSegments - left.sharedSegments);
}
