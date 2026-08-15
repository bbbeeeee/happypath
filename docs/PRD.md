# Happy Path

**Product direction:** Conversational, personalized routing through the city

**Primary product:** Happy Path

**Planning extension:** Detour

**Later platform layer:** Public Assets & Actions

**Initial mode:** Walking

**Initial geography:** A bounded, data-rich NYC pilot area

## 1. Product summary

**Happy Path helps people find a route that fits the person, purpose, and moment—not merely the shortest path.**

A user says one sentence:

> “Give me a green 20-minute loop that isn’t too hilly.”

> “My parents tire easily. Help us stroll toward Fifth Avenue and end somewhere with a bathroom.”

> “I have 45 minutes in Bushwick. Take me past places similar to the ones I’ve saved and end near the L.”

Happy Path:

1. understands the type of journey;
2. shows the user what it inferred;
3. computes a route from street-level city data and personal preferences;
4. explains why the route fits;
5. lets the user refine it naturally.

The product is not a chatbot that returns generic recommendations. It is an **intent-to-path engine**: conversational input controls a transparent, data-grounded routing system.

**Detour** uses the same model to identify where the city prevents desirable journeys from existing. It measures the burden created by missing shade, inaccessible connections, construction, absent amenities, and other public-realm gaps, then simulates which interventions could have the greatest impact.

A later **Public Assets & Actions** layer can match walkers with safe, verified opportunities to improve or observe the city along their route.

## 2. Product promise

> **Say how you want to move through the city. Get a route that fits, understand why, and reshape it naturally.**

The core experience should feel magical because it removes configuration, not because it hides complexity.

The interaction is:

> **Say one sentence → inspect what Happy Path inferred → receive a computed route → refine it naturally.**

## 3. Problem

Existing navigation products optimize primarily for time and distance. General-purpose AI can suggest neighborhoods, venues, or itineraries, but it does not reliably reason over the physical experience of each street segment.

Neither approach adequately answers:

* What is the greenest useful 20-minute loop from here?
* How can I walk toward a general area without choosing an exact destination?
* Which path is easiest for someone who tires quickly?
* Where can we pause, sit, or use a restroom along the way?
* Can I avoid steep blocks, stairs, construction, or sidewalk sheds?
* Which route resembles places and streets I personally enjoy?
* What do five additional minutes materially improve?
* Can I contribute something useful to the city during my walk?

NYC has much of the underlying information, but it is distributed across separate datasets and rarely translated into an actual journey.

## 4. Product principles

### 4.1 The route is the product

Happy Path is not primarily a place-discovery chatbot. Recommendations, events, and destinations may become anchors, but the main output is a computed path through the city.

### 4.2 One sentence should be enough

The user should not begin with a page of filters and sliders. Happy Path infers the initial trip specification from natural language and exposes it for correction.

### 4.3 Personalization should be earned

The system should not claim to know what is “cool,” “fun,” or tasteful in the abstract.

It should personalize using explicit evidence:

* places the user has saved or liked;
* previous routes they enjoyed;
* qualities they have selected repeatedly;
* stated dislikes;
* optional taste anchors supplied for the current request.

Happy Path should say:

> “This route passes independent galleries, relaxed bars, and lower-density side streets similar to places you’ve saved.”

It should not say:

> “This is the coolest route in Bushwick.”

### 4.4 Taste ranks candidates; it does not invent facts

Language models may interpret preferences and compare semantic similarities. The routing engine and underlying data determine where the route can actually go.

### 4.5 Every result should have reasons

Each recommendation should explain:

* what the system understood;
* which measurable characteristics influenced the route;
* what tradeoffs were made;
* what is official, inferred, observed, or uncertain.

### 4.6 No universal block score

A street is not permanently good or bad. Its usefulness depends on the person and situation.

A crowded, sunny street may be poor for a quiet afternoon walk, ideal for someone seeking nightlife, and irrelevant to a person prioritizing step-free access.

## 5. Core journey types

Happy Path should infer one of three simple journey shapes.

### A. Go somewhere

The user has a destination.

> “Get me to MoMA, but keep it easy for my parents.”

The destination is fixed; the experience of the route is optimized.

### B. Take a walk

The user specifies a duration but not a destination.

> “Give me a green 20-minute walk.”

Happy Path creates a loop or an out-and-back route, depending on the request and geography.

### C. Wander toward or end somewhere

The user has a direction, neighborhood, endpoint type, or total outing budget rather than a precise destination.

> “Stroll toward Fifth Avenue and end somewhere we can sit.”

> “I have 45 minutes. Walk me through interesting streets and finish near the L.”

Happy Path chooses an appropriate endpoint and route together.

The inferred trip brief must distinguish:

* **walking duration:** “a 20-minute walk”;
* **total outing duration:** “I have 45 minutes before dinner”;
* **fixed destination** versus **destination region**;
* **loop** versus **one-way journey**.

## 6. Primary user experience

### Step 1: One conversational input

The home screen contains one prominent prompt:

> **What kind of way are you looking for?**

Examples beneath it:

* “A shaded 25-minute loop.”
* “Easy walk toward Union Square with somewhere to sit.”
* “Take me to dinner through quieter streets.”
* “Walk me past places similar to the ones I’ve saved.”
* “Give me a green walk and one small way to help.”

Origin defaults to the current location but remains editable.

### Step 2: Happy Path shows its interpretation

Before or alongside the route, the app displays a compact, editable trip brief:

```text
20-minute loop
Starting and ending here

Priorities
Greenery · lower slopes · quieter side streets

Avoid
Mapped stairs

Flexible by
Up to 4 minutes
```

The user can edit any assumption directly.

Happy Path should ask at most one question before producing a route, and only when the answer would materially change the result:

> “Should this return you to your starting point?”

> “Should the route be completely step-free?”

### Step 3: Happy Path returns one primary route

The primary result should be decisive rather than showing a wall of options.

```text
YOUR HAPPY PATH

24 minutes · 3 minutes longer than fastest

Why it fits
• 42% more estimated shade
• 28 feet less climbing
• avoids 2 active sidewalk sheds
• passes 3 places to sit

Tradeoff
One busier commercial block near the destination

Confidence
High for slope and construction
Medium for current shade
```

The fastest route remains visible for comparison.

### Step 4: The user refines it naturally

Examples:

> “Make it a little greener.”

> “Keep the bathroom, but shorten it.”

> “More like the streets around Fort Greene Park.”

> “Avoid the busy avenue.”

> “End near a coffee shop.”

The route and receipt update immediately:

```text
+2 minutes
+11% estimated shade
same total climbing
restroom retained
```

This conversational recomputation is the main product “aha.”

### Step 5: Explain any segment

Tapping a block answers:

> **Why this street?**

* gentler grade than the parallel block;
* estimated building shade at the departure time;
* continuous tree coverage;
* no active sidewalk-shed record;
* one seating location nearby.

The user can also see the underlying evidence and its freshness.

## 7. Preference and taste model

Personalization should be optional and understandable.

### Initial personalization

A new user can provide:

* three places or streets they enjoy;
* qualities they care about;
* one or two things they dislike.

Example:

```text
Places I like
Fort Greene Park
Elizabeth Street Garden
The streets around Dimes Square

Usually prefer
Independent shops
Older architecture
Green side streets

Usually avoid
Very loud avenues
Long exposed walks
```

### Learned personalization

Over time, Happy Path can learn from:

* routes selected over the fastest alternative;
* post-walk ratings;
* saved places and routes;
* repeated refinements;
* explicit “more like this” and “less like this” feedback.

The user must be able to view, edit, or clear these preferences.

### Personalized reasons

Reasons should connect the result to the user’s actual history:

> “You have repeatedly chosen tree-lined side streets over commercial avenues.”

> “Two route segments resemble the lower-density gallery and café areas you’ve saved.”

> “This endpoint matches your preference for places with outdoor seating and nearby transit.”

The system should distinguish personal-fit evidence from general city-data evidence.

## 8. What Happy Path can reason about

Each walkable street segment has a set of features. The initial product should focus on criteria that can be computed credibly.

### Comfort

* shade at the relevant time;
* greenery and canopy;
* slope and elevation gain;
* mapped stairs;
* pedestrian ramps and crossings;
* seating;
* restrooms;
* drinking water;
* construction and sidewalk sheds.

### Experience

* quieter versus more active streets;
* parks and public spaces;
* architecture and historical interest;
* restaurants, shops, and cultural places;
* scheduled events;
* compatibility with the user’s saved places and preferences.

### Journey continuity

Happy Path should reason about the route as a sequence, not only average scores.

Important derived measures include:

* **shade continuity:** longest exposed stretch;
* **rest continuity:** maximum time between places to pause;
* **access continuity:** whether one missing connection breaks the route;
* **interest cadence:** how often the route encounters something relevant;
* **escapeability:** access to transit or a shorter ending point if the user becomes tired.

A route that is 70% shaded but contains one uninterrupted ten-minute exposed stretch may be worse than a route with slightly less total shade but no severe gap.

## 9. Intelligence architecture

The product should separate language intelligence from geospatial computation.

```text
User sentence
      ↓
Intent and preference compiler
      ↓
Editable trip brief
      ↓
Candidate endpoint and route generation
      ↓
Enriched pedestrian street graph
      ↓
Deterministic route scoring
      ↓
Evidence-backed route and reasons
      ↓
Conversational refinement
```

### The language model handles

