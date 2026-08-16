# Detour — City Planning Intelligence PRD

> Detour is the planning extension of Happy Path. It uses the same city layers, pedestrian graph, evidence model, and route metrics.

## 1. Product definition

**Detour helps planners see where the built environment makes ordinary pedestrian journeys harder—and which interventions could improve the greatest number of trips.**

Happy Path asks:

> What route best fits this person and moment?

Detour asks:

> Why is that kind of route difficult here, where do similar journeys encounter the same problem, and what change could reduce the burden?

A conventional asset map shows where benches, bathrooms, trees, ramps, or sheds are located. Detour shows **what journeys their absence, condition, or placement makes worse**.

## 2. Product role

Detour is decision support, not automated planning.

It should:

- translate city-data layers into route consequences;
- show the journeys supporting each finding;
- identify specific gaps, barriers, unreliable assets, or data uncertainties;
- simulate a proposed intervention;
- compare before-and-after route burdens;
- expose assumptions, evidence, and robustness.

It should not rank neighborhoods, decide budgets, or claim an intervention is feasible without relevant engineering, legal, operational, and public review.

## 3. Users

- City planners and public-realm teams
- Parks, transportation, accessibility, climate, and facilities staff
- Community boards and BIDs
- Public-space operators and civic organizations
- Later, residents and advocates exploring transparent scenarios

## 4. Core concepts

### Representative journey

A modeled origin-destination trip used to evaluate the network, such as transit to a library, school to park, or residential area to a restroom.

### Planning lens

The need being evaluated:

- shade and heat exposure;
- greenery continuity;
- gentler or mapped-step-free travel;
- seating and rest continuity;
- restroom or water access;
- construction burden;
- public-space access.

### Burden

A measurable journey consequence:

- extra travel time;
- unavoidable direct-sun minutes;
- longest exposed stretch;
- ascent or grade;
- mapped-step detour;
- maximum time between seating opportunities;
- deviation to a restroom or fountain;
- route distance affected by construction.

### Gap

A specific condition producing repeated burden:

- absent asset;
- broken connection;
- poor spacing;
- unavailable or unreliable asset;
- operating-hours mismatch;
- temporary obstruction;
- significant data uncertainty.

### Intervention

A proposed change to an asset, operation, connection, or evidence state.

Examples:

- add seating;
- extend restroom hours;
- repair or add a ramp;
- remove an obstruction;
- add temporary shade;
- plan long-term canopy;
- reopen a pedestrian connection;
- verify a high-impact uncertain condition.

## 5. Core workflow

### 5.1 Define the question

A planner selects a structured scenario or asks:

> “Where would three benches reduce the longest rest gaps between subway stations and public facilities?”

Detour compiles an editable analysis brief:

```text
Planning lens
Rest opportunities

Geography
Lower Manhattan pilot

Representative trips
Subway entrances → public facilities and parks

Objective
Reduce the longest time between mapped seating

Intervention
Up to 3 new seating locations
```

### 5.2 View burden

The map shows:

- representative route corridors;
- relevant assets and barriers;
- route burden by segment;
- high-impact continuity breaks;
- data-coverage gaps.

The first view should emphasize one planning finding, not every layer simultaneously.

### 5.3 Inspect a gap

Example:

```text
REST GAP

17 minutes between mapped seating opportunities

Affected journeys
• station → library
• station → park
• public facility → commercial corridor

Estimated reach
620 weighted representative journeys per weekday

Evidence
Official seating inventory
Derived pedestrian routes
Modeled trip demand

Confidence
Medium

Uncertainty
Private and informal seating may not be represented
```

The planner can inspect the individual routes producing the result.

### 5.4 Test an intervention

Apply a hypothetical change and reroute the same journey set:

```text
AFTER INTERVENTION

Longest rest gap
17 min → 9 min

Journeys improved
487 of 620

Median burden reduction
4.2 minutes

Journeys unchanged
133
```

### 5.5 Compare scenarios

Show separate dimensions instead of one opaque priority score:

- journeys improved;
- burden reduction per journey;
- maximum remaining gap;
- confidence;
- implementation horizon;
- evidence quality;
- affected destinations and trip types.

### 5.6 Export an intervention brief

The output should include:

- question and geography;
- representative demand assumptions;
- current burden;
- gap or barrier;
- proposed intervention;
- estimated before-and-after impact;
- data sources and versions;
- uncertainty and sensitivity;
- jurisdiction or responsible entity where known.

## 6. Map views

### Burden map

Shows where representative routes experience the selected condition.

### Route map

Shows the actual journeys behind a finding so a heatmap does not hide network behavior.

### Asset and gap map

Shows relevant amenities, barriers, operating status, ownership, and data uncertainty.

### Scenario map

Shows baseline and intervention routes, improved segments, unchanged journeys, and remaining burdens.

