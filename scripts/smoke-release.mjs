import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function run(command, argumentsList) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, argumentsList, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolvePromise()
      : reject(new Error(`${command} exited with status ${code ?? "unknown"}`)));
  });
}

const archive = process.argv[2];
if (!archive) throw new Error("Pass the release archive path to smoke-release.mjs");
const extracted = await mkdtemp(join(tmpdir(), "happy-path-release-"));

try {
  await run("tar", ["-xzf", resolve(archive), "-C", extracted, "--strip-components=1"]);
  const productionModule = await import(pathToFileURL(join(extracted, "dist-server/server/production.js")).href);
  const config = productionModule.loadProductionConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    BUILD_SHA: "archive-smoke",
  }, extracted);
  await productionModule.assertStaticBuild(config.staticDir);
  const server = productionModule.createProductionServer(config);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Release smoke server did not bind");
    const origin = `http://127.0.0.1:${address.port}`;
    const request = (path, options = {}) => fetch(`${origin}${path}`, { ...options, signal: AbortSignal.timeout(5_000) });
    const health = await request("/healthz");
    const htmlResponse = await request("/");
    const html = await htmlResponse.text();
    const localReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((reference) => reference.startsWith("/"));
    const referencedResponses = await Promise.all(localReferences.map((reference) => request(reference, { method: "HEAD" })));
    const lazyShadeFile = (await readdir(join(extracted, "dist/assets"))).find((file) => file.startsWith("hour-") && file.endsWith(".js"));
    const lazyShade = lazyShadeFile ? await request(`/assets/${lazyShadeFile}`, { method: "HEAD" }) : null;
    const interpret = await request("/api/interpret", { method: "POST" });
    const insights = await request("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sources: [{ sourceId: "osm", label: "OpenStreetMap", kind: "community" }],
        route: {
          routeId: "smoke-route",
          journeyLabel: "Release smoke route",
          evidence: [{ factId: "route-fact", statement: "The route uses mapped walking paths.", sourceIds: ["osm"] }],
          caveat: "Street details may be incomplete.",
        },
        candidates: [
          {
            candidateId: "shade-test",
            interventionType: "shade",
            locationLabel: "Test block one",
            proposedAction: "Test more shade here",
            evidence: [{ factId: "shade-fact", statement: "This test block has direct-sun exposure.", sourceIds: ["osm"] }],
            referenceSourceIds: [],
            caveat: "A planning test, not a proposal.",
          },
          {
            candidateId: "seat-test",
            interventionType: "seating",
            locationLabel: "Test block two",
            proposedAction: "Test a place to pause here",
            evidence: [{ factId: "seat-fact", statement: "This test block has no route-linked seat.", sourceIds: ["osm"] }],
            referenceSourceIds: [],
            caveat: "Inventory coverage may be incomplete.",
          },
        ],
      }),
    });
    const insightBody = await insights.json();
    if (!health.ok
      || !htmlResponse.ok
      || !html.includes('<div id="root">')
      || referencedResponses.some((response) => !response.ok)
      || !lazyShade?.ok
      || interpret.status !== 503
      || !insights.ok
      || insightBody.insight?.generatedBy !== "fallback") {
      throw new Error("The extracted release failed its static, lazy-asset, or API fallback smoke check");
    }
    console.log(`Release smoke passed: ${localReferences.length} entry assets, ${lazyShadeFile}, both API fallbacks`);
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
} finally {
  await rm(extracted, { recursive: true, force: true });
}
