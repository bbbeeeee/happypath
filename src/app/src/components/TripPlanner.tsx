import { useCallback, useEffect, useState } from "react";
import { Footprints, X } from "lucide-react";
import type { MapLocation } from "./StreetMap";

// A route handed to the map for drawing. Deliberately carries no metrics —
// StreetMap decides only how to style a variant, never what a number means.
export interface RouteOverlay {
  id: string;
  shape: [number, number][];
  variant: "recommended" | "baseline" | "alternate";
}

interface Greenery {
  treesAlongRoute: number;
  treesPerKm: number;
  largeTrees: number;
  coverage: number;
}

interface Candidate {
  candidate_id: string;
  shape: [number, number][];
  walking_minutes: number;
  distance_meters: number;
  extra_minutes_vs_fastest: number;
  greenery: Greenery | null;
  is_baseline: boolean;
  over_budget: boolean;
}

interface TripBrief {
  journey_shape: "destination" | "loop" | "wander";
  walking_budget_minutes: number | null;
  preferences: string[];
  requirements: string[];
  avoidances: string[];
  unsupported_or_unverified: string[];
  summary: string;
}

interface Plan {
  recommended: Candidate;
  baseline: Candidate;
  candidates: Candidate[];
}

// Only the shapes and preferences this build can actually evidence. Anything
// else the user asks for comes back in the brief as unsupported.
const SHAPES: { value: TripBrief["journey_shape"]; label: string }[] = [
  { value: "destination", label: "Go somewhere" },
  { value: "loop", label: "Loop" },
  { value: "wander", label: "Wander" },
];

const DURATIONS = [15, 30, 45, 60];
const FEELS = ["greener", "quieter", "interesting"];

interface TripPlannerProps {
  origin: MapLocation;
  onRoutesChange: (routes: RouteOverlay[]) => void;
  selectedRouteId?: string;
  onRouteSelect: (id: string) => void;
  onClose: () => void;
}

