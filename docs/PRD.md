# Good Way NYC + Detour Atlas

**Status:** Hackathon product specification
**Primary product:** Good Way NYC
**Planning extension:** Detour Atlas
**Later extension:** Civic Assets & Actions
**Initial mode:** Walking
**Initial geography:** One data-rich NYC pilot area

## 1. Product summary

**Good Way NYC** provides walking directions optimized for how a person wants the trip to feel—not only for minimum travel time.

A user can ask for a route that is:

* cooler or greener;
* flatter, step-free, or easier;
* quieter or less crowded;
* livelier and closer to food, nightlife, events, or public spaces;
* less affected by construction or sidewalk sheds;
* better supplied with seating, restrooms, or drinking water.

The user sets how much extra time they are willing to spend. Good Way recommends a route and explains what the detour buys them.

**Detour Atlas** applies the same routing model at a city-planning scale. It identifies places where missing shade, inaccessible connections, construction, or absent amenities impose avoidable burdens on pedestrian trips. It can then estimate which interventions would improve the most journeys.

> **Resident value:** Find a route that fits your body, company, mood, and conditions.
> **City value:** Understand where small public-realm interventions could improve the pedestrian network most.

## 2. Problem

Mainstream maps primarily optimize walking routes for time and distance. They generally do not answer questions such as:

* What is the coolest route at 2:00 PM?
* Which route is easiest for an older adult?
* Can I avoid stairs, steep blocks, and sidewalk sheds?
* Where can I sit or find a restroom along the way?
* Which route will feel lively tonight?
* Is five additional minutes enough to produce a substantially better walk?

NYC publishes much of the underlying information, but it is fragmented across unrelated datasets. Residents cannot easily translate that data into a trip decision.

City planners face the inverse problem. They can map trees, ramps, complaints, construction, public facilities, and pedestrian demand, but those layers do not directly reveal the **pedestrian consequence** of a missing or degraded connection.

A blocked ramp may look like one isolated issue. In routing terms, it might create a six-minute detour for every step-free trip between a subway station and a public facility.

## 3. Product thesis

The product should be built around four principles.

### 3.1 There is no universally “best” block

A crowded, steep, sunny street may be undesirable for one trip and desirable for another. Good Way models streets as collections of characteristics rather than assigning them one permanent quality score.

### 3.2 Time is the clearest tradeoff

Users should not need to configure a complicated routing model. The primary control is:

> **How much extra time would you spend for a better walk?**

The route engine then finds the highest-value route within that detour budget.

### 3.3 Every recommendation should be explainable

The app must show what changed relative to the fastest route:

* estimated direct-sun exposure;
* elevation gain and steepest segment;
* stairs or missing ramp data;
* distance affected by sidewalk sheds;
* proximity to seating, water, and restrooms;
* expected activity or quietness;
* source coverage and confidence.

### 3.4 The resident product and planning product share one model

Good Way should not be a consumer app with an unrelated civic dashboard attached. Detour Atlas should derive directly from the same street-segment features, route constraints, and scoring logic.

## 4. Users and jobs

### Walker

> When I am walking somewhere, help me choose a route that better fits the conditions and how I want the walk to feel.

Examples:

* avoiding direct sun during a hot afternoon;
* choosing a quieter walk home;
* finding the most active route through a nightlife district;
* avoiding construction while carrying luggage.

### Comfort-sensitive walker

> When I am walking with an older adult, child, stroller, luggage, temporary injury, or mobility limitation, help me reduce physical difficulty and uncertainty.

Relevant considerations include slope, stairs, pedestrian ramps, seating, restrooms, construction, and accessible transit connections.

The initial product must describe these as **gentler or step-free routes based on available data**, not guaranteed ADA-accessible routes.

### Explorer

> When the walk itself is part of the experience, help me pass through lively, green, historical, cultural, or otherwise interesting places.

### City planner or public-realm operator

> Help me identify which gaps in pedestrian infrastructure impose the greatest detours, and estimate which intervention would improve the most trips.

Potential users include DOT, Parks, City Planning, community boards, BIDs, accessibility teams, and public-space partners.

## 5. Core experience

### 5.1 Route request

The user enters:

1. Origin and destination
2. Departure time, defaulting to now
3. One primary route preference
4. Optional hard requirements
5. Maximum additional walking time

