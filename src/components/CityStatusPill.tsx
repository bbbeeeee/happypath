import { useEffect, useState } from "react";
import type { WeatherContext } from "../weatherContext";

const NYC_TIMEZONE = "America/New_York";

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

export function CityStatusPill({ weather }: { weather: WeatherContext | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
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
        <strong>{weather ? `${weather.temperatureF}° · ${weather.summary}` : "Unavailable"}</strong>
      </span>
    </div>
  );
}
