# Happy Path — Product Requirements Document

> Canonical product requirements for the resident product and its relationship to Detour.

| Field | Decision |
| --- | --- |
| Status | Review draft |
| Core product | Happy Path |
| Planning extension | Detour |
| Initial mode | Walking |
| Pilot | Bounded Lower Manhattan area |
| First journey | Fixed origin to destination |
| Hero proof | Time-aware Cooler route |
| Interface | Mobile, map-first, conversational |
| Data strategy | Broad city-data platform; selective, evidence-backed presentation |
| Last updated | 2026-08-15 |

## 1. Product definition

**Happy Path is an intelligent interface over New York City’s public-realm data.**

It turns fragmented information about streets, buildings, shade, greenery, construction, mapped steps, elevation, seating, restrooms, water, public spaces, transit, and activity into an explainable walking route for a particular person and moment.

The resident experience remains simple:

> **Say one sentence → inspect what Happy Path understood → receive a computed route → refine it naturally.**

Example:

> “Walk me to Washington Square Park with less direct sun. I can add five minutes, and avoid mapped steps.”

Happy Path:

1. translates the request into a visible Trip Brief;
2. computes valid alternatives from an enriched pedestrian graph;
3. recommends one practical route;
4. explains what the detour improves and what it compromises;
5. shows which city data and derivations support the result;
6. lets the user refine the route without starting over.

### Product promise

> **Tell Happy Path where you are going and what matters. It finds a practical way that fits and shows what the extra time buys.**

## 2. Two connected goals

### Resident goal

Use NYC public data to help someone choose a route that better fits their needs, preferences, company, available time, and current conditions.

### Civic goal

Make difficult-to-use public data understandable and actionable, while building a shared city model that can reveal gaps in shade, accessibility, amenities, public space, and pedestrian infrastructure.

The route is the bridge between the two goals:

- not “here are all NYC benches,” but “this route never leaves you more than seven minutes from mapped seating”;
- not “here are sidewalk sheds,” but “this alternative avoids three shed-affected blocks”;
- not “here are building footprints,” but “four extra minutes saves eleven estimated minutes in direct sun.”

## 3. Problem

Mainstream walking directions primarily optimize time and distance. They do not reliably answer:

- Which practical route has less direct sun at this time?
- What does adding five minutes materially improve?
- Can I avoid mapped steps, known construction friction, or long rest gaps?
- Which route better fits the person or situation?
- Why did the system choose one street rather than the parallel one?
- How reliable is the supporting evidence?

General-purpose AI can suggest places or produce an itinerary, but it does not establish pedestrian connectivity, calculate physical conditions, enforce route constraints, or measure route tradeoffs.

NYC publishes unusually rich public data, but it is fragmented across agencies, schemas, update schedules, and levels of reliability. Happy Path turns those layers into a concrete journey while preserving their provenance and limitations.

## 4. Primary user

The first user is:

> **A person walking through Manhattan who is willing to add a few minutes for a route that better fits the current conditions or company.**

Representative situations include:

- avoiding excessive direct sun;
- showing a parent or visitor around;
- choosing greener streets;
- avoiding mapped steps;
- carrying luggage or walking with a child;
- finding places to pause, use a restroom, or get water;
- avoiding likely construction friction;
- wanting a route that is more comfortable without becoming impractically long.

The initial product does not claim guaranteed accessibility, personal safety, live quietness, live crowding, or complete operational status for public amenities.

## 5. Product principles

### 5.1 The route is the answer

Happy Path is not primarily an itinerary generator, open-data browser, or place-recommendation chatbot. Places and amenities may influence or anchor a route, but the output must remain a feasible journey through the pedestrian network.

### 5.2 One sentence is enough

The user should not begin with a large filter panel. Natural language produces a compact, editable Trip Brief. Deterministic quick controls remain available for correction and fallback.

### 5.3 Extra time is the clearest tradeoff

The primary control is:

> **How much extra time will you spend for a better walk?**

Initial options are fastest, up to five extra minutes, and up to ten extra minutes. Happy Path may recommend a sweet spot when additional walking stops producing meaningful improvement.

### 5.4 City data is a platform, not a collection of features

A new data layer should plug into shared source, feature, evidence, routing, visualization, and Detour contracts. Adding benches or sidewalk sheds should not require redesigning the product.

A layer may be useful at several capability levels:

