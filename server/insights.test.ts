import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_URL,
} from "./interpret.ts";
import {
  RouteCityInsightError,
  createRouteCityInsightFallback,
  generateRouteCityInsightWithOpenRouter,
  type RouteCityInsightRequest,
} from "./insights.ts";

const request: RouteCityInsightRequest = {
  sources: [
    { sourceId: "route-engine", label: "Prototype route engine", kind: "derived" },
    { sourceId: "shade-model", label: "Prototype shade model", kind: "derived" },
    { sourceId: "civic-inventory", label: "City civic asset inventory", kind: "official" },
  ],
  route: {
    routeId: "route-quiet-park",
    journeyLabel: "A lower-sun walk to the park",
    evidence: [
      {
        factId: "route-duration",
        statement: "The route is modeled at 24 minutes.",
        sourceIds: ["route-engine"],
      },
      {
        factId: "route-sun",
        statement: "The shade model estimates 8 minutes in direct sun.",
        sourceIds: ["route-engine", "shade-model"],
      },
    ],
    caveat: "Times and shade are modeled estimates, not live street conditions.",
  },
  candidates: [
    {
      candidateId: "shade-east-block",
      interventionType: "shade",
      locationLabel: "East park approach",
      proposedAction: "Test added shade on the east park approach",
      evidence: [{
        factId: "shade-burden",
        statement: "The model attributes 11 direct-sun minutes to journeys using this approach.",
        sourceIds: ["shade-model"],
      }],
      referenceSourceIds: [],
      caveat: "This is a modeled what-if, not a surveyed or funded project.",
    },
    {
      candidateId: "seat-library-block",
      interventionType: "seating",
      locationLabel: "Library block",
      proposedAction: "Test a rest opportunity near the library block",
      evidence: [{
        factId: "seat-demand",
        statement: "7 of 20 modeled journeys pass the library block.",
        sourceIds: ["route-engine", "civic-inventory"],
      }],
      referenceSourceIds: ["civic-inventory"],
      caveat: "Mapped inventory can be incomplete and does not confirm site feasibility.",
    },
    {
      candidateId: "restroom-square",
      interventionType: "restroom",
      locationLabel: "Civic square",
      proposedAction: "Test restroom access as a civic-square scenario",
      evidence: [{
        factId: "restroom-gap",
        statement: "The civic inventory has no restroom record for this planning area.",
        sourceIds: ["civic-inventory"],
      }],
      referenceSourceIds: [],
      caveat: "No inventory record does not prove that no restroom exists.",
    },
  ],
};

