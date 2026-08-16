import { describe, expect, it } from "vitest";
import { defaultOrigin, pilotGraph } from "../data/cityGraph";
import { listCivicTasks } from "../data/civicTasks";
import { planJourney } from "../routing/journey";
import type { TripBrief as RoutingTripBrief } from "../types";
import { selectRouteThroughOptionalCivicTask } from "./civicTaskRouting";

function wanderBrief(minutes: number): RoutingTripBrief {
  return {
    journeyShape: "wander",
    originNodeId: defaultOrigin,
    walkingBudgetMinutes: minutes,
    departureHour: 14,
    preferences: [{ featureId: "shade", weight: 1 }],
    requirements: { avoidMappedSteps: true },
  };
}

describe("optional civic task routing", () => {
  it("routes a target-duration wander through a published check without leaving the target band", () => {
    const brief = wanderBrief(25);
    const planningOptions = { walkingTimeIntent: "target" as const };
    const result = planJourney(pilotGraph, brief, planningOptions);
    const selection = selectRouteThroughOptionalCivicTask({
      graph: pilotGraph,
      routingBrief: brief,
      result,
      preferredRoute: result.recommended,
      tasks: listCivicTasks({ intent: "verify", activeAt: new Date("2026-08-17T00:00:00Z") }),
      planningOptions,
    });
    expect(selection.status).toMatch(/along-route|routed-through-check/);
    expect(selection.taskId).toBeTruthy();
    expect(selection.route.durationMinutes).toBeGreaterThanOrEqual(result.timing.targetRangeMinutes!.minimum);
    expect(selection.route.durationMinutes).toBeLessThanOrEqual(result.timing.targetRangeMinutes!.maximum);
    expect(selection.route.nodeIds[0]).toBe(brief.originNodeId);
    expect(selection.route.mappedStepEdges).toBe(0);
  }, 20_000);

  it("leaves an ordinary route byte-for-byte selected when no civic check was requested", () => {
    const brief = wanderBrief(20);
    const result = planJourney(pilotGraph, brief, { walkingTimeIntent: "maximum" });
    expect(selectRouteThroughOptionalCivicTask({
      graph: pilotGraph,
      routingBrief: brief,
      result,
      preferredRoute: result.recommended,
      tasks: [],
    })).toEqual({ route: result.recommended, taskId: null, status: "not-requested" });
  });

  it("can make a published photo check the natural wander endpoint", () => {
    const brief = wanderBrief(25);
    const planningOptions = { walkingTimeIntent: "target" as const };
    const result = planJourney(pilotGraph, brief, planningOptions);
    const photoTasks = listCivicTasks({ intent: "photo", activeAt: new Date("2026-08-17T00:00:00Z") });
    const selection = selectRouteThroughOptionalCivicTask({
      graph: pilotGraph,
      routingBrief: brief,
      result,
      preferredRoute: result.recommended,
      tasks: photoTasks,
      planningOptions,
    });
    expect(selection.status).not.toBe("not-feasible");
    expect(photoTasks.map((task) => task.id)).toContain(selection.taskId);
    expect(selection.route.durationMinutes).toBeGreaterThanOrEqual(result.timing.targetRangeMinutes!.minimum);
    expect(selection.route.durationMinutes).toBeLessThanOrEqual(result.timing.targetRangeMinutes!.maximum);
  }, 20_000);
});