- **Cataloged:** source, schema, and terms are known;
- **Ingested:** data is available in the pilot;
- **Visualizable:** it can be rendered accurately;
- **Routing-ready:** it is sufficiently validated to affect route choice;
- **Detour-ready:** it can support gap or intervention analysis;
- **Experimental:** it provides context but relies on incomplete coverage or a proxy.

### 5.5 Broad underneath, selective on top

Happy Path should ingest and reason over many relevant city layers. The resident should see only the layers that materially affect the current request, recommendation, warning, or uncertainty.

The map must not become a generic GIS layer browser.

### 5.6 AI interprets; deterministic systems establish facts

Language intelligence may interpret intent, patch the Trip Brief, choose which supported evidence matters, rank valid candidates within a strict boundary, and explain tradeoffs.

It may not invent route geometry, travel time, solar exposure, physical conditions, operational status, accessibility guarantees, or planning impact.

### 5.7 Every recommendation has reasons

The result must show:

- what improved relative to the fastest route;
- what became worse or remains unresolved;
- which sources and derivations support the result;
- confidence and material uncertainty;
- the route segments responsible for the recommendation.

### 5.8 No universal block score

A street is not inherently good or bad. Its usefulness depends on the journey, user, time, and preference being evaluated.

## 6. Core experience

Detailed interaction behavior lives in [UX.md](UX.md).

### 6.1 Compose

The opening experience contains:

- origin;
- destination;
- departure time, defaulting to now;
- one natural-language request;
- extra-time allowance.

Primary prompt:

> **How do you want this walk to feel?**

Example:

> “Less direct sun, no more than five minutes longer, with places to sit if possible.”

### 6.2 Interpret

Happy Path displays an editable Trip Brief:

```text
Destination
Washington Square Park

Priorities
Less direct sun · mapped seating nearby

Avoid
Mapped steps

Flexible by
Up to 5 minutes

Departure
3:15 PM
```

Every material interpretation remains visible. The system asks at most one clarification before routing, and only when ambiguity changes the destination, time budget, journey shape, or hard requirement.

### 6.3 Compute

The route engine produces:

- the fastest valid route;
- geographically distinct alternatives;
- measured route features and evidence coverage;
- only candidates inside the selected time budget;
- explicit hard-constraint validation.

### 6.4 Recommend

Happy Path returns one primary route and a concise Route Receipt:

```text
YOUR HAPPY PATH

22 minutes · 4 minutes longer

About 11 fewer minutes in estimated direct sun
Longest exposed stretch reduced from 8 to 3 minutes
Passes 3 mapped seating locations
Avoids all mapped-step segments in the pilot graph

Tradeoff
Slightly less park frontage

Why this route
Four extra minutes captures most of the available shade improvement.

Confidence
Medium-high
```

The fastest route remains available as a comparison but should not visually compete with the recommendation by default.

### 6.5 Inspect

Tapping a segment answers **Why this street?** with the evidence that affected the decision.

Example:

- estimated building shade at the selected time;
- less direct sun than the parallel avenue;
- two mapped benches within five minutes;
- one active sidewalk-shed record avoided;
- derived evidence, with validation status and source date.

### 6.6 Refine

The user can say:

> “Shorten it, but keep most of the shade and the bathroom.”

Happy Path patches the existing Trip Brief, recomputes the route, and explains the delta. If no route satisfies the refinement, the product exposes the conflict rather than silently relaxing it.

## 7. Journey shapes

### P0: Go somewhere

A fixed origin and destination. This is the required implementation and demo journey.

### P0 stretch: Loop

A 15-, 20-, or 30-minute walk returning near the starting point. Loop proceeds only after fixed-destination routing, evidence, and refinement are stable.

### P1: Wander

A direction, neighborhood, endpoint type, or total outing budget where Happy Path chooses both endpoint and path. Wander requires endpoint generation, dwell-time logic, and stronger preference evidence, so it is not part of the critical path.

## 8. City-data capability target

The companion [data and inference specification](data-and-inference.md) contains exact sources, dataset IDs, claim boundaries, and validation gates.

