import type { RoutePriority, TripBrief } from "./planning/tripBrief";
import { metersToMiles } from "./planning/tripBrief";
import type { Coordinate, JourneyRoute, JourneyShape } from "./types";

export type RouteFeedbackSentiment = "worked_well" | "needs_attention" | "general";
export type RouteFeedbackCategory = "comfort" | "access" | "amenities" | "street_condition";

export interface RouteFeedback {
  id: string;
  createdAt: string;
  sentiment: RouteFeedbackSentiment;
  category: RouteFeedbackCategory | null;
  body: string;
}

export interface RouteActivityLog {
  id: string;
  candidateId: string;
  createdAt: string;
  lastMappedAt: string;
  timesMapped: number;
  originLabel: string;
  destinationLabel: string;
  journeyShape: JourneyShape;
  activity: TripBrief["activity"];
  departureHour: number;
  priorities: RoutePriority[];
  edgeIds: string[];
  coordinates: Coordinate[];
  streets: string[];
  distanceMeters: number;
  durationMinutes: number;
  directSunMinutes: number;
  shadePercent: number;
  greeneryPercent: number;
  mappedStepEdges: number;
  feedback: RouteFeedback[];
}

interface ActivityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredRouteActivity {
  version: 1;
  routes: RouteActivityLog[];
}

export interface RouteActivitySummary {
  uniqueRoutes: number;
  mappedEvents: number;
  feedbackCount: number;
  needsAttentionCount: number;
  totalMiles: number;
  averageDurationMinutes: number;
  categories: { category: RouteFeedbackCategory; count: number; share: number }[];
}

export const ROUTE_ACTIVITY_STORAGE_KEY = "happy-path:route-activity";
export const MAX_ROUTE_ACTIVITY = 60;
export const MAX_ROUTE_COORDINATES = 120;
export const MAX_ROUTE_FEEDBACK_CHARACTERS = 500;

export const ROUTE_FEEDBACK_SENTIMENT_LABELS: Record<RouteFeedbackSentiment, string> = {
  worked_well: "Worked well",
  needs_attention: "Needs attention",
  general: "General note",
};

export const ROUTE_FEEDBACK_CATEGORY_LABELS: Record<RouteFeedbackCategory, string> = {
  comfort: "Comfort",
  access: "Access",
  amenities: "Amenities",
  street_condition: "Street condition",
};

const SENTIMENTS = Object.keys(ROUTE_FEEDBACK_SENTIMENT_LABELS) as RouteFeedbackSentiment[];
const CATEGORIES = Object.keys(ROUTE_FEEDBACK_CATEGORY_LABELS) as RouteFeedbackCategory[];
const PRIORITIES: RoutePriority[] = ["shade", "greenery", "rest", "water", "restroom", "construction"];
const SHAPES: JourneyShape[] = ["destination", "loop", "wander"];

function browserActivityStorage(): ActivityStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value)
    && value.length === 2
    && finiteNumber(value[0])
    && finiteNumber(value[1])
    && value[0] >= -180
    && value[0] <= 180
    && value[1] >= -90
    && value[1] <= 90;
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function positiveInteger(value: unknown, fallback = 1) {
  return finiteNumber(value) && value >= 1 ? Math.floor(value) : fallback;
}

