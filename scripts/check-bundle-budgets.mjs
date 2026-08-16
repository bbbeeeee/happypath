import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const distDirectory = new URL("../dist/", import.meta.url);
const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const initialJavaScriptBudget = 850 * 1024;
const shadeTileBudget = 310 * 1024;
const floodContextBudget = 100 * 1024;
const plannerScenarioBudget = 20 * 1024;

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB gzip`;
}

const html = await readFile(new URL("index.html", distDirectory), "utf8");
const initialScriptMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);
if (!initialScriptMatch) throw new Error("Could not find the initial JavaScript asset in dist/index.html");

const initialScriptName = initialScriptMatch[1];
const initialScript = await readFile(new URL(`assets/${initialScriptName}`, distDirectory));
const initialScriptGzipBytes = gzipSync(initialScript).byteLength;

const shadeTileNames = (await readdir(assetsDirectory))
  .filter((name) => name.startsWith("hour-") && name.endsWith(".json"));
if (shadeTileNames.length === 0) throw new Error("The production build contains no lazy shade JSON tiles");

const floodContextName = (await readdir(assetsDirectory))
  .find((name) => name.startsWith("pilot-flood-evidence-") && name.endsWith(".js"));
if (!floodContextName) throw new Error("The production build contains no lazy flood-context chunk");
const floodContext = await readFile(join(fileURLToPath(assetsDirectory), floodContextName));
const floodContextGzipBytes = gzipSync(floodContext).byteLength;

const plannerScenarioName = (await readdir(assetsDirectory))
  .find((name) => name.startsWith("frozenRepresentativeShadeScenario-") && name.endsWith(".js"));
if (!plannerScenarioName) throw new Error("The production build contains no lazy representative-planner chunk");
const plannerScenario = await readFile(join(fileURLToPath(assetsDirectory), plannerScenarioName));
const plannerScenarioGzipBytes = gzipSync(plannerScenario).byteLength;

let largestShadeTile = { name: "", gzipBytes: 0 };
for (const name of shadeTileNames) {
  const contents = await readFile(join(fileURLToPath(assetsDirectory), name));
  const gzipBytes = gzipSync(contents).byteLength;
  if (gzipBytes > largestShadeTile.gzipBytes) largestShadeTile = { name, gzipBytes };
}

const failures = [];
if (initialScriptGzipBytes > initialJavaScriptBudget) {
  failures.push(`initial JavaScript ${formatKilobytes(initialScriptGzipBytes)} exceeds ${formatKilobytes(initialJavaScriptBudget)}`);
}
if (largestShadeTile.gzipBytes > shadeTileBudget) {
  failures.push(`${largestShadeTile.name} ${formatKilobytes(largestShadeTile.gzipBytes)} exceeds ${formatKilobytes(shadeTileBudget)}`);
}
if (floodContextGzipBytes > floodContextBudget) {
  failures.push(`${floodContextName} ${formatKilobytes(floodContextGzipBytes)} exceeds ${formatKilobytes(floodContextBudget)}`);
}
if (plannerScenarioGzipBytes > plannerScenarioBudget) {
  failures.push(`${plannerScenarioName} ${formatKilobytes(plannerScenarioGzipBytes)} exceeds ${formatKilobytes(plannerScenarioBudget)}`);
}

if (failures.length > 0) throw new Error(`Bundle budget failed: ${failures.join("; ")}`);

console.log(`Bundle budgets passed: initial JavaScript ${formatKilobytes(initialScriptGzipBytes)}; largest shade tile ${largestShadeTile.name} ${formatKilobytes(largestShadeTile.gzipBytes)}; flood context ${formatKilobytes(floodContextGzipBytes)}; planner scenario ${formatKilobytes(plannerScenarioGzipBytes)}`);
