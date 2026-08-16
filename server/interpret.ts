import type { IncomingMessage, ServerResponse } from "node:http";
import {
  DEFAULT_BRIEF,
  compileTripBrief,
  mergeTripBrief,
  parseCivicTaskIntent,
  parseDistanceMiles,
  parseMinutes,
  parseTripActivity,
  type TripBrief,
  type TripBriefPatch,
} from "../src/planning/tripBrief.ts";

export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5.6-luna";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 16_384;
const MAX_PROMPT_CHARACTERS = 1_000;

const journeyShapes = ["destination", "loop", "wander"] as const;
const priorities = ["shade", "greenery", "rest", "water", "restroom", "construction"] as const;
const directions = ["north", "south", "east", "west"] as const;
const endConditions = ["transit", "park"] as const;
const walkingTimeIntents = ["target", "maximum"] as const;
const civicTaskIntents = ["any", "verify", "observe", "photo"] as const;
const tripActivities = ["walk", "run"] as const;
const ACCESSIBILITY_LIMITATION = "We can avoid mapped steps, but cannot verify curb ramps, slopes, obstructions, or ADA accessibility";

export const tripBriefJsonSchema = {
  type: "object",
  properties: {
    shape: {
      type: "string",
      enum: journeyShapes,
      description: "The requested journey shape.",
    },
    activity: {
      type: "string",
      enum: tripActivities,
      description: "Whether the resident describes this route as a walk or a run.",
    },
    destinationQuery: {
      type: ["string", "null"],
      description: "A destination name or address for destination walks, otherwise null.",
    },
    distanceMiles: {
      type: ["number", "null"],
      minimum: 0.25,
      maximum: 5,
      description: "Explicit route distance when the resident uses miles, otherwise null. Kilometer conversion is handled deterministically after interpretation.",
    },
    walkingMinutes: {
      type: "integer",
      minimum: 10,
      maximum: 60,
      description: "Requested walking time from 10 to 60 minutes. Preserve custom integer values.",
    },
    walkingTimeIntent: {
      type: "string",
      enum: walkingTimeIntents,
      description: "Use target for an ordinary duration request and maximum only for explicit limits such as up to or no more than.",
    },
    detourMinutes: {
      type: "integer",
      enum: [0, 5, 10],
      description: "Maximum extra time accepted for a preferred route.",
    },
    departureHour: {
      type: "integer",
      description: "Local departure hour from 0 through 23.",
    },
    priorities: {
      type: "array",
      items: { type: "string", enum: priorities },
      description: "Supported route qualities explicitly requested or retained from the current brief.",
    },
    avoidMappedSteps: {
      type: "boolean",
      description: "Whether mapped steps must be excluded. This is not an accessibility guarantee.",
    },
    direction: {
      type: ["string", "null"],
      enum: [...directions, null],
      description: "Cardinal direction for a wander, otherwise null.",
    },
    endCondition: {
      type: ["string", "null"],
      enum: [...endConditions, null],
      description: "Supported end condition for a wander, otherwise null.",
    },
    civicTaskIntent: {
      type: ["string", "null"],
      enum: [...civicTaskIntents, null],
      description: "An explicitly requested optional city-data check. Never infer one from missing or stale data.",
    },
    unsupported: {
      type: "array",
      items: { type: "string" },
      description: "At most four short, resident-friendly statements about unsupported or unverifiable requests.",
    },
  },
  required: [
    "shape",
    "activity",
    "destinationQuery",
    "distanceMiles",
    "walkingMinutes",
    "walkingTimeIntent",
    "detourMinutes",
    "departureHour",
    "priorities",
    "avoidMappedSteps",
    "direction",
    "endCondition",
    "civicTaskIntent",
    "unsupported",
  ],
  additionalProperties: false,
} as const;

