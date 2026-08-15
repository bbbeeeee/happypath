# Happy Path

> Canonical product requirements document. Product scope, prototype constraints, and acceptance criteria live here so the team has one source of truth.

| Field | Decision |
| --- | --- |
| Status | Hackathon product specification |
| Core product | Happy Path |
| Planning extension | Detour |
| Initial mode | Walking |
| Pilot | One bounded, data-rich Manhattan area |
| Build target | Demoable 24-hour prototype |
| Last updated | 2026-08-15 |

## 1. Product definition

Happy Path finds a walking route that fits the person and the moment, not only the shortest path.

The user describes the walk they want, chooses how much extra time they will spend, and receives an evidence-backed route with a concise explanation of what the extra time buys them.

The hackathon hero is a **Cooler** route that responds to building geometry, sun position, and time of day:

> **4 minutes longer · about 11 fewer minutes in direct sun**

The long-term opportunity is broader. Conventional routing finds an efficient feasible path. Happy Path should choose the right evidence-backed compromise for this particular walk.

**Detour** is a later planning extension that uses the same street model to reveal where missing shade, access, or public amenities impose the greatest pedestrian burdens.

## 2. Problem and users

Mainstream walking directions emphasize time and distance. They do not reliably answer questions such as:

- Which practical route is coolest at 3:00 PM?
- Is five extra minutes enough to produce a meaningfully better walk?
- Which route better fits my company, energy, mood, or the weather?
- Why is the recommended route better, and how certain is that claim?

NYC publishes useful information about buildings, trees, streets, sidewalks, construction, elevation, ramps, seating, restrooms, and public spaces. That data is fragmented and does not directly answer a trip-level question.

### Primary user

A person walking through NYC who cares about the quality of the trip and is willing to trade a small amount of time for a better fit.

Relevant situations include:

- avoiding direct sun during a hot afternoon;
- staying near greenery or public space;
- finding likely overhead cover during rain;
- walking with a child, visitor, luggage, injury, or mobility need;
- choosing a livelier, calmer, or more interesting experience.

The hackathon does not need to solve every situation. It must prove that the same origin and destination can have a measurably better route for a specific human context.

## 3. Product thesis

### 3.1 Hard data establishes what is true

Route geometry, legal pedestrian access, travel time, solar position, mapped stairs, construction records, and other measurable facts belong to deterministic systems.

### 3.2 Inference finds the right tradeoff

People describe walks in human terms: “hot afternoon with my visiting parent,” “pleasant but not slow,” or “a little greener, no more than five extra minutes.” An inference layer can translate that context into supported preferences, compare valid candidates, and explain the best fit.

Inference must operate on evidence-backed route candidates. It must not invent paths or conditions.

### 3.3 Extra time is the clearest control

The primary tradeoff is:

> **How much extra time would you spend for a better walk?**

The initial choices are fastest, up to five extra minutes, and up to ten extra minutes.

### 3.4 Every recommendation earns trust

The product should show:

- what improved relative to the fastest route;
- what became worse or remained unresolved;
- which sources support the recommendation;
- where evidence is estimated, inferred, stale, or missing;
- why a different preference would produce a different path.

## 4. Core experience

### 4.1 Request

The user provides:

1. origin and destination;
2. departure time, defaulting to now;
3. a quick mode or a short description of the desired walk;
4. maximum extra walking time;
5. any explicitly confirmed hard constraints.

The P0 quick mode is **Cooler**. **Stay Dry** and **Greenest** are experiments that ship only after Cooler is credible.

Example natural-language request:

> It is a hot afternoon and I am showing my mom around. We are not rushed and can add five minutes. Give us a pleasant walk with less sun.

### 4.2 Route Concierge

The inference layer translates the request into a typed route profile:

```text
soft preferences: shade=high, greenery=medium, low_effort=unsupported
maximum extra time: 5 minutes
confirmed hard constraints: none
needs confirmation: mobility requirement not specified
```

