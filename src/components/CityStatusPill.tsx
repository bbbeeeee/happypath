import { useEffect, useState } from "react";

const NYC_TIMEZONE = "America/New_York";
const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006" +
  "&current=temperature_2m,weather_code&temperature_unit=fahrenheit" +
  `&timezone=${encodeURIComponent(NYC_TIMEZONE)}`;
const WEATHER_REFRESH_MS = 10 * 60 * 1000;

interface Weather {
  temperature: number;
  code: number;
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NYC_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NYC_TIMEZONE,
  month: "short",
  day: "numeric",
});

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Storms";
}

export function CityStatusPill() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let controller: AbortController | null = null;

    const loadWeather = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(WEATHER_URL, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.current) return;
        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // The clock and date stay useful if live weather is unavailable.
        }
      }
    };

    void loadWeather();
    const interval = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_MS);
    return () => {
      controller?.abort();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="city-status-pill" aria-label="Current New York City time, date, and weather">
      <span className="city-status-item">
        <small>Time</small>
        <strong>{timeFormat.format(now)}</strong>
      </span>
      <i aria-hidden="true" />
      <span className="city-status-item">
        <small>Date</small>
        <strong>{dateFormat.format(now)}</strong>
      </span>
      <i aria-hidden="true" />
      <span className="city-status-item city-status-weather">
        <small>Weather</small>
        <strong>{weather ? `${weather.temperature}° · ${weatherLabel(weather.code)}` : "Loading…"}</strong>
      </span>
    </div>
  );
}
