import { describe, expect, it } from "vitest";
import { defaultDestination, defaultOrigin, pilotGraph } from "../data/cityGraph";
import type { GraphEdge, PilotGraph, TripBrief } from "../types";
import { JourneyPlanningError, planJourney, WALKING_METERS_PER_MINUTE } from "./journey";

function edge(
  id: string,
  from: string,
  to: string,
  distanceMeters = 80,
  steps = false,
): GraphEdge {
  return {
    id,
    from,
    to,
    street: id,
    distanceMeters,
    orientationDegrees: 0,
    canyonFactor: 0,
    treeFactor: 0,
    source: "modeled-demo",
    osm: {
      wayId: Number(id.replace(/\D/g, "")) || 1,
      highway: steps ? "steps" : "footway",
      access: null,
      foot: null,
      steps,
    },
  };
}

const squareGraph: PilotGraph = {
  nodes: [
    { id: "a", name: "A", coordinate: [-74, 40.73] },
    { id: "b", name: "B", coordinate: [-73.99905, 40.73] },
    { id: "c", name: "C", coordinate: [-73.99905, 40.73072] },
    { id: "d", name: "D", coordinate: [-74, 40.73072] },
  ],
  edges: [
    edge("edge-1", "a", "b"),
    edge("edge-2", "b", "c"),
    edge("edge-3", "c", "d"),
    edge("edge-4", "d", "a"),
  ],
};

describe("planJourney destination", () => {
  it("uses an explicit minute detour allowance", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 15,
      detourAllowanceMinutes: 5,
      preferences: [{ featureId: "shade", weight: 1 }],
    });

    expect(result.baseline).not.toBeNull();
    expect(result.recommended.nodeIds[0]).toBe(defaultOrigin);
    expect(result.recommended.nodeIds.at(-1)).toBe(defaultDestination);
    expect(result.recommended.durationMinutes).toBeLessThanOrEqual(
      result.baseline!.durationMinutes + 5 + 0.0001,
    );
    expect(result.recommended.directSunMinutes).toBeLessThanOrEqual(result.baseline!.directSunMinutes + 0.0001);
    expect(result.recommended.extraMinutesVsBaseline).toBeLessThanOrEqual(5.0001);
  });

  it("supports Greener independently of shade and remains deterministic", () => {
    const brief: TripBrief = {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 15,
      detourAllowanceMinutes: 8,
      preferences: [{ featureId: "green", weight: 1 }],
    };
    const first = planJourney(pilotGraph, brief);
    const second = planJourney(pilotGraph, brief);

    expect(first.recommended.greeneryPercent).toBeGreaterThanOrEqual(first.baseline!.greeneryPercent - 0.0001);
    expect(first.recommended.candidateId).toBe(second.recommended.candidateId);
    expect(first.recommended.nodeIds).toEqual(second.recommended.nodeIds);
  });

  it("keeps a zero-minute journey on the baseline and applies departure-time shade", () => {
    const daytime = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 15,
      detourAllowanceMinutes: 0,
      preferences: [{ featureId: "shade", weight: 1 }],
    });
    const nighttime = planJourney(pilotGraph, {
      journeyShape: "destination",
      originNodeId: defaultOrigin,
      destinationNodeId: defaultDestination,
      departureHour: 22,
      detourAllowanceMinutes: 0,
      preferences: [{ featureId: "shade", weight: 1 }],
    });

    expect(daytime.recommended.candidateId).toBe(daytime.baseline!.candidateId);
    expect(daytime.recommended.directSunMinutes).toBeGreaterThan(0);
    expect(nighttime.recommended.directSunMinutes).toBe(0);
    expect(nighttime.recommended.shadePercent).toBe(100);
  });

  it("hard-excludes mapped steps instead of relaxing the requirement", () => {
    const graph: PilotGraph = {
      nodes: [
        { id: "a", name: "A", coordinate: [-74, 40.73] },
        { id: "b", name: "B", coordinate: [-73.999, 40.73] },
        { id: "c", name: "C", coordinate: [-73.9995, 40.731] },
      ],
      edges: [
        edge("steps-1", "a", "b", 100, true),
        edge("alternate-1", "a", "c", 80),
        edge("alternate-2", "c", "b", 80),
      ],
    };
    const result = planJourney(graph, {
      journeyShape: "destination",
      originNodeId: "a",
      destinationNodeId: "b",
      departureHour: 15,
      detourAllowanceMinutes: 0,
      requirements: { avoidMappedSteps: true },
    });

    expect(result.baseline!.nodeIds).toEqual(["a", "c", "b"]);
    expect(result.recommended.mappedStepEdges).toBe(0);
  });

  it("returns a typed no-route error when mapped steps are the only connection", () => {
    const graph: PilotGraph = {
      nodes: squareGraph.nodes.slice(0, 2),
      edges: [edge("steps-1", "a", "b", 80, true)],
    };
    expect(() => planJourney(graph, {
      journeyShape: "destination",
      originNodeId: "a",
      destinationNodeId: "b",
      departureHour: 15,
      detourAllowanceMinutes: 10,
      requirements: { avoidMappedSteps: true },
    })).toThrowError(expect.objectContaining<Partial<JourneyPlanningError>>({ code: "no-route" }));
  });

  it("uses the stored edge polyline in graph traversal order", () => {
    const geometry = [
      [-74, 40.73],
      [-74.0004, 40.7305],
      [-74.001, 40.73],
    ] as [number, number][];
    const graph: PilotGraph = {
      nodes: [
        { id: "a", name: "A", coordinate: geometry[0] },
        { id: "b", name: "B", coordinate: geometry.at(-1)! },
      ],
      edges: [{ ...edge("curve-1", "a", "b", 150), geometry }],
    };
    const result = planJourney(graph, {
      journeyShape: "destination",
      originNodeId: "b",
      destinationNodeId: "a",
      departureHour: 15,
      detourAllowanceMinutes: 0,
    });

    expect(result.recommended.coordinates).toEqual([...geometry].reverse());
  });
});