Safety-sensitive requirements are never silently inferred. If “my mom has trouble with stairs” appears in the request, Happy Path asks the user to confirm the need. If the current graph cannot support a reliable **No stairs** constraint, the prototype says so instead of implying that it can.

If intent parsing fails, returns an unsupported preference, or times out, the user can still route with the deterministic quick modes. Inference is a progressive enhancement, not a single point of failure.

### 4.3 Candidate routes

The deterministic route engine produces:

- the fastest legal route;
- several geographically distinct routes within the detour budget;
- measured features and confidence for every candidate.

The inference layer may select only from those candidate IDs. It cannot create geometry, change travel-time arithmetic, or relax a hard constraint.

### 4.4 Result and route receipt

The result shows the fastest route and the recommended Happy Path route.

```text
COOLER ROUTE

22 minutes · 4 minutes longer

About 11 fewer minutes in direct sun
More building shade on 6 blocks
Slightly less park frontage

Why this route: It captures most of the available shade improvement
within your five-minute budget.

Data confidence: Medium-high
```

The receipt includes:

- total time and distance;
- additional time relative to fastest;
- two to four material improvements;
- meaningful compromises;
- evidence and confidence by claim;
- segments responsible for the recommendation.

### 4.5 Refinement

The user can refine the result in human terms:

> A little greener, but do not make it longer.

Happy Path updates the typed preferences and reranks valid candidates. If nothing satisfies the request, it explains the conflict and offers explicit alternatives rather than quietly changing the requirements.

## 5. Inference layer

The inference layer is the product differentiator, not a replacement for routing.

```text
human trip context
        ↓
typed soft preferences ──→ confirm hard constraints
        ↓
deterministic candidate routes + measured evidence
        ↓
bounded candidate ranking
        ↓
evidence-linked explanation + compromises + confidence
        ↓
optional user refinement or pairwise feedback
```

### 5.1 Capabilities

| Capability | Role | Phase |
| --- | --- | --- |
| Intent compiler | Convert natural language into supported preference weights, detour budget, and confirmation needs | P0 |
| Candidate reranker | Choose among valid candidate IDs using only supplied route evidence | P0 |
| Route explanation | Describe why the winner fits and what tradeoffs remain | P0 |
| Best-extra-minute advisor | Find the point where more walking stops buying much more benefit | P0 |
| Constraint rescue | Explain why no route fits and present explicit alternatives | P1 |
| Whole-route fit | Prefer a coherent stretch over a choppy route made of isolated high-scoring blocks | P1 |
| Recommendation robustness | Test whether plausible changes in evidence or preference weights would change the winner | P1 |
| Experiential features | Estimate qualities such as lively, calm, or interesting from time-aware POIs, events, street form, imagery, and feedback | Later |
| Preference learning | Update personal weights from repeated route choices or pairwise feedback | Later |
| Route critic | Flag dominated candidates, weak evidence, or unsupported explanations before display | Later |

### 5.2 Best-extra-minute advisor

Instead of making the user guess a detour budget, Happy Path can compare the benefit frontier:

```text
+2 minutes → 7 fewer minutes in direct sun
+4 minutes → 11 fewer minutes in direct sun
+8 minutes → 12 fewer minutes in direct sun
```

The product can then say:

> Four extra minutes captures most of the available shade benefit; walking four minutes more adds very little.

The frontier calculation is deterministic. Inference personalizes and explains the tradeoff.

### 5.3 What inference must not do

Inference must not:

- generate route geometry or declare pedestrian access;
- calculate travel time, solar shadows, slope, or detour limits;
- claim ADA accessibility or personal safety;
- present live noise, crowding, restroom, or construction conditions without current evidence;
- silently relax stairs, access, or other hard constraints;
- convert missing data into a confident score;
- assign a universal “good,” “safe,” or “healthy” score to a block or neighborhood;
- produce an explanation that cannot be traced to candidate evidence.

## 6. Feature scope

### P0: required for the demo