| Layer family | Resident use | Detour use | Initial target |
| --- | --- | --- | --- |
| Pedestrian graph | Valid paths, time, mapped steps | Missing or broken connections | Core |
| Buildings + solar position | Time-aware shade | Shade-continuity gaps | Routing-ready |
| Trees + parks | Greener routes and context | Green-corridor gaps | Routing-ready after validation |
| Sidewalk sheds + construction | Avoid likely friction; possible cover context | Repeated construction burden | Visualizable; routing after validation |
| Elevation + slope | Lower-effort routes | Terrain and grade burdens | Experimental until validated |
| Ramps + crossings | Access context | Step-free detour analysis | Visualizable; later routing |
| Seating | Places to pause; rest continuity | Seating-gap interventions | High-priority amenity |
| Public restrooms | Include or end near a restroom | Coverage, hours, and deviation gaps | High-priority amenity |
| Drinking fountains | Water access | Water-access gaps | High-priority amenity |
| Parks, plazas, and POPS | Public places to pause or route through | Public-space access gaps | High-priority context |
| Transit entrances | Endpoints and fallback options | Representative trip demand | Important shared layer |
| Pedestrian counts | Activity where measured | Demand weighting | Experimental outside sensors |
| Events and activity | Time-specific anchors or context | Temporary demand and spillover | Contextual |
| Traffic, noise, and 311 | Expected friction or research context | Verification targeting | Experimental; never objective ground truth |
| Cultural assets | Personally relevant anchors | Cultural-access analysis | Later experiential layer |
| Recent observations | Operational corrections | Ground-truth and data-gap reduction | Later, expiring evidence |

### P0 data breadth target

The first integrated demo should:

1. catalog the full target layer set in the source registry;
2. ingest at least five official NYC datasets in addition to the pedestrian graph;
3. make at least five city-data layers inspectable on the map or in evidence details;
4. have at least three independent layer families materially affect a route, requirement, waypoint, or Route Receipt;
5. use at least one quantitative hero feature with validated route-level comparison;
6. preserve uncertainty where coverage is incomplete.

Not every ingested layer must control routing. Some may support explanation, waypoint selection, warning, coverage display, or Detour analysis first.

## 9. AI and inference boundary

The detailed contracts live in [data-and-inference.md](data-and-inference.md).

### AI may

- compile colloquial language into supported Trip Brief fields;
- identify when one clarification is necessary;
- preserve explicit hard requirements;
- select which supported layers are relevant to the request;
- rank close valid candidates using supplied evidence;
- explain benefits, compromises, uncertainty, and personal fit;
- translate refinements into typed changes;
- produce a typed presentation plan using allowed layer and claim IDs.

### AI may not

- generate or modify route geometry;
- calculate distance, travel time, solar position, slope, or exposure;
- treat missing evidence as a favorable condition;
- infer live noise, crowding, amenity operation, or construction state without current evidence;
- claim ADA accessibility or personal safety;
- invent civic tasks or planning impacts;
- output arbitrary map code, symbols, or colors.

Inference must fail safely. Deterministic route modes remain available when the model is unavailable or the request contains unsupported criteria.

## 10. Map and evidence presentation

The route is always primary.

A layer appears by default only when it:

1. satisfies a requirement;
2. materially influenced route selection;
3. explains a compromise or warning;
4. changes confidence in the recommendation.

The Route Receipt should include an expandable **City data used** section:

```text
CITY DATA USED

• NYC building footprints and roof heights
• NYC Forestry Tree Points
• NYC Parks properties
• NYC DOT seating
• NYC public restrooms
• OpenStreetMap pedestrian paths

3 official layers · 2 derived route metrics · 1 experimental condition
```

The product should teach users what public data made the route possible without forcing them to operate a data portal.

## 11. Personalization

Persistent personalization is P1.

P0 may use:

- the current request;
- visible refinements;
- explicit taste anchors supplied for the current trip.

Later, with explicit opt-in, Happy Path may remember structured tendencies such as choosing greener streets or accepting a typical detour. The current request always outranks history. The system learns route preferences, not sensitive identity, health, home, work, or personality traits.

## 12. Detour

Detour is a separate planning surface using the same graph, source registry, evidence, route features, and simulation engine.

It asks:

> **Where does the city make a desired journey unnecessarily difficult, and what intervention could reduce that burden?**

The initial planning proof should reuse one validated resident feature—for example shade continuity, seating access, or mapped-step detour—and show:

1. representative journeys;
2. a repeated route burden;
3. the segment or missing amenity causing it;
4. a hypothetical intervention;
5. before-and-after rerouting and burden reduction;
6. evidence, assumptions, and uncertainty.

Full requirements live in [DETOUR.md](DETOUR.md).

## 13. P0 scope

### Required product capabilities

- bounded Lower Manhattan pilot;
- fixed origin-to-destination walking;
- address search and map selection;
- current or selected departure time;
- fastest route;
- five- and ten-minute extra-time budgets;
- one natural-language request;
- visible, editable Trip Brief;
- deterministic candidate generation and validation;
- one recommended route;
- quantified Route Receipt;
- segment-level explanation;
- one natural-language refinement;
- source, confidence, coverage, and validation labels;
- responsive mobile map;
- complete loading, empty, unsupported, and error states.