### Confidence map

Shows where source coverage or current condition is insufficient. A high-impact data gap may produce a verification action rather than a construction recommendation.

## 7. Metrics

### Preference detour

```text
need-aware route time − fastest valid route time
```

### Exposure burden

Undesired condition remaining on the best available route, such as direct-sun minutes or construction-affected distance.

### Continuity gap

The longest uninterrupted period in which a need is not met, such as time without shade, seating, or a mapped step-free connection.

### Barrier impact

The burden attributable to one segment, intersection, asset, or obstruction, estimated through counterfactual removal or repair.

### Intervention value

```text
Σ journey weight × (burden before − burden after)
```

The interface should display the underlying components rather than only this aggregate.

### Robustness

A result should be tested under reasonable changes to:

- trip weights;
- uncertain asset state;
- candidate locations;
- time of day;
- source coverage;
- demand model.

## 8. Demand model

Detour must be useful before Happy Path has significant adoption.

Initial representative trips may be constructed from:

- subway and transit entrances;
- schools, libraries, parks, and healthcare facilities;
- public-service locations;
- residential population;
- commercial and employment areas;
- pedestrian counts where available;
- planner-defined origins and destinations.

Later, privacy-preserving Happy Path aggregates may supplement this model:

- requested route qualities;
- routes that require unusually large detours;
- places where no supported route exists;
- amenities repeatedly influencing route choice;
- time-limited condition corrections.

Product demand must never be treated as representative of all New Yorkers. Compare demand-weighted results with equal-coverage or public-facility views.

## 9. Gap classification and intervention ladder

### Gap types

- **Absence:** asset or connection does not exist.
- **Break:** one condition disrupts an otherwise connected network.
- **Reliability:** asset exists but cannot be depended upon.
- **Operation:** hours or access do not match need.
- **Spacing or capacity:** assets exist but are poorly distributed.
- **Information:** current or precise condition is unknown.

### Intervention ladder

1. **Verify** an uncertain condition.
2. **Operate** an existing asset differently.
3. **Repair or remove** a barrier.
4. **Build** a new asset or connection.

Detour should not jump directly from a mapped gap to a capital recommendation.

## 10. Intelligence boundary

AI may:

- compile natural-language planning questions into typed scenarios;
- identify missing assumptions;
- summarize structured findings;
- compare measured scenario tradeoffs;
- generate a planning brief from deterministic results.

AI may not:

- invent burden, asset state, demand, or route geometry;
- calculate intervention impact;
- hide assumptions;
- decide policy or budgets;
- recommend an unevaluated site;
- turn complaint volume into a neighborhood-quality score.

The scenario engine calculates before-and-after impact. Intelligence makes the analysis easier to express and understand.

## 11. Relationship to Civic Assets & Actions

A later asset registry may include:

```text
official state
recent observed state
responsible entity
operating hours
open issue
planned work
authorized action
last verification
confidence
```

This creates a verification loop:

1. Detour identifies a high-impact uncertain condition.
2. An agency, partner, or optional Happy Path user verifies it.
3. The evidence layer updates.
4. Detour recalculates the finding.

Resident contribution remains optional, safe, and authorized. City responsibilities must not become assumed volunteer work.

## 12. Phasing

### DT-P0: prepared planning proof

- same Lower Manhattan pilot and feature registry as Happy Path;
- one planning lens already validated in the resident product;
- one representative journey set;
- one burden map;
- one gap inspection;
- one hypothetical intervention;
- before-and-after rerouting;
- evidence and confidence;
- exportable intervention card.

Recommended first scenarios:

1. shade-continuity gap;
2. seating and rest gap;
3. mapped-step detour;
4. restroom-access gap.

### DT-P1

- structured interactive scenario controls;
- multiple candidate interventions;
- custom trip sets;
- sensitivity analysis;
- asset ownership and operating data;
- monitoring after an intervention.

### Later

- natural-language planning queries;
- citywide analysis;
- collaboration and comments;
- integration with agency planning and capital workflows;
- public scenario exploration;
- authorized verification and stewardship loops.

## 13. Acceptance criteria for the first proof

1. A planner can inspect the representative journey set.
2. Every burden is calculated from actual route results.
3. One gap can be traced to the routes and evidence producing it.
4. One hypothetical intervention modifies the network or asset model.
5. The same journey set is rerouted before and after.
6. Changed and unchanged journeys are visible.
7. Assumptions, demand weighting, and uncertainty are inspectable.
8. The result is reproducible from stored source and scenario versions.
9. No neighborhood receives a universal quality score.
10. App usage is not the sole demand signal.
11. Intervention benefit is separated from implementation feasibility.
12. At least one counterintuitive or low-impact scenario is shown, proving that the tool compares rather than merely advocates.
