import { describe, expect, it, vi } from "vitest";
import { interpretTripBrief } from "./interpretTripBrief";
import { compileTripBrief } from "./tripBrief";

describe("interpretTripBrief", () => {
  it("returns a valid model interpretation", async () => {
    const current = compileTripBrief("Give me a green 25-minute loop");
    const brief = {
      ...current,
      walkingMinutes: 20,
      prompt: "Make it shorter",
      interpretedBy: "model" as const,
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ brief }), { status: 200 }));

    await expect(interpretTripBrief("Make it shorter", current, { fetchImpl: fetchMock as unknown as typeof fetch })).resolves.toEqual(brief);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ prompt: "Make it shorter", currentBrief: current });
  });

  it("accepts a custom integer duration from the model", async () => {
    const current = compileTripBrief("Give me a shady 25-minute loop");
    const brief = {
      ...current,
      walkingMinutes: 37,
      prompt: "Make it 37 minutes",
      interpretedBy: "model" as const,
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ brief }), { status: 200 }));

    await expect(interpretTripBrief("Make it 37 minutes", current, {
      fetchImpl: fetchMock as unknown as typeof fetch,
    })).resolves.toMatchObject({ walkingMinutes: 37, walkingTimeIntent: "target" });
  });

  it("keeps saved defaults unless the current request explicitly replaces them", async () => {
    const current = { ...compileTripBrief("Walk me to Washington Square Park"), priorities: ["shade", "rest"] as const, detourMinutes: 10 as const };
    const modelBrief = {
      ...current,
      priorities: [],
      detourMinutes: 5 as const,
      prompt: "Walk me to Union Square",
      interpretedBy: "model" as const,
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ brief: modelBrief }), { status: 200 })) as unknown as typeof fetch;

    await expect(interpretTripBrief("Walk me to Union Square", { ...current, priorities: [...current.priorities] }, { fetchImpl })).resolves.toMatchObject({
      priorities: ["shade", "rest"],
      detourMinutes: 10,
    });

    const explicitModelBrief = { ...modelBrief, priorities: ["greenery"], prompt: "Take greener streets to Union Square" };
    const explicitFetch = vi.fn(async () => new Response(JSON.stringify({ brief: explicitModelBrief }), { status: 200 })) as unknown as typeof fetch;
    await expect(interpretTripBrief("Take greener streets to Union Square", { ...current, priorities: [...current.priorities] }, { fetchImpl: explicitFetch })).resolves.toMatchObject({
      priorities: ["greenery"],
      detourMinutes: 10,
    });
  });

  it("uses the deterministic compiler when the endpoint is unavailable", async () => {
    const current = compileTripBrief("Give me a green 25-minute loop with water nearby");
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 503 })) as unknown as typeof fetch;

    const result = await interpretTripBrief("A little shorter, but keep the water", current, { fetchImpl });
    expect(result).toEqual(compileTripBrief("A little shorter, but keep the water", current));
    expect(result).toMatchObject({ shape: "loop", walkingMinutes: 20, interpretedBy: "fallback" });
    expect(result.priorities).toEqual(expect.arrayContaining(["greenery", "water"]));
  });

  it("falls back when a nominally successful response is malformed", async () => {
    const current = compileTripBrief("Give me a shady 20-minute loop");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ brief: { shape: "loop" } }), { status: 200 })) as unknown as typeof fetch;

    const result = await interpretTripBrief("Make it longer", current, { fetchImpl });
    expect(result).toEqual(compileTripBrief("Make it longer", current));
  });
});