### Required data capabilities

- time-aware building shade;
- trees and parks;
- mapped steps;
- seating;
- public restrooms;
- drinking water or public-space locations;
- sidewalk sheds or construction context;
- shared layer registry and visualization contract.

A layer may ship as visualizable or explanatory before it becomes routing-ready, but its capability status and claim boundary must be visible in the documentation.

### Validated route features

At least three of the following should materially affect a route, requirement, waypoint, or receipt:

1. estimated direct-sun exposure;
2. greenery adjacency;
3. mapped-step avoidance;
4. rest continuity or seating access;
5. restroom or water waypoint access;
6. construction-friction avoidance.

### Conditional extensions

Only after the core experience is stable:

- time-boxed loop;
- elevation and gentler routing;
- one prepared Detour scenario;
- richer public-space routing;
- custom icon family.

### Deferred

- Wander and flexible endpoint generation;
- persistent preference memory;
- broad restaurant, nightlife, or event recommendations;
- subjective “cool” or “fun” claims without personal evidence;
- guaranteed ADA-compliant routing;
- live citywide noise or crowding;
- turn-by-turn navigation;
- citywide coverage;
- Civic Assets & Actions;
- general interactive planning tooling.

## 14. Demo suite

The product should support a few focused demonstrations rather than one overloaded flow.

### Cooler Manhattan

> “Get me to Washington Square Park with less direct sun. I can add five minutes.”

Demonstrates buildings, solar position, route comparison, greenery context, and a quantitative receipt.

### Taking my parents

> “My parents tire easily. Help us walk toward Union Square with places to rest and a bathroom.”

Demonstrates mapped steps, seating, restrooms, public space, greenery, and honest handling of unsupported accessibility guarantees.

### Rain and construction

> “It’s raining. Get me there while avoiding construction friction and favoring likely cover.”

Demonstrates sheds, construction context, transit or public-space anchors, and visible uncertainty.

### Detour reveal

Show that the same route features reveal a recurring shade, seating, restroom, or access gap and support a before-and-after intervention scenario.

## 15. Acceptance criteria

The P0 prototype succeeds when:

1. A user can select two locations inside the pilot.
2. A natural-language request produces a visible, editable Trip Brief.
3. The fastest route renders correctly.
4. Happy Path returns a valid alternative inside the selected minute budget.
5. The recommendation is materially different from the fastest route when a meaningful alternative exists.
6. The Route Receipt quantifies the route tradeoff.
7. Changing departure time changes shade evidence when expected.
8. A refinement changes the route predictably.
9. Confirmed hard requirements are never silently relaxed.
10. Every important claim maps to deterministic metrics and source evidence.
11. Unknown, stale, partial, or pending evidence remains visibly uncertain.
12. Inference failure falls back to deterministic routing.
13. At least five official NYC datasets are integrated and inspectable.
14. At least three independent layer families materially influence a route, requirement, waypoint, or receipt.
15. Every integrated layer has a documented capability status and claim boundary.
16. At least three demo prompts activate meaningfully different combinations of city data.
17. At least ten origin-destination pairs are manually reviewed.
18. At least twenty sampled blocks or assets are checked against current visual or field evidence where relevant.
19. One example clearly shows that a small detour produces a large human benefit.
20. The same feature registry powers one Detour burden or intervention analysis.
21. The warmed route interaction feels responsive on a representative phone.
22. The application has an explicit data-payload budget and does not eagerly load every source or time slice.

## 16. Non-goals

Happy Path is not:

- a generic AI travel planner;
- a chatbot that merely activates filters;
- an objective nightlife or cultural tastemaker;
- a safety-ranking system;
- a neighborhood-quality score;
- an ADA guarantee;
- a generic open-data dashboard;
- a replacement for all navigation products;
- a replacement for planners or public engagement;
- a system for outsourcing City responsibilities to residents.

## 17. Product definition

> **Happy Path converts a short description of how someone wants to walk into an evidence-backed route through Manhattan. It integrates fragmented NYC public data through a shared city-layer platform, computes valid alternatives, selects a practical tradeoff within the person’s available time, and explains what every detour buys. AI interprets and communicates; deterministic systems establish route facts. The same street model powers Detour, which identifies where missing shade, access, amenities, or infrastructure impose repeated journey burdens and tests which interventions could make the largest difference.**
