# Happy Path — Product Requirements Document

> Canonical product requirements for the resident product and its relationship to Detour.

| Field | Decision |
| --- | --- |
| Status | Review draft |
| Core product | Happy Path |
| Planning extension | Detour |
| Initial mode | Walking |
| Pilot | Manhattan south of Central Park, approximately Battery to 59th Street |
| Delivery target | P1 resident experience plus one Detour planning proof |
| Hero proof | Time-aware Cooler route |
| Interface | Mobile, map-first, conversational |
| Data strategy | Broad city-data platform; selective, evidence-backed presentation |
| Last updated | 2026-08-15 |

## 1. Product definition

**Happy Path helps people care about the journey, not only the destination.**

It converts a short request describing **where and/or how someone wants to walk** into an evidence-backed route through Manhattan. It combines fragmented NYC public data about streets, buildings, shade, greenery, construction, mapped steps, elevation, seating, restrooms, water, public spaces, transit, and other relevant conditions into one considered journey.

The resident experience remains simple:

> **Say one sentence → inspect what Happy Path understood → receive a computed route → refine it naturally.**

Examples:

> “Walk me to Washington Square Park with less direct sun. I can add five minutes.”

> “Give me a green 25-minute loop with places to sit.”

> “I have 40 minutes. Help me wander north through calmer streets and finish near a subway.”

Happy Path:

1. translates the request into a visible Trip Brief;
2. selects the city layers relevant to the situation;
3. computes valid alternatives from an enriched pedestrian graph;
4. recommends one practical route or walk;
5. explains what the detour improves and what it compromises;
6. shows which public data and derivations support the result;
7. lets the user refine the route without starting over.

### Product promise

> **Tell Happy Path where and/or how you want to walk. It finds a practical way that fits the person and moment, and shows what every detour buys.**

## 2. Three connected goals

### Resident goal

Help someone move through the city in a way that is more pleasant, personal, comfortable, informed, and appropriate to the current situation—not merely efficient.

### Civic-data goal

Make difficult-to-use NYC public data understandable and useful through a concrete resident decision. Happy Path should expose the value of City data without forcing anyone to operate a data portal.

### City-planning goal

Build a shared street and public-asset model that can reveal recurring gaps in shade, access, amenities, public space, and pedestrian infrastructure. The same model powers Detour.

The route is the bridge:

- not “here are all NYC benches,” but “this route keeps mapped seating within an eight-minute walk”;
- not “here are sidewalk sheds,” but “this alternative avoids three shed-affected blocks”;
- not “here are building footprints,” but “four extra minutes saves eleven estimated minutes in direct sun”;
- not “here are restrooms,” but “this walk includes one with published hours near the midpoint.”

## 3. Problem

Mainstream walking directions primarily optimize time and distance. They do not reliably answer:

- Which practical route has less direct sun at this time?
- What does adding five minutes materially improve?
- Can I avoid mapped steps, known construction friction, or long rest gaps?
- Can I take a useful loop without choosing a destination?
- Can I wander toward an area and finish near transit or another resource?
- Which route better fits my company, energy, preferences, or current conditions?
- Why did the system choose one street rather than the parallel one?
- How reliable is the supporting evidence?

General-purpose AI can suggest places or produce an itinerary, but it does not establish pedestrian connectivity, calculate physical conditions, enforce route constraints, or measure route tradeoffs.

NYC publishes unusually rich public data, but it is fragmented across agencies, schemas, update schedules, and levels of reliability. Happy Path turns those layers into a concrete journey while preserving provenance and limitations.

## 4. Primary user

The first user is:

> **A person walking through Manhattan who is willing to trade some efficiency for a journey that better fits the current person, purpose, and moment.**

Representative situations include:

- avoiding excessive direct sun;
- showing a parent or visitor around;
- choosing greener streets;
- avoiding mapped steps;
- carrying luggage or walking with a child;
- finding places to pause, use a restroom, or get water;
- avoiding likely construction friction;
- taking a purposeful walk without a fixed destination;
- ending near transit, a park, or another useful resource.

