/**
 * Permit records name streets the way the Street Activity Permit Office writes
 * them; the routing graph names them the way OpenStreetMap does. Neither side is
 * wrong, so both are normalised into one comparable form before matching.
 *
 * "AVENUE OF THE AMERICAS"        -> "6TH AVENUE"
 * "WEST   42 STREET"              -> "WEST 42ND STREET"
 * "Chrystie Street / 2nd Avenue"  -> ["CHRYSTIE STREET", "2ND AVENUE"]
 */

/** Named avenues that carry a numbered alias in the graph. */
const NAMED_ALIASES = new Map([
  ["AVENUE OF THE AMERICAS", "6TH AVENUE"],
  ["AVENUE OF AMERICAS", "6TH AVENUE"],
  ["FASHION AVENUE", "7TH AVENUE"],
  ["MALCOLM X BOULEVARD", "LENOX AVENUE"],
  ["ADAM CLAYTON POWELL JR BOULEVARD", "7TH AVENUE"],
]);

/** Spelled-out ordinals used in permit text but never in the graph. */
const WORD_ORDINALS = new Map([
  ["FIRST", "1ST"], ["SECOND", "2ND"], ["THIRD", "3RD"], ["FOURTH", "4TH"],
  ["FIFTH", "5TH"], ["SIXTH", "6TH"], ["SEVENTH", "7TH"], ["EIGHTH", "8TH"],
  ["NINTH", "9TH"], ["TENTH", "10TH"], ["ELEVENTH", "11TH"], ["TWELFTH", "12TH"],
]);

const SUFFIX_EXPANSIONS = new Map([
  ["ST", "STREET"], ["AVE", "AVENUE"], ["BLVD", "BOULEVARD"],
  ["PL", "PLACE"], ["SQ", "SQUARE"], ["PKWY", "PARKWAY"], ["DR", "DRIVE"],
]);

/** Permit rows abbreviate the compass prefix; the graph never does. */
const DIRECTION_EXPANSIONS = new Map([
  ["W", "WEST"], ["E", "EAST"], ["N", "NORTH"], ["S", "SOUTH"],
]);

/** 1 -> 1ST, 2 -> 2ND, 3 -> 3RD, 11..13 -> TH, everything else -> TH. */
export function ordinal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const remainderOfHundred = number % 100;
  if (remainderOfHundred >= 11 && remainderOfHundred <= 13) return `${number}TH`;
  switch (number % 10) {
    case 1: return `${number}ST`;
    case 2: return `${number}ND`;
    case 3: return `${number}RD`;
    default: return `${number}TH`;
  }
}

/**
 * Reduce one street name to a single comparable token string. Returns "" when
 * the input carries no usable name, so callers can treat it as unresolvable
 * rather than matching everything.
 */
export function normalizeStreetName(raw) {
  if (typeof raw !== "string") return "";
  let text = raw.toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";

  text = text.replace(/½/g, " 1/2 ").replace(/\s+/g, " ").trim();

  const words = text.split(" ").map((word, index) => {
    // Only a leading token is a compass prefix; "AVENUE E" must stay "E".
    if (index === 0) {
      const direction = DIRECTION_EXPANSIONS.get(word);
      if (direction) return direction;
    }
    const expanded = WORD_ORDINALS.get(word);
    if (expanded) return expanded;
    return SUFFIX_EXPANSIONS.get(word) ?? word;
  });
  text = words.join(" ");

  // Permit text carries typo ordinals ("32RD STREET"). Strip whatever suffix is
  // present and re-derive it, so the source's mistake cannot block a match.
  text = text.replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, (_match, digits) => ordinal(digits));

  // "5 AVENUE" / "EAST 42 STREET" -> ordinal form used by the graph.
  text = text.replace(/\b(\d+)\b(?=\s+(?:AVENUE|STREET))/g, (_match, digits) => ordinal(digits));

  const aliased = NAMED_ALIASES.get(text);
  if (aliased) return aliased;

  return text;
}

/**
 * Graph edges sometimes carry a combined name ("Greenwich Street / Trinity
 * Place"). Each side is a legitimate identity for that edge, so expand into all
 * of them rather than picking one.
 */
export function normalizeStreetAliases(raw) {
  if (typeof raw !== "string") return [];
  const parts = raw.split("/").map((part) => normalizeStreetName(part)).filter(Boolean);
  const whole = normalizeStreetName(raw);
  const all = new Set(parts);
  if (whole) all.add(whole);
  return [...all];
}

/**
 * Parse the "A between B and C" clauses of a permit location string.
 * A single permit may list several segments, comma separated.
 */
export function parseLocationClauses(rawLocation) {
  if (typeof rawLocation !== "string" || !rawLocation.trim()) return [];
  const clauses = [];
  const pattern = /([A-Za-z0-9½'\-. ]+?)\s+between\s+([A-Za-z0-9½'\-. ]+?)\s+and\s+([A-Za-z0-9½'\-. ]+?)(?=,|$)/gi;
  let match;
  while ((match = pattern.exec(rawLocation)) !== null) {
    const onStreet = normalizeStreetName(match[1]);
    const fromStreet = normalizeStreetName(match[2]);
    const toStreet = normalizeStreetName(match[3]);
    if (onStreet && fromStreet && toStreet) {
      clauses.push({ onStreet, fromStreet, toStreet });
    }
  }
  return clauses;
}