| Feature | Definition |
| --- | --- |
| Baseline routing | Render a plausible fastest walking route between two points |
| Time-aware Cooler routing | Estimate building shade and minimize direct-sun exposure within a detour budget |
| Time control | Default to now and allow a selected demo time |
| Route comparison | Show fastest and Happy Path routes together |
| Route Concierge | Translate natural-language context into a supported typed preference profile |
| Bounded ranking | Select only from measured, valid candidates |
| Route receipt | Quantify benefit, cost, compromise, evidence, and confidence |
| Best-extra-minute guidance | Explain which detour budget captures most available benefit |
| Mobile map | Provide a clear route card, map, legend, loading state, and error state |

### P1: add only after P0 is stable

| Feature | Evidence boundary |
| --- | --- |
| Stay Dry | Favor sidewalk-shed-adjacent blocks as **likely covered**, never guaranteed dry |
| Greenest | Favor tree- and park-adjacent streets; keep distinct from Cooler |
| Side-of-street guidance | Estimate which side is shadier without promising sidewalk-level routing |
| Constraint rescue | Offer explicit alternatives when no candidate satisfies the request |
| Visible street character | Test one locally calibrated imagery feature, such as pedestrian-visible greenery; never place it on the critical path |

### Deferred

- true sidewalk-side routing after a short feasibility experiment;
- Gentler and step-free routing;
- Livelier, Quieter, Curious, or historical modes;
- accounts, saved profiles, and persistent personalization;
- full turn-by-turn navigation;
- citywide coverage;
- the interactive Detour planning extension;
- Civic Assets & Actions;
- a complete feedback or volunteer-task marketplace.

## 7. Route features and evidence

| Feature | Metric | Initial evidence | Product language |
| --- | --- | --- | --- |
| Cooler | Estimated direct-sun minutes and shaded route share | Building footprints and heights, sun position, time | Estimated shade |
| Greenest | Tree and park adjacency | Street trees, parks, open space | Greener route |
| Stay Dry | Route share adjacent to likely overhead cover | Active sidewalk-shed records | Likely covered |
| Gentler | Ascent, grade, stairs, and uncertain crossings | Elevation, pedestrian graph, ramps, accessibility signals | Deferred; never guaranteed accessible |
| Livelier | Time-sensitive activity estimate | Open POIs, events, public spaces, pedestrian proxies | Expected activity |
| Quieter | Historical and contextual proxy | Traffic, construction, complaints, time | Expected quietness, not live noise |
| Interesting | Cultural or experiential opportunity within budget | Landmarks, public art, events, historic places | Interesting route |

Greenest and Cooler are separate. Tree presence is not automatically equivalent to measured shade, and the v0 shade claim can rely on building geometry alone.

### Evidence labels

- **Official:** directly represented in an authoritative source
- **Derived:** calculated from one or more sources
- **Inferred:** estimated by a model from supplied evidence
- **Observed:** recently reported or verified by a person
- **Unknown:** current evidence is insufficient

Every edge feature should retain its source, observation time, derivation method, spatial resolution, and confidence.

The inference model does not assign its own confidence score. Recommendation confidence comes from evidence coverage, freshness, calibration, and whether the same route wins when plausible feature values and preference weights vary.

## 8. Routing and shade model

### 8.1 Pedestrian graph

Use OpenStreetMap as the initial connected pedestrian graph. Audit the pilot area rather than assuming sidewalk, crossing, stair, incline, curb, or wheelchair tags are complete.

Use NYC street and sidewalk data as enrichment and for a timeboxed side-of-street experiment.

### 8.2 Detour constraint

First calculate the fastest legal route:

`T₀ = travel time of fastest route`

For a selected extra-time budget `Δ`, every candidate must satisfy:

`T(route) ≤ T₀ + Δ`

A percentage ceiling may act as an internal sanity check, but the user-facing control remains minutes.

### 8.3 Candidate generation and ranking

Generate several geographically distinct candidates using weighted graph search or K-shortest paths. Discard candidates that violate legal access, confirmed hard constraints, continuity, plausibility, or the detour budget.

