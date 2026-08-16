import type { Plugin } from "vite";
import { createInterpretMiddleware, type OpenRouterConfig } from "./interpret.ts";
import { createRouteCityInsightMiddleware } from "./insights.ts";
import { createWeatherMiddleware } from "./weather.ts";

export function openRouterTripBriefPlugin(config: OpenRouterConfig): Plugin {
  const middleware = createInterpretMiddleware(config);
  const insightsMiddleware = createRouteCityInsightMiddleware(config);
  const weatherMiddleware = createWeatherMiddleware();
  return {
    name: "footnote-openrouter-trip-brief",
    configureServer(server) {
      server.middlewares.use(middleware);
      server.middlewares.use(insightsMiddleware);
      server.middlewares.use("/api/weather", weatherMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
      server.middlewares.use(insightsMiddleware);
      server.middlewares.use("/api/weather", weatherMiddleware);
    },
  };
}
