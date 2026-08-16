import { describe, expect, it, vi } from "vitest";
import { loadWeatherContext } from "./weatherContext";

describe("weather context client", () => {
  it("returns valid representative weather and hides failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ temperatureF: 84, feelsLikeF: 87, representative: true }), { status: 200 }));
    await expect(loadWeatherContext(fetchImpl)).resolves.toMatchObject({ temperatureF: 84, feelsLikeF: 87 });
    fetchImpl.mockRejectedValueOnce(new Error("offline"));
    await expect(loadWeatherContext(fetchImpl)).resolves.toBeNull();
  });
});
