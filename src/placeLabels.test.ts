import { describe, expect, it } from "vitest";
import { defaultOrigin, ensureGraphCoverage, graphNodeById, pilotGraph } from "./data/cityGraph";
import { EXAMPLE_JOURNEYS } from "./exampleJourneys";
import { cleanPlaceName, humanReadableEndpointName, isHumanReadablePlaceName } from "./placeLabels";
import type { GraphNode } from "./types";

const technicalNode: GraphNode = {
  id: "3884587825",
  name: "OSM node 3884587825",
  coordinate: [-73.996, 40.73],
};

describe("human-readable endpoint names", () => {
  it("never exposes internal graph identifiers", () => {
    const label = humanReadableEndpointName(technicalNode, [technicalNode]);
    expect(label).toBe("Pinned on the map");
    expect(label).not.toMatch(/OSM|3884587825/i);
    expect(isHumanReadablePlaceName(technicalNode.name)).toBe(false);
  });

  it("uses a nearby intersection for an unnamed routing point", () => {
    const intersection: GraphNode = {
      id: "intersection",
      name: "Waverly Place & Washington Square East",
      coordinate: [-73.9957, 40.7302],
    };
    expect(humanReadableEndpointName(technicalNode, [technicalNode, intersection]))
      .toBe("Near Waverly Place & Washington Square East");
  });

  it("can prefer a nearby landmark while preserving already-readable names", () => {
    expect(humanReadableEndpointName(technicalNode, [technicalNode], [{
      name: "Washington Square Park",
      coordinate: [-73.9961, 40.7301],
    }])).toBe("Near Washington Square Park");

    const namedNode = { ...technicalNode, name: "Astor Place" };
    expect(humanReadableEndpointName(namedNode, [namedNode], [{
      name: "Washington Square Park",
      coordinate: namedNode.coordinate,
    }])).toBe("Astor Place");
  });

  it("keeps the existing Fifth Avenue cleanup for east-west street joins", () => {
    expect(cleanPlaceName("West 9th Street & East 9th Street")).toBe("9th Street & 5th Avenue");
  });

  it("keeps the real default and curated example endpoints resident-readable", async () => {
    await ensureGraphCoverage(EXAMPLE_JOURNEYS.flatMap((example) => [
      example.originCoordinate,
      ...(example.destinationCoordinate ? [example.destinationCoordinate] : []),
    ]));
    const endpointIds = [
      defaultOrigin,
      ...EXAMPLE_JOURNEYS.flatMap((example) => [
        example.originNodeId,
        ...(example.destinationNodeId ? [example.destinationNodeId] : []),
      ]),
    ];
    for (const endpointId of endpointIds) {
      const label = humanReadableEndpointName(graphNodeById(endpointId), pilotGraph.nodes);
      expect(label).not.toMatch(/OSM\s+(?:node|way)|unnamed|unknown|unmapped/i);
      expect(label).not.toMatch(/^\d{6,}$/);
    }
  }, 15_000);
});