The initial product does not claim guaranteed accessibility, personal safety, live quietness, live crowding, or complete operational status for public amenities.

## 5. Product principles

### 5.1 The journey is the product

Happy Path is not primarily an itinerary generator, open-data browser, or place-recommendation chatbot. Places and amenities may influence or anchor a route, but the product should improve the experience of moving through the city itself.

### 5.2 One sentence is enough

The user should not begin with a large filter panel. Natural language produces a compact, editable Trip Brief. Deterministic quick controls remain available for correction and fallback.

### 5.3 Extra time is the clearest tradeoff

For destination trips, the primary control is:

> **How much extra time will you spend for a better walk?**

Initial options are fastest, up to five extra minutes, and up to ten extra minutes. Happy Path may recommend a sweet spot when additional walking stops producing meaningful improvement.

For loops and open-ended walks, the primary control is the total walking-time budget.

### 5.4 City data is a platform, not a collection of features

A new data layer should plug into shared source, feature, evidence, routing, visualization, and Detour contracts. Adding benches, weather, or sidewalk sheds should not require redesigning the product.

A layer may be useful at several capability levels:

- **Cataloged:** source, schema, and terms are known;
- **Ingested:** data is available in the pilot;
- **Visualizable:** it can be rendered accurately;
- **Routing-ready:** it is sufficiently validated to affect route choice;
- **Detour-ready:** it can support gap or intervention analysis;
- **Experimental:** it provides context but relies on incomplete coverage or a proxy.

### 5.5 Broad underneath, selective on top

Happy Path should ingest and reason over many relevant city layers. The resident should see only the evidence that materially affects the current request, recommendation, warning, or uncertainty.

The map must not become a generic GIS layer browser.

### 5.6 AI interprets; deterministic systems establish facts

Language intelligence may interpret intent, patch the Trip Brief, choose which supported evidence matters, rank valid candidates within a strict boundary, and explain tradeoffs.

It may not invent route geometry, travel time, solar exposure, physical conditions, operational status, accessibility guarantees, or planning impact.

### 5.7 Every recommendation has reasons

The result must show:

- what improved relative to a relevant baseline;
- what became worse or remains unresolved;
- which sources and derivations support the result;
- confidence and material uncertainty;
- the route segments responsible for the recommendation.

### 5.8 No universal block score

A street is not inherently good or bad. Its usefulness depends on the journey, user, time, and preference being evaluated.

### 5.9 Connect people to the city

Happy Path should make City resources easier to discover and use. Over time, it may also invite safe, optional observations—such as confirming an obstruction or snapping a photo of an asset—to improve public ground truth. Participation must never be required for route utility or used to outsource City responsibilities.

## 6. Core experience

Detailed interaction behavior lives in [UX.md](UX.md).

### 6.1 Compose

The opening experience contains:

- origin;
- optional destination or end condition;
- walking-time or detour budget;
- departure time, defaulting to now;
- one natural-language request.

Primary prompt:

> **Where and how would you like to walk?**

Examples:

- “Less direct sun to Bryant Park, no more than five minutes longer.”
- “A green 20-minute loop with somewhere to sit.”
- “Walk north for about 35 minutes and end near a subway.”

### 6.2 Interpret

Happy Path displays an editable Trip Brief:

```text
Journey
25-minute loop

Priorities
Greenery · mapped seating nearby

Avoid
Mapped steps

Leaving
3:15 PM
```

Every material interpretation remains visible. The system asks at most one clarification before routing, and only when ambiguity changes the journey shape, time budget, endpoint, or hard requirement.

### 6.3 Compute

The route engine produces:

- the fastest valid route when there is a fixed destination;
- geographically distinct alternatives;
- candidate loops or endpoint-and-route combinations where supported;
- measured route features and evidence coverage;
- only candidates inside the selected time budget;
- explicit hard-constraint validation.

### 6.4 Recommend

Happy Path returns one primary route or walk and a concise Route Receipt:

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

The fastest or most-direct route remains available as a comparison but should not visually compete with the recommendation by default.