function completion(content: unknown) {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { content: JSON.stringify(content) },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function validModelOutput() {
  return {
    routeEvidenceFactIds: ["route-duration", "route-sun"],
    interventionSelections: [
      {
        candidateId: "shade-east-block",
        evidenceFactIds: ["shade-burden"],
      },
      {
        candidateId: "seat-library-block",
        evidenceFactIds: ["seat-demand"],
      },
    ],
  };
}

describe("generateRouteCityInsightWithOpenRouter", () => {
  it("uses strict output while hydrating authoritative actions, sources, caveats, and status", async () => {
    const fetchMock = vi.fn(async () => completion(validModelOutput()));

    const insight = await generateRouteCityInsightWithOpenRouter(request, {
      apiKey: "test-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(insight).toEqual({
      generatedBy: "model",
      rationale: {
        routeId: "route-quiet-park",
        headline: "A lower-sun walk to the park",
        summary: "The route is modeled at 24 minutes. The shade model estimates 8 minutes in direct sun.",
        factIds: ["route-duration", "route-sun"],
        sourceIds: ["route-engine", "shade-model"],
        caveat: "Times and shade are modeled estimates, not live street conditions.",
      },
      interventions: [
        {
          rank: 1,
          candidateId: "shade-east-block",
          interventionType: "shade",
          locationLabel: "East park approach",
          proposedAction: "Test added shade on the east park approach",
          rationale: "The model attributes 11 direct-sun minutes to journeys using this approach.",
          factIds: ["shade-burden"],
          sourceIds: ["shade-model"],
          referenceSourceIds: [],
          caveat: "This is a modeled what-if, not a surveyed or funded project.",
          status: "hypothetical",
        },
        {
          rank: 2,
          candidateId: "seat-library-block",
          interventionType: "seating",
          locationLabel: "Library block",
          proposedAction: "Test a rest opportunity near the library block",
          rationale: "7 of 20 modeled journeys pass the library block.",
          factIds: ["seat-demand"],
          sourceIds: ["route-engine", "civic-inventory"],
          referenceSourceIds: ["civic-inventory"],
          caveat: "Mapped inventory can be incomplete and does not confirm site feasibility.",
          status: "hypothetical",
        },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "happy_path_route_city_insight",
        strict: true,
        schema: {
          properties: {
            interventionSelections: {
              minItems: 2,
              maxItems: 3,
              items: {
                properties: {
                  candidateId: {
                    enum: ["shade-east-block", "seat-library-block", "restroom-square"],
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(body.provider).toEqual({ require_parameters: true, data_collection: "deny" });
  });

  it("rejects evidence IDs that do not belong to the selected candidate", async () => {
    const output = validModelOutput();
    output.interventionSelections[0].evidenceFactIds = ["seat-demand"];
    const fetchImpl = vi.fn(async () => completion(output)) as unknown as typeof fetch;

    await expect(generateRouteCityInsightWithOpenRouter(request, { apiKey: "test-key", fetchImpl }))
      .rejects.toMatchObject({ kind: "invalid-output" });
  });

  it("rejects duplicate candidates even if the provider ignores unique selection semantics", async () => {
    const output = validModelOutput();
    output.interventionSelections[1] = { ...output.interventionSelections[0] };
    const fetchImpl = vi.fn(async () => completion(output)) as unknown as typeof fetch;

    await expect(generateRouteCityInsightWithOpenRouter(request, { apiKey: "test-key", fetchImpl }))
      .rejects.toMatchObject({ kind: "invalid-output" });
  });

  it("rejects model-authored prose or geometry as an extra field", async () => {
    const output = validModelOutput() as ReturnType<typeof validModelOutput> & {
      geometry?: { coordinates: [number, number] };
    };
    output.geometry = { coordinates: [40.7128, -74.006] };
    const geometryFetch = vi.fn(async () => completion(output)) as unknown as typeof fetch;
    await expect(generateRouteCityInsightWithOpenRouter(request, {
      apiKey: "test-key",
      fetchImpl: geometryFetch,
    })).rejects.toMatchObject({ kind: "invalid-output" });
  });

  it("rejects caller facts with unknown source IDs before making a model request", async () => {
    const invalidRequest: RouteCityInsightRequest = {
      ...request,
      route: {
        ...request.route,
        evidence: [
          { ...request.route.evidence[0], sourceIds: ["invented-source"] },
          ...request.route.evidence.slice(1),
        ],
      },
    };
    const fetchImpl = vi.fn();

    await expect(generateRouteCityInsightWithOpenRouter(invalidRequest, {
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toEqual(expect.objectContaining<Partial<RouteCityInsightError>>({ kind: "invalid-input" }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("createRouteCityInsightFallback", () => {
  it("returns evidence-backed ideas without a model", () => {
    const insight = createRouteCityInsightFallback(request);

    expect(insight.generatedBy).toBe("fallback");
    expect(insight.interventions).toHaveLength(3);
    expect(insight.interventions[0]).toMatchObject({
      proposedAction: request.candidates[0].proposedAction,
      rationale: request.candidates[0].evidence[0].statement,
      sourceIds: ["shade-model"],
      caveat: request.candidates[0].caveat,
      status: "hypothetical",
    });
  });
});