Initial quick modes:

* **Cooler**
* **Gentler**
* **Livelier**

Optional requirements:

* no stairs;
* avoid steep slopes;
* avoid sidewalk sheds;
* include places to sit;
* include a restroom;
* favor greenery.

**Quieter** should be available as an experimental mode only after the proxy model has been validated.

### 5.2 Route result

The app shows the fastest route and the recommended Good Way route.

```text
GENTLER ROUTE

23 minutes · 4 minutes longer

No stairs
31 feet less climbing
Avoids 2 active sidewalk sheds
3 seating locations nearby
1 operational public restroom within 2 minutes

Data confidence: High
```

The result should include:

* total time and distance;
* additional time relative to fastest;
* three to five material improvements;
* any unavoidable compromises;
* confidence by criterion;
* map segments colored by the feature affecting the recommendation.

### 5.3 Route inspection

Tapping a route segment explains its contribution:

```text
This block is favored because:

• estimated building shade at 3:15 PM
• continuous street-tree coverage
• lower slope than the parallel block
• no active sidewalk-shed permit
```

The interface must distinguish:

* **Official:** directly represented in an authoritative dataset
* **Derived:** calculated from multiple sources
* **Observed:** recently reported or verified by a user
* **Unknown:** insufficient current data

### 5.4 During and after the walk

The hackathon version may support a lightweight follow mode using current location, but does not need full voice navigation.

Afterward, the user can provide low-friction feedback:

* This route matched my preference.
* This street was more crowded or quieter than expected.
* A listed restroom was closed.
* A route segment was obstructed.
* This route should not have been marked step-free.

Feedback should be time-stamped and treated as temporary evidence, not permanent ground truth.

## 6. Route criteria

| Criterion                   | Route metric                                                                          | Primary inputs                                                                 | Product language                      |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| **Shade and coolness**      | Estimated minutes or percentage of route in direct sun                                | Land cover, current trees, building geometry and height, sun position, weather | Estimated shade                       |
| **Greenery**                | Length-weighted canopy, tree, park, and green-space adjacency                         | Trees, canopy, parks, Greenstreets                                             | Greener route                         |
| **Slope and effort**        | Total ascent, maximum grade, sustained grade, stairs                                  | Elevation model, pedestrian graph                                              | Gentler route                         |
| **Step-free access**        | Steps excluded; penalties for uncertain crossings, ramps, or inaccessible connections | Pedestrian paths, ramps, accessibility signals                                 | Step-free based on available data     |
| **Construction friction**   | Route length affected by sheds, closures, or construction                             | Sidewalk sheds, street work, permits, user observations                        | Avoid construction                    |
| **Rest and relief**         | Distance between seating, restrooms, and fountains                                    | Seating, operational restrooms, restroom conditions, fountains                 | Places to stop                        |
| **Expected quietness**      | Historical and contextual noise proxy                                                 | 311 noise reports, traffic, construction, events                               | Expected quietness—not live noise     |
| **Activity and liveliness** | Time-sensitive activity estimate                                                      | Pedestrian counts, Citi Bike movement, restaurants, events, public spaces      | Live near sensors; expected elsewhere |
| **Interest**                | Cultural or experiential points along a reasonable detour                             | Landmarks, monuments, public art, events, historic places                      | Interesting route                     |

NYC already publishes core inputs including current Forestry Tree Points, six-inch land-cover data, building footprints with height attributes, and a one-foot elevation model.

Accessibility and amenity inputs include pedestrian-ramp locations, accessible pedestrian signals, DOT seating, public restrooms and their inspection records, and Parks drinking fountains.

Construction and experiential proxies can draw from active sidewalk-shed permits, 311 requests, fifteen-minute bicycle and pedestrian counts, restaurant records, public events, and Citi Bike’s real-time GBFS feed.

## 7. Routing model

### 7.1 Street graph

Represent the pedestrian network as a graph:

* **Nodes:** intersections, crossings, entrances, path junctions
* **Edges:** sidewalk or pedestrian-path segments
* **Edge features:** shade, grade, greenery, construction, expected activity, accessibility, amenities, confidence

