export type Coordinate = [number, number];

export interface GraphNode {
  id: string;
  name: string;
  coordinate: Coordinate;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  street: string;
  distanceMeters: number;
  orientationDegrees: number;
  canyonFactor: number;
  treeFactor: number;
  source: "modeled-demo";
  osm?: {
    wayId: number;
    highway: string;
    access: string | null;
    foot: string | null;
    steps: boolean;
  };
}

export interface PilotGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    generatedAt: string;
    pilotBbox: [number, number, number, number];
    sourceIds: string[];
    graphEvidence: "official" | "community" | "derived";
    shadeEvidence: "modeled-demo" | "derived";
    audit: {
      inputWays: number;
      routableWays: number;
      nodes: number;
      edges: number;
      mappedStairEdges: number;
      accessTaggedEdges: number;
      largestComponentShare: number;
    };
  };
}

export interface RouteResult {
  nodeIds: string[];
  coordinates: Coordinate[];
  distanceMeters: number;
  durationMinutes: number;
  directSunMinutes: number;
  longestExposedMinutes: number;
  mappedStepEdges: number;
  greeneryPercent: number;
  nearbyTreeCount: number;
  adjacentParkNames: string[];
  shadePercent: number;
  streets: string[];
}

export interface RouteComparison {
  fastest: RouteResult;
  recommended: RouteResult;
  extraMinutes: number;
  sunMinutesSaved: number;
  greeneryGainPoints: number;
}

export type RouteMode = "shade" | "green";
