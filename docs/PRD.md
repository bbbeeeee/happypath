# Happy Path

> Canonical product requirements document for the hackathon MVP.

| Field | Decision |
| --- | --- |
| Product | Happy Path |
| Promise | Turn the time someone has, where they are, and what they enjoy into an explainable way to spend time moving through the city |
| Initial mode | Walking |
| Pilot | One bounded, data-rich NYC area |
| Primary experience | Consumer city-time planner |
| Planning extension | Detour, after the consumer MVP |
| Data companion | [Data and inference specification](data-and-inference.md) |
| Last updated | 2026-08-15 |

## 1. Product brief

**Happy Path turns intent into a path through the city.**

A person can type what they want, tap preset preferences, or combine both. Happy Path builds a route-based plan, explains its choices and tradeoffs, and gets more personal as the person explicitly saves, chooses, and refines.

Examples:

> “Get me to MoMA, but keep it easy for my parents.”

> “Give me a green 30-minute loop with somewhere to sit.”

> “I have 45 minutes in Bushwick. Wander through interesting streets and finish near the L.”

These examples describe the product language; the MVP supports only requests inside the selected pilot area.

Happy Path is not a chatbot that returns a list of generic recommendations. It is an **intent-to-path engine**: natural language, quick controls, and remembered preferences produce one transparent trip brief that controls a data-grounded routing system.

### Product promise

> **Tell Happy Path how much time you have and what kind of experience you want. It will plan a route-based way to spend that time and learn what fits you.**

## 2. Problem and thesis

Navigation products usually assume a known destination and optimize for time. Discovery products suggest places, but rarely turn those suggestions into a coherent, feasible street-level journey.

That leaves a gap between “where should I go?” and “how should I move through the city?”

Happy Path should answer:

- What is a good way to spend the next 20, 30, or 60 minutes from here?
- Can I reach my destination through streets that better fit this moment?
- Can I walk without choosing a precise endpoint first?
- Which route fits my comfort needs and personal taste?
- What did the extra time buy, and why should I trust the recommendation?

NYC has useful data about streets, shade, greenery, slope, stairs, construction, amenities, public spaces, and places. Happy Path turns that fragmented evidence into an actual journey.

### Product principles

1. **The route is the spine.** Places and activities may become stops, but every suggestion must form a feasible journey within the user’s time and constraints.
2. **One sentence or a few taps should be enough.** Natural language and quick controls are equal entry points into the same editable trip brief.
3. **Personalization is earned and visible.** Happy Path learns tendencies from explicit evidence, shows when it uses them, and lets the user change or forget them.
4. **Inference ranks; it does not invent facts.** Language intelligence interprets intent and taste. Geospatial systems determine where a route can actually go.
5. **Every recommendation has reasons.** The user sees what improved, what was sacrificed, which evidence mattered, and where confidence is limited.
6. **There is no universal block score.** A street is useful only relative to a person, journey, and moment.

## 3. Journey shapes

Happy Path supports three ways to spend time in the city.

| Shape | User knows | Happy Path decides |
| --- | --- | --- |
| **Go somewhere** | A fixed destination | The best-fit route to it |
| **Loop** | A walking duration | A route that returns to the start |
| **Wander** | A direction, area, endpoint type, or total outing budget | Both the endpoint and path |

The trip brief must distinguish:

- walking time from total outing time;
- fixed destination from destination area or endpoint type;
- loop from one-way journey;
- soft preferences from hard requirements;
- route time from time spent at optional stops.

## 4. One brief, two ways to shape it

Preset controls and natural language are not separate modes. Both edit one canonical **Trip Brief**.

```text
quick tags ───────┐
                  ├──→ editable Trip Brief ──→ route-based plan
natural language ┘
```

### 4.1 Planner entry

The home screen contains:

1. current or editable origin;
2. one prominent prompt: **“How do you want to spend your time?”**;
3. a small row of Quick Picks;
4. the current Trip Brief as editable tags.

The first screen should feel useful before the user types. It should not become a giant filter panel.

