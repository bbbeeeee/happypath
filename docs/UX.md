# Happy Path — Core UX and Map Specification

> Companion to the [PRD](PRD.md). This document defines the resident-facing interaction and presentation model.

## 1. Experience goal

Happy Path should feel like an intelligent map, not a chatbot with a map attached and not a GIS dashboard.

The shortest useful interaction is:

> **Say one sentence → inspect the Trip Brief → receive one route → understand why → refine it naturally.**

Complexity belongs in the routing, evidence, and layer systems. The visible experience should remain decisive and calm.

## 2. Information hierarchy

The interface should answer these questions in order:

1. Where does this route go?
2. How long will it take?
3. Why does it better fit my request?
4. What did the detour cost and buy?
5. What evidence supports the result?
6. What remains uncertain?
7. How can I change it?

The route should remain visible while the user inspects details or edits the request.

## 3. Core screen states

### 3.1 Compose

Required elements:

- origin;
- destination;
- departure time;
- natural-language input;
- extra-time allowance;
- route action.

Primary prompt:

> **How do you want this walk to feel?**

Suggested examples should demonstrate supported requests rather than imply unsupported general intelligence.

Recommended examples:

- “Less direct sun, up to five minutes longer.”
- “Avoid mapped steps and pass somewhere to sit.”
- “Greener streets, with a restroom near the middle.”

Quick controls are secondary and synchronized with the same Trip Brief. P0 controls may include:

- Cooler;
- Greener;
- Avoid mapped steps;
- Seating;
- Restroom;
- fastest / +5 / +10 minutes.

Do not show every cataloged city layer as a control.

### 3.2 Interpret

After submission, display a compact Trip Brief before or alongside route generation:

```text
Going to
Washington Square Park

Priorities
Less direct sun · seating nearby

Avoid
Mapped steps

Flexible by
Up to 5 minutes

Leaving
3:15 PM
```

Each tag can be removed or edited. Unsupported and uncertain interpretations remain visible.

The system asks at most one question before routing. Examples:

- “Should every mapped-step segment be excluded?”
- “Is the bathroom required, or just preferred?”

Do not ask preference questions that do not materially change the route.

### 3.3 Loading

Loading should explain useful progress without exposing internal agent behavior:

```text
Comparing practical routes
Checking shade, greenery, and requested amenities
```

If some layers are unavailable, continue with supported evidence and show the limitation in the result.

### 3.4 Result

The default result contains:

- one visually dominant Happy Path;
- origin and destination;
- total time and extra minutes;
- two to four important improvements;
- one meaningful tradeoff when present;
- confidence summary;
- refinement composer;
- control to compare the fastest route.

Example receipt:

```text
YOUR HAPPY PATH

22 minutes · 4 minutes longer

11 fewer estimated minutes in direct sun
Longest exposed stretch: 3 min instead of 8
3 mapped seating locations along the way
No mapped-step segments

Tradeoff
One busier avenue block near the destination

Confidence
High for route and time · Medium for shade
```

The first view should not display a long source list. A compact **City data used** row opens evidence details.

### 3.5 Compare

The fastest route is available on demand or displayed in a subdued state.

Comparison should show:

- route geometry;
- time difference;
- primary metric difference;
- major gain and loss;
- whether both routes satisfy hard requirements.

Do not present several undifferentiated alternatives. Show at most one meaningful alternative when it illustrates a real tradeoff.

### 3.6 Inspect

Tapping a route segment or receipt claim opens a detail sheet:

```text
WHY THIS STREET?

Estimated building shade at 3:20 PM
Less direct sun than the parallel avenue
Two mapped benches within five minutes
No active sidewalk-shed record on this segment

Evidence
NYC BUILDING · derived shadow model
NYC DOT Seating · official inventory

Confidence
Medium-high
```

The detail sheet distinguishes:

- official fact;
- deterministic derivation;
- model inference;
- recent observation;
- unknown state.

### 3.7 Refine

The composer stays available on the result:

> “Shorten it, but keep the restroom.”

> “A little greener.”

> “Avoid the shed blocks.”

The update should show a concise delta:

```text
Route updated

2 minutes shorter
3 additional minutes in estimated direct sun
Restroom retained
Mapped-step avoidance retained
```

When the request is unsatisfiable, explain the conflict and offer explicit choices.

### 3.8 Evidence and coverage

The evidence drawer should show:

- city datasets used;
- whether each layer affected routing, waypoint selection, warning, or explanation;
- capability status;
- source freshness;
- coverage along the route;
- important limitations.

