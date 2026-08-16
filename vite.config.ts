import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { openRouterTripBriefPlugin } from "./server/vitePlugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      openRouterTripBriefPlugin({
        apiKey: env.OPENROUTER_API_KEY?.trim() ?? "",
        model: env.OPENROUTER_MODEL,
      }),
    ],
    optimizeDeps: { exclude: ["maplibre-gl"] },
  };
});