OpenStreetMap can provide the initial connected pedestrian graph, including tags for sidewalks, crossings, steps, incline, surface, curb characteristics, and wheelchair access where contributors have mapped them. Coverage must be audited in the pilot area rather than assumed complete.

### 7.2 Detour budget

First calculate the fastest legal walking route:

`T₀ = travel time of fastest route`

The user selects an additional-time budget:

`Δ = maximum acceptable extra minutes`

Any personalized route must satisfy:

`T(route) ≤ T₀ + Δ`

This prevents a high-scoring but unreasonable experiential route.

### 7.3 Route utility

For each feasible candidate route:

`Utility(route) = Σ preference_weightᵢ × normalized_route_metricᵢ − time_penalty`

Subject to:

* legal pedestrian access;
* hard accessibility constraints selected by the user;
* the additional-time budget;
* route continuity and plausibility;
* minimum data-confidence rules for strong claims.

Generate several geographically distinct candidate routes, discard infeasible routes, and return the highest-utility option plus the fastest baseline.

Routing systems such as Valhalla and GraphHopper support runtime or custom routing cost models, although a bounded pilot can also use a locally enriched pedestrian graph and A* or K-shortest-path routing.

### 7.4 Local normalization

Street conditions should be compared among reasonable alternatives for the current trip—not used to assign a universal citywide value to a neighborhood.

For example, a “green” result should mean:

> Greener than the other practical routes between this origin and destination.

It should not imply that the surrounding neighborhood is objectively good or bad.

### 7.5 Confidence

Each edge feature should store:

```text
value
source
observed_at
valid_until
spatial_resolution
derivation_method
confidence
```

Route-level confidence is calculated from:

* share of route with available data;
* source authority;
* freshness;
* geographic precision;
* whether the value is observed or inferred.

A route can remain usable with incomplete data, but the product must avoid unsupported precision.

## 8. MVP requirements

### P0: Good Way

* Mobile-first web experience
* Origin and destination search
* Current or scheduled departure time
* Fastest route baseline
* Three primary modes: Cooler, Gentler, Livelier
* Five-minute and ten-minute detour budgets
* Hard “no stairs” option
* Optional avoidance of sidewalk sheds
* Route receipt comparing the recommended route with fastest
* Segment-level explanations
* Source and confidence labels
* Basic location-follow mode
* Simple route-quality feedback
* One bounded pilot geography

### P0: Detour Atlas

* Select one profile: Cool or Gentle
* Map route-level detour burdens across the pilot area
* Identify the street segments or intersections contributing most to those burdens
* Inspect the evidence behind a hotspot
* Simulate at least one intervention
* Show the estimated change in affected trips
* Export or display a concise “intervention case” card

### P1

* Custom combinations of criteria
* Quieter mode
* Saved profiles such as “Taking my parents”
* Natural-language preference input
* Weather-triggered recommendations
* More complete operational restroom information
* Transit-linked walking routes and MTA elevator outages
* Recent community observations
* Curious or historical route mode

The MTA provides canonical station-accessibility information and separate real-time equipment and outage feeds that can support later multimodal and accessible-routing work.

### Explicitly outside the hackathon MVP

* Citywide production coverage
* Full turn-by-turn navigation
* Guaranteed ADA-compliant routing
* Real-time citywide noise or crowding
* Crime or “safety score” routing
* A universal block-health score
* A complete volunteer-task marketplace
* Replacement of 311 or existing agency workflows

## 9. Detour Atlas

### 9.1 Purpose

Detour Atlas translates individual street conditions into network-level pedestrian consequences.

It should answer:

* Where must people walk substantially farther to find shade?
* Which missing or unreliable step-free connection creates the largest detour?
* Where do sheds or construction repeatedly break otherwise comfortable routes?
* Which areas have long gaps between seating, restrooms, or water?
* Which small intervention would improve the greatest number of trips?

### 9.2 Initial demand model

Detour Atlas should provide useful analysis before Good Way has a large user base.

The first version should use a representative origin-destination matrix constructed from:

* transit stations and stops;
* schools, libraries, parks, healthcare and public facilities;
* commercial and employment areas;
* pedestrian-demand classifications;
* common neighborhood destinations.

NYC’s Facilities Database aggregates more than 30,000 public and public-serving sites, while DOT’s Pedestrian Mobility Plan data categorizes streets based on pedestrian needs and generators.

