import { useEffect, useState } from "react";

// New York City Hall, used as the reference point for local time and weather.
const NYC_LATITUDE = 40.7128;
const NYC_LONGITUDE = -74.006;
const NYC_TIMEZONE = "America/New_York";

// Open-Meteo needs no API key and sends permissive CORS headers, so it works
// straight from the browser in both dev and production.
const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${NYC_LATITUDE}&longitude=${NYC_LONGITUDE}` +
  "&current=temperature_2m,weather_code" +
  "&temperature_unit=fahrenheit" +
  `&timezone=${encodeURIComponent(NYC_TIMEZONE)}`;

// Refresh the forecast every 10 minutes; it updates far slower than that.
const WEATHER_REFRESH_MS = 10 * 60 * 1000;

interface Weather {
  temperature: number;
  code: number;
}

// WMO weather interpretation codes, grouped into the buckets we care about.
// https://open-meteo.com/en/docs
function describeWeather(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀", label: "Clear" };
  if (code <= 2) return { icon: "⛅", label: "Partly cloudy" };
  if (code === 3) return { icon: "☁", label: "Overcast" };
  if (code <= 48) return { icon: "🌫", label: "Fog" };
  if (code <= 57) return { icon: "🌦", label: "Drizzle" };
  if (code <= 67) return { icon: "🌧", label: "Rain" };
  if (code <= 77) return { icon: "❄", label: "Snow" };
  if (code <= 82) return { icon: "🌧", label: "Showers" };
  if (code <= 86) return { icon: "❄", label: "Snow showers" };
  return { icon: "⛈", label: "Thunderstorm" };
}

// Always render in NYC local time regardless of where the viewer sits, and
// label the zone so the reading is unambiguous.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NYC_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NYC_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

export function CityStatus() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);

  // Tick the clock every second. Align the first tick to the next whole second
  // so the display rolls over in step with the system clock rather than
  // drifting by however far into a second the component happened to mount.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 1000);
    }, 1000 - (Date.now() % 1000));

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // Fetch current conditions, and keep them fresh.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(WEATHER_URL);
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled || !data?.current) return;
        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
        });
      } catch {
        // Leave the previous reading in place; the clock still works offline.
      }
    };

    load();
    const interval = setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const conditions = weather ? describeWeather(weather.code) : null;

  return (
    <div className="city-status">
      <span className="city-status-date">{dateFormat.format(now)}</span>
      <span className="city-status-separator" aria-hidden="true" />
      <span className="city-status-time">{timeFormat.format(now)}</span>
      {weather && conditions && (
        <>
          <span className="city-status-separator" aria-hidden="true" />
          <span className="city-status-weather" title={conditions.label}>
            <span aria-hidden="true">{conditions.icon}</span>
            {weather.temperature}&deg;F
          </span>
        </>
      )}
    </div>
  );
}
