export const MAX_WALKING_NOTE_CHARACTERS = 240;

export function normalizeWalkingNote(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_WALKING_NOTE_CHARACTERS) : "";
}