Actual Good Way route requests can later supplement this model, but should not replace it; app users will not form a representative sample of New Yorkers.

### 9.3 Core metrics

#### Preference detour

Additional travel time required to satisfy a route preference:

`Preference Detour = personalized route time − fastest route time`

#### Exposure gap

Difference between the best available route and a target condition:

* unavoidable direct-sun minutes;
* unavoidable elevation gain;
* distance between rest opportunities;
* distance affected by construction.

#### Barrier impact

The total route burden attributable to a segment, intersection, or missing connection.

#### Intervention value

For a hypothetical change:

`Intervention Value = Σ trip_weight × (burden_before − burden_after)`

Examples:

* add or repair a pedestrian ramp;
* remove a temporary obstruction;
* restore an elevator connection;
* add shade or canopy to a segment;
* add a seating or restroom opportunity;
* reopen a pedestrian path.

#### Data uncertainty

Share of relevant routes for which the City lacks current or sufficiently precise information.

A data gap may itself be a useful planning finding.

### 9.4 Atlas interface

1. Select a profile, such as **Gentle**
2. View high-detour corridors and broken connections
3. Select a hotspot
4. See:

   * affected route types;
   * estimated detour;
   * likely contributing assets or conditions;
   * underlying data and freshness;
   * number of representative trips affected
5. Apply a hypothetical intervention
6. Recalculate and display the benefit

Example:

```text
ATLANTIC AVE AT X STREET

Likely issue:
Incomplete or uncertain step-free crossing

Current impact:
+5.8 minutes on 312 simulated weekly trip patterns

Scenario:
Add a reliable step-free connection

Estimated result:
74% reduction in gentle-route detour
Connects transit, library, and park routes
```

### 9.5 Planning principles

Detour Atlas must:

* identify specific network conditions, not rate whole communities;
* separate City responsibility from resident preference;
* disclose uncertain or stale data;
* avoid treating complaint volume as objective condition;
* show both need and data coverage;
* support comparison of interventions, not neighborhood desirability;
* avoid retaining identifiable origin-destination histories.

## 10. Later extension: Civic Assets & Actions

This is a distinct later phase, not part of the core hackathon scope.

The extension would represent public assets such as:

* trees and tree beds;
* pedestrian ramps;
* benches;
* public restrooms;
* drinking fountains;
* community gardens;
* rain gardens;
* litter baskets;
* plazas and other public spaces.

Each asset could have:

```text
asset_id
asset_type
official_state
observed_state
last_verified_at
responsible_entity
open_issue
available_action
action_publisher
training_required
safety_limitations
```

### Along-the-way experience

A user could optionally request:

> Give me a shaded route with one small way to help.

The route might include one appropriate action:

* verify that a restroom is open;
* verify that a curb ramp is unobstructed;
* record approved tree stewardship;
* join a scheduled garden or cleanup event;
* report an official-data discrepancy.

The app should not invent tasks from asset condition alone. Actions involving infrastructure, tools, rodents, hazardous waste, traffic, or ongoing maintenance must come from an authorized agency or partner.

### Scoring approach

Do not assign blocks a universal health or quality score.

Potential indicators are:

* **Known:** how recently asset information was verified
* **Cared for:** approved stewardship activity
* **City follow-through:** status of official issues
* **Actionable:** whether a clear next action exists

These describe the state of public assets and coordination—not the worth of a neighborhood.

## 11. Data and system architecture

```text
Official NYC data ─┐
External open data ├─> ingestion and validation
Weather/time data ─┤
Observations ──────┘
                         ↓
                 spatial feature store
                         ↓
            enriched pedestrian street graph
                     ↙           ↘
             Good Way API     Detour analysis
                    ↓               ↓
              Resident map     Planning map
```

### Recommended components

* Spatial database for normalized source data and street-edge features
* Scheduled ingestion jobs with freshness monitoring
* Base pedestrian graph built from open street/path data
* Routing service supporting dynamic edge costs
* API returning route geometry, receipt, explanations, and confidence
* Map-based mobile web client
* Separate scenario-analysis service for Detour Atlas
* Cached sun-position and shade calculations by time interval

### Key shared entities