### 6.5 Inspect

Tapping a segment answers **Why this street?** with the evidence that affected the decision.

Example:

- estimated building shade at the selected time;
- less direct sun than the parallel avenue;
- two mapped benches within five minutes;
- one sidewalk-shed record avoided;
- derived evidence, with validation status and source date.

### 6.6 Refine

The user can say:

> “Shorten it, but keep most of the shade and the bathroom.”

> “Make the loop a little greener.”

Happy Path patches the existing Trip Brief, recomputes the route, and explains the delta. If no route satisfies the refinement, the product exposes the conflict rather than silently relaxing it.

## 7. Journey shapes

### P0 foundation: Go somewhere

A fixed origin and destination with an evidence-backed route alternative. This is the first implementation foundation because it gives the clearest baseline and tradeoff.

### P1 target: Loop

A time-boxed walk returning near the starting point. The user supplies a duration and preferences; Happy Path chooses the path.

### P1 target: Wander

The user supplies a direction, area, endpoint type, or walking-time budget. Happy Path chooses an endpoint and path while remaining within the stated constraints.

P1 does not require a general multi-stop itinerary planner. Optional public resources or points of interest may act as waypoints or endpoints only when they fit the route and time budget.

## 8. City-data capability target

The companion [data and inference specification](data-and-inference.md) contains exact sources, dataset IDs, claim boundaries, and validation gates.

| Layer family | Resident use | Detour use | P1 target |
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
| Weather and alerts | Time-sensitive defaults and context | Scenario context | Future live-data adapter |
| Recent observations | Operational corrections | Ground-truth and data-gap reduction | Later, expiring evidence |

### P1 data breadth target

The integrated product should:

1. catalog the full target layer set in the source registry;
2. ingest at least five official NYC datasets in addition to the pedestrian graph;
3. make at least five city-data layers inspectable on the map or in evidence details;
4. have at least three independent layer families materially affect a route, requirement, waypoint, or Route Receipt;
5. use at least one quantitative hero feature with validated route-level comparison;
6. preserve uncertainty where coverage is incomplete;
7. allow future time-sensitive inputs, such as weather, without changing the core layer contract.

Not every ingested layer must control routing. Some may support explanation, waypoint selection, warning, coverage display, or Detour analysis first.

## 9. AI and inference boundary

The detailed contracts live in [data-and-inference.md](data-and-inference.md).

### AI may

- compile colloquial language into supported Trip Brief fields;
- infer destination, loop, or wander shape;
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
- infer live noise, crowding, amenity operation, weather effects, or construction state without current evidence;
- claim ADA accessibility or personal safety;
- invent civic tasks or planning impacts;
- output arbitrary map code, symbols, or colors.

Inference must fail safely. Deterministic route controls remain available when the model is unavailable or the request contains unsupported criteria.

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

The product should teach users what public data made the journey possible without forcing them to operate a data portal.

## 11. Personalization

P1 personalization comes primarily from the current request and visible refinements.

P1 may also support explicit taste anchors supplied for the current trip, such as a park, street, or place the user likes. The system must explain the connection rather than claim universal taste.

Persistent cross-session memory is later. With explicit opt-in, Happy Path may remember structured tendencies such as choosing greener streets or accepting a typical detour. The current request always outranks history. The system learns route preferences, not sensitive identity, health, home, work, or personality traits.

## 12. Detour

Detour is a separate planning surface using the same graph, source registry, evidence, route features, and simulation engine.

It asks:

> **Where does the city make a desired journey unnecessarily difficult, and what intervention could reduce that burden?**

The P1 planning proof should reuse one validated resident feature—for example shade continuity, seating access, restroom access, or mapped-step detour—and show:

1. representative journeys;
2. a repeated route burden;
3. the segment or missing amenity causing it;
4. a hypothetical intervention;
5. before-and-after rerouting and burden reduction;
6. evidence, assumptions, and uncertainty.

Full requirements live in [DETOUR.md](DETOUR.md). A general planner workspace and workflow integration are later.

## 13. Delivery scope