### 4.2 Quick Picks

| Group | Candidate controls |
| --- | --- |
| Time | Walk 15, 30, 45, or 60 min; Outing 30, 45, or 60 min; custom |
| Shape | Go somewhere, Loop, Wander |
| Feel | Greener, Shadier, Gentler, Quieter, Livelier, Interesting |
| Needs | Seating, Restroom, Avoid mapped stairs |
| End near | Transit, Coffee, Food, Park |

Only controls supported credibly in the pilot should appear. The MVP can expose a smaller set while keeping this vocabulary stable.

Quick Picks may be prefilled from the current context or an opted-in preference profile. Prefilled tags remain visible, labeled, and removable.

### 4.3 Natural-language planning

The user can type a complete request or add detail after selecting tags:

> “Toward Fifth Avenue, end by a bathroom, and make the last few blocks lively.”

The language layer returns a patch to the same Trip Brief. It does not create a second hidden interpretation.

Typing and tapping stay synchronized:

- language can select, weight, or remove a tag;
- changing a tag updates the brief without requiring a rewritten prompt;
- follow-up language patches the existing brief instead of reparsing the trip from scratch;
- the UI shows meaningful changes such as **“Quiet removed · Lively added.”**

### 4.4 Trip Brief

| Field | Example |
| --- | --- |
| Journey shape | Wander |
| Origin | Current location |
| Destination or end condition | End near subway |
| Walking budget | 25 minutes |
| Total outing budget | 45 minutes |
| Stop allocation | Up to 20 minutes across one or two stops |
| Departure time | Now |
| Priorities | Green, gentle, interesting |
| Requirements | Restroom required |
| Avoid | Mapped stairs |
| Flexibility | Up to 5 extra minutes |
| Taste anchors | Places similar to Fort Greene Park |
| Unsupported or unverified | None |

Each field also carries compact metadata:

- `input_origin`: `prompt`, `quick_pick`, `refinement`, `saved_preference`, or `default`;
- `requirement_state`: `prefer`, `required`, or `avoid`, when applicable;
- `interpretation_confidence`: `confirmed`, `high`, `medium`, or `low`.

For an outing, estimated walking time plus visible stop dwell time must not exceed the total outing budget. If the requested plan does not fit, Happy Path shortens the route, reduces or shortens stops, or asks the user to change the brief. It never silently exceeds the budget.

Example summary:

```text
30-minute wander · toward SoHo · green + gentle
end near subway · restroom required · up to 5 extra minutes
```

### 4.5 Precedence and ambiguity

The system resolves inputs in this order:

1. the user’s latest explicit edit when inputs conflict, including removing or downgrading a requirement;
2. remaining confirmed hard requirements;
3. other compatible prompt and tag inputs;
4. saved preferences, used only to fill gaps;
5. product defaults.

If a typed request contradicts a selected soft tag, the latest explicit action wins and the change is visible. Compatible tension can become route structure, such as **quiet for most of the walk, lively near the end**.

Happy Path asks at most one question before routing, and only when ambiguity changes the journey shape, time budget, endpoint, or hard requirement.

Hard requirements are never silently weakened by the system. The user can remove or downgrade one explicitly. If no verified route satisfies a required feature, the product explains the gap and offers explicit alternatives.

Unsupported or unverified requests remain visible in the Trip Brief. A required unsupported feature blocks generation until the user changes or acknowledges it; a soft request may be omitted only after the product shows what it cannot support. No requested constraint disappears silently.

## 5. Plan, explain, and refine

### 5.1 Generate

From the Trip Brief, Happy Path creates valid candidate endpoints and routes within the user’s time budget.

The result contains:

1. one recommended Happy Path;
2. a fastest or most-direct baseline when relevant;
3. at most one meaningful alternative when there is a real tradeoff;
4. zero to three route-compatible stops or anchors.

Every stop has an editable dwell estimate. Candidate generation enforces both the walking budget and, when present, the total outing budget across walking and dwell time.