describe("planJourney loop", () => {
  it("returns a connected, nontrivial loop inside the hard walking budget", () => {
    const result = planJourney(squareGraph, {
      journeyShape: "loop",
      originNodeId: "a",
      departureHour: 15,
      walkingBudgetMinutes: 4,
    });

    expect(result.baseline).toBeNull();
    expect(result.recommended.nodeIds[0]).toBe("a");
    expect(result.recommended.nodeIds.at(-1)).toBe("a");
    expect(new Set(result.recommended.edgeIds).size).toBeGreaterThanOrEqual(3);
    expect(result.recommended.repeatedEdgeRatio).toBeLessThanOrEqual(0.2);
    expect(result.recommended.durationMinutes).toBeLessThanOrEqual(4.0001);
    expect(result.recommended.distanceMeters).toBe(4 * WALKING_METERS_PER_MINUTE);
  });

  it("does not fake a loop when the graph has no cycle", () => {
    const lineGraph: PilotGraph = {
      nodes: squareGraph.nodes.slice(0, 3),
      edges: [edge("line-1", "a", "b"), edge("line-2", "b", "c")],
    };
    expect(() => planJourney(lineGraph, {
      journeyShape: "loop",
      originNodeId: "a",
      departureHour: 15,
      walkingBudgetMinutes: 8,
    })).toThrowError(expect.objectContaining<Partial<JourneyPlanningError>>({ code: "no-feasible-loop" }));
  });

  it("generates a useful real-data loop without retracing edges", () => {
    const result = planJourney(pilotGraph, {
      journeyShape: "loop",
      originNodeId: defaultOrigin,
      departureHour: 15,
      walkingBudgetMinutes: 20,
      preferences: [
        { featureId: "shade", weight: 0.6 },
        { featureId: "green", weight: 1 },
      ],
      requirements: { avoidMappedSteps: true },
    });

    expect(result.recommended.durationMinutes).toBeGreaterThanOrEqual(20 * 0.52);
    expect(result.recommended.durationMinutes).toBeLessThanOrEqual(20.0001);
    expect(result.recommended.mappedStepEdges).toBe(0);
    expect(result.recommended.repeatedEdgeRatio).toBeLessThanOrEqual(0.2);
  });
});

describe("planJourney wander", () => {
  const directionalGraph: PilotGraph = {
    nodes: [
      { id: "origin", name: "Origin", coordinate: [-74, 40.73] },
      { id: "north", name: "North", coordinate: [-74, 40.73144] },
      { id: "east", name: "East", coordinate: [-73.99905, 40.73] },
      { id: "northeast", name: "Northeast", coordinate: [-73.99905, 40.73144] },
      { id: "west", name: "West", coordinate: [-74.00095, 40.73] },
    ],
    edges: [
      edge("steps-1", "origin", "north", 100, true),
      edge("path-1", "origin", "east", 80),
      edge("path-2", "east", "northeast", 80),
      edge("path-3", "northeast", "north", 80),
      edge("path-4", "origin", "west", 80),
    ],
  };

  it("enforces both direction and a resolved end condition", () => {
    const result = planJourney(directionalGraph, {
      journeyShape: "wander",
      originNodeId: "origin",
      departureHour: 15,
      walkingBudgetMinutes: 3,
      direction: "north",
      endCondition: { nodeIds: ["north", "west"], label: "near transit" },
      requirements: { avoidMappedSteps: true },
    });

    expect(result.recommended.endpointNodeId).toBe("north");
    expect(result.recommended.nodeIds).toEqual(["origin", "east", "northeast", "north"]);
    expect(result.recommended.durationMinutes).toBeLessThanOrEqual(3.0001);
    expect(result.recommended.mappedStepEdges).toBe(0);
  });

  it("reports an impossible direction/end-condition combination", () => {
    expect(() => planJourney(directionalGraph, {
      journeyShape: "wander",
      originNodeId: "origin",
      departureHour: 15,
      walkingBudgetMinutes: 3,
      direction: "north",
      endCondition: { nodeIds: ["west"] },
    })).toThrowError(expect.objectContaining<Partial<JourneyPlanningError>>({ code: "no-feasible-wander" }));
  });
});

describe("Trip Brief validation", () => {
  it("rejects invalid budgets and preference weights", () => {
    expect(() => planJourney(squareGraph, {
      journeyShape: "loop",
      originNodeId: "a",
      departureHour: 15,
      walkingBudgetMinutes: 0,
    })).toThrowError(expect.objectContaining<Partial<JourneyPlanningError>>({ code: "invalid-brief" }));

    expect(() => planJourney(squareGraph, {
      journeyShape: "destination",
      originNodeId: "a",
      destinationNodeId: "c",
      departureHour: 15,
      detourAllowanceMinutes: 1,
      preferences: [{ featureId: "shade", weight: 2 }],
    })).toThrowError(expect.objectContaining<Partial<JourneyPlanningError>>({ code: "invalid-brief" }));
  });
});