function newId(prefix: string) {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    // A timestamp/random fallback keeps local-only storage usable in restricted browsers.
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sampleRouteCoordinates(coordinates: readonly Coordinate[], maximum = MAX_ROUTE_COORDINATES): Coordinate[] {
  const valid = coordinates.filter(validCoordinate);
  if (valid.length <= maximum) return valid.map((coordinate) => [...coordinate] as Coordinate);
  if (maximum <= 2) return [[...valid[0]] as Coordinate, [...valid.at(-1)!] as Coordinate].slice(0, maximum);
  const sampled = Array.from({ length: maximum }, (_, index) => {
    const sourceIndex = Math.round(index * (valid.length - 1) / (maximum - 1));
    return [...valid[sourceIndex]] as Coordinate;
  });
  return sampled.filter((coordinate, index) => index === 0 || coordinate[0] !== sampled[index - 1][0] || coordinate[1] !== sampled[index - 1][1]);
}

function cleanFeedback(value: unknown): RouteFeedback | null {
  if (!value || typeof value !== "object") return null;
  const feedback = value as Partial<RouteFeedback>;
  const body = text(feedback.body, MAX_ROUTE_FEEDBACK_CHARACTERS);
  if (!text(feedback.id, 100) || !text(feedback.createdAt, 40) || !body || !SENTIMENTS.includes(feedback.sentiment as RouteFeedbackSentiment)) return null;
  return {
    id: text(feedback.id, 100),
    createdAt: text(feedback.createdAt, 40),
    sentiment: feedback.sentiment as RouteFeedbackSentiment,
    category: CATEGORIES.includes(feedback.category as RouteFeedbackCategory) ? feedback.category as RouteFeedbackCategory : null,
    body,
  };
}

function cleanRoute(value: unknown): RouteActivityLog | null {
  if (!value || typeof value !== "object") return null;
  const route = value as Partial<RouteActivityLog>;
  const coordinates = sampleRouteCoordinates(Array.isArray(route.coordinates) ? route.coordinates.filter(validCoordinate) : []);
  if (!text(route.id, 100)
    || !text(route.candidateId, 180)
    || !text(route.createdAt, 40)
    || coordinates.length < 2
    || !SHAPES.includes(route.journeyShape as JourneyShape)
    || !finiteNumber(route.distanceMeters)
    || !finiteNumber(route.durationMinutes)) return null;
  return {
    id: text(route.id, 100),
    candidateId: text(route.candidateId, 180),
    createdAt: text(route.createdAt, 40),
    lastMappedAt: text(route.lastMappedAt, 40) || text(route.createdAt, 40),
    timesMapped: positiveInteger(route.timesMapped),
    originLabel: text(route.originLabel, 100) || "Starting point",
    destinationLabel: text(route.destinationLabel, 100) || (route.journeyShape === "loop" ? "Back to start" : "Route end"),
    journeyShape: route.journeyShape as JourneyShape,
    activity: route.activity === "run" ? "run" : "walk",
    departureHour: finiteNumber(route.departureHour) ? Math.max(0, Math.min(23.99, route.departureHour)) : 12,
    priorities: PRIORITIES.filter((priority) => Array.isArray(route.priorities) && route.priorities.includes(priority)),
    edgeIds: Array.isArray(route.edgeIds) ? route.edgeIds.map((edgeId) => text(edgeId, 180)).filter(Boolean).slice(0, 500) : [],
    coordinates,
    streets: Array.isArray(route.streets) ? route.streets.map((street) => text(street, 100)).filter(Boolean).slice(0, 20) : [],
    distanceMeters: Math.max(0, route.distanceMeters),
    durationMinutes: Math.max(0, route.durationMinutes),
    directSunMinutes: finiteNumber(route.directSunMinutes) ? Math.max(0, route.directSunMinutes) : 0,
    shadePercent: finiteNumber(route.shadePercent) ? Math.max(0, Math.min(100, route.shadePercent)) : 0,
    greeneryPercent: finiteNumber(route.greeneryPercent) ? Math.max(0, Math.min(100, route.greeneryPercent)) : 0,
    mappedStepEdges: finiteNumber(route.mappedStepEdges) ? Math.max(0, Math.floor(route.mappedStepEdges)) : 0,
    feedback: Array.isArray(route.feedback) ? route.feedback.map(cleanFeedback).filter((item): item is RouteFeedback => Boolean(item)).slice(0, 20) : [],
  };
}

export function loadRouteActivity(storage: ActivityStorage | null = browserActivityStorage()): RouteActivityLog[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(ROUTE_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredRouteActivity>;
    if (parsed.version !== 1 || !Array.isArray(parsed.routes)) return [];
    return parsed.routes.map(cleanRoute).filter((route): route is RouteActivityLog => Boolean(route)).slice(0, MAX_ROUTE_ACTIVITY);
  } catch {
    return [];
  }
}

export function saveRouteActivity(routes: readonly RouteActivityLog[], storage: ActivityStorage | null = browserActivityStorage()) {
  if (!storage) return false;
  try {
    const stored: StoredRouteActivity = { version: 1, routes: routes.slice(0, MAX_ROUTE_ACTIVITY) };
    storage.setItem(ROUTE_ACTIVITY_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function clearRouteActivity(storage: ActivityStorage | null = browserActivityStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(ROUTE_ACTIVITY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function recordMappedRoute(
  routes: readonly RouteActivityLog[],
  route: JourneyRoute,
  brief: TripBrief,
  labels: { origin: string; destination: string },
  options: { id?: string; now?: string } = {},
) {
  const now = options.now ?? new Date().toISOString();
  const existing = routes.find((item) => item.candidateId === route.candidateId);
  const entry: RouteActivityLog = {
    id: existing?.id ?? options.id ?? newId("route"),
    candidateId: route.candidateId,
    createdAt: existing?.createdAt ?? now,
    lastMappedAt: now,
    timesMapped: (existing?.timesMapped ?? 0) + 1,
    originLabel: labels.origin,
    destinationLabel: labels.destination,
    journeyShape: route.journeyShape,
    activity: brief.activity,
    departureHour: brief.departureHour,
    priorities: [...brief.priorities],
    edgeIds: [...route.edgeIds],
    coordinates: sampleRouteCoordinates(route.coordinates),
    streets: [...new Set(route.streets.filter(Boolean))].slice(0, 20),
    distanceMeters: route.distanceMeters,
    durationMinutes: route.durationMinutes,
    directSunMinutes: route.directSunMinutes,
    shadePercent: route.shadePercent,
    greeneryPercent: route.greeneryPercent,
    mappedStepEdges: route.mappedStepEdges,
    feedback: existing?.feedback ?? [],
  };
  return [entry, ...routes.filter((item) => item.id !== entry.id)].slice(0, MAX_ROUTE_ACTIVITY);
}

export function addRouteFeedback(
  routes: readonly RouteActivityLog[],
  routeId: string,
  input: { sentiment: RouteFeedbackSentiment; category: RouteFeedbackCategory | null; body: string },
  options: { id?: string; now?: string } = {},
) {
  const body = text(input.body, MAX_ROUTE_FEEDBACK_CHARACTERS);
  if (!body || !SENTIMENTS.includes(input.sentiment) || (input.category !== null && !CATEGORIES.includes(input.category))) return [...routes];
  const feedback: RouteFeedback = {
    id: options.id ?? newId("note"),
    createdAt: options.now ?? new Date().toISOString(),
    sentiment: input.sentiment,
    category: input.category,
    body,
  };
  return routes.map((route) => route.id === routeId ? { ...route, feedback: [feedback, ...route.feedback].slice(0, 20) } : route);
}

export function removeRouteFeedback(routes: readonly RouteActivityLog[], routeId: string, feedbackId: string) {
  return routes.map((route) => route.id === routeId ? { ...route, feedback: route.feedback.filter((item) => item.id !== feedbackId) } : route);
}

export function summarizeRouteActivity(routes: readonly RouteActivityLog[]): RouteActivitySummary {
  const feedback = routes.flatMap((route) => route.feedback);
  const categoryCounts = new Map<RouteFeedbackCategory, number>();
  feedback.forEach((item) => {
    if (item.category) categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  });
  const categorizedCount = [...categoryCounts.values()].reduce((total, count) => total + count, 0);
  return {
    uniqueRoutes: routes.length,
    mappedEvents: routes.reduce((total, route) => total + route.timesMapped, 0),
    feedbackCount: feedback.length,
    needsAttentionCount: feedback.filter((item) => item.sentiment === "needs_attention").length,
    totalMiles: routes.reduce((total, route) => total + metersToMiles(route.distanceMeters) * route.timesMapped, 0),
    averageDurationMinutes: routes.length
      ? routes.reduce((total, route) => total + route.durationMinutes * route.timesMapped, 0) / Math.max(1, routes.reduce((total, route) => total + route.timesMapped, 0))
      : 0,
    categories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count, share: categorizedCount ? count / categorizedCount : 0 }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
  };
}

export function routeActivityGeoJSON(routes: readonly RouteActivityLog[], selectedRouteId: string | null = null) {
  return {
    type: "FeatureCollection" as const,
    features: routes.flatMap((route) => {
      const line = {
        type: "Feature" as const,
        id: `route-${route.id}`,
        properties: {
          kind: "route",
          routeId: route.id,
          selected: route.id === selectedRouteId,
          timesMapped: route.timesMapped,
          feedbackCount: route.feedback.length,
          needsAttention: route.feedback.some((item) => item.sentiment === "needs_attention"),
        },
        geometry: { type: "LineString" as const, coordinates: route.coordinates },
      };
      if (!route.feedback.length) return [line];
      const midpoint = route.coordinates[Math.floor((route.coordinates.length - 1) / 2)];
      return [line, {
        type: "Feature" as const,
        id: `feedback-${route.id}`,
        properties: {
          kind: "feedback",
          routeId: route.id,
          selected: route.id === selectedRouteId,
          feedbackCount: route.feedback.length,
          needsAttention: route.feedback.some((item) => item.sentiment === "needs_attention"),
        },
        geometry: { type: "Point" as const, coordinates: midpoint },
      }];
    }),
  };
}
