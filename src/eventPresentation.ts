import type { OnRouteEvent } from "./planning/routeEvents";

/**
 * Presentation for permitted events that a walk passes through.
 *
 * Copy here stays inside what a permit can support: it says an event is
 * permitted for a block the walk uses, never that the event is under way.
 */

/** Only the blocks the walk shares with the event are drawn. */
export function onRouteEventGeoJSON(matches: readonly OnRouteEvent[]) {
  return {
    type: "FeatureCollection" as const,
    features: matches.map((match) => ({
        type: "Feature" as const,
        id: match.event.id,
        properties: {
          eventId: match.event.id,
          name: match.event.name,
          eventType: match.event.eventType ?? "Permitted event",
        },
        geometry: {
          type: "MultiLineString" as const,
          coordinates: match.sharedGeometry.map((line) => line.map(([longitude, latitude]) => [longitude, latitude])),
        },
      })),
  };
}

/** "Street festival · 10:00–18:00 today" */
export function eventSummaryLine(match: OnRouteEvent): string {
  const kind = match.event.eventType ?? "Permitted event";
  return `${kind} · ${match.timeWindowLabel} today`;
}

/** "6th Ave, W 34th to W 42nd" — the block run in the reader's language. */
export function eventBlockRunLabel(match: OnRouteEvent): string {
  const [segment] = match.sharedEventSegments;
  if (!segment) return match.event.locationLabel;
  const shorten = (name: string) =>
    name
      .replace(/\bSTREET\b/i, "")
      .replace(/\bAVENUE\b/i, "Ave")
      .replace(/\bWEST\b/i, "W")
      .replace(/\bEAST\b/i, "E")
      .replace(/\s+/g, " ")
      .trim();
  const on = shorten(segment.onStreet);
  const extra = match.event.segments.length - 1;
  const run = `${on}, ${shorten(segment.fromStreet)} to ${shorten(segment.toStreet)}`;
  return extra > 0 ? `${run} +${extra} more` : run;
}

/**
 * How much of the walk runs through the event. Phrased in blocks because that
 * is the unit the permit is written in.
 */
export function eventOverlapLabel(match: OnRouteEvent): string {
  const blocks = match.sharedSegments;
  const unit = blocks === 1 ? "block" : "blocks";
  return `${blocks} ${unit} of your walk`;
}

/** The boundary line shown under every event, without exception. */
export const EVENT_EVIDENCE_BOUNDARY =
  "A permit records an approval, not that the event is set up or happening.";
