import { describe, expect, it, vi } from "vitest";
import { createWeatherMiddleware, parseWeatherContext } from "./weather.ts";

const NOW = Date.parse("2026-08-16T16:15:00Z");

function hourlyPayload() {
  return { properties: { periods: [{
    startTime: "2026-08-16T12:00:00-04:00",
    temperature: 89,
    shortForecast: "Mostly Sunny",
    relativeHumidity: { value: 63 },
    probabilityOfPrecipitation: { value: 20 },
  }] } };
}

function gridPayload() {
  return { properties: {
    apparentTemperature: { values: [{ validTime: "2026-08-16T16:00:00Z/PT1H", value: 33.3 }] },
    heatIndex: { values: [{ validTime: "2026-08-16T16:00:00Z/PT1H", value: 34.4 }] },
    heatRisk: { values: [{ validTime: "2026-08-16T12:00:00Z/PT6H", value: 2 }] },
  } };
}

describe("weather context", () => {
  it("normalizes NWS hourly and grid data without implying street-level conditions", () => {
    expect(parseWeatherContext(hourlyPayload(), gridPayload(), NOW)).toMatchObject({
      locationLabel: "Manhattan representative forecast",
      temperatureF: 89,
      feelsLikeF: 94,
      relativeHumidity: 63,
      precipitationChance: 20,
      heatRisk: "moderate",
      summary: "Mostly Sunny",
      representative: true,
    });
  });

  it("caches a successful response and degrades quietly when upstream is unavailable", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(hourlyPayload()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(gridPayload()), { status: 200 }));
    const middleware = createWeatherMiddleware({ fetchImpl, now: () => NOW });
    const response = () => {
      const headers = new Map<string, string>();
      return {
        statusCode: 0,
        setHeader: (key: string, value: string | number) => headers.set(key.toLowerCase(), String(value)),
        end: vi.fn(),
        headers,
      };
    };
    const first = response();
    await middleware({ method: "GET" } as never, first as never);
    const second = response();
    await middleware({ method: "GET" } as never, second as never);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
