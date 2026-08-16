import type { Coordinate } from "./types";
import type { TripBrief } from "./planning/tripBrief";

export interface ExampleJourney {
  id: string;
  label: string;
  prompt: string;
  originNodeId: string;
  originCoordinate: Coordinate;
  destinationNodeId: string | null;
  destinationCoordinate: Coordinate | null;
}

/**
 * Curated product demos, not placeholder copy. Each origin gives the request
 * enough room to produce a legible, representative route inside the pilot.
 */
export const EXAMPLE_JOURNEYS: readonly ExampleJourney[] = [
  {
    id: "destination-shade",
    label: "Get somewhere",
    prompt: "Walk me to Union Square with less direct sun and greener streets, up to five minutes longer.",
    originNodeId: "42436968", // Downing Street & Varick Street
    originCoordinate: [-74.0052872, 40.7288513],
    destinationNodeId: "42440710", // East 14th Street & 5th Avenue
    destinationCoordinate: [-73.9936325, 40.7360074],
  },
  {
    id: "green-loop",
    label: "Take a loop",
    prompt: "I’m free for half an hour. Give me a green loop with somewhere to sit.",
    originNodeId: "42431165", // Great Jones Street & Lafayette Street
    originCoordinate: [-73.9936231, 40.7272894],
    destinationNodeId: null,
    destinationCoordinate: null,
  },
  {
    id: "transit-wander",
    label: "Just wander",
    prompt: "I have half an hour. Let me wander north through greener streets and finish near a subway.",
    originNodeId: "42436968", // Downing Street & Varick Street
    originCoordinate: [-74.0052872, 40.7288513],
    destinationNodeId: null,
    destinationCoordinate: null,
  },
  {
    id: "rain-cover-loop",
    label: "Find mapped cover",
    prompt: "It’s raining. Take me to Waterside Plaza with as much mapped cover as possible.",
    originNodeId: "42440710", // East 14th Street & 5th Avenue
    originCoordinate: [-73.9936325, 40.7360074],
    destinationNodeId: "4389441146", // Waterside Plaza building passage
    destinationCoordinate: [-73.973618, 40.7378624],
  },
  {
    id: "civic-check-loop",
    label: "Help the map",
    prompt: "I have 25 minutes. Take me past a drinking fountain that could use a fresh photo.",
    originNodeId: "42448558", // West Houston Street & LaGuardia Place
    originCoordinate: [-73.9998695, 40.7270026],
    destinationNodeId: null,
    destinationCoordinate: null,
  },
  {
    id: "shaded-run",
    label: "2-mile run",
    prompt: "Map me a shaded 2-mile run through greener streets that loops back here.",
    originNodeId: "42429373", // West 13th Street & 5th Avenue
    originCoordinate: [-73.994118, 40.735313],
    destinationNodeId: null,
    destinationCoordinate: null,
  },
] as const;

export const EXAMPLE_REQUESTS = EXAMPLE_JOURNEYS.map((example) => example.prompt);

/** The opening product contract: four supported, rehearsed journeys. */
export const HERO_JOURNEYS = [
  EXAMPLE_JOURNEYS[0],
  EXAMPLE_JOURNEYS[1],
  EXAMPLE_JOURNEYS[2],
  EXAMPLE_JOURNEYS[5],
] as const;
export const HERO_REQUESTS = HERO_JOURNEYS.map((example) => example.prompt);

type HeroExpectedBrief = Pick<TripBrief,
  "shape" | "activity" | "destinationQuery" | "walkingMinutes" | "walkingTimeIntent" | "distanceMiles" | "detourMinutes" | "priorities" | "direction" | "endCondition"
>;

export interface HeroPromptContract {
  id: string;
  prompt: string;
  phraseConsequences: readonly { phrase: string; consequence: keyof HeroExpectedBrief | "unsupported" }[];
  expectedBrief: HeroExpectedBrief;
  evidenceSourceIds: readonly string[];
}

/** Typed truth contract for the four opening shortcuts and their route claims. */
export const HERO_PROMPT_CONTRACTS: readonly HeroPromptContract[] = [
  {
    id: "destination-shade",
    prompt: HERO_JOURNEYS[0].prompt,
    phraseConsequences: [
      { phrase: "Union Square", consequence: "destinationQuery" },
      { phrase: "less direct sun", consequence: "priorities" },
      { phrase: "greener streets", consequence: "priorities" },
      { phrase: "up to five minutes longer", consequence: "detourMinutes" },
    ],
    expectedBrief: {
      shape: "destination",
      activity: "walk",
      destinationQuery: "Union Square",
      walkingMinutes: 25,
      walkingTimeIntent: "target",
      distanceMiles: null,
      detourMinutes: 5,
      priorities: ["shade", "greenery"],
      direction: null,
      endCondition: null,
    },
    evidenceSourceIds: ["openstreetmap", "nyc-building-footprints", "building-shadow-model", "nyc-parks-properties"],
  },
  {
    id: "green-loop",
    prompt: HERO_JOURNEYS[1].prompt,
    phraseConsequences: [
      { phrase: "half an hour", consequence: "walkingMinutes" },
      { phrase: "loop", consequence: "shape" },
      { phrase: "green", consequence: "priorities" },
      { phrase: "somewhere to sit", consequence: "priorities" },
    ],
    expectedBrief: {
      shape: "loop",
      activity: "walk",
      destinationQuery: null,
      walkingMinutes: 30,
      walkingTimeIntent: "target",
      distanceMiles: null,
      detourMinutes: 5,
      priorities: ["greenery", "rest"],
      direction: null,
      endCondition: null,
    },
    evidenceSourceIds: ["openstreetmap", "nyc-parks-properties", "nyc-dot-seating"],
  },
  {
    id: "transit-wander",
    prompt: HERO_JOURNEYS[2].prompt,
    phraseConsequences: [
      { phrase: "half an hour", consequence: "walkingMinutes" },
      { phrase: "wander", consequence: "shape" },
      { phrase: "north", consequence: "direction" },
      { phrase: "greener streets", consequence: "priorities" },
      { phrase: "finish near a subway", consequence: "endCondition" },
    ],
    expectedBrief: {
      shape: "wander",
      activity: "walk",
      destinationQuery: null,
      walkingMinutes: 30,
      walkingTimeIntent: "target",
      distanceMiles: null,
      detourMinutes: 5,
      priorities: ["greenery"],
      direction: "north",
      endCondition: "transit",
    },
    evidenceSourceIds: ["openstreetmap", "nyc-parks-properties", "mta-subway-entrances-2024"],
  },
  {
    id: "shaded-run",
    prompt: HERO_JOURNEYS[3].prompt,
    phraseConsequences: [
      { phrase: "2-mile", consequence: "distanceMiles" },
      { phrase: "run", consequence: "activity" },
      { phrase: "shaded", consequence: "priorities" },
      { phrase: "greener streets", consequence: "priorities" },
      { phrase: "loops back", consequence: "shape" },
    ],
    expectedBrief: {
      shape: "loop",
      activity: "run",
      destinationQuery: null,
      walkingMinutes: 25,
      walkingTimeIntent: "target",
      distanceMiles: 2,
      detourMinutes: 5,
      priorities: ["shade", "greenery"],
      direction: null,
      endCondition: null,
    },
    evidenceSourceIds: ["openstreetmap", "nyc-building-footprints", "building-shadow-model", "nyc-parks-properties"],
  },
];
