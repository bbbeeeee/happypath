import { describe, expect, it, vi } from "vitest";
import { loadAccessContext } from "./accessContext";

describe("access context", () => {
  it("loads a display-only GeoJSON collection lazily", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 }));
    await expect(loadAccessContext(fetchImpl)).resolves.toEqual({ type: "FeatureCollection", features: [] });
    expect(fetchImpl).toHaveBeenCalledWith("/data/pilot-access-context.json");
  });

  it("rejects malformed data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(loadAccessContext(fetchImpl)).rejects.toThrow(/could not be read/i);
  });
});
