import {
  DEFAULT_BRIEF,
  compileTripBrief,
  hasExplicitRoutePriorityIntent,
  type RoutePriority,
  type TripBrief,
} from "./planning/tripBrief";
import { normalizeWalkingNote } from "./preferenceNote";
export { MAX_WALKING_NOTE_CHARACTERS, normalizeWalkingNote } from "./preferenceNote";

export type PreferencePriority = Exclude<RoutePriority, "construction">;

export interface UserPreferences {
  preferredPriorities: PreferencePriority[];
  detourMinutes: 0 | 5 | 10;
  walkingNote: string;
}

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type StoredUserPreferences = (Omit<UserPreferences, "walkingNote"> & { version: 1 })
  | (UserPreferences & { version: 2 });

export const USER_PREFERENCES_STORAGE_KEY = "happy-path:user-preferences";
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredPriorities: [],
  detourMinutes: 5,
  walkingNote: "",
};

const PREFERENCE_PRIORITIES: PreferencePriority[] = ["shade", "greenery", "rest", "water", "restroom"];

function localPreferenceStorage(): PreferenceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadUserPreferences(storage: PreferenceStorage | null = localPreferenceStorage()): UserPreferences | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(USER_PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUserPreferences>;
    if (![1, 2].includes(parsed.version ?? -1) || ![0, 5, 10].includes(parsed.detourMinutes ?? -1)) return null;
    const preferredPriorities = Array.isArray(parsed.preferredPriorities)
      ? PREFERENCE_PRIORITIES.filter((priority) => parsed.preferredPriorities?.includes(priority))
      : [];
    return {
      preferredPriorities,
      detourMinutes: parsed.detourMinutes as 0 | 5 | 10,
      walkingNote: parsed.version === 2 ? normalizeWalkingNote(parsed.walkingNote) : "",
    };
  } catch {
    return null;
  }
}

export function saveUserPreferences(preferences: UserPreferences, storage: PreferenceStorage | null = localPreferenceStorage()) {
  if (!storage) return false;
  try {
    const stored: StoredUserPreferences = {
      version: 2,
      ...preferences,
      walkingNote: normalizeWalkingNote(preferences.walkingNote),
    };
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function clearUserPreferences(storage: PreferenceStorage | null = localPreferenceStorage()) {
  if (!storage) return false;
  try {
    storage.removeItem(USER_PREFERENCES_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function newTripBriefFromPreferences(preferences: UserPreferences | null, departureHour = new Date().getHours()): TripBrief {
  const defaults = preferences ?? DEFAULT_USER_PREFERENCES;
  const walkingNote = normalizeWalkingNote(defaults.walkingNote);
  const notePriorities = walkingNote && hasExplicitRoutePriorityIntent(walkingNote)
    ? compileTripBrief(walkingNote, { ...DEFAULT_BRIEF, priorities: [] }).priorities.filter(
        (priority): priority is PreferencePriority => priority !== "construction",
      )
    : [];
  return {
    ...DEFAULT_BRIEF,
    priorities: [...new Set([...defaults.preferredPriorities, ...notePriorities])],
    detourMinutes: defaults.detourMinutes,
    departureHour,
  };
}
