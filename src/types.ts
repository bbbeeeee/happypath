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
  /** Ordered street geometry from `from` to `to`, including OSM shape nodes. */
  geometry?: Coordinate[];
  street: string;
  distanceMeters: number;
  orientationDegrees: number;
  canyonFactor: number;
  treeFactor: number;
  source: "openstreetmap" | "modeled-demo";
  osm?: {
    wayId: number;
    highway: string;
    access: string | null;
    foot: string | null;
    steps: boolean;
    covered?: string | null;
    tunnel?: string | null;
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
      mappedCoveredEdges?: number;
      accessTaggedEdges: number;
      largestComponentShare: number;
      edgesWithGeometry?: number;
      geometryPointCount?: number;
      curvedEdges?: number;
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

export type JourneyShape = "destination" | "loop" | "wander";

export type WanderDirection =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest";

export interface JourneyPreference {
  featureId: RouteMode;
  /** Relative preference strength. Values must be between zero and one. */
  weight: number;
}

export interface JourneyRequirements {
  avoidMappedSteps?: boolean;
}

interface TripBriefBase {
  originNodeId: string;
  /** Decimal local hour. For example, 15.5 represents 3:30 PM. */
  departureHour: number;
  preferences?: JourneyPreference[];
  requirements?: JourneyRequirements;
}

export interface DestinationTripBrief extends TripBriefBase {
  journeyShape: "destination";
  destinationNodeId: string;
  /** Maximum additional walking time relative to the fastest valid route. */
  detourAllowanceMinutes: number;
}

export interface LoopTripBrief extends TripBriefBase {
  journeyShape: "loop";
  /** Hard upper bound for the complete loop. */
  walkingBudgetMinutes: number;
}

export interface WanderEndCondition {
  /**
   * Graph nodes that satisfy an externally resolved end condition, such as
   * "near transit" or "at a public space". The journey engine does not invent
   * endpoints or inspect amenity datasets directly.
   */
  nodeIds: string[];
  label?: string;
}

export interface WanderTripBrief extends TripBriefBase {
  journeyShape: "wander";
  /** Hard upper bound for the one-way wander. */
  walkingBudgetMinutes: number;
  direction?: WanderDirection;
  endCondition?: WanderEndCondition;
}

export type TripBrief = DestinationTripBrief | LoopTripBrief | WanderTripBrief;

export interface JourneyRoute extends RouteResult {
  candidateId: string;
  journeyShape: JourneyShape;
  edgeIds: string[];
  endpointNodeId: string;
  /** Fraction of traversed edges that repeat an edge already used. */
  repeatedEdgeRatio: number;
  /** Weighted zero-to-one fit for the explicit supported preferences. */
  preferenceScore: number;
  extraMinutesVsBaseline: number | null;
}

export type RouteValueMetric = "direct_sun_minutes" | "greenery_points" | "preference_fit";

export interface RouteValueFrontierPoint {
  candidateId: string;
  extraMinutes: number;
  /** Improvement over the fastest valid baseline, in the frontier metric's unit. */
  benefit: number;
  /** Share of the best measured candidate benefit, from zero to one. */
  capturedBenefitRatio: number;
}

export interface RouteValueFrontier {
  metric: RouteValueMetric;
  baselineCandidateId: string;
  recommendedCandidateId: string;
  status: "meaningful_alternative" | "no_meaningful_alternative";
  meaningfulBenefitFloor: number;
  targetCaptureRatio: number;
  maximumBenefit: number;
  points: RouteValueFrontierPoint[];
}

export interface JourneyResult {
  brief: TripBrief;
  baseline: JourneyRoute | null;
  recommended: JourneyRoute;
  /** At most two materially distinct valid alternatives. */
  alternatives: JourneyRoute[];
  evaluatedCandidateCount: number;
  /** Destination-only frontier. Null when there is no baseline or requested route benefit. */
  routeValueFrontier: RouteValueFrontier | null;
}