For supported route features:

`Utility(route) = Σ preference_weightᵢ × normalized_metricᵢ − time_penalty`

Normalize features among practical alternatives for the current trip. A “greener” result means greener than the other viable routes between this origin and destination, not an objective rating of the neighborhood.

The deterministic utility score provides a stable baseline. The inference layer can rerank close alternatives only within the same evidence and constraint boundary.

### 8.4 Shade model

For each nearby building:

`shadow_length = building_height / tan(solar_elevation)`

Project the footprint opposite the sun direction to create an approximate shadow polygon. Then calculate for each route edge:

```text
shade_score = shaded_length / edge_length
sun_exposure_time = walk_time × (1 − shade_score)
```

Compute shadows only around the origin-destination corridor. Use projected NYC coordinates for spatial calculations and latitude/longitude for display.

### 8.5 Side-of-street experiment

Timebox true sidewalk topology to two or three hours after street-level Cooler routing works.

Success requires reliable transitions from sidewalk to intersection to cross street to sidewalk. If topology is not clean enough, stop and keep street-level routing. The fallback is independent left/right shade estimation with guidance such as “the south side is likely shadier.”

## 9. Prototype architecture

```text
NYC + open street data ──→ local preprocessing ──→ enriched pedestrian graph
                                                          ↓
trip text ──→ intent compiler ──→ typed preferences ──→ candidate generator
                                                          ↓
                                             measured candidate evidence
                                                          ↓
                                     bounded ranking + deterministic validator
                                                          ↓
                                       map + route receipt + confidence
```

### Prototype stack

- **Frontend:** Next.js, TypeScript, MapLibre
- **Backend:** Python, FastAPI
- **Geospatial:** GeoPandas, Shapely, PyProj, NetworkX, NumPy
- **Storage:** GeoParquet and a serialized routing graph
- **Database:** none unless profiling shows a concrete need

Download, validate, crop, and preprocess NYC datasets before serving route requests. Do not query every source during an interactive request.

### Minimal route contract

`POST /route` accepts:

- origin and destination;
- departure time;
- quick mode or natural-language trip context;
- maximum extra minutes;
- confirmed hard constraints.

It returns:

- fastest route and candidate geometries;
- the recommended candidate ID;
- distance and walking time;
- supported route metrics and confidence;
- environmental benefit versus fastest;
- evidence-linked route receipt;
- explicit warnings or unresolved constraints.

## 10. Build order and kill rules

| Phase | Outcome |
| --- | --- |
| Hours 0–5 | Crop data, build the graph, and render a fastest A-to-B route |
| Hours 5–10 | Project shadows, add time control, and calculate per-edge exposure |
| Hours 10–15 | Generate Cooler candidates, enforce detour limits, and build the route receipt |
| Hours 15–19 | Add the Route Concierge, bounded ranking, explanation, and refinement |
| Hours 19–24 | Test routes, fix failures, polish the demo, and add one P1 feature only if P0 is stable |

Kill rules:

- Never cut baseline routing, time-aware shade, route comparison, evidence, or confidence.
- Keep the inference layer bounded; a polished structured intent and explanation flow is enough.
- Stop true side-of-street routing after two or three hours if topology is unreliable.
- Do not add Greenest or Stay Dry until Cooler works across the demo set.
- Do not add a production database or citywide pipeline for the hackathon.

## 11. Acceptance criteria

The prototype is done when a user can:

1. choose two locations inside the pilot area;
2. see the fastest walking route;
3. request a Cooler walk using a quick mode or natural language;
4. receive a meaningfully different route within the selected time budget;
5. understand the time-versus-sun tradeoff through measured evidence;
6. change the time and see shadows or routing respond;
7. refine a soft preference without losing confirmed hard constraints;
8. inspect confidence and the source behind every major claim.

Quality gates:

- no disconnected, illegal, or implausibly looping route in the demo set;
- every recommendation is one of the measured candidate IDs;
- every explanation is supported by returned route metrics;
- unknown or weakly supported conditions are visible, not silently imputed;
- deterministic route computation completes in under three seconds for the pilot area;
- the full warmed request, including inference, feels interactive;
- at least ten representative origin-destination pairs are reviewed manually;
- hard-data-only and inference-ranked results are compared on the same test routes;
- at least three contrasting route pairs are walked or reviewed against current street evidence;
- every inference-ranked winner is checked for constraint compliance and explanation accuracy;
- at least one example clearly shows that a small detour buys a large shade improvement.

## 12. Privacy, fairness, and safety

- No account is required for core routing.
- Do not retain precise trip text, origin-destination history, or inferred personal context by default.
- Validate inference output against a strict schema and supported feature list.
- Treat user feedback as time-stamped evidence, not permanent ground truth.
- Do not use app activity or complaint volume as the sole measure of need.
- Do not infer personal safety from crime, crowding, activity, or visual appearance.
- Do not guarantee accessibility until the pedestrian network is comprehensively audited.
- Maintain legal pedestrian access and confirmed hard constraints regardless of preference score.
- Show low confidence and missing coverage at the moment they affect a recommendation.

## 13. Extensions

### Detour

Detour applies the same street features and routing logic at a planning scale. It asks where a missing connection, shade gap, obstruction, or absent amenity creates repeated route burdens and which intervention would improve the most representative trips.

The full planning interface is outside the hackathon MVP. A later version may compare a baseline network with a simulated intervention while avoiding neighborhood rankings, complaint-volume bias, and identifiable trip histories.

### Experiential routing

Later inference can estimate qualities such as lively, calm, or interesting from time-aware POIs, events, public-space adjacency, street form, imagery, and recent observations. These remain derived local expectations with visible evidence and confidence, never universal neighborhood scores.

### Preference learning

With explicit consent, repeated pairwise choices such as “which of these two routes would you take?” can update personal route weights. The system should learn preferences rather than store sensitive trip narratives.

### Civic Assets & Actions

A later extension could connect routes to verified public assets or authorized civic actions. It must not invent tasks or direct people toward unsafe, unapproved, or hazardous work.

## 14. Open decisions

1. Which bounded Manhattan area has the best combination of alternate paths, building geometry, and demo value?
2. Which geocoder should power the prototype?
3. Is the NYC sidewalk graph usable within the side-of-street timebox?
4. Are sidewalk-shed records precise enough to support Stay Dry as a P1 mode?
5. Should the detour control remain explicit `+5 / +10 minutes`, or include a recommended sweet spot by default?
6. Which inference provider and model best support low-latency structured output?
7. Should inference rerank all valid candidates or only break near-ties in deterministic utility?
8. Which claims require a minimum confidence threshold before they can affect routing?

## 15. Decisions made

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-08-15 | Use this PRD as the single canonical product and prototype document | Avoid conflicting scope across a separate implementation plan |
| 2026-08-15 | Make time-aware Cooler routing the hackathon hero | It is measurable, visually demonstrable, and grounded in available data |
| 2026-08-15 | Use Happy Path as the core product name and Detour as the planning extension | Keep one clear product hierarchy |
| 2026-08-15 | Keep inference above deterministic routing | Preserve legal access, numerical correctness, explainability, and trust |

## Research directions

- [World-scale inverse reinforcement learning in Google Maps](https://research.google/blog/world-scale-inverse-reinforcement-learning-in-google-maps/) shows that route choices can reveal latent reward signals, while still serving routes through graph search.
- [Comparative feedback for personalized multi-objective learning](https://research.google/pubs/eliciting-user-preferences-for-personalized-multi-objective-reinforcement-learning-through-comparative-feedback/) supports learning a person’s objective weights from a small number of route comparisons.
- [Explaining route selection](https://research.google/pubs/why-is-my-route-different-todayan-algorithm-for-explaining-route-selection/) motivates concise, contrastive explanations focused on the few conditions that actually changed the recommendation.
