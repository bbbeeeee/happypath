import type { IncomingMessage, ServerResponse } from "node:http";

const NWS_GRID_URL = "https://api.weather.gov/gridpoints/OKX/34,45";
const NWS_HOURLY_URL = "https://api.weather.gov/gridpoints/OKX/34,45/forecast/hourly";
const CACHE_MS = 15 * 60_000;
const STALE_MS = 2 * 60 * 60_000;

export interface WeatherContext {
  locationLabel: string;
  temperatureF: number;
  feelsLikeF: number;
  relativeHumidity: number | null;
  precipitationChance: number | null;
  heatRisk: "none" | "minor" | "moderate" | "major" | "extreme" | "unknown";
  summary: string;
  validAt: string;
  fetchedAt: string;
  sourceUrl: string;
  representative: true;
}

interface WeatherMiddlewareOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function celsiusToFahrenheit(value: number) {
  return Math.round((value * 9) / 5 + 32);
}

function intervalContains(interval: string, time: number) {
  const [startText, durationText] = interval.split("/");
  const start = Date.parse(startText ?? "");
  if (!Number.isFinite(start)) return false;
  const hours = Number(durationText?.match(/^PT([0-9.]+)H$/)?.[1]);
  const days = Number(durationText?.match(/^P([0-9.]+)D$/)?.[1]);
  const duration = Number.isFinite(hours) ? hours * 60 * 60_000 : Number.isFinite(days) ? days * 24 * 60 * 60_000 : 0;
  return time >= start && time < start + duration;
}

function currentGridValue(property: unknown, time: number): number | null {
  if (!property || typeof property !== "object") return null;
  const values = (property as { values?: unknown }).values;
  if (!Array.isArray(values)) return null;
  const current = values.find((candidate) => candidate && typeof candidate === "object"
    && typeof (candidate as { validTime?: unknown }).validTime === "string"
    && intervalContains((candidate as { validTime: string }).validTime, time));
  return current && typeof current === "object" ? finiteNumber((current as { value?: unknown }).value) : null;
}

function heatRiskLabel(value: number | null): WeatherContext["heatRisk"] {
  if (value === null) return "unknown";
  return value >= 4 ? "extreme" : value >= 3 ? "major" : value >= 2 ? "moderate" : value >= 1 ? "minor" : "none";
}

export function parseWeatherContext(hourlyPayload: unknown, gridPayload: unknown, fetchedAt: number): WeatherContext | null {
  const hourlyProperties = hourlyPayload && typeof hourlyPayload === "object"
    ? (hourlyPayload as { properties?: unknown }).properties
    : null;
  if (!hourlyProperties || typeof hourlyProperties !== "object") return null;
  const periods = (hourlyProperties as { periods?: unknown }).periods;
  const period = Array.isArray(periods) ? periods[0] : null;
  if (!period || typeof period !== "object") return null;
  const temperature = finiteNumber((period as { temperature?: unknown }).temperature);
  if (temperature === null) return null;

  const gridProperties = gridPayload && typeof gridPayload === "object"
    ? (gridPayload as { properties?: Record<string, unknown> }).properties
    : null;
  const apparentCelsius = gridProperties ? currentGridValue(gridProperties.apparentTemperature, fetchedAt) : null;
  const heatIndexCelsius = gridProperties ? currentGridValue(gridProperties.heatIndex, fetchedAt) : null;
  const heatRisk = gridProperties ? currentGridValue(gridProperties.heatRisk, fetchedAt) : null;
  const humidity = finiteNumber((period as { relativeHumidity?: { value?: unknown } }).relativeHumidity?.value);
  const precipitation = finiteNumber((period as { probabilityOfPrecipitation?: { value?: unknown } }).probabilityOfPrecipitation?.value);
  const feelsLike = heatIndexCelsius ?? apparentCelsius;

  return {
    locationLabel: "Manhattan representative forecast",
    temperatureF: Math.round(temperature),
    feelsLikeF: feelsLike === null ? Math.round(temperature) : celsiusToFahrenheit(feelsLike),
    relativeHumidity: humidity === null ? null : Math.round(humidity),
    precipitationChance: precipitation === null ? null : Math.round(precipitation),
    heatRisk: heatRiskLabel(heatRisk),
    summary: String((period as { shortForecast?: unknown }).shortForecast || "NWS hourly forecast"),
    validAt: String((period as { startTime?: unknown }).startTime || new Date(fetchedAt).toISOString()),
    fetchedAt: new Date(fetchedAt).toISOString(),
    sourceUrl: NWS_HOURLY_URL,
    representative: true,
  };
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, body: unknown, cacheControl = "no-store") {
  const encoded = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("Content-Length", Buffer.byteLength(encoded));
  response.end(request.method === "HEAD" ? undefined : encoded);
}

export function createWeatherMiddleware(options: WeatherMiddlewareOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let cached: { value: WeatherContext; fetchedAt: number } | null = null;

  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("Allow", "GET, HEAD");
      sendJson(request, response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for weather context." } });
      return;
    }
    const currentTime = now();
    if (cached && currentTime - cached.fetchedAt < CACHE_MS) {
      sendJson(request, response, 200, cached.value, "public, max-age=300, stale-while-revalidate=600");
      return;
    }

    try {
      const headers = {
        Accept: "application/geo+json, application/json",
        "User-Agent": "Footnote/0.1 (https://github.com/bbbeeeee/happypath)",
      };
      const [hourlyResponse, gridResponse] = await Promise.all([
        fetchImpl(NWS_HOURLY_URL, { headers, signal: AbortSignal.timeout(4_500) }),
        fetchImpl(NWS_GRID_URL, { headers, signal: AbortSignal.timeout(4_500) }),
      ]);
      if (!hourlyResponse.ok || !gridResponse.ok) throw new Error("NWS response was unavailable");
      const parsed = parseWeatherContext(await hourlyResponse.json(), await gridResponse.json(), currentTime);
      if (!parsed) throw new Error("NWS response could not be interpreted");
      cached = { value: parsed, fetchedAt: currentTime };
      sendJson(request, response, 200, parsed, "public, max-age=300, stale-while-revalidate=600");
    } catch {
      if (cached && currentTime - cached.fetchedAt < STALE_MS) {
        sendJson(request, response, 200, cached.value, "public, max-age=60");
        return;
      }
      sendJson(request, response, 503, { error: { code: "WEATHER_UNAVAILABLE", message: "Weather context is temporarily unavailable." } });
    }
  };
}