### P0 foundation

- Manhattan pedestrian graph and geocoding;
- fixed origin-to-destination routing;
- fastest route and time-aware shade alternative;
- explicit minute-based detour budgets;
- source, coverage, confidence, and validation labels;
- basic Trip Brief, Route Receipt, and map inspection;
- reusable layer and evidence contracts.

### P1 target

- operating geography from Lower Manhattan through Midtown, approximately south of Central Park;
- destination, loop, and wander journey shapes;
- one natural-language request and visible editable Trip Brief;
- one recommended route or walk;
- natural-language refinement;
- time-aware shade, trees and parks, mapped steps, seating, restrooms, water or public space, and sheds or construction context;
- at least three validated layer families affecting the result;
- at least five official NYC datasets integrated and inspectable;
- one P1 Detour planning proof using the same feature registry;
- responsive mobile experience with complete loading, unsupported, partial-coverage, and error states.

### Later / stretch

- persistent preference memory;
- broad restaurant, nightlife, or event recommendation;
- richer live data such as weather, service alerts, or activity feeds;
- guaranteed ADA-compliant routing;
- turn-by-turn navigation;
- citywide or multimodal coverage;
- custom icon family;
- full interactive Detour workspace and planning-tool integration;
- Civic Assets & Actions, resident photo verification, and authorized contribution matching.

## 14. Demo suite

### Cooler Manhattan

> “Get me to Washington Square Park with less direct sun. I can add five minutes.”

Demonstrates buildings, solar position, route comparison, greenery context, and a quantitative receipt.

### Considered loop

> “Give me a green 25-minute loop with places to sit and water nearby.”

Demonstrates a destination-free journey, trees, parks, seating, fountains, and the time budget.

### Taking my parents

> “Help us walk toward Union Square with places to rest, a bathroom, and no mapped steps.”

Demonstrates a flexible endpoint, seating, restrooms, public space, greenery, mapped steps, and honest handling of unsupported accessibility guarantees.

### Rain and construction

> “It’s raining. Get me there while avoiding construction friction and favoring likely cover.”

Demonstrates sheds, construction context, public-space or transit anchors, and visible uncertainty. Live weather may be supplied manually or through a later adapter.

### Detour reveal

Show that the same route features reveal a recurring shade, seating, restroom, or access gap and support a before-and-after intervention scenario.

## 15. Acceptance criteria

The P1 prototype succeeds when:

1. A user can describe where and/or how they want to walk in one short request.
2. A natural-language request produces a visible, editable Trip Brief.
3. Destination, loop, and wander each produce at least one credible pilot journey.
4. A relevant baseline renders correctly.
5. Happy Path returns a valid alternative inside the selected time budget.
6. The Route Receipt quantifies the route tradeoff.
7. Changing departure time changes shade evidence when expected.
8. A refinement changes the route predictably.
9. Confirmed hard requirements are never silently relaxed.
10. Every important claim maps to deterministic metrics and source evidence.
11. Unknown, stale, partial, or pending evidence remains visibly uncertain.
12. Inference failure falls back to deterministic controls.
13. At least five official NYC datasets are integrated and inspectable.
14. At least three independent layer families materially influence a route, requirement, waypoint, or receipt.
15. Every integrated layer has a documented capability status and claim boundary.
16. At least four demo prompts activate meaningfully different combinations of city data.
17. At least ten destination routes and a representative set of loops and wanders are manually reviewed.
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

> **Happy Path converts a short request describing where and/or how someone wants to walk into an evidence-backed route through Manhattan. It integrates fragmented NYC public data through a shared city-layer platform, computes valid alternatives, selects a practical tradeoff within the person’s available time, and explains what every detour buys. AI interprets and communicates; deterministic systems establish route facts. The product cares about the journey—not only arrival—and connects residents to City resources, public spaces, and information along the way. The same street model powers Detour, which identifies where missing shade, access, amenities, or infrastructure impose repeated journey burdens and tests which interventions could make the largest difference. Future live data and optional resident observations can make both sides more current and useful.**