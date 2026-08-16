# Detour — City Planning Intelligence PRD

> Detour is the planning side of Happy Path. It uses the same Manhattan street graph, city layers, route metrics, and evidence model.

## 1. Product definition

**Detour helps people understand where the city makes everyday journeys harder—and which changes could improve them.**

Happy Path asks:

> What route or walk best fits this person and moment?

Detour asks:

> Why is that kind of journey difficult here, where does the same problem repeat, and what intervention might reduce the burden?

A conventional asset map shows where trees, benches, bathrooms, ramps, or sheds exist. Detour shows **what journeys their absence, condition, hours, or placement makes worse**.

## 2. Role in P1

P1 includes one credible Detour planning proof using a feature already validated for Happy Path.

### Current implemented slice

The current City what-if is a route-local proof:

- it carries one resident route into a planning surface;
- it can select a route segment and vary modeled shade;
- it compares exposure across the current route and its alternatives;
- it holds route geometry fixed so the displayed difference comes from the shade assumption alone;
- it ranks only precomputed intervention candidates and evidence IDs;
- it labels the result hypothetical and exposes source and claim boundaries.

This slice does **not** yet identify a repeated city-scale gap. Its route alternatives are not representative demand, no journey is rerouted after the intervention, and the result is not a feasibility or priority recommendation.

### Next P1 proof

The first proof should:

1. define representative journeys inside Manhattan south of Central Park;
2. calculate a repeated burden using real route and layer data;
3. identify one gap, barrier, or high-impact uncertainty;
4. apply a clearly hypothetical intervention;
5. reroute the same journeys;
6. show what improved, what did not, and how certain the result is.

P1 does **not** require a complete planner workspace, agency integration, approvals, or capital-planning workflow.

## 3. Product promise

> **See the journeys behind an amenity gap. Test a change. Understand who and what it could help.**

## 4. Users

- City planners and public-realm teams
- Parks, transportation, accessibility, climate, and facilities staff
- Community boards and BIDs
- Public-space operators and civic organizations
- Residents and advocates exploring transparent scenarios

The hackathon demo may use a simple public-facing planning view rather than a production agency workflow.

## 5. Product principles

### 5.1 Measure journey consequences

Do not assign neighborhoods a universal quality score.

Measure specific burdens such as:

- extra walking time;
- unavoidable direct-sun minutes;
- longest exposed stretch;
- mapped-step detour;
- maximum time between mapped places to sit;
- deviation to a restroom or fountain;
- route distance affected by shed or construction records.

### 5.2 Use the same facts as Happy Path

Detour must reuse:

- the pedestrian graph;
- `LayerDefinition` records;
- feature derivations;
- source versions;
- confidence and claim boundaries;
- route and continuity metrics.

It should not build a separate planning-only data stack.

### 5.3 Show impact, not an opaque priority score

Expose:

- journeys affected;
- burden per journey;
- total or median burden reduction;
- remaining burden;
- evidence quality;
- assumptions;
- implementation horizon.

Human planners decide priority.

### 5.4 Start with the intervention ladder

A gap does not always require construction.

Possible responses:

1. **Verify** — confirm a high-impact uncertain condition.
2. **Operate** — change hours, access, service, or maintenance.
3. **Repair or remove** — restore a connection or remove a barrier.
4. **Build** — add a new asset or connection.

### 5.5 Be honest about the scenario

A simulated bench, shade structure, ramp, or restroom is a hypothetical planning input. It is not an engineering design, budget recommendation, or City commitment.

## 6. Core concepts

### Representative journey

A modeled origin-destination trip used to evaluate the network.

Examples:

- subway entrance to a library;
- school to park;
- residential area to public restroom;
- transit to a public facility;
- custom origins and destinations selected for a corridor study.

### Planning lens

The need being evaluated:

- shade and heat exposure;
- greenery continuity;
- lower-effort or mapped-step-free travel;
- seating and rest continuity;
- restroom or water access;
- construction burden;
- public-space access.

### Burden

A measurable journey consequence.

### Gap

A specific condition that repeatedly creates burden:

- absent asset;
- broken connection;
- poor spacing;
- unreliable or closed asset;
- operating-hours mismatch;
- temporary obstruction;
- important data uncertainty.

### Intervention

A proposed change to an asset, operation, connection, or evidence state.

## 7. P1 experience

The flow below describes the next P1 proof, not the current fixed-route slice.

### Step 1: Select a planning question

The demo should begin with one clear question, such as:

> **Where would one new place to sit reduce the longest rest gaps?**

Or:

> **Where does one exposed corridor break otherwise shaded walks to transit?**

### Step 2: Show the journeys

Display the representative routes included in the analysis. The audience should be able to understand what people are trying to reach.

### Step 3: Reveal the burden

Example:

```text
A LONG GAP WITHOUT A PLACE TO REST

17 minutes between mapped seating
on several routes from transit to public facilities

What we used
• NYC DOT seating
• public-facility locations
• pedestrian routes

Confidence
Medium — informal or private seating may be missing
```

### Step 4: Test one change

Apply one hypothetical intervention and reroute the same journeys.

```text
IF A BENCH WERE ADDED HERE

Longest gap
17 min → 9 min

Journeys improved
487 of 620 weighted journeys

Some routes do not change
They approach from a different corridor
```

