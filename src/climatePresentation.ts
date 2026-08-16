import { orientedEdgeCoordinates } from "./routing/geometry";
import { edgeShade, shadeMetadata } from "./routing/shade";
import type { JourneyRoute, PilotGraph } from "./types";
import {
  demoLikelyCoverEvidence,
  formatHour,
  shadeEvidence,
  type PresentationEvidence,
} from "./presentationEvidence";

const WALKING_METERS_PER_MINUTE = 80;

export type ShadeBand = "mostly_shaded" | "mixed" | "mostly_sunny";
export type ShadeTone = "shade_deep" | "shade_mixed" | "sun_warm";

export interface DemoRainContext {
  condition: "rain";
  source: "user_prompt";
  confidence: "explicit" | "intent";
  routePreference: {
    id: "likely_cover";
    label: "Favor likely cover";
  };
  receiptLabel: string;
  evidence: PresentationEvidence;
}

export type RainPromptIntent = "on" | "off" | "unspecified";

const explicitRainPattern = /\b(?:rain(?:s|ed|ing|y)?|drizzl(?:e|es|ed|ing)|downpour|showers?|storming|wet weather)\b/i;
const dryIntentPattern = /\b(?:(?:keep|help) me dry|stay dry|under (?:an? )?(?:awning|cover)|br(?:ing(?:ing)?|ought) (?:an? )?umbrella)\b/i;
const rainNegationPattern = /\b(?:not raining|no rain|rain (?:has )?stopped|stopped raining|isn['’]?t raining|won['’]?t (?:be )?rain(?:ing)?|dry now)\b/i;

export function rainPromptIntent(prompt: string): RainPromptIntent {
  const normalized = prompt.trim();
  if (rainNegationPattern.test(normalized)) return "off";
  if (explicitRainPattern.test(normalized) || dryIntentPattern.test(normalized)) return "on";
  return "unspecified";
}

/**
 * Recognizes rain supplied by the person. It deliberately makes no network
 * request and never presents the prompt as a live weather observation.
 */
export function rainContextFromPrompt(prompt: string): DemoRainContext | null {
  const normalized = prompt.trim();
  if (rainPromptIntent(normalized) !== "on") return null;
  const confidence = explicitRainPattern.test(normalized)
    ? "explicit"
    : dryIntentPattern.test(normalized)
      ? "intent"
      : null;
  if (!confidence) return null;

  return {
    condition: "rain",
    source: "user_prompt",
    confidence,
    routePreference: { id: "likely_cover", label: "Favor likely cover" },
    receiptLabel: "Rain-friendly · favoring likely cover",
    evidence: demoLikelyCoverEvidence,
  };
}

export function resolveShadeHour(requestedHour: number): number {
  if (!Number.isFinite(requestedHour)) throw new Error("requestedHour must be finite");
  const supportedHours = shadeMetadata.hours as number[];
  if (!supportedHours.length) throw new Error("No shade hours are available");
  return supportedHours.reduce((closest, hour) => (
    Math.abs(hour - requestedHour) < Math.abs(closest - requestedHour) ? hour : closest
  ));
}

function shadeBand(shadeShare: number): ShadeBand {
  if (shadeShare >= 0.67) return "mostly_shaded";
  if (shadeShare >= 0.34) return "mixed";
  return "mostly_sunny";
}

function shadeTone(band: ShadeBand): ShadeTone {
  if (band === "mostly_shaded") return "shade_deep";
  if (band === "mixed") return "shade_mixed";
  return "sun_warm";
}

/**
 * Builds MapLibre-ready route segments. A repeated edge is emitted once per
 * traversal so loops retain their visual order and tooltip evidence.
 */
export function routeShadeSegmentsGeoJSON(
  route: JourneyRoute | null | undefined,
  graph: PilotGraph,
  requestedHour: number,
) {
  const resolvedHour = resolveShadeHour(requestedHour);
  const evidence = shadeEvidence(resolvedHour);
  if (!route) {
    return {
      type: "FeatureCollection" as const,
      features: [],
      metadata: {
        requestedHour,
        resolvedHour,
        timeLabel: formatHour(resolvedHour),
        evidence,
      },
    };
  }
  if (route.nodeIds.length !== route.edgeIds.length + 1) {
    throw new Error("Route node and edge counts do not describe one continuous path");
  }

  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const features = route.edgeIds.map((edgeId, order) => {
    const edge = edgeById.get(edgeId);
    if (!edge) throw new Error(`Route references unknown edge ${edgeId}`);
    const shadeShare = edgeShade(edge, resolvedHour);
    const directSunShare = 1 - shadeShare;
    const band = shadeBand(shadeShare);
    const directSunMinutes = edge.distanceMeters * directSunShare / WALKING_METERS_PER_MINUTE;

    return {
      type: "Feature" as const,
      id: `${route.candidateId}:${order}`,
      properties: {
        edgeId,
        order,
        street: edge.street,
        distanceMeters: edge.distanceMeters,
        durationMinutes: edge.distanceMeters / WALKING_METERS_PER_MINUTE,
        hour: resolvedHour,
        shadeShare,
        directSunShare,
        directSunMinutes,
        shadeBand: band,
        mapTone: shadeTone(band),
        label: `${Math.round(shadeShare * 100)}% estimated shade at ${formatHour(resolvedHour)}`,
        evidenceKind: "estimated_building_shade" as const,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: orientedEdgeCoordinates(edge, route.nodeIds[order], nodeById),
      },
    };
  });

  return {
    type: "FeatureCollection" as const,
    features,
    metadata: {
      requestedHour,
      resolvedHour,
      timeLabel: formatHour(resolvedHour),
      evidence,
    },
  };
}
