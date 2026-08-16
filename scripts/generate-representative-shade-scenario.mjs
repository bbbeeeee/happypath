import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputPath = fileURLToPath(new URL("../src/data/detour/seward-park-shade-result.json", import.meta.url));
const server = await createServer({
  root,
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
});

try {
  const [{ ensureGraphCoverage, pilotGraph }, scenario] = await Promise.all([
    server.ssrLoadModule("/src/data/cityGraph.ts"),
    server.ssrLoadModule("/src/detour/representativeShadeScenario.ts"),
  ]);
  const coordinates = scenario.representativeShadeFixture.journeys.flatMap((journey) => [
    journey.origin.coordinate,
    scenario.representativeShadeFixture.destination.coordinate,
  ]);
  await ensureGraphCoverage(coordinates, 1);
  const result = scenario.generateRepresentativeShadeScenario(pilotGraph);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote ${outputPath}\n`);
} finally {
  await server.close();
}