* understanding colloquial intent;
* inferring journey shape;
* translating vague preferences into supported criteria;
* determining whether clarification is necessary;
* matching current requests to known user preferences;
* explaining tradeoffs;
* interpreting follow-up refinements.

### The routing system handles

* legal pedestrian connectivity;
* route time and distance;
* slope and stairs;
* time-specific shade;
* amenities and stopping opportunities;
* construction and shed avoidance;
* candidate route generation;
* route scoring and detour limits.

### The evidence system handles

* source and provenance;
* observation date;
* official versus inferred values;
* confidence;
* user corrections;
* expiration of temporary observations.

The language model should never invent or directly draw a route.

## 10. Route selection

First calculate the fastest available route.

`Fastest time = T₀`

The user’s language or settings establish an acceptable additional-time budget.

`Maximum route time = T₀ + detour allowance`

Happy Path then chooses the highest-fit route within that budget.

The product may compare several distinct candidates internally, but should return:

1. one recommended Happy Path;
2. the fastest baseline;
3. optionally one meaningful alternative when there is a genuine tradeoff.

The result should answer:

> **What did the extra time buy?**

## 11. Contribution mode

Contribution should be an optional layer, not a requirement for using the app.

A user can ask:

> “Give me a green walk and one small way to help.”

Or enable:

> **Help along the way**

Happy Path may add at most one relevant task that is:

* close to the route;
* safe;
* current;
* specific;
* authorized by a City agency or trusted partner;
* completable within the user’s time budget.

### Initial task types

The MVP should emphasize observation and verification:

* confirm that a listed restroom is open;
* verify whether a pedestrian ramp is unobstructed;
* verify whether a public-space entrance is accessible;
* confirm that a sidewalk obstruction remains present;
* report a discrepancy between official data and physical conditions.

Later task types may include approved stewardship:

* record authorized tree care;
* join a garden or rain-garden workday;
* participate in an organized cleanup;
* support a scheduled public-space event.

Happy Path must not infer that residents should handle hazardous waste, pests, traffic conditions, infrastructure repair, or other unsafe work.

### Why contribution belongs in the product

The walker receives a useful route first. An optional task generates fresher ground truth about the public realm without turning the product into another complaint form.

The same observation can improve future routes and inform Detour.

## 12. Detour

### Purpose

Detour identifies where the city imposes avoidable burdens on desired journeys.

It converts isolated infrastructure conditions into route consequences:

* How many additional minutes does a missing step-free connection create?
* Where does one exposed block break an otherwise shaded corridor?
* Which active sidewalk sheds disrupt the greatest number of comfortable routes?
* Where is there an excessive gap between places to sit?
* Which restroom, ramp, shade, or seating intervention would improve the most journeys?

### Core concept: burden minutes

Instead of ranking neighborhoods, Detour measures the extra burden created by a specific gap.

Examples:

```text
Missing or uncertain ramp
+5.4 minutes for representative step-free trips
```

```text
Shade-network gap
8 unavoidable minutes in direct sun
between two otherwise shaded corridors
```

```text
Rest opportunity gap
17 minutes between available seating locations
on trips linking transit and public facilities
```

### Intervention simulation

A planner selects or proposes a change:

* add or repair a ramp;
* remove an obstruction;
* add seating;
* add shade or canopy;
* restore a restroom;
* reopen a pedestrian connection;
* remove a long-running shed.

Detour recalculates representative journeys before and after the intervention.

```text
PROPOSED INTERVENTION
Add seating near this intersection

WHY HERE
It closes a 17-minute gap between rest opportunities.

ESTIMATED EFFECT
• improves 420 representative journeys per week
• connects a station, library, and park
• reduces the longest rest gap from 17 to 8 minutes

CONFIDENCE
Medium
```

### Demand inputs

The initial Detour experience should not depend solely on Happy Path users.

It should combine:

* representative trips between transit, public facilities, parks, schools, and commercial areas;
* pedestrian-demand models;
* anonymized, aggregated Happy Path requests once sufficient volume exists;
* recent verified observations;
* official infrastructure and condition data.

User demand should supplement—not replace—equity-aware planning analysis.

### Planner interface

The first version should remain simple:

1. choose a journey need, such as **Gentle** or **Cool**;
2. view high-burden links;
3. inspect the cause and evidence;
4. apply a hypothetical intervention;
5. see the estimated improvement.

Natural-language planning queries can be added later:

> “Where would three benches reduce rest gaps most?”

> “Which sheds create the largest step-free detours?”

## 13. Public Assets & Actions platform

This is a later platform layer shared by Happy Path and Detour.

Each asset can have:

```text
asset
official state
recent observed state
responsible organization
open issue
available action
action publisher
last verified time
confidence
```

Possible assets include:

* trees and tree beds;
* ramps and crossings;
* benches;
* restrooms;
* drinking fountains;
* gardens;
* rain gardens;
* litter baskets;
* plazas and public spaces.

The platform should describe assets and responsibilities rather than scoring blocks.

Useful indicators include:

* **Known:** how recently conditions were verified;
* **Working:** whether the asset appears operational;
* **Actionable:** whether an authorized next action exists;
* **City follow-through:** status of official work or reports.

There should be no universal neighborhood-health leaderboard.

## 14. MVP

### Pilot experience

Build within one bounded area with strong alternate routes and sufficient data coverage.

### Required Happy Path capabilities

* one conversational input;
* origin detection and editing;
* three journey shapes:

  * destination;
  * loop;
  * directional or endpoint-based wander;
* current or future departure time;
* inferred and editable trip brief;
* fastest-route baseline;
* three reliable route dimensions:

  * greener/cooler;
  * gentler;
  * personally interesting;
* mapped-stairs avoidance;
* sidewalk-shed avoidance;
* seating and restroom awareness;
* one recommended route;
* quantified route receipt;
* segment-level explanations;
* natural-language refinements;
* confidence and provenance.

### Personalization MVP

Users can provide three to five taste anchors:

* saved places;
* streets;
* parks;
* venue types;
* explicit likes and dislikes.

The system uses these anchors to rank candidate routes and endpoints and explains the similarity.

A broad external history import is not required for the hackathon.

### Contribution MVP

Support one low-risk task type:

* verify an obstruction, restroom, ramp, or public-space condition.

The route may include one optional task.

### Detour MVP

Demonstrate one clear counterfactual:

* a missing or uncertain ramp;
* a shade-continuity gap;
* a long rest-opportunity gap;
* or a disruptive shed.

Show:

* present route burden;
* affected representative trips;
* simulated intervention;
* estimated burden reduction;
* evidence and confidence.

## 15. Demo scenarios

### Scenario 1: Time-boxed loop

> “Give me a green 20-minute loop from here. Nothing too hilly.”

Happy Path produces a loop, shows what it inferred, and explains the shade, canopy, and grade improvements over the most direct equivalent walk.

### Scenario 2: Comfort-sensitive drift

> “My parents tire easily. Help us stroll toward Fifth Avenue and end somewhere with a bathroom.”

Happy Path infers a directional journey, selects a suitable endpoint, favors lower slopes and rest opportunities, and exposes any accessibility uncertainty.

### Scenario 3: Personalized exploration

> “I have 45 minutes. Take me through streets similar to the places I’ve saved and finish near the L.”

Happy Path uses explicit taste anchors to choose route segments and an endpoint. The result explains the similarity rather than asserting generic taste.

### Scenario 4: Contribution

> “Give me a quiet walk and one small way to help.”

Happy Path adds one verified observation task without materially degrading the requested route.

### Scenario 5: Detour

The same pilot area reveals a single missing connection that creates repeated gentle-route detours. A simulated intervention visibly improves the network.

## 16. Non-goals

Happy Path is not:

* a generic AI travel planner;
* a chatbot that merely activates map filters;
* a universal nightlife or restaurant tastemaker;
* a replacement for all existing navigation;
* a guaranteed ADA-routing service at launch;
* a real-time citywide noise or crowding oracle;
* a crime or safety-score product;
* a neighborhood-quality ranking;
* a replacement for 311;
* a system for outsourcing City responsibilities to residents.

## 17. Success criteria

The prototype succeeds when:

1. A user can describe a journey in one natural sentence.
2. Happy Path correctly infers the route shape, time budget, and main preferences.
3. The user can understand and edit those assumptions immediately.
4. The resulting route is materially different from the fastest route.
5. The route receipt quantifies what the detour improves.
6. A conversational refinement changes the route predictably.
7. Personalization is tied to explicit user evidence.
8. Every important claim has provenance and confidence.
9. One optional contribution produces useful ground truth.
10. Detour demonstrates one credible, high-impact intervention.

Initial product metrics:

* percentage of trip briefs accepted without correction;
* percentage of users choosing Happy Path over fastest;
* post-walk “matched what I asked for” rating;
* average extra minutes willingly accepted;
* route-refinement success rate;
* explanation usefulness;
* verification-task completion;
* estimated burden reduced by Detour interventions.

## 18. Product definition

> **Happy Path turns a person’s situation, preferences, and available time into an explainable path through the city. It can take someone to a destination, create a time-boxed walk, or help them wander toward an appropriate endpoint. It combines public city data with explicit personal preferences, computes the route rather than improvising it, and explains what every detour buys. Optional contribution tasks improve the city’s ground truth. Detour uses the same model to identify the missing connections and public-realm interventions that would improve the greatest number of journeys.**