The default map shows one visually dominant Happy Path. Estimated shade appears as an ambient layer; discrete route-relevant amenities, constraints, and anchors appear as icons. The first view prioritizes required stops and evidence that materially affected the recommendation, then shows other significant request-relevant evidence when it fits without collisions. Secondary or overlapping detail moves to optional toggles or the route receipt. Intelligence may propose semantic display priority, while deterministic layout rules control density and overlap.

### 5.2 Route receipt

```text
YOUR HAPPY PATH

32 minutes · 4 minutes longer than direct

Why it fits
• more tree-lined side streets
• 24 feet less climbing
• passes a saved independent bookstore
• ends 2 minutes from the subway

Tradeoff
One busier block near the endpoint

Confidence
High for time and slope · Medium for current shade
```

The receipt separates:

- measured route facts;
- inferred personal fit;
- tradeoffs and constraints;
- data provenance, freshness, and confidence.

Tapping a segment answers **“Why this street?”** with the evidence that affected the decision.

### 5.3 Refine

The user can type or tap a change:

> “Quieter, but keep the bookstore and restroom.”

The route recomputes from the updated brief and shows the delta:

```text
+2 minutes · less commercial frontage
bookstore retained · restroom retained
```

Conversational recomputation is the main product “aha.”

## 6. Intelligence boundary

```text
prompt + tags + saved preferences
              ↓
       typed Trip Brief
              ↓
valid endpoint and route candidates
              ↓
hard city data + inferred route qualities
              ↓
contextual ranking and evidence checks
              ↓
route receipt + refinement
```

| System | Responsibilities |
| --- | --- |
| Language and preference layer | Interpret colloquial intent, patch the Trip Brief, map taste anchors to supported features, rank close candidates, and explain tradeoffs |
| Geospatial routing layer | Enforce mapped pedestrian connectivity, time, distance, slope, stairs, detour limits, route continuity, and candidate generation |
| Evidence layer | Track source, observation date, derivation, official versus inferred values, confidence, and user corrections |

Inference never invents paths, physical conditions, travel-time arithmetic, or accessibility guarantees. It can propose route-compatible stops and rank valid candidates only within the supplied evidence and constraints.

The companion [Data and inference specification](data-and-inference.md) defines source IDs, feature derivations, validation gates, and the claims each evidence type may support.

## 7. Personalization and learning

Happy Path learns at three horizons.

### 7.1 This trip: immediate adaptation

Prompts, tag changes, and refinements update the current Trip Brief immediately. They are session context, not permanent facts about the person.

### 7.2 Usually: explicit preference memory

The user may opt in to remember:

- route qualities they often prefer or avoid;
- liked places, streets, routes, or venue types;
- how much extra time they usually accept;
- explicit **More like this** and **Less like this** feedback.

On later trips, Happy Path uses these as soft defaults and prefilled tags. The current request always outranks history.

For the MVP, this opt-in profile is stored only in the browser. It requires no account and can be viewed, edited, paused, or cleared from one place.

MVP example:

1. The user asks for greener, quieter side streets.
2. They accept or refine the route.
3. Happy Path asks: **“Remember that you prefer tree-lined side streets, even when they add a few minutes?”**
4. On a later trip, those tags are prefilled with a **From your preferences** label.
5. The new route explains: **“Prioritized tree-lined side streets because you asked us to remember them.”**
6. Removing the tag or clearing the preference restores the unpersonalized ranking.

This is a truthful hackathon demonstration of learning: Happy Path understands what the user wants now and remembers what they explicitly choose.

### 7.3 Over time: learned ranking

A later system can infer low-confidence soft preferences from repeated, consistent choices between known alternatives:

- routes selected over other displayed candidates;
- saved or skipped stops;
- repeated refinements;
- post-walk ratings;
- repeated acceptance of the same tradeoff.

One interaction never becomes a personal fact. Inferred preferences remain weaker than explicit ones and must be confirmable, dismissible, and easy to clear.

Trip abandonment, GPS deviation, failure to finish, and one-off accessibility context are not safe preference signals.

