export type JourneyShape = "destination" | "loop" | "wander";
export type RoutePriority = "shade" | "greenery" | "rest" | "water" | "restroom" | "construction";
export type EndCondition = "transit" | "park" | null;

export interface TripBrief {
  shape: JourneyShape;
  destinationQuery: string | null;
  walkingMinutes: number;
  detourMinutes: 0 | 5 | 10;
  departureHour: number;
  priorities: RoutePriority[];
  avoidMappedSteps: boolean;
  direction: "north" | "south" | "east" | "west" | null;
  endCondition: EndCondition;
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
  destinationQuery: null,
  walkingMinutes: 25,
  detourMinutes: 5,
  departureHour: new Date().getHours(),
  priorities: ["shade"],
  avoidMappedSteps: false,
  direction: null,
  endCondition: null,
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
  five: 5,
};

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function parseMinutes(prompt: string) {
  const numeric = prompt.match(/\b(10|15|20|25|30|35|40|45|60)[\s-]*(?:minutes?|mins?)\b/i);
  if (numeric) return Number(numeric[1]);
  const compact = prompt.toLowerCase().replace(/[ -]/g, "");
  const word = Object.entries(numberWords).find(([candidate]) => compact.includes(`${candidate}minute`));
  return word?.[1] ?? null;
}

function parseDestination(prompt: string) {
  const match = prompt.match(/(?:walk|get|take|bring|route|going|head)\s+(?:(?:me|us)\s+)?to\s+(.+?)(?=\s+(?:with|while|but|and\s+(?:avoid|keep|favor|make)|in\s+\d+|up\s+to|no\s+more)|[,.!?]|$)/i);
  return match?.[1]?.trim() || null;
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
  if (/\bsafe(?:st|ty)?\b/i.test(text)) unsupported.push("Safety ranking is not supported");
  if (/wheelchair accessible|ada(?:-compliant)?/i.test(text)) unsupported.push("Guaranteed accessibility is not supported");
  if (/quiet|noise|crowd/i.test(text)) unsupported.push("Live quietness and crowding are not supported");
  if (/open now/i.test(text)) unsupported.push("Current amenity operation is not verified");
  return unsupported;
}

export function compileTripBrief(prompt: string, current: TripBrief = DEFAULT_BRIEF): TripBrief {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const isRefinement = Boolean(current.prompt) && !/\b(loop|wander|walk me|get me|take me|route me)\b/i.test(text);
  let shape: JourneyShape = current.shape;
  if (/\bloop\b|back (?:to|where) (?:i|we) start/i.test(text)) shape = "loop";
  else if (/\bwander\b|walk (?:north|south|east|west)|finish|end near/i.test(text)) shape = "wander";
  else if (parseDestination(text)) shape = "destination";

  const parsedMinutes = shape === "destination" ? null : parseMinutes(text);
  const shorter = /shorter|less time/i.test(text);
  const longer = /longer|more time/i.test(text);
  const walkingMinutes = parsedMinutes ?? (shorter ? Math.max(10, current.walkingMinutes - 5) : longer ? Math.min(60, current.walkingMinutes + 5) : current.walkingMinutes);

  let detourMinutes = current.detourMinutes;
  if (/fastest|no detour/i.test(text)) detourMinutes = 0;
  else if (/(?:add|up to|no more than)\s+(?:5|five)\s*(?:minutes?|mins?)/i.test(text)) detourMinutes = 5;
  else if (/(?:add|up to|no more than)\s+(?:10|ten)\s*(?:minutes?|mins?)/i.test(text)) detourMinutes = 10;

  const mentioned = collectPriorities(text);
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
  const destinationQuery = shape === "destination" ? (parseDestination(text) ?? current.destinationQuery) : null;

  return {
    ...current,
    shape,
    destinationQuery,
    walkingMinutes,
    detourMinutes,
    priorities,
    avoidMappedSteps: /(?:avoid|no) (?:mapped )?(?:steps|stairs)/i.test(text) ? true : current.avoidMappedSteps,
    direction,
    endCondition,
    unsupported: unique([...collectUnsupported(text), ...(isRefinement ? current.unsupported : [])]),
    prompt: text,
    interpretedBy: "fallback",
  };
}

export function mergeTripBrief(base: TripBrief, patch: TripBriefPatch, interpretedBy: TripBrief["interpretedBy"]): TripBrief {
  const next = { ...base, ...patch, interpretedBy };
  return {
    ...next,
    departureHour: Math.max(0, Math.min(23, Math.round(next.departureHour))),
    walkingMinutes: Math.max(10, Math.min(60, Math.round(next.walkingMinutes / 5) * 5)),
    detourMinutes: ([0, 5, 10].includes(next.detourMinutes) ? next.detourMinutes : 5) as 0 | 5 | 10,
    priorities: unique(next.priorities).filter((priority): priority is RoutePriority => ["shade", "greenery", "rest", "water", "restroom", "construction"].includes(priority)),
    unsupported: unique(next.unsupported).slice(0, 4),
  };
}

export function briefSummary(brief: TripBrief) {
  const journey = brief.shape === "destination"
    ? (brief.destinationQuery ? `To ${brief.destinationQuery}` : "Destination walk")
    : brief.shape === "loop"
      ? `${brief.walkingMinutes}-minute loop`
      : `Wander for up to ${brief.walkingMinutes} minutes`;
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
    ...brief.priorities.map((priority) => ({ shade: "Less direct sun", greenery: "Greener streets", rest: "Places to rest", water: "Water nearby", restroom: "Restroom nearby", construction: "Less construction friction" })[priority]),
    brief.avoidMappedSteps ? "Avoid mapped steps" : null,
  ].filter((item): item is string => Boolean(item));
}
