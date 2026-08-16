import {
  compileTripBrief,
  DEFAULT_BRIEF,
  type TripBrief,
} from "./tripBrief";

interface InterpretResponse {
  brief?: unknown;
}

export interface InterpretTripBriefOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

const shapes = ["destination", "loop", "wander"];
const priorities = ["shade", "greenery", "rest", "water", "restroom", "construction"];
const directions = ["north", "south", "east", "west"];
const endConditions = ["transit", "park"];
const walkingTimeIntents = ["target", "maximum"];

function isTripBrief(value: unknown): value is TripBrief {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const brief = value as Record<string, unknown>;
  return shapes.includes(brief.shape as string)
    && (brief.destinationQuery === null || (typeof brief.destinationQuery === "string" && brief.destinationQuery.length <= 160))
    && typeof brief.walkingMinutes === "number" && Number.isInteger(brief.walkingMinutes)
    && brief.walkingMinutes >= 10 && brief.walkingMinutes <= 60
    // Accept one release of legacy model responses while the server schema rolls
    // forward; callers receive a normalized intent below.
    && (brief.walkingTimeIntent === undefined || walkingTimeIntents.includes(brief.walkingTimeIntent as string))
    && [0, 5, 10].includes(brief.detourMinutes as number)
    && typeof brief.departureHour === "number" && Number.isInteger(brief.departureHour)
    && brief.departureHour >= 0 && brief.departureHour <= 23
    && Array.isArray(brief.priorities) && brief.priorities.length <= priorities.length
    && brief.priorities.every((item) => priorities.includes(item))
    && typeof brief.avoidMappedSteps === "boolean"
    && (brief.direction === null || directions.includes(brief.direction as string))
    && (brief.endCondition === null || endConditions.includes(brief.endCondition as string))
    && Array.isArray(brief.unsupported) && brief.unsupported.length <= 4
    && brief.unsupported.every((item) => typeof item === "string" && item.length <= 120)
    && typeof brief.prompt === "string"
    && brief.interpretedBy === "model";
}

export async function interpretTripBrief(
  prompt: string,
  currentBrief: TripBrief = DEFAULT_BRIEF,
  options: InterpretTripBriefOptions = {},
): Promise<TripBrief> {
  const fallback = () => compileTripBrief(prompt, currentBrief);
  try {
    const response = await (options.fetchImpl ?? fetch)(options.endpoint ?? "/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, currentBrief }),
      signal: options.signal,
    });
    if (!response.ok) return fallback();
    const payload = await response.json() as InterpretResponse;
    return isTripBrief(payload.brief)
      ? {
          ...payload.brief,
          walkingTimeIntent: payload.brief.walkingTimeIntent ?? currentBrief.walkingTimeIntent,
        }
      : fallback();
  } catch {
    return fallback();
  }
}
