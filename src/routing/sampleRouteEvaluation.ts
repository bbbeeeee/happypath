import { demoCoverShare, routeCoverShare } from "../demoCover";
import { defaultDestination, defaultOrigin, pilotGraph } from "../data/cityGraph";
import { getPilotTransitEndpointCandidates } from "../data/transitEndpoints";
import type { JourneyRoute, TripBrief } from "../types";
import {
  planJourney,
  type JourneyPlanningOptions,
  type JourneyTimingMetadata,
} from "./journey";

export type SampleRouteScenarioId =
  | "destination"
  | "thirty_minute_wander"
  | "custom_time_loop"
  | "rain_cover"
  | "avoid_mapped_steps";

export interface SampleRouteMetrics {
  candidateId: string;
  durationMinutes: number;
  distanceMeters: number;
  directSunMinutes: number;
  shadePercent: number;
  greeneryPercent: number;
  mappedStepEdges: number;
  repeatedEdgeRatio: number;
  coverPercent: number;
  evaluatedCandidateCount: number;
  timing: JourneyTimingMetadata;
}

export interface SampleRouteEvaluation {
  id: SampleRouteScenarioId;
  label: string;
  requestSummary: string;
  evidenceBoundary: string;
  metrics: SampleRouteMetrics;
  comparison?: {
    baselineCandidateId: string;
    baselineDurationMinutes: number;
    baselineDirectSunMinutes: number;
    baselineCoverPercent: number;
    durationDifferenceMinutes: number;
    directSunMinutesSaved: number;
    coverGainPoints: number;
  };
}

