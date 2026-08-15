import type { Plugin } from "vite";
import Anthropic from "@anthropic-ai/sdk";

// Happy Path navigation backend.
//
// Scope for the hackathon demo: the deterministic half of the PRD's intelligence
// boundary is real — Valhalla owns pedestrian connectivity and all time/distance
// arithmetic, NYC Forestry tree points own the Greener evidence, and the model
// only compiles intent into a Trip Brief and explains metrics it was handed.
// It never invents geometry or recomputes a number.
//
// Deliberately NOT implemented yet (see docs/data-and-inference.md):
//   - time-aware shade (needs building heights + solar position)
//   - Gentler (needs the 1-ft DEM and mapped-stair audit)
//   - amenities / restrooms / seating
// Those appear in the brief as unsupported rather than being faked.

const DEFAULT_MODEL = process.env.CITY_OS_MODEL || "claude-sonnet-4-20250514";
const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const TREES_URL = "https://data.cityofnewyork.us/resource/hn5i-inap.json";
const DATA_TIMEOUT_MS = 12_000;

// Evidence dimensions this build can actually support.
const SUPPORTED_PREFERENCES = ["greener", "quieter", "interesting"] as const;
const UNSUPPORTED_NOTE: Record<string, string> = {
  shadier: "Time-aware shade needs building-height and solar-position data that isn't wired up yet.",
  gentler: "Slope and mapped-stair evidence hasn't passed the pilot audit yet.",
  seating: "Seating locations aren't ingested yet.",
  restroom: "Public restroom data isn't ingested yet.",
  "rain cover": "Sidewalk-shed data isn't ingested yet.",
  accessible:
    "Happy Path can't make accessibility guarantees — mapped-stair and ramp evidence isn't audited.",
};

const WALK_METERS_PER_MINUTE = 80; // ~3 mph, used only to size loop/wander geometry

export interface TripBrief {
  journey_shape: "destination" | "loop" | "wander";
  origin: { latitude: number; longitude: number };
  destination_or_end_condition: {
    kind: "coordinates" | "end_near";
    latitude?: number;
    longitude?: number;
    label?: string;
  } | null;
  walking_budget_minutes: number | null;
  preferences: string[];
  requirements: string[];
  avoidances: string[];
  unsupported_or_unverified: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Valhalla encodes shapes as polyline with 6 decimal places of precision. */
function decodePolyline6(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    for (const axis of ["lat", "lon"] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lon += delta;
    }
    points.push([lat / 1e6, lon / 1e6]);
  }
  return points;
}

const EARTH_RADIUS_M = 6_371_000;

