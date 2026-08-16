import snapshotJson from "./pilot-events.json";

/**
 * Permitted events are resolved onto graph edges at ingest time, so an event's
 * relationship to a route is a segment overlap rather than a proximity guess.
 *
 * A permit is an approval record. Nothing here proves an event is set up,
 * staffed, or happening, so permitted events never affect routing.
 */

export type EventNodePair = readonly [fromNodeId: string, toNodeId: string];

export interface PermittedEventSegment {
  onStreet: string;
  fromStreet: string;
  toStreet: string;
  edgeIds: readonly string[];
  nodePairs: readonly EventNodePair[];
  /** One coordinate ring per graph edge in the block run. */
  geometry: readonly (readonly [longitude: number, latitude: number])[][];
  meters: number;
}

export interface PermittedEvent {
  id: string;
  recordId: string | null;
  name: string;
  eventType: string | null;
  agency: string | null;
  startsAt: string | null;
  endsAt: string | null;
  closureType: string | null;
  locationLabel: string;
  /** Whether this permit reads as a public invitation rather than an occupancy. */
  inviting: boolean;
  segments: readonly PermittedEventSegment[];
  totalMeters: number;
  sourceId: string;
}

export interface PermittedEventSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  source: {
    id: string;
    datasetId: string;
    datasetName: string;
    publisher: string;
    datasetUrl: string;
    termsUrl: string;
    retrievedAt: string;
  };
  boundaries: {
    permitMeaning: string;
    geometry: string;
    routing: string;
  };
  stats: {
    fetched: number;
    resolved: number;
    unresolvedLocation: number;
    outsideArea: number;
  };
  events: readonly PermittedEvent[];
}

export const permittedEventSnapshot = snapshotJson as unknown as PermittedEventSnapshot;

export const permittedEvents: readonly PermittedEvent[] = permittedEventSnapshot.events;

/** Undirected key for one graph segment, so route direction never matters. */
export function segmentKey(fromNodeId: string, toNodeId: string): string {
  return fromNodeId < toNodeId ? `${fromNodeId}~${toNodeId}` : `${toNodeId}~${fromNodeId}`;
}

export function eventSegmentKeys(event: PermittedEvent): Set<string> {
  const keys = new Set<string>();
  for (const segment of event.segments) {
    for (const [from, to] of segment.nodePairs) keys.add(segmentKey(from, to));
  }
  return keys;
}