export function TripPlanner({
  origin,
  onRoutesChange,
  selectedRouteId,
  onRouteSelect,
  onClose,
}: TripPlannerProps) {
  const [prompt, setPrompt] = useState("");
  const [shape, setShape] = useState<TripBrief["journey_shape"]>("loop");
  const [minutes, setMinutes] = useState(30);
  const [feels, setFeels] = useState<string[]>(["greener"]);
  const [brief, setBrief] = useState<TripBrief | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<"idle" | "compiling" | "routing">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggleFeel = (feel: string) =>
    setFeels((current) =>
      current.includes(feel) ? current.filter((f) => f !== feel) : [...current, feel]
    );

  // Push routes up to the map whenever a new plan lands.
  useEffect(() => {
    if (!plan) {
      onRoutesChange([]);
      return;
    }
    // Recommended wins over baseline when one candidate is both — which happens
    // whenever the best-fit route is also the fastest.
    onRoutesChange(
      plan.candidates.map((candidate) => ({
        id: candidate.candidate_id,
        shape: candidate.shape,
        variant:
          candidate.candidate_id === plan.recommended.candidate_id
            ? "recommended"
            : candidate.is_baseline
              ? "baseline"
              : "alternate",
      }))
    );
    onRouteSelect(plan.recommended.candidate_id);
  }, [plan, onRoutesChange, onRouteSelect]);

  // Quick Picks alone are enough to route. This is the no-model path: it keeps
  // the planner fully usable when /api/nav/brief is unavailable, and it is the
  // same Trip Brief shape the model would have produced.
  const briefFromQuickPicks = useCallback(
    (note?: string): TripBrief => ({
      journey_shape: shape,
      walking_budget_minutes: minutes,
      preferences: feels,
      requirements: [],
      avoidances: [],
      unsupported_or_unverified: note ? [note] : [],
      summary: `${minutes}-minute ${feels.join(" + ")} ${
        SHAPES.find((s) => s.value === shape)?.label.toLowerCase() ?? shape
      }`,
    }),
    [shape, minutes, feels]
  );

  const run = useCallback(async () => {
    setError(null);
    setStatus("compiling");
    setPlan(null);

    try {
      // Quick Picks and typed text are equal inputs into one brief.
      const quickPicks = [
        SHAPES.find((s) => s.value === shape)?.label ?? "",
        `${minutes} minutes`,
        ...feels,
      ];

      let compiled: TripBrief;
      try {
        const briefResponse = await fetch("/api/nav/brief", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, quickPicks, origin }),
        });
        const payload = await briefResponse.json();
        if (!briefResponse.ok) throw new Error(payload.error ?? "brief unavailable");
        compiled = payload;
      } catch {
        // Fall back to the Quick Picks brief rather than failing the whole plan.
        // Say so plainly — a typed request that wasn't read must not look honored.
        compiled = briefFromQuickPicks(
          prompt.trim()
            ? `"${prompt.trim()}" wasn't interpreted — the language service is unavailable, so only the Quick Picks below were used.`
            : undefined
        );
      }
      setBrief(compiled);

      setStatus("routing");
      const planResponse = await fetch("/api/nav/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief: { ...compiled, origin } }),
      });
      const planned = await planResponse.json();
      if (!planResponse.ok) throw new Error(planned.error ?? "Couldn't build a route.");
      setPlan(planned);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("idle");
    }
  }, [prompt, shape, minutes, feels, origin, briefFromQuickPicks]);

  const busy = status !== "idle";
  const recommended = plan?.recommended;
  const baseline = plan?.baseline;
  // Only a genuinely different route makes the comparison meaningful.
  const hasComparison =
    recommended && baseline && recommended.candidate_id !== baseline.candidate_id;

  const greenDelta =
    hasComparison && recommended.greenery && baseline.greenery
      ? recommended.greenery.treesPerKm - baseline.greenery.treesPerKm
      : null;

  return (
    <aside className="tripplanner">
      <header className="tripplanner-titlebar">
        <Footprints size={13} aria-hidden="true" />
        <h2>Plan a walk</h2>
        <button className="icon-button" onClick={onClose} title="Close planner">
          <X size={14} />
        </button>
      </header>

      <div className="tripplanner-body">
        <label className="tripplanner-field">
          <span>How do you want to spend your time?</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="A green 30-minute loop with somewhere to sit…"
            rows={2}
          />
        </label>

        <div className="tripplanner-group">
          <h3>Shape</h3>
          <div className="tripplanner-chips">
            {SHAPES.map((option) => (
              <button
                key={option.value}
                className={shape === option.value ? "active" : ""}
                onClick={() => setShape(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tripplanner-group">
          <h3>Walking time</h3>
          <div className="tripplanner-chips">
            {DURATIONS.map((value) => (
              <button
                key={value}
                className={minutes === value ? "active" : ""}
                onClick={() => setMinutes(value)}
              >
                {value} min
              </button>
            ))}
          </div>
        </div>

        <div className="tripplanner-group">
          <h3>Feel</h3>
          <div className="tripplanner-chips">
            {FEELS.map((feel) => (
              <button
                key={feel}
                className={feels.includes(feel) ? "active" : ""}
                onClick={() => toggleFeel(feel)}
              >
                {feel}
              </button>
            ))}
          </div>
        </div>

        <button className="tripplanner-go" onClick={run} disabled={busy}>
          {status === "compiling"
            ? "Reading your request…"
            : status === "routing"
              ? "Finding routes…"
              : "Plan it"}
        </button>

        {error && <div className="tripplanner-error">{error}</div>}

        {brief && (
          <div className="tripplanner-brief">
            <h3>Trip brief</h3>
            <p className="tripplanner-summary">{brief.summary}</p>
            {brief.unsupported_or_unverified.length > 0 && (
              <div className="tripplanner-unsupported">
                <strong>Can't evidence yet</strong>
                <ul>
                  {brief.unsupported_or_unverified.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {recommended && (
          <div className="tripplanner-receipt">
            <h3>Your Happy Path</h3>
            <p className="tripplanner-headline">
              {recommended.walking_minutes} min ·{" "}
              {(recommended.distance_meters / 1000).toFixed(1)} km
              {hasComparison && recommended.extra_minutes_vs_fastest > 0
                ? ` · ${recommended.extra_minutes_vs_fastest} min longer than direct`
                : hasComparison
                  ? " · no longer than direct"
                  : ""}
            </p>

            {recommended.over_budget && brief?.walking_budget_minutes != null && (
              <p className="tripplanner-overbudget">
                No candidate fit your {brief.walking_budget_minutes}-minute budget — the
                shortest walkable option here is {recommended.walking_minutes} minutes.
              </p>
            )}

            <h4>Why it fits</h4>
            <ul>
              {recommended.greenery ? (
                <li>
                  {recommended.greenery.treesAlongRoute} street trees along the route (
                  {recommended.greenery.treesPerKm.toFixed(0)} per km,{" "}
                  {recommended.greenery.largeTrees} with a trunk over 12 in)
                </li>
              ) : (
                <li>Tree data unavailable for this area — greenery not ranked.</li>
              )}
              {greenDelta !== null && greenDelta > 0 && (
                <li>
                  {greenDelta.toFixed(0)} more trees per km than the most direct route
                </li>
              )}
            </ul>

            {plan && plan.candidates.length > 1 && (
              <>
                <h4>Candidates</h4>
                <div className="tripplanner-candidates">
                  {plan.candidates.map((candidate) => (
                    <button
                      key={candidate.candidate_id}
                      className={
                        selectedRouteId === candidate.candidate_id ? "active" : ""
                      }
                      onClick={() => onRouteSelect(candidate.candidate_id)}
                    >
                      <span>
                        {candidate.walking_minutes} min
                        {candidate.is_baseline ? " · direct" : ""}
                        {candidate.over_budget ? " · over budget" : ""}
                      </span>
                      <span className="tripplanner-candidate-green">
                        {candidate.greenery
                          ? `${candidate.greenery.treesPerKm.toFixed(0)} trees/km`
                          : "—"}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <h4>Evidence</h4>
            <p className="tripplanner-provenance">
              Walking network, time and distance from OpenStreetMap via Valhalla. Street
              trees from NYC Forestry Tree Points (hn5i-inap)
              {recommended.greenery && recommended.greenery.coverage < 1
                ? " — tree query truncated, counts are a lower bound"
                : ""}
              . Trunk diameter is a proxy for tree size, not a canopy or shade measurement.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
