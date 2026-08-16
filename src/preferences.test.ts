import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_PREFERENCES,
  USER_PREFERENCES_STORAGE_KEY,
  clearUserPreferences,
  loadUserPreferences,
  newTripBriefFromPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "./preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    value: (key: string) => values.get(key),
  };
}

describe("user preferences", () => {
  it("requires an explicit saved value before preferences exist", () => {
    expect(loadUserPreferences(memoryStorage())).toBeNull();
  });

  it("round-trips supported walking defaults", () => {
    const storage = memoryStorage();
    const preferences: UserPreferences = {
      preferredPriorities: ["shade", "rest", "water"],
      detourMinutes: 10,
      walkingNote: "I like leafy side streets.",
    };

    expect(saveUserPreferences(preferences, storage)).toBe(true);
    expect(loadUserPreferences(storage)).toEqual(preferences);
    expect(JSON.parse(storage.value(USER_PREFERENCES_STORAGE_KEY) ?? "{}")).toMatchObject({ version: 2 });
  });

  it("ignores malformed, unsupported, and duplicated values", () => {
    const storage = memoryStorage({
      [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 1,
        preferredPriorities: ["rest", "construction", "rest", "made-up"],
        detourMinutes: 5,
      }),
    });

    expect(loadUserPreferences(storage)).toEqual({ preferredPriorities: ["rest"], detourMinutes: 5, walkingNote: "" });
  });

  it("falls back safely when local data cannot be read or written", () => {
    const brokenStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };

    expect(loadUserPreferences(brokenStorage)).toBeNull();
    expect(saveUserPreferences(DEFAULT_USER_PREFERENCES, brokenStorage)).toBe(false);
    expect(clearUserPreferences(brokenStorage)).toBe(false);
  });

  it("removes saved preferences when reset", () => {
    const storage = memoryStorage();
    saveUserPreferences({ preferredPriorities: ["shade"], detourMinutes: 5, walkingNote: "" }, storage);
    expect(clearUserPreferences(storage)).toBe(true);
    expect(loadUserPreferences(storage)).toBeNull();
  });

  it("starts a fresh trip with saved defaults without carrying trip-specific intent", () => {
    const brief = newTripBriefFromPreferences({
      preferredPriorities: ["greenery", "restroom"],
      detourMinutes: 10,
      walkingNote: "Water is a bonus.",
    }, 17);

    expect(brief).toMatchObject({
      priorities: ["greenery", "restroom", "water"],
      avoidMappedSteps: false,
      detourMinutes: 10,
      departureHour: 17,
      destinationQuery: null,
      prompt: "",
    });
  });

  it("normalizes a bounded walking note and migrates version one data", () => {
    const storage = memoryStorage({
      [USER_PREFERENCES_STORAGE_KEY]: JSON.stringify({
        version: 2,
        preferredPriorities: [],
        detourMinutes: 5,
        walkingNote: `  ${"leafy ".repeat(60)}  `,
      }),
    });

    const preferences = loadUserPreferences(storage);
    expect(preferences?.walkingNote.length).toBe(240);
    expect(preferences?.walkingNote.startsWith("leafy")).toBe(true);
  });

  it("uses only supported route qualities from the local note", () => {
    const brief = newTripBriefFromPreferences({
      preferredPriorities: ["shade"],
      detourMinutes: 10,
      walkingNote: "Leafy streets, water stops, and benches. Wander west for 50 minutes to my home; I use a wheelchair.",
    }, 17);

    expect(brief).toMatchObject({
      priorities: ["shade", "greenery", "rest", "water"],
      detourMinutes: 10,
      destinationQuery: null,
      walkingMinutes: 25,
      avoidMappedSteps: false,
      direction: null,
      unsupported: [],
      prompt: "",
      interpretedBy: "controls",
    });
  });
});