const systemPrompt = `You convert a resident's walking request into a Happy Path Trip Brief for a deterministic pedestrian routing engine.

Return only the structured fields required by the schema. Treat the current brief as retained state during a refinement: keep a value unless the new request explicitly changes or removes it. The new request always wins when it is explicit. The initial current brief may be an empty destination draft; never return shape "destination" with destinationQuery null. A timed walk without a named destination is a wander.

Supported priorities are shade, greenery, places to rest, water, restrooms, and less construction friction. Preserve the resident's destination wording without inventing an address. Preserve any integer walkingMinutes from 10 through 60. For an explicit distance in miles, set distanceMiles and use null when the request is time-based. For kilometer requests, leave distanceMiles null; deterministic code converts the stated value. Use activity run only for run, running, jog, or jogging language; otherwise use walk. A distance run without a destination is normally a loop unless the resident asks to wander or finish elsewhere. Use walkingTimeIntent "target" for ordinary requests such as "a 30-minute walk" and "maximum" only for explicit limits such as "up to 30 minutes". Use 0/5/10 for detourMinutes and a whole local hour from 0 through 23.

Interpret accessibility language narrowly and helpfully. If the resident asks for an accessible, wheelchair-friendly, mobility-friendly, stroller-friendly, or step-free route, set avoidMappedSteps to true and include this limitation in unsupported: "We can avoid mapped steps, but cannot verify curb ramps, slopes, obstructions, or ADA accessibility". If a refinement says steps or stairs are okay, set avoidMappedSteps to false. Do not claim safety, guaranteed accessibility, live quietness, live crowding, live weather, current construction state, or current amenity operation. Keep those requests visible in unsupported instead of pretending they were satisfied.

Set civicTaskIntent only when the resident explicitly asks to help, verify, observe, report, document, photograph, or contribute to city/public data. Use any when they ask generally, verify for a structured confirmation, observe for a bounded report or observation, and photo for a picture. These are optional checks selected later from a pre-published registry; never invent a task, hazard, issue, or City request from an amenity or data gap. A request to skip the check sets it to null.

Examples:
- "A shaded 2-mile run" means shape loop, activity run, distanceMiles 2, and priority shade.
- "Walk 3 kilometers west" means shape wander, activity walk, distanceMiles null, and direction west; deterministic code performs the unit conversion.
- "A green 37-minute loop with a bench halfway" means shape loop, walkingMinutes 37, walkingTimeIntent target, priorities greenery and rest.
- "Wander west for no more than 30 minutes and finish near a train" means shape wander, walkingMinutes 30, walkingTimeIntent maximum, direction west, endCondition transit.
- "It’s raining. Find me a 25-minute walk with more likely cover" means shape wander, walkingMinutes 25, with the weather/cover limitation visible in unsupported.
- "Give me a 30-minute loop where I can help verify city data" means shape loop, walkingMinutes 30, walkingTimeIntent target, civicTaskIntent verify.
- "Route me toward something I can photograph for city data" means shape wander and civicTaskIntent photo; do not invent what will be photographed.
- "I need an accessible route to Washington Square Park" means shape destination, destinationQuery Washington Square Park, avoidMappedSteps true, plus the accessibility limitation above.
- "A little shorter, but keep the bathroom" is a refinement: retain the current shape, destination or endpoint, and priorities, then reduce walkingMinutes by five when no exact duration is given.`;

type OpenRouterFetch = typeof fetch;

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: OpenRouterFetch;
}

export interface InterpretRequest {
  prompt: string;
  currentBrief?: TripBrief;
}

interface OpenRouterResponse {
  error?: unknown;
  choices?: Array<{
    finish_reason?: string | null;
    error?: unknown;
    message?: { content?: string | null };
  }>;
}