* `StreetEdge`
* `FeatureObservation`
* `RouteProfile`
* `RouteRequest`
* `RouteResult`
* `DetourMetric`
* `InterventionScenario`
* Later: `PublicAsset` and `CivicAction`

## 12. Privacy, fairness, and safety

### Privacy

* No account required for core routing
* Do not retain precise route histories by default
* Aggregate planning demand only above privacy thresholds
* Snap retained demand to coarse geographic units
* Separate user feedback from identifiable device history
* Publish clear retention rules

### Fairness

* Do not use app activity as the sole measure of need
* Do not use raw 311 volume as an objective condition score
* Report where data is missing or participation is low
* Use representative public destinations and pedestrian-demand models
* Evaluate whether route quality varies systematically by neighborhood
* Avoid labels such as “bad,” “unsafe,” or “unhealthy” block

### Safety and claims

* Maintain legal pedestrian access as a base routing requirement
* Do not infer personal safety from crowding, crime, or activity
* Label quietness and activity as estimates
* Do not guarantee accessibility until the network has been comprehensively audited
* Do not route through a segment merely because it scores well environmentally if its pedestrian access is uncertain

## 13. Success criteria

### Hackathon success

The product succeeds if it can demonstrate:

1. Three materially different routes for the same trip
2. A clear explanation of what each route optimizes
3. A useful route within the selected extra-time budget
4. Traceability from every major claim to an underlying source
5. One Detour Atlas hotspot with a credible simulated intervention
6. A coherent connection between resident utility and City planning

### Prototype performance targets

* Route response under three seconds for the pilot area
* No disconnected, illegal, or implausibly looping routes in the demo set
* At least 80% feature coverage for the criteria used in the primary demo
* Route receipt generated for every successful request
* Confidence shown whenever a criterion relies on derived or incomplete data
* At least 4/5 average “matched my preference” rating in a small route test
* A meaningful personalized alternative for at least 70% of tested origin-destination pairs when five additional minutes are allowed

### Longer-term product metrics

* Percentage of users selecting a personalized route over fastest
* Extra minutes users willingly accept
* Post-walk preference-match rating
* Rate of inaccurate or stale-condition reports
* Route-feature coverage by neighborhood
* Number of high-impact network gaps identified
* Estimated trip burden eliminated by proposed or completed interventions

## 14. Recommended hackathon scope

### Pilot

Choose a two-to-four-square-mile area after a rapid data-coverage audit.

A strong candidate is **Downtown Brooklyn, Brooklyn Heights, and DUMBO**, because it contains:

* meaningful elevation changes;
* waterfront and park routes;
* active commercial and cultural areas;
* tourist and commuter activity;
* construction and accessibility tradeoffs;
* several plausible alternate walking paths.

### Build

* Cooler, Gentler, and Livelier modes
* Five-minute and ten-minute detour choices
* Avoid-stairs and avoid-sheds options
* Fastest-route comparison
* Route receipt and segment explanations
* One confidence framework
* Detour Atlas for Cool and Gentle trips
* Two intervention simulations:

  * one shade-network improvement;
  * one step-free connection improvement

### Defer

* Quieter mode as a headline feature
* Rain-cover routing
* Full personalization
* Accounts and saved preferences
* Public-asset contributions
* Citywide deployment
* Turn-by-turn voice navigation

## 15. Core demo story

```text
1. A user enters an origin and destination.
2. The fastest route takes 18 minutes.
3. The user selects “Taking my parents” and allows five extra minutes.
4. Good Way returns a 22-minute route with:
   • less climbing
   • no mapped stairs
   • more estimated shade
   • three places to sit
   • fewer sidewalk sheds
5. The route receipt explains each tradeoff and its confidence.
6. The same destination is rerouted using “Livelier,” producing a
   route through active restaurants, public spaces, and an event.
7. Detour Atlas reveals that one uncertain or missing step-free
   connection causes repeated detours across the pilot area.
8. A simulated intervention shows how many representative journeys
   would improve if that connection were fixed.
```

## 16. Product definition

> **Good Way NYC helps people move through New York in a way that fits the person and the moment. It combines fragmented public data into transparent, preference-aware walking routes. Detour Atlas uses the same model to reveal the shade, access, amenity, and construction gaps that impose the greatest burdens on pedestrian journeys—and to estimate which interventions would make the largest difference.**
