import { describe, expect, it } from "vitest";
import {
  ensureGraphCoverage,
  loadedGraphPartitionIds,
  nearestGraphNodeWithin,
  pilotGraph,
} from "./cityGraph";
import { isInsideSupportedArea } from "./supportedArea";
import { planJourney } from "../routing/journey";

describe("Battery-to-60th walking coverage", () => {
  it("loads a connected cross-neighborhood corridor and routes from FiDi to Midtown", async () => {
    const fidi = [-74.0113, 40.7069] as [number, number];
    const midtown = [-73.9735, 40.7644] as [number, number];
    await ensureGraphCoverage([fidi, midtown]);

    const origin = nearestGraphNodeWithin(fidi, 180);
    const destination = nearestGraphNodeWithin(midtown, 180);
    expect(origin).not.toBeNull();
    expect(destination).not.toBeNull();
    expect(loadedGraphPartitionIds()).toEqual(expect.arrayContaining([
      "fidi",
      "downtown",
      "village",
      "chelsea",
      "midtown-south",
    ]));

    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: origin!.id,
      destinationNodeId: destination!.id,
      departureHour: 14,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 0.6 }],
    });
    expect(result.recommended.distanceMeters).toBeGreaterThan(5_000);
    expect(result.recommended.coordinates.every(isInsideSupportedArea)).toBe(true);
    expect(result.recommended.nodeIds[0]).toBe(origin!.id);
    expect(result.recommended.nodeIds.at(-1)).toBe(destination!.id);
  }, 60_000);
});
