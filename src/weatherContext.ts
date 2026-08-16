import type { WeatherContext } from "../server/weather";

export type { WeatherContext };

export async function loadWeatherContext(fetchImpl: typeof fetch = fetch): Promise<WeatherContext | null> {
  try {
    const response = await fetchImpl("/api/weather");
    if (!response.ok) return null;
    const payload = await response.json() as Partial<WeatherContext>;
    if (typeof payload.temperatureF !== "number" || typeof payload.feelsLikeF !== "number" || payload.representative !== true) return null;
    return payload as WeatherContext;
  } catch {
    return null;
  }
}
