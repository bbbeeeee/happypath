import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { cityOsPlugin } from "./server/cityos";
import { navigationPlugin } from "./server/navigation";

// Default host serving the rendered NYC tile pyramid. This is the upstream
// project's public bucket — the only place these tiles are published. Override
// with TILES_HOST in .env once we host our own. See UPSTREAM.md.
const TILES_HOST = "https://isometric-nyc-tiles.cannoneyed.com";
const STREET_TILES_URL =
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

export default defineConfig(({ mode }) => {
  // Load env file from project root (two levels up from src/app/).
  // Only load variables this app understands so unrelated terminal secrets never
  // become part of Vite's configuration object.
  const env = loadEnv(mode, resolve(__dirname, "../.."), [
    "ANTHROPIC_",
    "CITY_OS_",
    "LOCAL_",
    "MAP_",
    "R2_",
    "STREET_",
    "TILES_",
    "USE_",
  ]);

  const tilesHost = env.TILES_HOST || TILES_HOST;
  const streetTilesUrl = env.STREET_TILES_URL || STREET_TILES_URL;

  // The City OS endpoint reads ANTHROPIC_API_KEY from the process env; surface
  // the value from the repo-root .env so `npx vite` alone is enough to run it.
  if (!process.env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }
  if (!process.env.CITY_OS_MODEL && env.CITY_OS_MODEL) {
    process.env.CITY_OS_MODEL = env.CITY_OS_MODEL;
  }

  return {
    base: "/",
    plugins: [react(), cityOsPlugin(), navigationPlugin()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    server: {
      port: 3000,
      open: true,
      // The tiles host restricts CORS to its own site's origin, so a browser on
      // localhost is blocked from fetching tiles directly. Proxying /dzi through
      // the dev server makes those requests same-origin and sidesteps CORS.
      proxy: {
        "/dzi": {
          target: tilesHost,
          changeOrigin: true,
        },
      },
    },
    define: {
      // Base URL for DZI tiles.
      // Production: the tiles host (export dir is appended via config.ts)
      // Dev: local public folder (empty string = same origin)
      __TILES_BASE_URL__: JSON.stringify(
        mode === "production" ? tilesHost : ""
      ),
      // MAP_ID determines which subdirectory under public/dzi/ to load
      // Set via: MAP_ID=tiny-nyc in .env file or MAP_ID=tiny-nyc bun run dev
      __MAP_ID__: JSON.stringify(env.MAP_ID || ""),
      // LOCAL_R2 forces use of R2 tiles in dev mode
      // Set via: LOCAL_R2=true in .env file or LOCAL_R2=true bun run dev
      __LOCAL_R2__: JSON.stringify(env.LOCAL_R2 === "true"),
      // USE_R2_NYC fetches from R2 dzi/ directly (no map id subdir)
      // Set via: USE_R2_NYC=true in .env file or USE_R2_NYC=true bun run dev
      __USE_R2_NYC__: JSON.stringify(env.USE_R2_NYC === "true"),
      // Host serving the DZI tile pyramid. Override with TILES_HOST in .env.
      __TILES_HOST__: JSON.stringify(tilesHost),
      // R2_PROXY routes R2 tiles through the dev server proxy below instead of
      // hitting the R2 host directly, so the browser sees same-origin requests.
      // Dev only; ignored in production builds.
      __R2_PROXY__: JSON.stringify(
        mode !== "production" && env.R2_PROXY !== "false"
      ),
      // Browser-requested Web Mercator tiles for the normal 2D map mode.
      __STREET_TILES_URL__: JSON.stringify(streetTilesUrl),
    },
  };
});
