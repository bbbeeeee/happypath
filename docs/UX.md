# Footnote — Core UX and Product Language

> Companion to the [PRD](PRD.md). This document defines how Footnote should feel, speak, and behave for residents.

## 1. Experience standard

Footnote should feel like a thoughtful consumer product, not a technical demonstration, GIS dashboard, or chatbot with a map attached.

The visible experience is simple:

> **Say what kind of walk you want → check what Footnote understood → get one considered route → see why it fits → refine it naturally.**

The complexity may be substantial underneath. The user should experience that complexity as care:

- the route appears considered rather than merely different;
- the map shows only what matters now;
- the explanation sounds human and useful;
- public data feels relevant rather than bureaucratic;
- uncertainty is honest without overwhelming the experience;
- refinements feel immediate and predictable.

### Demo quality bar

The hackathon build should feel like a real, coherent product inside its supported Manhattan area.

That means:

- use real NYC and open data for route facts wherever practical;
- preprocess and clean data so the interaction is fast and visually calm;
- prepare strong, validated journeys without reducing the demo to a fake animation;
- remove debug language, raw IDs, schemas, and implementation jargon from the resident UI;
- make loading, empty, partial-data, and failure states feel intentional;
- use friendly product copy throughout;
- prefer one polished end-to-end experience over many unfinished controls.

Synthetic or manually configured information may be used only for a clearly labeled scenario, such as a hypothetical Detour intervention. It must not be presented as an observed City fact.

## 2. The magical moments

The experience should create five clear moments.

### 2.1 Footnote understands me

A short request becomes a useful Trip Brief without a long interview.

> “A green 25-minute loop with places to sit.”

Becomes:

```text
25-minute loop
Greener streets
Places to rest along the way
Starting and ending here
```

### 2.2 The route visibly changes for a reason

The recommended route should be materially different when the request supports a better alternative.

The user should be able to see and understand the difference within a few seconds.

### 2.3 The extra time feels worth it

Footnote should answer:

> **What did the detour buy me?**

Examples:

- 11 fewer estimated minutes in direct sun;
- a shorter longest exposed stretch;
- three mapped places to sit;
- a restroom with published hours near the midpoint;
- fewer blocks with active sidewalk-shed records.

### 2.4 The map responds to the moment

Changing the time, route need, or constraint should produce an understandable change in the route or evidence.

Later, relevant live context such as weather, alerts, or verified observations may influence the same interaction.

### 2.5 Refinement feels conversational, not procedural

> “A little shorter, but keep the bathroom.”

The route updates and explains the delta without asking the user to rebuild the request.

### 2.6 One resident insight opens the planning story

Detour should not compete with route planning on the first screen. It becomes relevant after Footnote has identified a concrete route burden.

Preferred transition:

> **See this gap across more journeys**
>
> This exposed stretch still affects your route. Check whether the same gap appears on similar public journeys.

The transition carries the route segment, need, route metric, and evidence IDs into the planning surface. The user should not have to choose a fresh layer or restate the question.

## 3. Core experience

### 3.1 Compose

Required elements:

- current or editable origin;
- optional destination or end condition;
- natural-language request;
- walking-time or extra-time allowance;
- departure time, defaulting to now;
- one clear action.

Primary prompt:

> **Where and how would you like to walk?**

Suggested prompts should demonstrate supported value:

- “Less direct sun to Bryant Park, up to five minutes longer.”
- “A green 20-minute loop with somewhere to sit.”
- “Walk north for about 35 minutes and finish near a subway.”
- “Avoid mapped steps and pass a restroom if possible.”
- “Map me a shaded two-mile run that loops back here.”

Every visible example is a product contract. Each meaningful phrase must change a Trip Brief field, deterministic route behavior, ranking, receipt claim, or visible unsupported state. Decorative semantics are not allowed.

For loops and wanders, explicit distance replaces the active time target; a later explicit time replaces distance. The preview supports 0.25–5 miles. A destination-free run defaults to a loop. Route distance is measured from geometry, while displayed duration remains a pedestrian-graph estimate and must not be presented as running pace.

Quick controls are secondary. They edit the same Trip Brief and should never grow into a large layer panel.

### 3.2 Interpret

Show a compact, editable Trip Brief before or alongside route generation:

```text
Your walk
25-minute loop

Looking for
Greener streets · places to sit

Avoid
Mapped steps

Leaving
Now
```

Each material assumption is editable.

The system asks at most one question before routing, and only when the answer changes the journey shape, endpoint, time budget, or hard requirement.

Good:

> “Should every mapped-step segment be avoided?”

Avoid:

> “Tell us more about your ideal walking vibe.”

### 3.3 Loading

Loading should feel purposeful and short.

Preferred copy:

> **Finding a better way**  
> Comparing practical routes for shade, greenery, and the things you asked for.

Avoid exposing internal agent steps, dataset calls, chain-of-thought, or technical progress logs.

When a layer is unavailable, continue with supported evidence when possible and explain the limitation after the route appears.

### 3.4 Result

The default result contains:

- one visually dominant Footnote;
- origin and destination, loop, or end condition;
- total time and relevant baseline;
- two to four meaningful benefits;
- one material tradeoff when present;
- a short confidence summary;
- a refinement field;
- an optional fastest or direct comparison.

Example:

```text
YOUR FOOTNOTE

22 min · 4 min longer

A little longer, a lot shadier
• about 11 fewer minutes in direct sun
• longest exposed stretch: 3 min instead of 8
• 3 mapped places to sit along the way

One tradeoff
A busier final block near the park

Good confidence for route and time
Shade is an estimate
```

The result should read like a recommendation from a considerate product, not a model report.

### 3.5 Compare

The fastest or most-direct route is available on demand or in a subdued comparison state.

Show:

- geometry;
- time difference;
- primary benefit difference;
- important gain and loss;
- whether both satisfy hard requirements.

Do not show a wall of similar alternatives.

### 3.6 Inspect

Tapping a route segment or receipt claim opens **Why this way?**

Example:

```text
WHY THIS WAY?

This block is likely shadier at 3:20 PM.
It also keeps you close to two mapped benches.
The parallel avenue has less estimated shade.

Based on
NYC building shapes and heights
NYC DOT seating locations

Shade is estimated and some street details may be incomplete.
```

The technical provenance remains available, but the main explanation begins with the human reason.

### 3.7 Refine

The composer remains available on the result:

- “Shorter, but keep most of the shade.”
- “More greenery.”
- “Keep the bathroom and avoid the shed blocks.”
- “Make this a 30-minute loop.”

Show a concise change summary:

```text
Route updated

2 minutes shorter
3 more minutes in estimated sun
Bathroom retained
Mapped steps still avoided
```

When the request cannot be satisfied, explain the conflict and present clear choices.

### 3.8 City data used

The initial result should not begin with a source list. A calm, expandable row can say:

> **Built with 6 city and street data sources**

The expanded view shows:

```text
CITY DATA USED

For the route
• NYC buildings — estimated shade
• NYC Forestry Tree Points — greener streets
• OpenStreetMap — walking paths and mapped steps

Along the way
• NYC DOT seating — 3 mapped places
• NYC public restrooms — published hours

Context
• DOB sidewalk sheds — permit records; current presence may vary
```

Use plain language first. Dataset IDs, retrieval dates, coverage, and method versions belong one level deeper.

For rain or cover, preferred summary copy is:

> **Uses paths explicitly mapped as covered**
>
> Most streets have not been assessed, and mapped cover does not promise a dry or passable path.

Shed permits, nearby POPS arcades, and dated construction records may appear in deeper context. They do not become covered-route meters because they are close to a path.

## 4. Journey shapes

### Destination

A fixed origin and destination with a better-fit route.

### Loop

A time-boxed walk returning near the start.

### Wander

A direction, area, end condition, or walking-time budget where Footnote chooses the endpoint and route.

All three should share the same visual language and Trip Brief. The user should not feel that they entered a separate feature.

## 5. Map visual system

### 5.1 Default hierarchy

1. Footnote route
2. Origin, destination, or loop state
3. Required waypoint or amenity
4. Evidence supporting the primary benefit
5. Warning or hard constraint
6. Secondary context

### 5.2 Clean and complete by default

The map should always feel like a full Manhattan street map, even when a particular City dataset has partial or uneven coverage.

The default map should show:

- a complete, legible street and place context across the visible supported area;
- one route;
- one continuous evidence treatment at most;
- only route-relevant assets and warnings;
- a compact legend only when needed.

Optional data layers should **add information**, not replace the map underneath them.

A street with no tree, shed, seating, or other layer record should still look like an ordinary street. Do not blank it out, heavily dim it, mask it, or make it appear unsupported simply because one overlay has no observation there.

When lack of coverage materially affects a recommendation, communicate that uncertainty locally on the relevant route segment, in the receipt, or in the evidence view. Do not turn ordinary map areas into large visual “unknown” zones unless the uncertainty itself is the thing the user is inspecting.

Do not display every integrated City layer merely to prove it exists.

### 5.3 Continuous conditions

Use ambient or segment treatments for:

- estimated shade or sun;
- greenery;
- grade;
- experimental activity or noise context.

Continuous overlays should be transparent enough that streets, parks, landmarks, and route context remain recognizable beneath them.

The route line must remain dominant and legible.

### 5.4 Discrete assets

Use icons for:

- seating;
- restrooms;
- water;
- transit entrances;
- public spaces;
- mapped steps;
- sheds or obstructions;
- selected stops.

Display an asset by default when it is required, selected, materially affected the route, or explains a warning.

### 5.5 Layer selection

AI may propose which registered layers and claims are relevant. Deterministic presentation rules control:

- styling;
- collision;
- density;
- zoom thresholds;
- required warnings;
- maximum visible layers.

P1 target: one continuous layer plus relevant discrete assets and warnings.

### 5.6 Motion and responsiveness

Use restrained motion to make recomputation understandable:

