import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertStaticBuild,
  createProductionServer,
  loadProductionConfig,
  type ProductionServerOptions,
} from "./production.ts";

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixtureServer(overrides: Partial<ProductionServerOptions> = {}) {
  const staticDir = await mkdtemp(join(tmpdir(), "happy-path-production-"));
  temporaryDirectories.push(staticDir);
  await mkdir(join(staticDir, "assets"));
  await writeFile(join(staticDir, "index.html"), "<!doctype html><main>Happy Path</main>");
  await writeFile(join(staticDir, "assets", "app-testhash.js"), "console.log('ready');".repeat(100));
  const server = createProductionServer({
    host: "127.0.0.1",
    port: 3000,
    staticDir,
    buildSha: "test-sha",
    apiRateLimitPerMinute: 30,
    trustProxy: false,
    openRouter: { apiKey: "", model: "openai/gpt-5.6-luna" },
    ...overrides,
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a port");
  return { server, staticDir, origin: `http://127.0.0.1:${address.port}` };
}

describe("production configuration", () => {
  it("loads safe VM defaults and keeps the model key server-only", () => {
    const config = loadProductionConfig({ OPENROUTER_API_KEY: " secret ", BUILD_SHA: "abc123" }, "/srv/happy-path");
    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 3000,
      staticDir: "/srv/happy-path/dist",
      buildSha: "abc123",
      apiRateLimitPerMinute: 30,
      trustProxy: false,
      openRouter: { apiKey: "secret", model: "openai/gpt-5.6-luna" },
    });
  });

  it("rejects invalid ports and request limits at startup", () => {
    expect(() => loadProductionConfig({ PORT: "0" })).toThrow(/PORT/);
    expect(() => loadProductionConfig({ API_RATE_LIMIT_PER_MINUTE: "many" })).toThrow(/API_RATE_LIMIT_PER_MINUTE/);
  });
});

describe("production server", () => {
  it("serves health, immutable assets, and the SPA fallback", async () => {
    const { origin } = await fixtureServer();
    const health = await fetch(`${origin}/healthz`);
    expect(await health.json()).toEqual({
      status: "ok",
      service: "happy-path",
      build: "test-sha",
      model: { configured: false, name: "openai/gpt-5.6-luna" },
    });
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");

    const asset = await fetch(`${origin}/assets/app-testhash.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(asset.headers.get("content-encoding")).toBe("gzip");

    const uncompressedAsset = await fetch(`${origin}/assets/app-testhash.js`, { headers: { "Accept-Encoding": "identity" } });
    expect(uncompressedAsset.headers.get("vary")).toBe("Accept-Encoding");

    const spaRoute = await fetch(`${origin}/a/future/client-route`);
    expect(await spaRoute.text()).toContain("Happy Path");
    expect(spaRoute.headers.get("cache-control")).toBe("no-cache");

    const dataSourcesRoute = await fetch(`${origin}/datasources`);
    expect(dataSourcesRoute.status).toBe(200);
    expect(await dataSourcesRoute.text()).toContain("Happy Path");
    expect(dataSourcesRoute.headers.get("cache-control")).toBe("no-cache");
  });

  it("rate-limits only the bounded model API surface", async () => {
    let time = 100;
    const { origin } = await fixtureServer({ apiRateLimitPerMinute: 1, now: () => time });
    const first = await fetch(`${origin}/api/interpret`, { method: "POST" });
    const second = await fetch(`${origin}/api/interpret`, { method: "POST" });
    expect(first.status).toBe(503);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");

    time += 60_000;
    const nextWindow = await fetch(`${origin}/api/interpret`, { method: "POST" });
    expect(nextWindow.status).toBe(503);
  });

  it("fails readiness before startup when the static build is absent", async () => {
    const staticDir = await mkdtemp(join(tmpdir(), "happy-path-missing-build-"));
    temporaryDirectories.push(staticDir);
    await expect(assertStaticBuild(staticDir)).rejects.toThrow(/npm run build/);
  });

  it("contains malformed absolute request targets at the HTTP boundary", async () => {
    const { origin } = await fixtureServer();
    const parsed = new URL(origin);
    const status = await new Promise<number>((resolve, reject) => {
      const request = httpRequest({ hostname: parsed.hostname, port: parsed.port, path: "http://[", method: "GET" }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
      });
      request.on("error", reject);
      request.end();
    });
    expect(status).toBe(400);
    expect((await fetch(`${origin}/healthz`)).status).toBe(200);
  });
});