Example:

```text
CITY DATA USED

Routing
• NYC BUILDING — estimated shade
• NYC Forestry Tree Points — greenery
• OpenStreetMap — pedestrian paths and mapped steps

Amenities
• NYC DOT Seating — 3 mapped locations
• NYC Public Restrooms — published hours only

Context
• DOB Sidewalk Sheds — current permit record, presence unverified
```

## 4. Map visual system

### 4.1 Default hierarchy

1. Happy Path route
2. Origin and destination
3. Required waypoint or amenity
4. Evidence supporting the primary route claim
5. Warning or hard constraint
6. Secondary context

### 4.2 Continuous conditions

Use ambient or route-segment treatments for:

- estimated direct sun or shade;
- greenery;
- grade;
- experimental activity or noise context.

The route line must remain readable above continuous layers.

### 4.3 Discrete assets

Use icons for:

- seating;
- restrooms;
- water;
- transit entrances;
- public spaces;
- mapped steps;
- sheds or obstructions;
- selected stops.

Display an asset by default when it is required, selected, materially affects the route, or explains a warning. Other nearby assets remain discoverable through a contextual layer toggle or detail view.

### 4.4 Layer selection

AI may propose which registered layers and claims are relevant. Deterministic presentation rules control:

- collision;
- density;
- zoom thresholds;
- visual styling;
- required warnings;
- maximum visible layers.

Recommended P0 limit: one continuous evidence layer plus relevant discrete assets and warnings.

### 4.5 Confidence and stale data

Do not cover the map in confidence badges. Show uncertainty:

- in the Route Receipt;
- in the detail sheet;
- with a subtle warning treatment when it affects the immediate decision.

Absence of an asset must not be visually confused with absence of data.

### 4.6 Icons

P0 should use a coherent existing icon library. A custom Happy Path icon family is a parallel or later visual-design task, not a blocker for the product flow.

## 5. Journey-shape progression

### P0: destination route

Fixed origin and destination with an experiential route alternative.

### Stretch: loop

The user supplies a duration. Happy Path produces a route returning near the start and explains its experience metrics.

### Later: wander

The user supplies a direction, area, endpoint type, or total outing budget. Happy Path selects both endpoint and path.

Do not let loop or wander requirements complicate the destination-route UI before P0 is stable.

## 6. Demo flows

### Cooler Manhattan

1. Select origin and destination.
2. Ask for less direct sun with five extra minutes.
3. Inspect the Trip Brief.
4. Receive a route with a quantitative receipt.
5. Change departure time and see the evidence update.
6. Inspect a selected shaded segment.

### Taking my parents

1. Ask for mapped-step avoidance, places to rest, and a bathroom.
2. Confirm whether mapped steps are a hard exclusion.
3. Receive a route using seating, restroom, greenery, and access evidence.
4. Inspect uncertainty and the distinction between mapped-step avoidance and accessibility.

### Rain and construction

1. Ask for less exposed walking and fewer construction-friction blocks.
2. Receive a route using shed and construction context.
3. Show that likely cover is not a dryness guarantee.

## 7. Required states

The UI must define:

- first-use empty state;
- geocoding loading and failure;
- location outside pilot;
- route unavailable;
- hard requirement unsatisfied;
- inference unavailable;
- partial data coverage;
- source temporarily unavailable;
- no meaningful alternative to fastest;
- route updated after refinement;
- mobile map loading and recovery.

## 8. Accessibility and responsive behavior

- Use semantic controls and visible focus states.
- Do not encode critical distinctions by color alone.
- Keep route, receipt, and refinement usable on a phone without hiding required warnings.
- Allow map and sheet sizes to change without losing route context.
- Avoid small tap targets and dense icon clusters.
- Use narrow claim language instead of implying guaranteed accessibility.

## 9. UX acceptance criteria

1. A new user can create a supported route without opening a layer panel.
2. The Trip Brief makes the system interpretation inspectable and editable.
3. One route is visually dominant.
4. The user can understand the primary benefit and cost within a few seconds.
5. Every visible layer is relevant to the request or route explanation.
6. A user can inspect which City sources supported a claim.
7. A refinement changes the same Trip Brief rather than starting a separate chat.
8. Hard requirements remain visible through the entire flow.
9. Partial coverage and uncertainty are understandable without reading technical documentation.
10. The three primary demo flows can be completed on a representative mobile viewport.
