import { describe, expect, it, vi } from "vitest";
import { searchNycAddress } from "./geocoding";

describe("searchNycAddress", () => {
  it("returns the first point result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { type: "Point", coordinates: [-74, 40.73] }, properties: { label: "Example address" } }] }),
    }));
    await expect(searchNycAddress("12 Example Street")).resolves.toEqual({ coordinate: [-74, 40.73], label: "Example address" });
    vi.unstubAllGlobals();
  });
});
