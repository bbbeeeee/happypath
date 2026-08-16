import type { Coordinate, JourneyRoute } from "./types";

/**
 * Navigation presentation: an aerial framing of the whole walk, a heading arrow
 * showing where you are along it, and distinct A and B endpoint markers.
 *
 * The arrow is a position along the planned route, advanced by the demo clock.
 * It is not a device location fix and does not claim to be one.
 */

const EARTH_METERS_PER_DEGREE_LATITUDE = 111_111;

/** Longitude degrees shrink with latitude; Manhattan sits near this factor. */
function metersPerDegreeLongitude(latitude: number): number {
  return EARTH_METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);
}

export function coordinateDistanceMeters(a: Coordinate, b: Coordinate): number {
  const latitude = (a[1] + b[1]) / 2;
  return Math.hypot(
    (b[0] - a[0]) * metersPerDegreeLongitude(latitude),
    (b[1] - a[1]) * EARTH_METERS_PER_DEGREE_LATITUDE,
  );
}

/** Compass bearing in degrees, clockwise from north, matching icon-rotate. */
export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const latitude = (from[1] + to[1]) / 2;
  const east = (to[0] - from[0]) * metersPerDegreeLongitude(latitude);
  const north = (to[1] - from[1]) * EARTH_METERS_PER_DEGREE_LATITUDE;
  if (east === 0 && north === 0) return 0;
  const degrees = (Math.atan2(east, north) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export interface RoutePosition {
  coordinate: Coordinate;
  /** Compass heading of the step being walked. */
  bearing: number;
  /** Metres walked so far. */
  metersTravelled: number;
  metersRemaining: number;
}

/**
 * Position along the route at a given progress fraction, interpolated within
 * whichever step the walk is currently on so the arrow glides rather than hops.
 */
export function positionAlongRoute(
  coordinates: readonly Coordinate[],
  progress: number,
): RoutePosition | null {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) {
    return { coordinate: coordinates[0], bearing: 0, metersTravelled: 0, metersRemaining: 0 };
  }

  const steps: number[] = [];
  let total = 0;
  for (let index = 0; index + 1 < coordinates.length; index += 1) {
    const length = coordinateDistanceMeters(coordinates[index], coordinates[index + 1]);
    steps.push(length);
    total += length;
  }
  if (total === 0) {
    return { coordinate: coordinates[0], bearing: 0, metersTravelled: 0, metersRemaining: 0 };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const target = clamped * total;

  let walked = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const length = steps[index];
    if (length === 0) continue;
    if (walked + length >= target || index === steps.length - 1) {
      const withinStep = Math.min(1, Math.max(0, (target - walked) / length));
      const from = coordinates[index];
      const to = coordinates[index + 1];
      return {
        coordinate: [
          from[0] + (to[0] - from[0]) * withinStep,
          from[1] + (to[1] - from[1]) * withinStep,
        ],
        bearing: bearingDegrees(from, to),
        metersTravelled: target,
        metersRemaining: Math.max(0, total - target),
      };
    }
    walked += length;
  }

  const last = coordinates.at(-1)!;
  return { coordinate: last, bearing: 0, metersTravelled: total, metersRemaining: 0 };
}

export function navigationCursorGeoJSON(route: JourneyRoute | null, progress: number) {
  const position = route ? positionAlongRoute(route.coordinates, progress) : null;
  if (!position) return { type: "FeatureCollection" as const, features: [] };
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      properties: { bearing: position.bearing },
      geometry: { type: "Point" as const, coordinates: position.coordinate },
    }],
  };
}

/** The stretch already walked, drawn under the remaining route. */
export function navigationTrailGeoJSON(route: JourneyRoute | null, progress: number) {
  if (!route || route.coordinates.length < 2) {
    return { type: "FeatureCollection" as const, features: [] };
  }
  const position = positionAlongRoute(route.coordinates, progress);
  if (!position) return { type: "FeatureCollection" as const, features: [] };

  const walked: Coordinate[] = [];
  let travelled = 0;
  for (let index = 0; index + 1 < route.coordinates.length; index += 1) {
    const from = route.coordinates[index];
    const to = route.coordinates[index + 1];
    walked.push(from);
    const length = coordinateDistanceMeters(from, to);
    if (travelled + length >= position.metersTravelled) break;
    travelled += length;
  }
  walked.push(position.coordinate);
  if (walked.length < 2) return { type: "FeatureCollection" as const, features: [] };

  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: walked },
    }],
  };
}

/** "8 min left · 0.4 mi" */
export function navigationProgressLabel(route: JourneyRoute | null, progress: number): string {
  if (!route) return "";
  const position = positionAlongRoute(route.coordinates, progress);
  if (!position) return "";
  const share = position.metersRemaining / Math.max(1, position.metersTravelled + position.metersRemaining);
  const minutesLeft = Math.max(0, Math.round(route.durationMinutes * share));
  const milesLeft = position.metersRemaining / 1609.34;
  if (position.metersRemaining < 25) return "Arrived";
  return `${minutesLeft} min left · ${milesLeft.toFixed(milesLeft < 1 ? 2 : 1)} mi`;
}

const CURSOR_COLOR = "#F05A47";
const ENDPOINT_INK = "#1E2A24";
const ENDPOINT_PAPER = "#FFFDF8";

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Heading arrow. Drawn pointing north so `icon-rotate` can carry the bearing
 * directly, and given a white collar so it stays legible over the route line.
 */
export function navigationCursorSvg(): string {
  // The vector is authored in a 22-unit box and rasterised at 88px. With
  // pixelRatio 2 that lands at 44 CSS px, large enough to read as "you are
  // here" while the camera is pulled back far enough to frame the whole walk.
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 22 22">` +
    `<circle cx="11" cy="11" r="10" fill="${CURSOR_COLOR}" fill-opacity="0.18"/>` +
    `<path d="M11 2.6 17.2 18a.6.6 0 0 1-.85.74L11 15.9 5.65 18.74A.6.6 0 0 1 4.8 18Z" ` +
    `fill="${CURSOR_COLOR}" stroke="${ENDPOINT_PAPER}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `</svg>`,
  );
}

/** Point A: a hollow ring, deliberately quieter than the destination. */
export function originMarkerSvg(): string {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 15 15">` +
    `<circle cx="7.5" cy="7.5" r="5.6" fill="${ENDPOINT_PAPER}" stroke="${ENDPOINT_INK}" stroke-width="2.2"/>` +
    `<circle cx="7.5" cy="7.5" r="2" fill="${ENDPOINT_INK}"/>` +
    `</svg>`,
  );
}

/** Point B: a pin, so the end of the walk reads differently from the start. */
export function destinationMarkerSvg(): string {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 17 21">` +
    `<path d="M8.5 20.2S15.6 12.6 15.6 8.1A7.1 7.1 0 0 0 1.4 8.1c0 4.5 7.1 12.1 7.1 12.1Z" ` +
    `fill="${ENDPOINT_INK}" stroke="${ENDPOINT_PAPER}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="8.5" cy="8" r="2.7" fill="${ENDPOINT_PAPER}"/>` +
    `</svg>`,
  );
}
