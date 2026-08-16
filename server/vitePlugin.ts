import type { Plugin } from "vite";
import { createInterpretMiddleware, type OpenRouterConfig } from "./interpret.ts";
import { createRouteCityInsightMiddleware } from "./insights.ts";

export function openRouterTripBriefPlugin(config: OpenRouterConfig): Plugin {
  const middleware = createInterpretMiddleware(config);
  const insightsMiddleware = createRouteCityInsightMiddleware(config);
  return {
    name: "happy-path-openrouter-trip-brief",
    configureServer(server) {
      server.middlewares.use(middleware);
      server.middlewares.use(insightsMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
      server.middlewares.use(insightsMiddleware);
    },
  };
}
