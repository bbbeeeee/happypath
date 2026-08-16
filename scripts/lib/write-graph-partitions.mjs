import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { supportedArea } from "./supported-area.mjs";

export async function writeGraphPartitions(graph, directory = new URL("../../src/data/graph/", import.meta.url)) {
  await mkdir(directory, { recursive: true });
  const [south, west, north, east] = graph.metadata.pilotBbox;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const manifestPartitions = [];
  for (const partition of supportedArea.partitions) {
    const partitionEdges = graph.edges.filter((edge) => {
      const geometry = edge.geometry ?? [];
      const latitude = geometry.length
        ? geometry.reduce((sum, coordinate) => sum + coordinate[1], 0) / geometry.length
        : (nodeById.get(edge.from).coordinate[1] + nodeById.get(edge.to).coordinate[1]) / 2;
      return latitude >= partition.south
        && (latitude < partition.north || partition.id === supportedArea.partitions.at(-1).id && latitude <= partition.north);
    });
    const nodeIds = new Set(partitionEdges.flatMap((edge) => [edge.from, edge.to]));
    const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
    const data = {
      nodes,
      edges: partitionEdges,
      metadata: {
        ...graph.metadata,
        partitionId: partition.id,
        partitionLabel: partition.label,
        pilotBbox: [Math.max(south, partition.south), west, Math.min(north, partition.north), east],
        audit: { ...graph.metadata.audit, nodes: nodes.length, edges: partitionEdges.length },
      },
    };
    await writeFile(new URL(`${partition.id}.json`, directory), `${JSON.stringify(data)}\n`);
    manifestPartitions.push({ id: partition.id, label: partition.label, nodes: nodes.length, edges: partitionEdges.length });
  }
  const bootstrapEdges = graph.edges.filter((edge) => {
    const geometry = edge.geometry ?? [];
    const center = geometry.length
      ? geometry.reduce((sum, coordinate) => [sum[0] + coordinate[0], sum[1] + coordinate[1]], [0, 0]).map((value) => value / geometry.length)
      : nodeById.get(edge.from).coordinate;
    const bounds = supportedArea.bootstrapBbox;
    return center[0] >= bounds.west && center[0] <= bounds.east && center[1] >= bounds.south && center[1] <= bounds.north;
  });
  const bootstrapNodeIds = new Set(bootstrapEdges.flatMap((edge) => [edge.from, edge.to]));
  const bootstrapNodes = graph.nodes.filter((node) => bootstrapNodeIds.has(node.id));
  await writeFile(new URL("bootstrap.json", directory), `${JSON.stringify({
    nodes: bootstrapNodes,
    edges: bootstrapEdges,
    metadata: {
      ...graph.metadata,
      partitionId: "bootstrap",
      partitionLabel: "Initial Washington Square map",
      pilotBbox: [supportedArea.bootstrapBbox.south, supportedArea.bootstrapBbox.west, supportedArea.bootstrapBbox.north, supportedArea.bootstrapBbox.east],
      audit: { ...graph.metadata.audit, nodes: bootstrapNodes.length, edges: bootstrapEdges.length },
    },
  })}\n`);
  const manifest = {
    schemaVersion: 1,
    generatedAt: graph.metadata.generatedAt,
    supportedAreaId: supportedArea.id,
    envelope: { south, west, north, east },
    partitions: manifestPartitions,
    bootstrap: { nodes: bootstrapNodes.length, edges: bootstrapEdges.length },
  };
  await writeFile(new URL("manifest.json", directory), `${JSON.stringify(manifest)}\n`);
  return manifest;
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  const graph = JSON.parse(await readFile(new URL("../../src/data/pilot-osm.json", import.meta.url), "utf8"));
  const manifest = await writeGraphPartitions(graph);
  console.log(`Wrote ${manifest.partitions.length} graph partitions with ${manifest.partitions.reduce((sum, partition) => sum + partition.edges, 0)} edges`);
}
