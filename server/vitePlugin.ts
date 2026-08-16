import type { Plugin } from "vite";
import { createInterpretMiddleware, type OpenRouterConfig } from "./interpret.ts";

export function openRouterTripBriefPlugin(config: OpenRouterConfig): Plugin {
  const middleware = createInterpretMiddleware(config);
  return {
    name: "happy-path-openrouter-trip-brief",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
