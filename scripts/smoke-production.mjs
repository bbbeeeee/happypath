import { once } from "node:events";
import { createProductionServer, loadProductionConfig, assertStaticBuild } from "../dist-server/server/production.js";

const config = loadProductionConfig({
  ...process.env,
  HOST: "127.0.0.1",
  PORT: "3000",
  BUILD_SHA: process.env.BUILD_SHA || "smoke-test",
});

await assertStaticBuild(config.staticDir);
const server = createProductionServer(config);
server.listen(0, "127.0.0.1");
await once(server, "listening");

try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Production smoke server did not bind");
  const origin = `http://127.0.0.1:${address.port}`;
  const [health, page] = await Promise.all([fetch(`${origin}/healthz`), fetch(`${origin}/`)]);
  if (!health.ok || !page.ok || !(await page.text()).includes('<div id="root">')) {
    throw new Error(`Production smoke failed: health=${health.status}, page=${page.status}`);
  }
  const healthBody = await health.json();
  console.log(`Production smoke passed: ${healthBody.service} ${healthBody.status}, build ${healthBody.build}`);
} finally {
  server.close();
  await once(server, "close");
}
