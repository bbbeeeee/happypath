import type { JourneyResult, RouteValueFrontier, RouteValueMetric } from "../types";

const EPSILON = 1e-9;

export const ROUTE_VALUE_CAPTURE_RATIO = 0.8;

export interface RouteValuePolicy {
  metric: RouteValueMetric;
  meaningfulBenefitFloor: number;
  targetCaptureRatio: number;
}

export const ROUTE_VALUE_POLICIES: Readonly<Record<RouteValueMetric, RouteValuePolicy>> = {
  direct_sun_minutes: {
    metric: "direct_sun_minutes",
    meaningfulBenefitFloor: 0.5,
    targetCaptureRatio: ROUTE_VALUE_CAPTURE_RATIO,
  },
  greenery_points: {
    metric: "greenery_points",
    meaningfulBenefitFloor: 2,
    targetCaptureRatio: ROUTE_VALUE_CAPTURE_RATIO,
  },
  preference_fit: {
    metric: "preference_fit",
    meaningfulBenefitFloor: 0.02,
    targetCaptureRatio: ROUTE_VALUE_CAPTURE_RATIO,
  },
};

export interface RouteValueCandidate {
  candidateId: string;
  extraMinutes: number;
  /** Non-negative improvement over the fastest valid baseline. */
  benefit: number;
}

function assertCandidate(candidate: RouteValueCandidate) {
  if (!candidate.candidateId) throw new Error("Route value candidates require a stable candidateId");
  if (!Number.isFinite(candidate.extraMinutes) || candidate.extraMinutes < 0) {
    throw new Error(`Route value candidate ${candidate.candidateId} has invalid extra minutes`);
  }
  if (!Number.isFinite(candidate.benefit)) {
    throw new Error(`Route value candidate ${candidate.candidateId} has invalid benefit`);
  }
}

/**
 * Builds the non-dominated best-extra-minute frontier and chooses the earliest
 * candidate that captures most of the measured benefit. The fastest valid
 * route remains the recommendation when every gain is below the policy floor.
 */
export function computeRouteValueFrontier(
  baselineCandidateId: string,
  candidates: readonly RouteValueCandidate[],
  policy: RouteValuePolicy,
): RouteValueFrontier {
  if (!baselineCandidateId) throw new Error("A route value frontier requires a baseline candidate");
  if (!(policy.meaningfulBenefitFloor >= 0) || !Number.isFinite(policy.meaningfulBenefitFloor)) {
    throw new Error("Route value meaningfulBenefitFloor must be finite and non-negative");
  }
  if (!(policy.targetCaptureRatio > 0 && policy.targetCaptureRatio <= 1)) {
    throw new Error("Route value targetCaptureRatio must be greater than zero and at most one");
  }

  const seenIds = new Set<string>();
  const normalized = candidates.map((candidate) => {
    assertCandidate(candidate);
    if (seenIds.has(candidate.candidateId)) throw new Error(`Duplicate route value candidate ${candidate.candidateId}`);
    seenIds.add(candidate.candidateId);
    return candidate.candidateId === baselineCandidateId
      ? { candidateId: baselineCandidateId, extraMinutes: 0, benefit: 0 }
      : { ...candidate, benefit: Math.max(0, candidate.benefit) };
  });
  if (!seenIds.has(baselineCandidateId)) {
    normalized.push({ candidateId: baselineCandidateId, extraMinutes: 0, benefit: 0 });
  }

  const ordered = normalized.sort((a, b) => (
    a.extraMinutes - b.extraMinutes
    || b.benefit - a.benefit
    || a.candidateId.localeCompare(b.candidateId)
  ));
  const maximumBenefit = ordered.reduce((maximum, candidate) => Math.max(maximum, candidate.benefit), 0);
  const frontierCandidates: RouteValueCandidate[] = [{
    candidateId: baselineCandidateId,
    extraMinutes: 0,
    benefit: 0,
  }];
  let bestBenefit = 0;
  for (const candidate of ordered) {
    if (candidate.candidateId === baselineCandidateId || candidate.benefit <= bestBenefit + EPSILON) continue;
    frontierCandidates.push(candidate);
    bestBenefit = candidate.benefit;
  }

  const meaningful = maximumBenefit + EPSILON >= policy.meaningfulBenefitFloor;
  const targetBenefit = maximumBenefit * policy.targetCaptureRatio;
  const recommended = meaningful
    ? frontierCandidates
      .filter((candidate) => candidate.candidateId !== baselineCandidateId && candidate.benefit + EPSILON >= targetBenefit)
      .sort((a, b) => (
        a.extraMinutes - b.extraMinutes
        || b.benefit - a.benefit
        || a.candidateId.localeCompare(b.candidateId)
      ))[0]
    : undefined;

  return {
    metric: policy.metric,
    baselineCandidateId,
    recommendedCandidateId: recommended?.candidateId ?? baselineCandidateId,
    status: recommended ? "meaningful_alternative" : "no_meaningful_alternative",
    meaningfulBenefitFloor: policy.meaningfulBenefitFloor,
    targetCaptureRatio: policy.targetCaptureRatio,
    maximumBenefit,
    points: frontierCandidates.map((candidate) => ({
      ...candidate,
      capturedBenefitRatio: maximumBenefit <= EPSILON ? 0 : candidate.benefit / maximumBenefit,
    })),
  };
}

/**
 * A later route-level selector may replace the engine recommendation. Consumers
 * must not display a now-stale frontier claim in that state.
 */
export function currentRouteValueFrontier(
  result: Pick<JourneyResult, "recommended" | "routeValueFrontier">,
) {
  return result.routeValueFrontier?.recommendedCandidateId === result.recommended.candidateId
    ? result.routeValueFrontier
    : null;
}
