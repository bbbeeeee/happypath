import { describe, expect, it } from "vitest";
import type { JourneyRoute, RouteValueFrontier } from "../types";
import {
  computeRouteValueFrontier,
  currentRouteValueFrontier,
  ROUTE_VALUE_POLICIES,
} from "./routeValueFrontier";

describe("route value frontier", () => {
  it("removes dominated points and picks the smallest detour capturing 80% of the available benefit", () => {
    const frontier = computeRouteValueFrontier("baseline", [
      { candidateId: "baseline", extraMinutes: 0, benefit: 0 },
      { candidateId: "early-gain", extraMinutes: 1, benefit: 4 },
      { candidateId: "dominated", extraMinutes: 2, benefit: 3 },
      { candidateId: "sweet-spot", extraMinutes: 3, benefit: 8 },
      { candidateId: "maximum", extraMinutes: 6, benefit: 10 },
    ], ROUTE_VALUE_POLICIES.direct_sun_minutes);

    expect(frontier.status).toBe("meaningful_alternative");
    expect(frontier.maximumBenefit).toBe(10);
    expect(frontier.recommendedCandidateId).toBe("sweet-spot");
    expect(frontier.points.map((point) => point.candidateId)).toEqual([
      "baseline",
      "early-gain",
      "sweet-spot",
      "maximum",
    ]);
    expect(frontier.points.find((point) => point.candidateId === "sweet-spot")?.capturedBenefitRatio).toBe(0.8);
  });

  it("keeps the baseline when the best measured gain is below the meaningful-benefit floor", () => {
    const frontier = computeRouteValueFrontier("baseline", [
      { candidateId: "baseline", extraMinutes: 0, benefit: 0 },
      { candidateId: "tiny-change", extraMinutes: 1, benefit: 0.49 },
    ], ROUTE_VALUE_POLICIES.direct_sun_minutes);

    expect(frontier).toMatchObject({
      status: "no_meaningful_alternative",
      recommendedCandidateId: "baseline",
      maximumBenefit: 0.49,
      meaningfulBenefitFloor: 0.5,
    });
  });

  it("uses a stable candidate id to break equal time and benefit ties", () => {
    const frontier = computeRouteValueFrontier("baseline", [
      { candidateId: "baseline", extraMinutes: 0, benefit: 0 },
      { candidateId: "route-z", extraMinutes: 2, benefit: 5 },
      { candidateId: "route-a", extraMinutes: 2, benefit: 5 },
      { candidateId: "route-later", extraMinutes: 4, benefit: 5.5 },
    ], ROUTE_VALUE_POLICIES.greenery_points);

    expect(frontier.recommendedCandidateId).toBe("route-a");
    expect(frontier.points.map((point) => point.candidateId)).toEqual(["baseline", "route-a", "route-later"]);
  });

  it("returns the direct route when no candidate improves on it", () => {
    const frontier = computeRouteValueFrontier("baseline", [
      { candidateId: "baseline", extraMinutes: 0, benefit: 0 },
      { candidateId: "worse", extraMinutes: 3, benefit: -4 },
    ], ROUTE_VALUE_POLICIES.greenery_points);

    expect(frontier.status).toBe("no_meaningful_alternative");
    expect(frontier.recommendedCandidateId).toBe("baseline");
    expect(frontier.points).toEqual([{
      candidateId: "baseline",
      extraMinutes: 0,
      benefit: 0,
      capturedBenefitRatio: 0,
    }]);
  });

  it("suppresses a frontier made stale by a later route-level selector", () => {
    const frontier = {
      recommendedCandidateId: "engine-choice",
    } as RouteValueFrontier;
    const engineChoice = { candidateId: "engine-choice" } as JourneyRoute;
    const postSelected = { candidateId: "post-selected" } as JourneyRoute;

    expect(currentRouteValueFrontier({ recommended: engineChoice, routeValueFrontier: frontier })).toBe(frontier);
    expect(currentRouteValueFrontier({ recommended: postSelected, routeValueFrontier: frontier })).toBeNull();
  });
});
