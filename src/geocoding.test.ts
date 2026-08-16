import { afterEach, describe, expect, it, vi } from "vitest";
import { GeocodingUnavailableError, searchNycAddress } from "./geocoding";

afterEach(() => vi.unstubAllGlobals());

describe("searchNycAddress", () => {
  it("returns the first point result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ geometry: { type: "Point", coordinates: [-74, 40.73] }, properties: { label: "Example address" } }] }),
    }));
    await expect(searchNycAddress("12 Example Street")).resolves.toEqual({ coordinate: [-74, 40.73], label: "Example address" });
  });

  it("prefers a supported Manhattan result over an earlier nearby-borough result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [
        { geometry: { type: "Point", coordinates: [-73.9969, 40.7033] }, properties: { label: "Brooklyn" } },
        { geometry: { type: "Point", coordinates: [-74.006, 40.7128] }, properties: { label: "Manhattan" } },
      ] }),
    }));
    await expect(searchNycAddress("Example")).resolves.toEqual({ coordinate: [-74.006, 40.7128], label: "Manhattan" });
  });

  it("keeps an empty successful result distinct from service failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    }));

    await expect(searchNycAddress("Missing place")).resolves.toBeNull();
  });

  it("normalizes rejected network requests to temporary unavailability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(searchNycAddress("12 Example Street")).rejects.toMatchObject({
      name: "GeocodingUnavailableError",
      kind: "temporary-unavailable",
      message: "Address search is temporarily unavailable.",
    });
  });

  it("uses the same temporary-unavailable state for non-success responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(searchNycAddress("12 Example Street")).rejects.toBeInstanceOf(GeocodingUnavailableError);
  });
});
