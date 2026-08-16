export type JourneyShape = "destination" | "loop" | "wander";
export type RoutePriority = "shade" | "greenery" | "rest" | "water" | "restroom" | "construction";
export type EndCondition = "transit" | "park" | null;
export type WalkingTimeIntent = "target" | "maximum";
export type CivicTaskIntent = "any" | "verify" | "observe" | "photo" | null;
export type TripActivity = "walk" | "run";

export const METERS_PER_MILE = 1609.344;
export const ROUTING_METERS_PER_MINUTE = 80;

export interface TripBrief {
  shape: JourneyShape;
  activity: TripActivity;
  destinationQuery: string | null;
  /** Exact route-distance target for loops and wanders. Null uses time. */
  distanceMiles: number | null;
  walkingMinutes: number;
  /** Whether Loop/Wander duration is an approximate target or a hard ceiling. */
  walkingTimeIntent: WalkingTimeIntent;
  detourMinutes: 0 | 5 | 10;
  departureHour: number;
  priorities: RoutePriority[];
  avoidMappedSteps: boolean;
  direction: "north" | "south" | "east" | "west" | null;
  endCondition: EndCondition;
  /** Explicit resident interest in an optional, pre-published city-data check. */
  civicTaskIntent: CivicTaskIntent;
  unsupported: string[];
  prompt: string;
  interpretedBy: "model" | "fallback" | "controls";
}

export interface TripBriefPatch extends Partial<Omit<TripBrief, "unsupported" | "priorities">> {
  priorities?: RoutePriority[];
  unsupported?: string[];
}

export const DEFAULT_BRIEF: TripBrief = {
  shape: "destination",
  activity: "walk",
  destinationQuery: null,
  distanceMiles: null,
  walkingMinutes: 25,
  walkingTimeIntent: "target",
  detourMinutes: 5,
  departureHour: new Date().getHours(),
  priorities: ["shade"],
  avoidMappedSteps: false,
  direction: null,
  endCondition: null,
  civicTaskIntent: null,
  unsupported: [],
  prompt: "",
  interpretedBy: "controls",
};