function rounded(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function metrics(
  route: JourneyRoute,
  timing: JourneyTimingMetadata,
  evaluatedCandidateCount: number,
): SampleRouteMetrics {
  return {
    candidateId: route.candidateId,
    durationMinutes: rounded(route.durationMinutes),
    distanceMeters: rounded(route.distanceMeters, 0),
    directSunMinutes: rounded(route.directSunMinutes),
    shadePercent: rounded(route.shadePercent, 1),
    greeneryPercent: rounded(route.greeneryPercent, 1),
    mappedStepEdges: route.mappedStepEdges,
    repeatedEdgeRatio: rounded(route.repeatedEdgeRatio, 3),
    coverPercent: rounded(routeCoverShare(route, pilotGraph) * 100, 1),
    evaluatedCandidateCount,
    timing: {
      ...timing,
      actualMinutes: rounded(route.durationMinutes),
      targetRangeMinutes: timing.targetRangeMinutes
        ? {
            minimum: rounded(timing.targetRangeMinutes.minimum),
            maximum: rounded(timing.targetRangeMinutes.maximum),
          }
        : null,
      differenceMinutes: timing.differenceMinutes === null
        ? null
        : rounded(route.durationMinutes - (timing.requestedMinutes ?? route.durationMinutes)),
    },
  };
}

function evaluateStandard(
  id: SampleRouteScenarioId,
  label: string,
  requestSummary: string,
  evidenceBoundary: string,
  brief: TripBrief,
  options: JourneyPlanningOptions = {},
): SampleRouteEvaluation {
  const result = planJourney(pilotGraph, brief, options);
  const baseline = result.baseline;
  return {
    id,
    label,
    requestSummary,
    evidenceBoundary,
    metrics: metrics(result.recommended, result.timing, result.evaluatedCandidateCount),
    comparison: baseline
      ? {
          baselineCandidateId: baseline.candidateId,
          baselineDurationMinutes: rounded(baseline.durationMinutes),
          baselineDirectSunMinutes: rounded(baseline.directSunMinutes),
          baselineCoverPercent: rounded(routeCoverShare(baseline, pilotGraph) * 100, 1),
          durationDifferenceMinutes: rounded(result.recommended.durationMinutes - baseline.durationMinutes),
          directSunMinutesSaved: rounded(baseline.directSunMinutes - result.recommended.directSunMinutes),
          coverGainPoints: rounded((routeCoverShare(result.recommended, pilotGraph) - routeCoverShare(baseline, pilotGraph)) * 100, 1),
        }
      : undefined,
  };
}

function evaluateRainCover(): SampleRouteEvaluation {
  const brief: TripBrief = {
    journeyShape: "wander",
    originNodeId: defaultOrigin,
    departureHour: 15,
    walkingBudgetMinutes: 25,
    preferences: [{ featureId: "shade", weight: 0.6 }],
  };
  const ordinaryResult = planJourney(pilotGraph, brief, { walkingTimeIntent: "target" });
  const result = planJourney(pilotGraph, brief, {
    walkingTimeIntent: "target",
    edgePreference: {
      id: "likely_cover_demo",
      weight: 1,
      score: demoCoverShare,
    },
  });
  const ordinary = ordinaryResult.recommended;
  const selected = result.recommended;
  const selectedCover = routeCoverShare(selected, pilotGraph);
  const ordinaryCover = routeCoverShare(ordinary, pilotGraph);
  const targetRange = result.timing.targetRangeMinutes;
  const timing: JourneyTimingMetadata = {
    ...result.timing,
    actualMinutes: selected.durationMinutes,
    differenceMinutes: selected.durationMinutes - brief.walkingBudgetMinutes,
    status: targetRange
      && selected.durationMinutes >= targetRange.minimum - 0.0001
      && selected.durationMinutes <= targetRange.maximum + 0.0001
      ? "within-target"
      : "closest-feasible",
  };
  return {
    id: "rain_cover",
    label: "Rain-friendly proof route",
    requestSummary: "A 25-minute walk favoring more likely cover",
    evidenceBoundary: "Cover is a deterministic demo signal, not observed infrastructure or a promise of dryness.",
    metrics: metrics(selected, timing, result.evaluatedCandidateCount),
    comparison: {
      baselineCandidateId: ordinary.candidateId,
      baselineDurationMinutes: rounded(ordinary.durationMinutes),
      baselineDirectSunMinutes: rounded(ordinary.directSunMinutes),
      baselineCoverPercent: rounded(ordinaryCover * 100, 1),
      durationDifferenceMinutes: rounded(selected.durationMinutes - ordinary.durationMinutes),
      directSunMinutesSaved: rounded(ordinary.directSunMinutes - selected.directSunMinutes),
      coverGainPoints: rounded((selectedCover - ordinaryCover) * 100, 1),
    },
  };
}

/**
 * Runs a small, deterministic product-level audit against the checked-in pilot
 * graph. It is deliberately independent from React and network services so it
 * can act as a stable regression fixture while the interface evolves.
 */
export function evaluateSampleRoutes(): SampleRouteEvaluation[] {
  const transitNodeIds = [...new Set(
    getPilotTransitEndpointCandidates({ maxSnapDistanceMeters: 50 })
      .map((candidate) => candidate.graphNodeId),
  )];

  return [
    evaluateStandard(
      "destination",
      "Destination with a comfort detour",
      "Walk to the sample destination with less direct sun and up to five extra minutes",
      "Shade is estimated for the selected hour; route geometry and time come from the walking graph.",
      {
        journeyShape: "destination",
        originNodeId: defaultOrigin,
        destinationNodeId: defaultDestination,
        departureHour: 15,
        detourAllowanceMinutes: 5,
        preferences: [{ featureId: "shade", weight: 1 }],
      },
    ),
    evaluateStandard(
      "thirty_minute_wander",
      "Thirty-minute wander ending near transit",
      "Wander for about 30 minutes and finish near a mapped subway entrance",
      "Transit endpoints are inventory records; access, service, and elevator operation are not verified.",
      {
        journeyShape: "wander",
        originNodeId: defaultOrigin,
        departureHour: 15,
        walkingBudgetMinutes: 30,
        endCondition: { nodeIds: transitNodeIds, label: "near a mapped subway entrance" },
        preferences: [{ featureId: "shade", weight: 0.8 }],
      },
      { walkingTimeIntent: "target" },
    ),
    evaluateStandard(
      "custom_time_loop",
      "Custom-time loop",
      "A greener 23-minute loop",
      "Twenty-three minutes is preserved as entered; the target permits a ten-percent tolerance.",
      {
        journeyShape: "loop",
        originNodeId: defaultOrigin,
        departureHour: 15,
        walkingBudgetMinutes: 23,
        preferences: [{ featureId: "green", weight: 1 }],
      },
      { walkingTimeIntent: "target" },
    ),
    evaluateRainCover(),
    evaluateStandard(
      "avoid_mapped_steps",
      "Avoid mapped steps",
      "A destination walk that excludes edges tagged as steps",
      "This excludes mapped steps only; it is not a guarantee of a step-free or accessible journey.",
      {
        journeyShape: "destination",
        originNodeId: defaultOrigin,
        destinationNodeId: defaultDestination,
        departureHour: 15,
        detourAllowanceMinutes: 5,
        preferences: [{ featureId: "shade", weight: 0.6 }],
        requirements: { avoidMappedSteps: true },
      },
    ),
  ];
}
