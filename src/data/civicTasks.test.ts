import { describe, expect, it } from "vitest";
import { getSourceRegistryEntry } from "./sourceRegistry";
import {
  createSessionCivicObservation,
  findCivicTasksNearRoute,
  listCivicTasks,
  loadCivicTaskFixture,
} from "./civicTasks";
import { listCivicAssets } from "./civicAssets";

describe("civic task registry", () => {
  it("keeps every check published, bounded, expiring, and tied to real inventory evidence", () => {
    const fixture = loadCivicTaskFixture();
    const assetIds = new Set(listCivicAssets().map((asset) => asset.id));
    expect(fixture.publisher.kind).toBe("simulated_partner");
    expect(fixture.tasks.length).toBeGreaterThanOrEqual(5);
    for (const task of fixture.tasks) {
      expect(assetIds.has(task.relatedAssetId)).toBe(true);
      expect(new Date(task.expiresAt).valueOf()).toBeGreaterThan(new Date(task.publishedAt).valueOf());
      expect(task.sourceIds).toContain(fixture.publisher.sourceId);
      task.sourceIds.forEach((sourceId) => expect(getSourceRegistryEntry(sourceId), sourceId).toBeTruthy());
      expect(task.purpose).toBeTruthy();
      expect(task.safetyNote).toMatch(/public|sidewalk|walking path/i);
      expect(`${task.title} ${task.prompt}`).not.toMatch(/repair|clean up|enter traffic|hazard|remove waste|fix it/i);
    }
  });

  it("requires purpose-limited privacy guidance for every photo check", () => {
    const photos = listCivicTasks({ intent: "photo", activeAt: new Date("2026-08-17T00:00:00Z") });
    expect(photos.length).toBeGreaterThan(0);
    photos.forEach((task) => {
      expect(task.photoGuidance).toMatch(/faces/i);
      expect(task.photoGuidance).toMatch(/license plates/i);
      if (/operat/i.test(task.downstreamUse)) expect(task.downstreamUse).toMatch(/not by itself prove operation/i);
    });
  });

  it("filters expired tasks and finds active checks near a route deterministically", () => {
    expect(listCivicTasks({ activeAt: new Date("2028-01-01T00:00:00Z") })).toEqual([]);
    const task = listCivicTasks({ activeAt: new Date("2026-08-17T00:00:00Z") })[0];
    const nearby = findCivicTasksNearRoute([task.coordinate, [-74.002, 40.731]], {
      maxDistanceMeters: 20,
      activeAt: new Date("2026-08-17T00:00:00Z"),
    });
    expect(nearby[0]).toMatchObject({ task: { id: task.id }, distanceBasis: "route_geometry" });
    expect(nearby[0].routeGeometryDistanceMeters).toBe(0);
  });

  it("creates a session-only observation without changing official state", () => {
    const task = listCivicTasks({ intent: "verify", activeAt: new Date("2026-08-17T00:00:00Z") })[0];
    const observedAt = new Date("2026-08-17T12:00:00Z");
    const observation = createSessionCivicObservation(task, task.responseOptions[0], observedAt);
    expect(observation).toMatchObject({
      taskId: task.id,
      evidenceClass: "session_demo_observation",
      officialStateChanged: false,
      persisted: false,
    });
    expect(new Date(observation.expiresAt).valueOf()).toBe(observedAt.valueOf() + task.observationExpiresAfterHours * 3_600_000);
    expect(() => createSessionCivicObservation(task, "free-form unsafe response", observedAt)).toThrow(/not allowed/i);
  });
});