- the prior route softens;
- the new route draws or settles into place;
- receipt changes animate subtly;
- the map reframes without disorienting the user.

Avoid decorative animation that delays the answer.

## 6. Product language

### 6.1 Voice

Footnote should sound:

- thoughtful;
- friendly;
- calm;
- competent;
- concise;
- honest about uncertainty.

It should not sound:

- bureaucratic;
- overly technical;
- robotic;
- cutesy;
- alarmist;
- falsely certain.

### 6.2 Copy rules

- Lead with the human benefit, then explain the evidence.
- Use “mapped,” “estimated,” or “published” when those distinctions matter.
- Prefer short sentences and familiar words.
- Do not expose internal names such as `RouteCandidate`, `routing-ready`, or `validation_status` in the resident UI.
- Do not use “optimal” when the route is a tradeoff.
- Do not describe neighborhoods as good, bad, safe, unsafe, healthy, or unhealthy.
- Do not claim accessibility where the product only avoids mapped steps or estimates grade.

### 6.3 Translation table

| Internal or technical language | Resident-facing language |
| --- | --- |
| Derived solar-exposure metric | Estimated direct sun |
| Mapped-step hard exclusion | Avoids steps shown in our map data |
| Validation pending | Some street details may be incomplete |
| Source temporarily unavailable | We couldn’t check one city data source right now |
| No non-dominated candidate | We couldn’t find a meaningfully better route within your time |
| Amenity inventory record | Mapped place to sit / mapped restroom |
| Construction-friction proxy | Streets with recent construction or shed records |
| Inference failure | We couldn’t interpret that request, but you can still choose what matters below |

### 6.4 Preferred product moments

- “A little longer, a lot shadier.”
- “We found a gentler way.”
- “You’ll pass three mapped places to sit.”
- “Most of the shade benefit comes from four extra minutes.”
- “We couldn’t find a better option within five minutes, so we kept the direct route.”
- “This restroom has published hours, but we can’t confirm that it’s open right now.”

## 7. Data realism and demo curation

### 7.1 Real data by default

Resident route geometry, route metrics, assets, and source explanations should use actual supported-area data wherever the claim implies current or historical reality.

### 7.2 Curated does not mean fake

It is acceptable to:

- crop the geography;
- preprocess and simplify geometry;
- cache data;
- choose strong demonstration journeys;
- precompute expensive features;
- hide unsupported locations or prompts;
- use a scripted Detour intervention.

It is not acceptable to:

- invent a current amenity state;
- show a fake live crowd level;
- present a hypothetical intervention as built;
- hard-code a numerical benefit that the route engine did not calculate.

### 7.3 Supported-area behavior

Inside the supported Manhattan area, the product should feel complete. Outside it, use friendly language:

> **Footnote is exploring Manhattan below Central Park for now.**

Do not expose an arbitrary bounding box or developer error.

## 8. Required states

The UI must define:

- first-use empty state;
- geocoding loading and failure;
- location outside supported area;
- route unavailable;
- hard requirement unsatisfied;
- inference unavailable;
- partial data coverage;
- source temporarily unavailable;
- no meaningful alternative to the baseline;
- route updated after refinement;
- contextual resident-to-Detour handoff;
- mobile map loading and recovery.

Every state should preserve a clear next action.

## 9. Accessibility and responsive behavior

- Use semantic controls and visible focus states.
- Do not encode critical distinctions by color alone.
- Keep route, receipt, and refinement usable on a phone without hiding warnings.
- Allow map and sheet sizes to change without losing route context.
- Avoid small tap targets and dense icon clusters.
- Respect reduced-motion preferences.
- Use narrow claim language rather than implying guaranteed accessibility.

## 10. UX acceptance criteria

1. A new user can create a supported walk without opening a layer panel.
2. The product’s purpose is understandable within the first screen.
3. The Trip Brief makes the interpretation inspectable and editable.
4. Destination, loop, and wander use one coherent interaction model.
5. One route is visually dominant.
6. The primary benefit and cost are understandable within a few seconds.
7. Every visible layer is relevant to the request, route, or warning.
8. The base map remains visually complete and legible regardless of optional data-layer coverage.
9. Partial layer coverage does not make ordinary streets look missing or unsupported.
10. The product uses friendly resident language in all primary states.
11. Technical data and provenance remain available without dominating the route.
12. A refinement updates the same Trip Brief and visibly changes the route.
13. Partial coverage and uncertainty are understandable without technical documentation.
14. The interface feels complete on a representative mobile viewport.
15. One resident hero, one planner continuation, and up to two supporting proofs work from a clean session using real supported-area data for every displayed claim.
16. No resident-facing screen exposes raw dataset fields, internal schemas, debug logs, or unexplained technical jargon.
17. A user can reach the first meaningful recommendation quickly enough for the interaction to feel immediate.
18. Every meaningful phrase in a displayed example has a visible interpretation or limitation.
19. The primary receipt presents one benefit, one cost, and retained hard requirements before technical evidence.
20. Detour opens from a route burden with the relevant segment, need, and evidence already selected.