const numberWords: Record<string, number> = {
  ten: 10,
  fifteen: 15,
  twenty: 20,
  twentyfive: 25,
  thirty: 30,
  thirtyfive: 35,
  forty: 40,
  fortyfive: 45,
  fifty: 50,
  fiftyfive: 55,
  sixty: 60,
  five: 5,
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function parseMinutes(prompt: string) {
  const numeric = prompt.match(/\b(\d{1,3})[\s-]*(?:minutes?|mins?)\b/i);
  if (numeric) return Number(numeric[1]);
  if (/\b(?:half (?:an )?hour|half-hour)\b/i.test(prompt)) return 30;
  if (/\b(?:an hour|one hour|the next hour)\b/i.test(prompt)) return 60;
  const compact = prompt.toLowerCase().replace(/[ -]/g, "");
  const word = Object.entries(numberWords).find(([candidate]) => compact.includes(`${candidate}minute`));
  return word?.[1] ?? null;
}

export function parseDistanceMiles(prompt: string) {
  const distancePattern = /(?:^|[\s(])([+-]?\d+(?:\.\d+)?)\s*[- ]?(miles?|mi|kilometers?|kilometres?|km)\b/gi;
  for (const match of prompt.matchAll(distancePattern)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const contextBefore = prompt.slice(Math.max(0, (match.index ?? 0) - 60), match.index).toLowerCase();
    const describesAmenityRadius = /(?:seats?|seating|benches?|water|fountains?|restrooms?|bathrooms?|amenit(?:y|ies)|parks?|transit)\s+(?:nearby\s+)?within\s*$/.test(contextBefore);
    if (describesAmenityRadius) continue;
    return /^mi(?:le)?s?$/i.test(match[2]) ? value : value * 0.621371;
  }
  return null;
}

export function parseTripActivity(prompt: string): TripActivity | null {
  if (/\b(?:run|running|jog|jogging)\b/i.test(prompt)) return "run";
  if (/\b(?:walk|walking|stroll|strolling)\b/i.test(prompt)) return "walk";
  return null;
}

export function distanceMilesToRoutingMinutes(distanceMiles: number) {
  return distanceMiles * METERS_PER_MILE / ROUTING_METERS_PER_MINUTE;
}

export function metersToMiles(distanceMeters: number) {
  return distanceMeters / METERS_PER_MILE;
}

function parseWalkingTimeIntent(prompt: string, parsedMinutes: number | null): WalkingTimeIntent | null {
  if (parsedMinutes === null) return null;
  const minuteValue = String.raw`(?:\d{1,3}|ten|fifteen|twenty(?:[- ]?five)?|thirty(?:[- ]?five)?|forty(?:[- ]?five)?|fifty(?:[- ]?five)?|sixty)`;
  const minuteUnit = String.raw`(?:minutes?|mins?)`;
  const explicitMaximum = new RegExp(
    String.raw`\b(?:up to|no more than|at most|only have)\s+${minuteValue}\s*${minuteUnit}\b|\bwithin\s+${minuteValue}\s*${minuteUnit}\b|\b${minuteValue}\s*${minuteUnit}\s*(?:maximum|max|limit)\b|\b(?:maximum|max|limit)(?:\s+of|\s+is|\s*:)?\s+${minuteValue}\s*${minuteUnit}\b`,
    "i",
  );
  return explicitMaximum.test(prompt)
    ? "maximum"
    : "target";
}

function parseDestination(prompt: string) {
  const match = prompt.match(/(?:walk|run|jog|get|take|bring|route|going|head)\s+(?:(?:me|us)\s+)?to\s+(.+?)(?=\s+(?:with|while|but|and\s+(?:avoid|keep|favor|make|let|help|include|pass|verify|check|confirm|photograph|photo|snap|report|observe)|in\s+\d+|up\s+to|no\s+more)|[,.!?]|$)/i);
  return match?.[1]?.trim() || null;
}

function civicTaskClauseStart(text: string): number {
  const direct = text.search(/\b(?:verify|confirm|photograph|photo|snap|report|observe|document)\b/i);
  const check = text.search(/\bcheck\b(?=[^.?!]{0,50}\b(?:city data|public data|record|seat|bench|fountain|restroom|entrance|amenity)\b)/i);
  const help = text.search(/\b(?:help|contribute)\b(?=[^.?!]{0,60}\b(?:city|public|civic)\s+data\b)/i);
  return [direct, check, help].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
}

function withoutCivicTaskClause(text: string): string {
  const start = civicTaskClauseStart(text);
  return start < 0 ? text : text.slice(0, start);
}

export function parseCivicTaskIntent(text: string): CivicTaskIntent | undefined {
  if (/\b(?:skip|remove|drop|don'?t include|no)\b[^.?!]{0,30}\b(?:photo|verification|observation|city data|civic)\s*(?:check|stop|task)?\b/i.test(text)) return null;
  const hasTaskLanguage = civicTaskClauseStart(text) >= 0
    || /\b(?:something|a stop)\b[^.?!]{0,40}\b(?:help|contribute)\b[^.?!]{0,40}\b(?:city|public|civic)\s+data\b/i.test(text);
  if (!hasTaskLanguage) return undefined;
  if (/\b(?:photograph|photo|snap|picture|camera)\b/i.test(text)) return "photo";
  if (/\b(?:report|observe|document|note)\b/i.test(text)) return "observe";
  if (/\b(?:verify|confirm|check)\b/i.test(text)) return "verify";
  return "any";
}

function collectPriorities(text: string): RoutePriority[] {
  const priorities: RoutePriority[] = [];
  if (/shade|shady|sun|cooler/i.test(text)) priorities.push("shade");
  if (/green|tree|park[- ]?lined/i.test(text)) priorities.push("greenery");
  if (/\b(?:sit|seat|seating|bench|benches|rest)\b/i.test(text)) priorities.push("rest");
  if (/water|fountain/i.test(text)) priorities.push("water");
  if (/restroom|bathroom|toilet/i.test(text)) priorities.push("restroom");
  if (/construction|shed|work zone/i.test(text)) priorities.push("construction");
  return unique(priorities);
}

function collectUnsupported(text: string) {
  const unsupported: string[] = [];
  if (/\bsafe(?:st|ty)?\b/i.test(text)) unsupported.push("We don’t rate streets by safety yet");
  if (/\b(?:accessible|accessibility|wheelchair|mobility|ada(?:-compliant)?|stroller)\b/i.test(text)) {
    unsupported.push("Known stairs can be avoided, but curb ramps, slopes, and temporary obstacles can change");
  }
  if (/quiet|noise|crowd/i.test(text)) unsupported.push("Crowd and noise levels aren’t live yet");
  if (/open now/i.test(text)) unsupported.push("Opening hours and current availability may have changed");
  return unsupported;
}

function parseMappedStepPreference(text: string): boolean | null {
  if (/\b(?:steps?|stairs?)\s+(?:are\s+)?(?:okay|ok|fine)\b|\bdon'?t\s+(?:need\s+to\s+)?avoid\s+(?:mapped\s+)?(?:steps?|stairs?)\b/i.test(text)) {
    return false;
  }
  if (/(?:avoid|no)\s+(?:mapped\s+)?(?:steps?|stairs?)|\bstep[- ]free\b|\b(?:accessible|accessibility|wheelchair|mobility|ada(?:-compliant)?|stroller)\b/i.test(text)) {
    return true;
  }
  return null;
}

export function compileTripBrief(prompt: string, current: TripBrief = DEFAULT_BRIEF): TripBrief {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const parsedCivicTaskIntent = parseCivicTaskIntent(text);
  const parsedDestination = parseDestination(text);
  const parsedDistance = parseDistanceMiles(text);
  const parsedActivity = parseTripActivity(text);
  const isRefinement = Boolean(current.prompt) && !/\b(loop|wander|walk me|run|running|jog|jogging|get me|take me|route me)\b/i.test(text);
  let shape: JourneyShape = current.shape;
  if (/\bloop\b|back (?:to|where) (?:i|we) start/i.test(text)) shape = "loop";
  else if (/\bwander\b|walk (?:north|south|east|west)|finish|end near/i.test(text)) shape = "wander";
  else if (parsedDestination) shape = "destination";
  else if (parsedDistance !== null && parsedActivity === "run") shape = "loop";
  else if (parsedDistance !== null) shape = "wander";
  else if (!current.destinationQuery && parseMinutes(text) !== null && parsedActivity === "run") shape = "loop";
  else if (!current.destinationQuery && parsedActivity === "run") shape = "loop";
  else if (!current.destinationQuery && parseMinutes(text) !== null && /\b(?:walk|walking|stroll|roam|explore)\b/i.test(text)) shape = "wander";
  else if (!current.destinationQuery && parsedCivicTaskIntent) shape = "wander";

  const parsedMinutesRaw = shape === "destination" ? null : parseMinutes(text);
  const parsedMinutes = parsedMinutesRaw === null
    ? null
    : Math.max(10, Math.min(60, Math.round(parsedMinutesRaw)));
  const parsedWalkingTimeIntent = parseWalkingTimeIntent(text, parsedMinutes);
  const shorter = /shorter|less time/i.test(text);
  const longer = /longer|more time/i.test(text);
  const walkingMinutes = parsedMinutes ?? (shorter ? Math.max(10, current.walkingMinutes - 5) : longer ? Math.min(60, current.walkingMinutes + 5) : current.walkingMinutes);
  const retainedDistance = current.distanceMiles === null
    ? null
    : shorter ? current.distanceMiles - 0.25 : longer ? current.distanceMiles + 0.25 : current.distanceMiles;
  const distanceMiles = shape === "destination"
    ? null
    : parsedDistance !== null
      ? parsedDistance
      : parsedMinutesRaw !== null || /\b(?:use time|by time|minutes? instead|no distance)\b/i.test(text)
        ? null
        : retainedDistance;

  let detourMinutes = current.detourMinutes;
  if (/fastest|no detour/i.test(text)) detourMinutes = 0;
  else if (/(?:add|up to|no more than)\s+(?:5|five)\s*(?:minutes?|mins?)/i.test(text)) detourMinutes = 5;
  else if (/(?:add|up to|no more than)\s+(?:10|ten)\s*(?:minutes?|mins?)/i.test(text)) detourMinutes = 10;

  const mentioned = collectPriorities(withoutCivicTaskClause(text));
  let priorities = isRefinement ? [...current.priorities] : mentioned;
  if (!isRefinement && priorities.length === 0) priorities = ["shade"];
  if (isRefinement) {
    priorities = unique([...priorities, ...mentioned]);
    if (/less shade|don'?t prioritize shade/i.test(lower)) priorities = priorities.filter((item) => item !== "shade");
    if (/less green|don'?t prioritize green/i.test(lower)) priorities = priorities.filter((item) => item !== "greenery");
  }

  const direction = (["north", "south", "east", "west"] as const).find((item) => lower.includes(item)) ?? (shape === "wander" ? current.direction : null);
  const endCondition: EndCondition = /(?:end|finish) near (?:a |the )?(?:subway|train|transit)/i.test(text)
    ? "transit"
    : /(?:end|finish) near (?:a |the )?park/i.test(text)
      ? "park"
      : shape === "wander" ? current.endCondition : null;
  const destinationQuery = shape === "destination" ? (parsedDestination ?? current.destinationQuery) : null;
  const mappedStepPreference = parseMappedStepPreference(text);

  const distanceLimitation = parsedDistance !== null && (parsedDistance < 0.25 || parsedDistance > 5)
    ? ["This preview supports route distances from 0.25 to 5 miles"]
    : [];
  const destinationDistanceLimitation = parsedDestination && parsedDistance !== null
    ? ["A fixed destination and exact distance can conflict, so this route uses the destination"]
    : [];
  const next: TripBrief = {
    ...current,
    shape,
    activity: parsedActivity ?? current.activity,
    destinationQuery,
    distanceMiles,
    walkingMinutes,
    walkingTimeIntent: parsedDistance !== null ? "target" : parsedWalkingTimeIntent ?? current.walkingTimeIntent,
    detourMinutes,
    priorities,
    avoidMappedSteps: mappedStepPreference ?? current.avoidMappedSteps,
    direction,
    endCondition,
    civicTaskIntent: parsedCivicTaskIntent === undefined ? current.civicTaskIntent : parsedCivicTaskIntent,
    unsupported: unique([...collectUnsupported(text), ...distanceLimitation, ...destinationDistanceLimitation, ...(isRefinement ? current.unsupported : [])]),
    prompt: text,
    interpretedBy: "fallback",
  };
  return mergeTripBrief(next, {}, "fallback");
}

export function mergeTripBrief(base: TripBrief, patch: TripBriefPatch, interpretedBy: TripBrief["interpretedBy"]): TripBrief {
  const next = { ...base, ...patch, interpretedBy };
  return {
    ...next,
    departureHour: Math.max(0, Math.min(23, Math.round(next.departureHour))),
    walkingMinutes: Math.max(10, Math.min(60, Math.round(next.walkingMinutes))),
    walkingTimeIntent: next.distanceMiles !== null
      ? "target"
      : (["target", "maximum"] as const).includes(next.walkingTimeIntent) ? next.walkingTimeIntent : "target",
    activity: next.activity === "run" ? "run" : "walk",
    distanceMiles: next.shape === "destination" || next.distanceMiles === null || !Number.isFinite(next.distanceMiles)
      ? null
      : Math.max(0.25, Math.min(5, Math.round(next.distanceMiles * 100) / 100)),
    detourMinutes: ([0, 5, 10].includes(next.detourMinutes) ? next.detourMinutes : 5) as 0 | 5 | 10,
    priorities: unique(next.priorities).filter((priority): priority is RoutePriority => ["shade", "greenery", "rest", "water", "restroom", "construction"].includes(priority)),
    civicTaskIntent: (["any", "verify", "observe", "photo"] as const).includes(next.civicTaskIntent as Exclude<CivicTaskIntent, null>)
      ? next.civicTaskIntent
      : null,
    unsupported: unique(next.unsupported).slice(0, 4),
  };
}

export function withDestinationOverride(brief: TripBrief, destination: string): TripBrief {
  const destinationQuery = destination.trim();
  if (!destinationQuery) return brief;
  return mergeTripBrief(brief, {
    shape: "destination",
    destinationQuery,
    distanceMiles: null,
    direction: null,
    endCondition: null,
  }, brief.interpretedBy);
}

export function briefSummary(brief: TripBrief) {
  const activity = brief.activity === "run" ? "run" : "walk";
  const journey = brief.shape === "destination"
    ? (brief.destinationQuery ? `To ${brief.destinationQuery}` : `Destination ${activity}`)
    : brief.distanceMiles !== null
      ? brief.shape === "loop"
        ? brief.activity === "run" ? `${brief.distanceMiles}-mile run, back to your start` : `${brief.distanceMiles}-mile loop`
        : `${brief.distanceMiles}-mile ${activity}`
    : brief.shape === "loop"
      ? brief.walkingTimeIntent === "maximum"
        ? `Loop for up to ${brief.walkingMinutes} minutes`
        : `About a ${brief.walkingMinutes}-minute loop`
      : brief.walkingTimeIntent === "maximum"
        ? `Wander for up to ${brief.walkingMinutes} minutes`
        : `Wander for about ${brief.walkingMinutes} minutes`;
  const direction = brief.shape === "wander" && brief.direction
    ? `Head ${brief.direction}`
    : null;
  const endCondition = brief.shape === "wander" && brief.endCondition
    ? brief.endCondition === "transit" ? "Finish near transit" : "Finish near a park"
    : null;
  return [
    journey,
    direction,
    endCondition,
    brief.civicTaskIntent ? brief.civicTaskIntent === "photo" ? "Pass a photo check" : "Pass a city data check" : null,
    ...brief.priorities.map((priority) => ({ shade: "Less direct sun", greenery: "Greener streets", rest: "Places to rest", water: "Water nearby", restroom: "Restroom nearby", construction: "Less construction friction" })[priority]),
    brief.avoidMappedSteps ? "Avoid known stairs" : null,
  ].filter((item): item is string => Boolean(item));
}