export class TripBriefInterpretError extends Error {
  constructor(public readonly kind: "timeout" | "upstream" | "invalid-output") {
    super("Trip Brief interpretation failed");
    this.name = "TripBriefInterpretError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T | null {
  return value === null || (typeof value === "string" && allowed.includes(value as T));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isTripBrief(value: unknown): value is TripBrief {
  if (!isRecord(value)) return false;
  return journeyShapes.includes(value.shape as (typeof journeyShapes)[number])
    && tripActivities.includes(value.activity as (typeof tripActivities)[number])
    && (value.destinationQuery === null || (typeof value.destinationQuery === "string" && value.destinationQuery.trim().length > 0 && value.destinationQuery.length <= 160))
    && (value.distanceMiles === null || (typeof value.distanceMiles === "number" && Number.isFinite(value.distanceMiles) && value.distanceMiles >= 0.25 && value.distanceMiles <= 5))
    && !(value.shape === "destination" && value.distanceMiles !== null)
    && typeof value.walkingMinutes === "number" && Number.isInteger(value.walkingMinutes)
    && value.walkingMinutes >= 10 && value.walkingMinutes <= 60
    && walkingTimeIntents.includes(value.walkingTimeIntent as (typeof walkingTimeIntents)[number])
    && [0, 5, 10].includes(value.detourMinutes as number)
    && typeof value.departureHour === "number" && Number.isInteger(value.departureHour)
    && value.departureHour >= 0 && value.departureHour <= 23
    && Array.isArray(value.priorities) && value.priorities.length <= priorities.length
    && value.priorities.every((item) => priorities.includes(item))
    && typeof value.avoidMappedSteps === "boolean"
    && isNullableEnum(value.direction, directions)
    && isNullableEnum(value.endCondition, endConditions)
    && (value.civicTaskIntent === undefined || isNullableEnum(value.civicTaskIntent, civicTaskIntents))
    && isStringArray(value.unsupported) && value.unsupported.length <= 4
    && value.unsupported.every((item) => item.length <= 120)
    && typeof value.prompt === "string"
    && ["model", "fallback", "controls"].includes(value.interpretedBy as string);
}

function parseModelPatch(value: unknown): TripBriefPatch {
  if (!isRecord(value)
    || !journeyShapes.includes(value.shape as (typeof journeyShapes)[number])
    || !(value.activity === undefined || tripActivities.includes(value.activity as (typeof tripActivities)[number]))
    || !(value.destinationQuery === null || typeof value.destinationQuery === "string")
    || !(value.distanceMiles === undefined || value.distanceMiles === null || (typeof value.distanceMiles === "number" && Number.isFinite(value.distanceMiles)))
    || typeof value.walkingMinutes !== "number" || !Number.isFinite(value.walkingMinutes)
    || !walkingTimeIntents.includes(value.walkingTimeIntent as (typeof walkingTimeIntents)[number])
    || ![0, 5, 10].includes(value.detourMinutes as number)
    || typeof value.departureHour !== "number" || !Number.isFinite(value.departureHour)
    || !Array.isArray(value.priorities) || !value.priorities.every((item) => priorities.includes(item))
    || typeof value.avoidMappedSteps !== "boolean"
    || !isNullableEnum(value.direction, directions)
    || !isNullableEnum(value.endCondition, endConditions)
    || !(value.civicTaskIntent === undefined || isNullableEnum(value.civicTaskIntent, civicTaskIntents))
    || !isStringArray(value.unsupported)) {
    throw new TripBriefInterpretError("invalid-output");
  }

  return {
    shape: value.shape,
    ...(value.activity !== undefined ? { activity: value.activity } : {}),
    destinationQuery: typeof value.destinationQuery === "string"
      ? value.destinationQuery.trim().slice(0, 160) || null
      : null,
    ...(value.distanceMiles !== undefined ? { distanceMiles: value.distanceMiles } : {}),
    walkingMinutes: value.walkingMinutes,
    walkingTimeIntent: value.walkingTimeIntent,
    detourMinutes: value.detourMinutes,
    departureHour: value.departureHour,
    priorities: value.priorities,
    avoidMappedSteps: value.avoidMappedSteps,
    direction: value.direction,
    endCondition: value.endCondition,
    ...(value.civicTaskIntent !== undefined ? { civicTaskIntent: value.civicTaskIntent } : {}),
    unsupported: value.unsupported.map((item) => item.slice(0, 120)).slice(0, 4),
  } as TripBriefPatch;
}

export async function interpretTripBriefWithOpenRouter(
  request: InterpretRequest,
  config: OpenRouterConfig,
): Promise<TripBrief> {
  const prompt = request.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_CHARACTERS) {
    throw new TripBriefInterpretError("invalid-output");
  }
  const currentBrief = request.currentBrief ?? DEFAULT_BRIEF;
  if (!isTripBrief(currentBrief)) throw new TripBriefInterpretError("invalid-output");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await (config.fetchImpl ?? fetch)(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model?.trim() || DEFAULT_OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({ request: prompt, currentBrief }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "happy_path_trip_brief",
            strict: true,
            schema: tripBriefJsonSchema,
          },
        },
        provider: { require_parameters: true, data_collection: "deny" },
        stream: false,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new TripBriefInterpretError(controller.signal.aborted ? "timeout" : "upstream");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new TripBriefInterpretError("upstream");

  let payload: OpenRouterResponse;
  try {
    payload = await response.json() as OpenRouterResponse;
  } catch {
    throw new TripBriefInterpretError("invalid-output");
  }
  const choice = payload.choices?.[0];
  if (payload.error || choice?.error || choice?.finish_reason === "error") {
    throw new TripBriefInterpretError("upstream");
  }
  if (typeof choice?.message?.content !== "string") {
    throw new TripBriefInterpretError("invalid-output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(choice.message.content);
  } catch {
    throw new TripBriefInterpretError("invalid-output");
  }
  const patch = parseModelPatch(parsed);
  const deterministicBrief = compileTripBrief(prompt, currentBrief);
  // A destination route without a destination cannot be planned. Models can
  // over-retain the empty initial draft, so keep this domain invariant here.
  if (patch.shape === "destination" && patch.destinationQuery === null) {
    patch.shape = "wander";
  }
  const relaxesMappedSteps = /\b(?:steps?|stairs?)\s+(?:are\s+)?(?:okay|ok|fine)\b|\bdon'?t\s+(?:need\s+to\s+)?avoid\s+(?:mapped\s+)?(?:steps?|stairs?)\b/i.test(prompt);
  const requestsMappedStepAvoidance = /(?:avoid|no)\s+(?:mapped\s+)?(?:steps?|stairs?)|\bstep[- ]free\b|\b(?:accessible|accessibility|wheelchair|mobility|ada(?:-compliant)?|stroller)\b/i.test(prompt);
  if (relaxesMappedSteps) patch.avoidMappedSteps = false;
  else if (requestsMappedStepAvoidance) {
    patch.avoidMappedSteps = true;
    patch.unsupported = [...new Set([...(patch.unsupported ?? []), ACCESSIBILITY_LIMITATION])].slice(0, 4);
  }
  const explicitCivicTaskIntent = parseCivicTaskIntent(prompt);
  if (explicitCivicTaskIntent !== undefined) patch.civicTaskIntent = explicitCivicTaskIntent;
  else if (!currentBrief.civicTaskIntent) patch.civicTaskIntent = null;
  const explicitDistanceMiles = parseDistanceMiles(prompt);
  const explicitActivity = parseTripActivity(prompt);
  if (explicitDistanceMiles !== null) {
    patch.distanceMiles = explicitDistanceMiles;
    const deterministicBrief = compileTripBrief(prompt, currentBrief);
    if (!patch.destinationQuery) patch.shape = deterministicBrief.shape;
    patch.unsupported = [...new Set([...(patch.unsupported ?? []), ...deterministicBrief.unsupported])].slice(0, 4);
  } else if (currentBrief.distanceMiles === null || parseMinutes(prompt) !== null || /\b(?:use time|by time|minutes? instead|no distance)\b/i.test(prompt)) {
    patch.distanceMiles = null;
  } else {
    patch.distanceMiles = currentBrief.distanceMiles;
  }
  patch.activity = explicitActivity ?? currentBrief.activity;
  // The model may add language understanding, but deterministic parsing owns
  // every supported route switch and every visible evidence limitation. This
  // prevents a valid structured response from dropping or inventing semantics.
  patch.priorities = deterministicBrief.priorities;
  patch.shape = deterministicBrief.shape;
  patch.destinationQuery = deterministicBrief.destinationQuery;
  patch.walkingMinutes = deterministicBrief.walkingMinutes;
  patch.direction = deterministicBrief.direction;
  patch.endCondition = deterministicBrief.endCondition;
  patch.detourMinutes = deterministicBrief.detourMinutes;
  patch.walkingTimeIntent = deterministicBrief.walkingTimeIntent;
  if (deterministicBrief.destinationQuery) {
    patch.shape = deterministicBrief.shape;
    patch.destinationQuery = deterministicBrief.destinationQuery;
  }
  patch.unsupported = [...new Set([...(patch.unsupported ?? []), ...deterministicBrief.unsupported])].slice(0, 4);
  const brief = mergeTripBrief(currentBrief, patch, "model");
  return { ...brief, prompt };
}

class RequestError extends Error {
  constructor(public readonly status: number) {
    super("Invalid request");
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new RequestError(413);
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400);
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function safeError(status: number, code: string) {
  const message = status === 400 || status === 413
    ? "Please enter a shorter walking request and try again."
    : "Trip interpretation is temporarily unavailable.";
  return { error: { code, message } };
}

export function createInterpretMiddleware(config: OpenRouterConfig) {
  return async (request: IncomingMessage, response: ServerResponse, next?: () => void) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/api/interpret") {
      next?.();
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, safeError(405, "METHOD_NOT_ALLOWED"));
      return;
    }
    if (!config.apiKey) {
      sendJson(response, 503, safeError(503, "MODEL_UNAVAILABLE"));
      return;
    }

    try {
      const body = await readJsonBody(request);
      if (!isRecord(body) || typeof body.prompt !== "string"
        || body.prompt.trim().length === 0 || body.prompt.trim().length > MAX_PROMPT_CHARACTERS
        || (body.currentBrief !== undefined && !isTripBrief(body.currentBrief))) {
        throw new RequestError(400);
      }
      const brief = await interpretTripBriefWithOpenRouter(
        { prompt: body.prompt, currentBrief: body.currentBrief },
        config,
      );
      sendJson(response, 200, { brief });
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(response, error.status, safeError(error.status, error.status === 413 ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST"));
      } else if (error instanceof TripBriefInterpretError && error.kind === "timeout") {
        sendJson(response, 504, safeError(504, "MODEL_TIMEOUT"));
      } else {
        sendJson(response, 502, safeError(502, "MODEL_ERROR"));
      }
    }
  };
}