Happy Path learns tendencies, not identities. It may remember **“often chooses tree-lined side streets”**; it must not infer disability, health, home, work, religion, income, or personality.

### 7.4 Minimal preference record

```text
feature or taste anchor
direction and weight
memory_status: saved or inferred
evidence_origin: remember_this, pinned_tag, saved_place, or repeated_choice
confidence and evidence count
created and last-used time
enabled status
```

The profile stores structured preferences rather than complete location history or raw trip narratives.

## 8. Route features

The MVP needs two or three route dimensions that are credible in the pilot, plus personal taste anchors. Time-aware shade is the first proposed measurable proof; one or two additional dimensions advance only after pilot validation.

| Dimension | Evidence | Product claim |
| --- | --- | --- |
| Time-aware shade | Building geometry, usable heights, solar position, time | Estimated direct-sun exposure, not measured street temperature |
| Greener | Trees, parks, land cover, and canopy where available | Green adjacency or cover; keep greenery distinct from shade |
| Gentler | Elevation, slope, mapped stairs, ramps, seating | Lower effort based on available data, not guaranteed accessibility |
| Personally interesting | Saved places, explicit anchors, POIs, cultural places, public spaces | Similar to evidence the user supplied, not objectively cool |
| Quieter or livelier | Traffic, events, construction, activity proxies, time | Expected conditions; experimental until validated |
| Amenities and endpoints | Seating, restrooms, water, transit, venue types | Include or end near a supported place |

Happy Path should reason about the route as a sequence, not only an average score. Relevant measures include the longest exposed stretch, maximum gap between rest opportunities, whether one missing connection breaks access, and how often meaningful anchors occur.

First calculate a direct or fastest baseline. Generate distinct valid candidates within the Trip Brief’s time budget, then choose the highest-fit route. The result must answer:

> **What did the extra time buy?**

## 9. MVP scope

### Required

- one bounded NYC walking pilot;
- natural-language input and Quick Picks on the same screen;
- one synchronized, editable Trip Brief;
- Go somewhere, Loop, and Wander journey shapes;
- separate walking and total-outing budgets with visible stop-time allocation;
- two or three credible route dimensions;
- zero to three route-compatible stops or anchors;
- one recommended plan and a direct baseline when relevant;
- quantified receipt, segment reasons, confidence, and provenance;
- typed and tag-based refinements with predictable recomputation;
- browser-local, opt-in preference memory;
- a later trip that visibly uses one remembered preference;
- one place to view, edit, pause, or clear personalization.

### Deferred

- implicit behavioral learning presented as mature personalization;
- broad external history import;
- citywide or multimodal coverage;
- guaranteed ADA-compliant routing;
- real-time citywide noise, crowding, or restroom status;
- generic itinerary generation disconnected from a feasible route;
- civic contribution tasks;
- the Public Assets & Actions platform;
- the interactive Detour planning product.

## 10. Demo

### New user

1. The user taps **45 min**, **Wander**, **Greener**, and **End near transit**.
2. They type: **“Independent places, not too hilly, and quieter most of the way.”**
3. One Trip Brief visibly merges both inputs.
4. Happy Path generates a route-based outing with one to three anchors.
5. The receipt explains its evidence and time tradeoffs.
6. The user says: **“More like Fort Greene Park, but keep the bookstore.”**
7. The route and quantified receipt update.
8. The user chooses **Remember this** for the green, quieter-side-street preference.

### Returning user

1. The user starts a new request: **“I have 25 minutes before dinner.”**
2. They choose **Loop**. Happy Path prefills the remembered preference and labels its source.
3. The candidate ranking changes relative to an unpersonalized baseline.
4. The explanation cites the remembered preference.
5. The user can remove it with one tap and see the plan update.

A short **Go somewhere** case also proves that conventional A-to-B routing works. Together, the demo set covers Go somewhere, Loop, and Wander, including one outing whose walking plus stop dwell time fits a total budget.

## 11. Acceptance criteria

