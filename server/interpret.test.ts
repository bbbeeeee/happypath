import { describe, expect, it, vi } from "vitest";
import { compileTripBrief } from "../src/planning/tripBrief.ts";
import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_URL,
  TripBriefInterpretError,
  interpretTripBriefWithOpenRouter,
} from "./interpret.ts";

function completion(content: unknown) {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { content: JSON.stringify(content) },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("interpretTripBriefWithOpenRouter", () => {
  it("uses strict structured output and includes the current brief for refinement", async () => {
    const current = compileTripBrief("Give me a green 25-minute loop with water nearby");
    const fetchMock = vi.fn(async () => completion({
      shape: "loop",
      destinationQuery: null,
      walkingMinutes: 20,
      detourMinutes: 5,
      departureHour: 15,
      priorities: ["greenery", "water"],
      avoidMappedSteps: false,
      direction: null,
      endCondition: null,
      unsupported: [],
    }));

    const brief = await interpretTripBriefWithOpenRouter(
      { prompt: "A little shorter, but keep the water", currentBrief: current },
      { apiKey: "test-key", fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(brief).toMatchObject({
      shape: "loop",
      walkingMinutes: 20,
      priorities: ["greenery", "water"],
      interpretedBy: "model",
      prompt: "A little shorter, but keep the water",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "happy_path_trip_brief", strict: true },
    });
    expect(body.provider).toEqual({ require_parameters: true });
    const refinement = JSON.parse(body.messages[1].content);
    expect(refinement.currentBrief).toEqual(current);
  });

  it("rejects invalid model output instead of passing it to the client", async () => {
    const fetchImpl = vi.fn(async () => completion({ walkingMinutes: "many" })) as unknown as typeof fetch;
    await expect(interpretTripBriefWithOpenRouter(
      { prompt: "Give me a shady walk" },
      { apiKey: "test-key", fetchImpl },
    )).rejects.toMatchObject({ kind: "invalid-output" });
  });

  it("aborts an upstream request at the configured timeout", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as unknown as typeof fetch;

    await expect(interpretTripBriefWithOpenRouter(
      { prompt: "Give me a shady walk" },
      { apiKey: "test-key", fetchImpl, timeoutMs: 5 },
    )).rejects.toEqual(expect.objectContaining<Partial<TripBriefInterpretError>>({ kind: "timeout" }));
  });
});
