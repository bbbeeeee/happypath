import { describe, expect, it } from "vitest";
import { graphNodeById, nearestGraphNode, pilotGraph } from "../data/cityGraph";
import { planJourney } from "../routing/journey";
import { compileTripBrief, DEFAULT_BRIEF } from "./tripBrief";
import { buildRoutingTripBrief } from "./routePolicy";

describe("Trip Brief route policy", () => {
  it("carries a park-ending wander through the production routing contract", () => {
    // Keep this policy regression on the resident bootstrap graph. Partition
    // loading has its own integration test; loading Downtown here made this
    // small routing assertion contend on multi-megabyte JSON during full runs.
    const origin = nearestGraphNode([-73.9959296, 40.7328696]);
    const uiBrief = compileTripBrief("Wander west for up to 20 minutes and finish near a park", {
      ...DEFAULT_BRIEF,
      priorities: [],
      prompt: "",
    });
    const routingBrief = buildRoutingTripBrief(uiBrief, origin.id, origin.id, pilotGraph);

    expect(routingBrief).toMatchObject({ journeyShape: "wander", direction: "west" });
    if (routingBrief.journeyShape !== "wander") throw new Error("expected wander policy");
    expect(routingBrief.endCondition?.nodeIds.length).toBeGreaterThan(0);
    const result = planJourney(pilotGraph, routingBrief, { walkingTimeIntent: uiBrief.walkingTimeIntent });
    expect(routingBrief.endCondition?.nodeIds).toContain(result.recommended.endpointNodeId);
    expect(graphNodeById(result.recommended.endpointNodeId)).toBeTruthy();
  });
});