The MVP succeeds when:

1. A user can plan with text, Quick Picks, or both.
2. Equivalent text and Quick Pick inputs produce equivalent Trip Briefs.
3. The Trip Brief correctly represents time, journey shape, priorities, endpoint conditions, and hard requirements.
4. Explicit inputs resolve predictably and remain editable.
5. Each of Go somewhere, Loop, and Wander produces a feasible plan for at least one supported pilot request.
6. Walking time fits the walking budget; walking plus displayed stop dwell fits the total outing budget.
7. The result fits the explicit Trip Brief and is materially personalized when opted-in preferences exist.
8. The receipt quantifies the difference from a relevant baseline, and at least one segment exposes its evidence and provenance.
9. Explanations separate hard data, inference, personal evidence, and uncertainty.
10. Unsupported or unverified requests remain visible; required ones are never silently dropped.
11. A refinement changes the plan in the requested direction without losing retained requirements.
12. An opted-in preference visibly changes a later plan and explains why.
13. The user can view, edit, pause, or clear personalization and recover the unpersonalized result.
14. No hard requirement is silently weakened or violated.

Prototype evaluation targets:

- at least 16 of 20 scripted prompts produce an accepted Trip Brief;
- 10 of 10 equivalent prompt and Quick Pick pairs produce equivalent briefs;
- zero hard-constraint violations in the demo set;
- all three journey shapes pass a feasible pilot case;
- remembered preferences are visible, removable, and reflected in ranking.

Future product signals include refinement success, explanation usefulness, remembered-preference acceptance, post-walk **“matched what I asked for”** ratings, and route choice over the direct baseline for eligible fixed-destination trips.

## 12. Privacy, trust, and non-goals

- Guest use is session-only by default.
- Browser-local personalization requires clear opt-in.
- Exact origins, destinations, route geometry, and raw queries are not retained server-side for learning or prototype evaluation.
- Prototype evaluation uses scripted cases or aggregate counters, not stored raw prompts or paths.
- A route is stored only when the user explicitly saves it.
- Trip Brief fields expose their `input_origin`; preference records expose `memory_status` as saved or inferred.
- Clearing personalization deletes the local profile and its evidence records.
- Hard access requirements are never inferred, weakened, or overridden by a profile.
- Happy Path does not infer personal safety or assign safety, quality, or desirability scores to neighborhoods.
- It does not claim to know a person after one trip.
- It is not an open-ended itinerary generator; every recommendation must fit a real route and time budget.
- It is not a replacement for all navigation, an ADA guarantee, 311, or City responsibility.

## 13. Extensions

### Detour

Detour uses the same route features to identify where missing shade, access, amenities, or connections create repeated journey burdens and to simulate which public-realm interventions could help the most representative trips. The full planning product follows the consumer MVP.

### Contributions and Public Assets

A later opt-in layer can invite safe, verified observations along a route and maintain fresher public-asset evidence. It must never invent tasks, direct residents toward hazardous work, or outsource government responsibilities.

### Learned ranking

With sufficient consented feedback, Happy Path can train a preference-aware reranker on comparisons between known valid routes. Learned signals remain soft, inspectable, and subordinate to the current request.

## 14. Decisions and open questions

### Decisions

- Happy Path is a city-time planner whose output is a feasible path.
- Preset tags and natural language are equal inputs into one Trip Brief.
- The current request always outranks saved or inferred preferences.
- The MVP demonstrates explicit cross-session preference memory.
- MVP preference memory is browser-local and requires no account.
- Time-aware shade is the first proposed measurable route proof, subject to pilot validation.
- Mature implicit learning, contribution, Public Assets, and Detour are later phases.

### Open questions

1. Which pilot area best supports all three journey shapes and the demo route dimensions?
2. Which Quick Picks can the pilot support with defensible evidence?
3. Which one or two route dimensions should accompany time-aware shade in the MVP?
4. How should endpoint candidates be generated for Wander requests?
5. What confidence threshold is required before a feature can affect ranking?