### Step 5: Explain the planning insight

The result should answer:

- why this location matters;
- which journeys improve;
- which do not;
- what assumptions drive the result;
- what would need verification next.

## 8. Initial planning lenses

| Lens | Burden | Example intervention |
| --- | --- | --- |
| Shade | Direct-sun minutes and longest exposed stretch | Temporary shade, canopy scenario, alternate connection |
| Seating | Maximum time between mapped rest opportunities | Bench or leaning bar |
| Restrooms | Network deviation and hours mismatch | Reopen, extend hours, or add facility |
| Mapped steps | Additional time to avoid mapped steps | Repair or add connection after proper review |
| Construction | Route distance affected by current-enough records | Remove obstruction, coordinate work, or improve passage |
| Public space | Network access to a usable public place | Entrance, hours, signage, or access improvement |

Choose the first P1 lens based on validation quality, not ambition.

## 9. Representative demand

Detour should not depend only on Happy Path users.

P1 may build a transparent sample from:

- subway entrances;
- libraries, parks, schools, and public facilities;
- selected residential or commercial anchors;
- equal geographic coverage;
- available pedestrian-demand indicators.

Show how journeys are weighted. App usage may become an additional signal later, with privacy thresholds and explicit representativeness caveats.

## 10. Metrics

### Preference detour

```text
need-aware route time − direct route time
```

### Exposure burden

An undesirable condition remaining on the best available route.

### Continuity gap

The longest uninterrupted period in which a need is not met.

### Barrier impact

The burden attributable to one edge, asset, or crossing, estimated through a controlled counterfactual.

### Journeys affected

The number or weighted volume of representative journeys encountering the gap.

### Intervention value

```text
Σ journey weight × (burden before − burden after)
```

Display the underlying components rather than only the aggregate.

## 11. `DetourScenario`

```yaml
scenario_id: string
geography: polygon
planning_lens: shade | seating | restroom | mapped_steps | construction | public_space
time_context: object
representative_journeys: string
baseline_network_version: string

intervention:
  type: string
  location: geometry
  assumptions: []

results:
  journeys_evaluated: number
  journeys_changed: number
  journeys_improved: number
  burden_before: object
  burden_after: object
  remaining_burden: object

source_ids: []
confidence: high | medium | low
limitations: []
```

## 12. Interface

The P1 proof needs four coordinated views:

1. **Journey map** — routes included in the analysis.
2. **Burden view** — the repeated gap or barrier.
3. **Scenario view** — the hypothetical change and rerouted journeys.
4. **Intervention card** — concise before-and-after impact, sources, and caveats.

Keep the map focused on one finding. Do not expose every City layer at once.

## 13. Future planning workflow

Later Detour may support:

- planner-defined origins and destinations;
- comparison of several intervention locations;
- saved scenarios and notes;
- source refresh and verification queues;
- exportable briefs for community-board or agency review;
- links to asset ownership, open work, capital projects, or permits;
- integration with City GIS, asset-management, or planning tools;
- monitoring after an intervention is implemented.

Those workflows follow the P1 proof and require agency-specific discovery.

## 14. Connection to resident observations

A future high-impact uncertainty may create a verification request:

- Is this restroom open?
- Is this entrance usable?
- Is the reported obstruction still present?
- Does the mapped bench exist?

Happy Path could optionally invite a nearby person to confirm the condition or submit a photo. Such evidence must be purpose-limited, privacy-aware, time-limited, and clearly distinct from official state.

## 15. Fairness and privacy

- Do not use app adoption as the sole measure of need.
- Do not treat complaint volume as objective condition data.
- Show where source coverage is weaker.
- Keep demographic context separate from street-quality scoring.
- Do not expose individual Happy Path routes.
- Use coarse aggregation and minimum-count thresholds for any future demand data.
- Do not label neighborhoods good, bad, safe, unsafe, healthy, or unhealthy.

## 16. P1 acceptance criteria

The current slice satisfies shared-model reuse, deterministic fixed-route comparison, evidence disclosure, and hypothetical labeling. The full planning proof is not complete until the representative-journey and rerouting criteria below pass.

The planning proof succeeds when:

1. one validated Happy Path feature becomes a planning lens;
2. the representative journey set is visible and reproducible;
3. every burden derives from route results;
4. one specific gap or high-impact uncertainty is identified;
5. the same journeys are compared before and after;
6. changed and unchanged routes are visible;
7. intervention value is separate from feasibility;
8. assumptions, data sources, and uncertainty are clear;
9. the scenario reuses the shared city-layer platform;
10. the audience understands how the analysis could support a real planning decision.

## 17. Non-goals

Detour is not:

- an automated capital-budget allocator;
- an official City recommendation;
- a neighborhood-ranking system;
- a complaint heatmap;
- an engineering-feasibility tool;
- a replacement for planners, public engagement, or agency review;
- a production multi-user planning workflow in P1.

## 18. Product definition

> **Detour turns the same public data and route features used by Happy Path into planning insight. It shows which journeys are burdened by missing shade, access, amenities, or infrastructure, then tests how one hypothetical change would alter those journeys. P1 proves the method; later versions can connect the analysis to real City planning, asset, and verification workflows.**