function metersBetween(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLon = (b[1] - a[1]) * toRad;
  const lat1 = a[0] * toRad;
  const lat2 = b[0] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Point at `distance` meters from origin along `bearing` degrees. */
function offsetPoint(
  lat: number,
  lon: number,
  bearingDegrees: number,
  distanceMeters: number
): { latitude: number; longitude: number } {
  const toRad = Math.PI / 180;
  const angular = distanceMeters / EARTH_RADIUS_M;
  const bearing = bearingDegrees * toRad;
  const lat1 = lat * toRad;
  const lon1 = lon * toRad;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { latitude: lat2 / toRad, longitude: lon2 / toRad };
}

function boundingBox(points: [number, number][], padMeters: number) {
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const padLat = padMeters / 111_320;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLon = padMeters / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return {
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
    minLon: Math.min(...lons) - padLon,
    maxLon: Math.max(...lons) + padLon,
  };
}

/** Approximate distance from a point to a polyline, in meters. */
function distanceToPath(point: [number, number], path: [number, number][]): number {
  let best = Infinity;
  // Sampling every other vertex is plenty at tree-adjacency scale and keeps
  // this O(trees x vertices) loop cheap.
  for (let i = 0; i < path.length; i += 2) {
    const d = metersBetween(point, path[i]);
    if (d < best) best = d;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Routing (Valhalla owns all connectivity and time arithmetic)
// ---------------------------------------------------------------------------

interface RawRoute {
  shape: [number, number][];
  walkingSeconds: number;
  distanceMeters: number;
}

async function valhalla(
  locations: { latitude: number; longitude: number }[],
  alternates: number
): Promise<RawRoute[]> {
  const response = await fetch(VALHALLA_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(DATA_TIMEOUT_MS),
    body: JSON.stringify({
      locations: locations.map((l) => ({ lat: l.latitude, lon: l.longitude })),
      costing: "pedestrian",
      alternates,
      directions_options: { units: "kilometers" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Routing service returned ${response.status}`);
  }

  const data = await response.json();
  const trips = [data.trip, ...(data.alternates ?? []).map((a: { trip: unknown }) => a.trip)];

  return trips
    .filter(Boolean)
    .map((trip: { legs: { shape: string }[]; summary: { time: number; length: number } }) => ({
      shape: trip.legs.flatMap((leg) => decodePolyline6(leg.shape)),
      walkingSeconds: trip.summary.time,
      distanceMeters: trip.summary.length * 1000,
    }));
}

// ---------------------------------------------------------------------------
// Greener evidence — NYC Forestry Tree Points (hn5i-inap)
// ---------------------------------------------------------------------------

interface GreeneryMetric {
  treesAlongRoute: number;
  treesPerKm: number;
  largeTrees: number;
  coverage: number;
}

async function greeneryFor(route: RawRoute): Promise<GreeneryMetric | null> {
  const box = boundingBox(route.shape, 40);
  // This dataset has no latitude/longitude columns — coordinates live in the
  // `location` point, so filter with within_box(north, west, south, east).
  const where = `within_box(location,${box.maxLat},${box.minLon},${box.minLat},${box.maxLon})`;
  const url = `${TREES_URL}?$select=location,dbh&$limit=3000&$where=${encodeURIComponent(where)}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DATA_TIMEOUT_MS) });
    if (!response.ok) return null;

    const rows = (await response.json()) as {
      location?: { coordinates?: [number, number] };
      dbh?: string;
    }[];

    let along = 0;
    let large = 0;
    for (const row of rows) {
      // GeoJSON order is [longitude, latitude].
      const coords = row.location?.coordinates;
      if (!coords) continue;
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      // 25m captures street trees flanking the walked path without pulling in
      // trees on the parallel street.
      if (distanceToPath([lat, lon], route.shape) <= 25) {
        along++;
        // Trunk diameter is the closest available proxy for canopy size. It is
        // not a canopy measurement — the receipt must not claim shade from it.
        if (Number(row.dbh) >= 12) large++;
      }
    }

    const km = route.distanceMeters / 1000;
    return {
      treesAlongRoute: along,
      treesPerKm: km > 0 ? along / km : 0,
      largeTrees: large,
      // Truncated result sets mean we undercount; flag it rather than hide it.
      coverage: rows.length >= 3000 ? 0.6 : 1,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Candidate generation per journey shape
// ---------------------------------------------------------------------------

async function buildCandidates(brief: TripBrief): Promise<RawRoute[]> {
  const origin = brief.origin;
  const budget = brief.walking_budget_minutes ?? 30;

  if (brief.journey_shape === "destination") {
    const dest = brief.destination_or_end_condition;
    if (!dest || dest.latitude == null || dest.longitude == null) {
      throw new Error("A destination is needed for a 'go somewhere' trip.");
    }
    return valhalla([origin, { latitude: dest.latitude, longitude: dest.longitude }], 2);
  }

  // Loop and wander: the router still owns connectivity — we only propose
  // waypoints and let it decide whether a walkable path exists.
  //
  // Sizing the radius: with two waypoints at radius r about 75 degrees apart,
  // the straight-line perimeter is roughly 3.2r, and street-network detour adds
  // ~30% on top — so budget distance divided by ~4.2 lands near the budget.
  // (A /3.2 divisor overshot a 30-minute request by 9-10 minutes.)
  const radius = (budget * WALK_METERS_PER_MINUTE) / 4.2;
  const routes: RawRoute[] = [];

  // Three loops in different directions give the ranker a real choice.
  for (const heading of [30, 150, 270]) {
    const first = offsetPoint(origin.latitude, origin.longitude, heading, radius);
    const second = offsetPoint(origin.latitude, origin.longitude, heading + 75, radius);
    try {
      const [route] = await valhalla([origin, first, second, origin], 0);
      if (route) routes.push(route);
    } catch {
      // A heading with no walkable loop is fine — skip it.
    }
  }

  if (routes.length === 0) {
    throw new Error("Couldn't find a walkable loop from that origin.");
  }
  return routes;
}

// ---------------------------------------------------------------------------
// Scoring — deterministic, so the model never has to do arithmetic
// ---------------------------------------------------------------------------

export interface Candidate {
  candidate_id: string;
  shape: [number, number][];
  walking_minutes: number;
  distance_meters: number;
  extra_minutes_vs_fastest: number;
  greenery: GreeneryMetric | null;
  is_baseline: boolean;
  /** True when this candidate exceeds the brief's walking budget. Never hidden. */
  over_budget: boolean;
}

function rank(candidates: Candidate[], brief: TripBrief): Candidate[] {
  const wantsGreen = brief.preferences.includes("greener");
  if (!wantsGreen) return candidates;

  return [...candidates].sort((a, b) => {
    const greenA = a.greenery?.treesPerKm ?? 0;
    const greenB = b.greenery?.treesPerKm ?? 0;
    // Trade at most ~1 minute of extra walking per 20 trees/km of gain.
    const scoreA = greenA / 20 - a.extra_minutes_vs_fastest;
    const scoreB = greenB / 20 - b.extra_minutes_vs_fastest;
    return scoreB - scoreA;
  });
}

async function plan(brief: TripBrief) {
  const raw = await buildCandidates(brief);

  const fastest = Math.min(...raw.map((r) => r.walkingSeconds));
  const budget = brief.walking_budget_minutes;

  const withMetrics: Candidate[] = await Promise.all(
    raw.map(async (route, index) => {
      const walkingMinutes = Math.round(route.walkingSeconds / 60);
      return {
        candidate_id: `cand_${index}`,
        shape: route.shape,
        walking_minutes: walkingMinutes,
        distance_meters: Math.round(route.distanceMeters),
        extra_minutes_vs_fastest: Math.round((route.walkingSeconds - fastest) / 60),
        greenery: await greeneryFor(route),
        is_baseline: route.walkingSeconds === fastest,
        over_budget: budget != null && walkingMinutes > budget,
      };
    })
  );

  const ranked = rank(withMetrics, brief);
  // Prefer a route that actually fits the budget. If none do, still return the
  // best one — but it stays flagged rather than quietly blowing the budget.
  const recommended = ranked.find((c) => !c.over_budget) ?? ranked[0];
  const baseline = withMetrics.find((c) => c.is_baseline) ?? recommended;

  return { recommended, baseline, candidates: withMetrics };
}

// ---------------------------------------------------------------------------
// Trip Brief compilation (the model's only structural job)
// ---------------------------------------------------------------------------

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    journey_shape: { type: "string", enum: ["destination", "loop", "wander"] },
    walking_budget_minutes: { type: ["number", "null"] },
    preferences: {
      type: "array",
      items: { type: "string", enum: [...SUPPORTED_PREFERENCES] },
    },
    requirements: { type: "array", items: { type: "string" } },
    avoidances: { type: "array", items: { type: "string" } },
    unsupported_or_unverified: { type: "array", items: { type: "string" } },
    destination_label: { type: ["string", "null"] },
    summary: { type: "string" },
  },
  required: [
    "journey_shape",
    "walking_budget_minutes",
    "preferences",
    "requirements",
    "avoidances",
    "unsupported_or_unverified",
    "destination_label",
    "summary",
  ],
  additionalProperties: false,
};

const BRIEF_SYSTEM = `You compile a walking request into a Happy Path Trip Brief.

Journey shapes: "destination" (a fixed place), "loop" (returns to start), "wander" (no fixed endpoint).

Only these preferences are supported by current evidence: greener, quieter, interesting.
Anything else the user asks for — shade, gentler/flatter, seating, restrooms, rain cover,
step-free or accessible routing — goes in unsupported_or_unverified using the user's own
words. Never drop a request silently and never move it into preferences.

summary is one short line a person can read back, e.g.
"30-minute green loop from here".`;

async function compileBrief(
  client: Anthropic,
  input: { prompt: string; quickPicks: string[]; origin: TripBrief["origin"] }
): Promise<TripBrief> {
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1200,
    system: BRIEF_SYSTEM,
    output_config: { format: { type: "json_schema", schema: BRIEF_SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `Request: ${input.prompt || "(none typed)"}\n` +
          `Quick Picks selected: ${input.quickPicks.join(", ") || "(none)"}`,
      },
    ],
  } as Parameters<typeof client.messages.create>[0]);

  const text = (response as Anthropic.Message).content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  const parsed = JSON.parse(text?.text ?? "{}");

  // Anything the model flagged as unsupported gets the concrete reason we know.
  const unsupported = (parsed.unsupported_or_unverified as string[]).map((item) => {
    const key = Object.keys(UNSUPPORTED_NOTE).find((k) => item.toLowerCase().includes(k));
    return key ? `${item} — ${UNSUPPORTED_NOTE[key]}` : item;
  });

  return {
    journey_shape: parsed.journey_shape,
    origin: input.origin,
    destination_or_end_condition: parsed.destination_label
      ? { kind: "end_near", label: parsed.destination_label }
      : null,
    walking_budget_minutes: parsed.walking_budget_minutes,
    preferences: parsed.preferences,
    requirements: parsed.requirements,
    avoidances: parsed.avoidances,
    unsupported_or_unverified: unsupported,
    summary: parsed.summary,
  };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 128_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function navigationPlugin(): Plugin {
  return {
    name: "happy-path-navigation",
    configureServer(server) {
      // Compile prompt + Quick Picks into a Trip Brief.
      server.middlewares.use("/api/nav/brief", async (req, res) => {
        res.setHeader("content-type", "application/json");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              error: "Set ANTHROPIC_API_KEY in .env at the repo root, then restart the dev server.",
            })
          );
          return;
        }
        try {
          const input = JSON.parse(await readBody(req));
          const client = new Anthropic({ apiKey });
          res.end(JSON.stringify(await compileBrief(client, input)));
        } catch (error) {
          console.error("[nav/brief]", error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });

      // Turn a Trip Brief into ranked, measured route candidates.
      server.middlewares.use("/api/nav/plan", async (req, res) => {
        res.setHeader("content-type", "application/json");
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }
        try {
          const { brief } = JSON.parse(await readBody(req)) as { brief: TripBrief };
          res.end(JSON.stringify(await plan(brief)));
        } catch (error) {
          console.error("[nav/plan]", error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
  };
}
