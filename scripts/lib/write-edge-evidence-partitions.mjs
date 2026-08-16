import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { supportedArea } from "./supported-area.mjs";

const DATA_DIRECTORY = new URL("../../src/data/", import.meta.url);

export async function writeGreeneryPartitions() {
  const full = JSON.parse(await readFile(new URL("pilot-greenery.json", DATA_DIRECTORY), "utf8"));
  const outputDirectory = new URL("greenery/", DATA_DIRECTORY);
  await mkdir(outputDirectory, { recursive: true });
  for (const partition of supportedArea.partitions) {
    const graph = JSON.parse(await readFile(new URL(`graph/${partition.id}.json`, DATA_DIRECTORY), "utf8"));
    const edgeGreenery = Object.fromEntries(graph.edges.map((edge) => [edge.id, full.edgeGreenery[edge.id]]));
    await writeFile(new URL(`${partition.id}.json`, outputDirectory), `${JSON.stringify({
      metadata: { ...full.metadata, partitionId: partition.id, edgeCount: graph.edges.length },
      edgeGreenery,
    })}\n`);
  }
  const bootstrapGraph = JSON.parse(await readFile(new URL("graph/bootstrap.json", DATA_DIRECTORY), "utf8"));
  await writeFile(new URL("bootstrap.json", outputDirectory), `${JSON.stringify({
    metadata: { ...full.metadata, partitionId: "bootstrap", edgeCount: bootstrapGraph.edges.length },
    edgeGreenery: Object.fromEntries(bootstrapGraph.edges.map((edge) => [edge.id, full.edgeGreenery[edge.id]])),
  })}\n`);
}

export async function writeShadePartitions() {
  const full = JSON.parse(await readFile(new URL("pilot-shade.json", DATA_DIRECTORY), "utf8"));
  const outputDirectory = new URL("shade/", DATA_DIRECTORY);
  await mkdir(outputDirectory, { recursive: true });
  for (const partition of supportedArea.partitions) {
    const graph = JSON.parse(await readFile(new URL(`graph/${partition.id}.json`, DATA_DIRECTORY), "utf8"));
    const edgeShadeByHour = Object.fromEntries(graph.edges.map((edge) => [edge.id, full.edgeShadeByHour[edge.id]]));
    await writeFile(new URL(`${partition.id}.json`, outputDirectory), `${JSON.stringify({
      metadata: { ...full.metadata, partitionId: partition.id, edgeCount: graph.edges.length },
      edgeShadeByHour,
    })}\n`);
  }
  const bootstrapGraph = JSON.parse(await readFile(new URL("graph/bootstrap.json", DATA_DIRECTORY), "utf8"));
  await writeFile(new URL("bootstrap.json", outputDirectory), `${JSON.stringify({
    metadata: { ...full.metadata, partitionId: "bootstrap", edgeCount: bootstrapGraph.edges.length },
    edgeShadeByHour: Object.fromEntries(bootstrapGraph.edges.map((edge) => [edge.id, full.edgeShadeByHour[edge.id]])),
  })}\n`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  const mode = process.argv[2] ?? "all";
  if (["all", "greenery"].includes(mode)) await writeGreeneryPartitions();
  if (["all", "shade"].includes(mode)) await writeShadePartitions();
  console.log(`Wrote ${mode} edge-evidence partitions`);
}
