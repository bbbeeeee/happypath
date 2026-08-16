import fixtureJson from "./pilot-civic-tasks.json";
import {
  distanceFromRouteGeometryMeters,
  listCivicAssets,
  type CivicCoordinate,
} from "./civicAssets";
import type { CivicTaskIntent } from "../planning/tripBrief";

export type CivicTaskAction = "verify" | "observe" | "photo";
export type { CivicTaskIntent };

export interface CivicTaskPublisher {
  id: string;
  name: string;
  kind: "simulated_partner";
  sourceId: string;
}

export interface CivicTask {
  id: string;
  action: CivicTaskAction;
  title: string;
  shortLabel: string;
  prompt: string;
  locationLabel: string;
  coordinate: CivicCoordinate;
  relatedAssetId: string;
  sourceIds: string[];
  purpose: string;
  downstreamUse: string;
  estimatedMinutes: 1 | 2;
  responseOptions: string[];
  publishedAt: string;
  expiresAt: string;
  observationExpiresAfterHours: number;
  safetyNote: string;
  photoGuidance: string | null;
}

export interface CivicTaskFixture {
  schemaVersion: 1;
  generatedAt: string;
  publisher: CivicTaskPublisher;
  tasks: CivicTask[];
}

export interface NearbyCivicTask {
  task: CivicTask;
  routeGeometryDistanceMeters: number;
  distanceBasis: "route_geometry";
}

export interface SessionCivicObservation {
  id: string;
  taskId: string;
  response: string;
  observedAt: string;
  expiresAt: string;
  evidenceClass: "session_demo_observation";
  officialStateChanged: false;
  persisted: false;
}

const fixture = fixtureJson as unknown as CivicTaskFixture;
const knownAssetIds = new Set(listCivicAssets().map((asset) => asset.id));

function validateFixture(value: CivicTaskFixture): CivicTaskFixture {
  if (value.schemaVersion !== 1) throw new Error(`Unsupported civic task schema version: ${value.schemaVersion}`);
  if (!value.publisher.id || !value.publisher.name || !value.publisher.sourceId) throw new Error("Civic task publisher is incomplete");
  const ids = new Set<string>();
  for (const task of value.tasks) {
    if (ids.has(task.id)) throw new Error(`Duplicate civic task id: ${task.id}`);
    ids.add(task.id);
    if (!knownAssetIds.has(task.relatedAssetId)) throw new Error(`Civic task ${task.id} has an unknown related asset`);
    if (!task.sourceIds.includes(value.publisher.sourceId) || task.sourceIds.length < 2) {
      throw new Error(`Civic task ${task.id} must cite its publisher and underlying inventory`);
    }
    if (task.coordinate.length !== 2 || task.coordinate.some((coordinate) => !Number.isFinite(coordinate))) {
      throw new Error(`Civic task ${task.id} has invalid coordinates`);
    }
    if (!task.responseOptions.length || task.responseOptions.some((option) => !option.trim())) {
      throw new Error(`Civic task ${task.id} needs bounded response options`);
    }
    if (task.action === "photo" && !task.photoGuidance) throw new Error(`Photo task ${task.id} needs privacy guidance`);
    if (task.observationExpiresAfterHours <= 0 || new Date(task.expiresAt) <= new Date(task.publishedAt)) {
      throw new Error(`Civic task ${task.id} has invalid expiry rules`);
    }
  }
  return value;
}

const validatedFixture = validateFixture(fixture);

export function loadCivicTaskFixture(): CivicTaskFixture {
  return validatedFixture;
}

export function listCivicTasks(options: { intent?: CivicTaskIntent; activeAt?: Date } = {}): CivicTask[] {
  const activeAt = options.activeAt ?? new Date();
  return validatedFixture.tasks.filter((task) => (
    (options.intent === undefined || options.intent === null || options.intent === "any" || task.action === options.intent)
    && new Date(task.publishedAt) <= activeAt
    && activeAt < new Date(task.expiresAt)
  ));
}

export function getCivicTask(taskId: string): CivicTask | undefined {
  return validatedFixture.tasks.find((task) => task.id === taskId);
}

export function findCivicTasksNearRoute(
  route: readonly CivicCoordinate[],
  options: { intent?: CivicTaskIntent; maxDistanceMeters: number; limit?: number; activeAt?: Date },
): NearbyCivicTask[] {
  if (!Number.isFinite(options.maxDistanceMeters) || options.maxDistanceMeters < 0) {
    throw new Error("maxDistanceMeters must be a non-negative finite number");
  }
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  if (limit !== Number.POSITIVE_INFINITY && (!Number.isInteger(limit) || limit < 0)) {
    throw new Error("limit must be a non-negative integer");
  }
  return listCivicTasks({ intent: options.intent, activeAt: options.activeAt })
    .map((task) => ({
      task,
      routeGeometryDistanceMeters: distanceFromRouteGeometryMeters(task, route),
      distanceBasis: "route_geometry" as const,
    }))
    .filter((candidate) => candidate.routeGeometryDistanceMeters <= options.maxDistanceMeters)
    .sort((a, b) => a.routeGeometryDistanceMeters - b.routeGeometryDistanceMeters || a.task.id.localeCompare(b.task.id))
    .slice(0, limit);
}

export function createSessionCivicObservation(task: CivicTask, response: string, observedAt = new Date()): SessionCivicObservation {
  if (!task.responseOptions.includes(response)) throw new Error("Response is not allowed for this civic task");
  return {
    id: `session:${task.id}:${observedAt.toISOString()}`,
    taskId: task.id,
    response,
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(observedAt.getTime() + task.observationExpiresAfterHours * 60 * 60 * 1_000).toISOString(),
    evidenceClass: "session_demo_observation",
    officialStateChanged: false,
    persisted: false,
  };
}

export function civicTaskActionLabel(action: CivicTaskAction): string {
  if (action === "photo") return "Photo check";
  if (action === "observe") return "Quick observation";
  return "Quick verification";
}
