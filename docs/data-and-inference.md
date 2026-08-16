# Happy Path — Data and Inference Specification

> Companion to the [Happy Path PRD](PRD.md). The PRD owns product scope; this document owns source, feature, evidence, inference, validation, and data-delivery contracts.

| Field | Decision |
| --- | --- |
| Current preview geography | Lower Manhattan: `40.726,-74.006,40.736,-73.988` |
| P1 target geography | Manhattan from the Battery through Midtown, approximately south of Central Park |
| P1 journey shapes | Destination, loop, and wander |
| Request targets | Walk or run framing; time or 0.25–5 mile distance for loop/wander |
| First quantitative proof | Time-aware estimated direct-sun exposure |
| Data strategy | Broad layer registry; route only on validated evidence |
| Experience strategy | Clean and curate data so the product feels simple and fast |
| Inference strategy | Interpret, select, and explain; never invent route or city facts |
| Planning extension | Detour reuses the same graph, layers, metrics, and evidence |
| Live-data direction | Add weather, alerts, and verified observations through the same layer contract |
| Last updated | 2026-08-16 |

## 1. Purpose

This document defines:

1. how NYC and open sources become useful city layers;
2. how those layers attach to pedestrian routes and public assets;
3. which layers may be shown, used for routing, or used by Detour;
4. how natural-language inference controls a deterministic journey engine;
5. how claims retain provenance, coverage, freshness, and confidence;
6. how data is cleaned and packaged for a polished mobile demo;
7. how future live inputs can enrich the product without redesigning it.

The goal is not to expose every dataset as a filter. Happy Path should intelligently assemble the small set of evidence that matters for the current walk while maintaining a much broader city model underneath.

## 2. Core rule

> **Inference interprets the person and the evidence. It does not invent the city.**

| System | Authority |
| --- | --- |
| Route engine | Pedestrian connectivity, geometry, distance, time, candidate generation, detour limits, loops, endpoint search, and hard requirements |
| Feature pipeline | Spatial and temporal joins, physical derivations, route metrics, coverage, and freshness |
| Language layer | Compile natural language into a Trip Brief, ask one useful clarification, patch refinements, and select supported feature IDs |
| Ranking policy | Deterministic baseline; optional bounded model tie-break among supplied valid candidates |
| Explanation layer | Turn supplied benefits, tradeoffs, sources, and uncertainty into friendly product language |
| Evidence layer | Retain source, method, date, coverage, confidence, allowed claims, and prohibited claims |
| Renderer | Convert registered layer and presentation IDs into fixed map treatments and collision behavior |
| Detour engine | Generate representative journeys, calculate burdens, apply interventions, and reroute before and after |

Inference may not create geometry, change time arithmetic, treat missing evidence as favorable, silently relax a requirement, or calculate intervention impact.

## 3. End-to-end architecture

```text
NYC, open, and time-sensitive sources
        ↓
source registry + validation
        ↓
cleaned city layers and public assets
        ↓
enriched Manhattan pedestrian graph
        ↓
valid route, loop, and endpoint candidates
        ↓
Trip Brief + deterministic ranking policy
        ↓
validated candidate selection
        ↓
Route Receipt + MapPresentation
        ↓
resident refinement

The same layers and metrics
        ↓
representative journeys + counterfactual network
        ↓
Detour burden and intervention analysis
```

Interactive requests should read preprocessed data. Do not query many City APIs while someone is waiting for a route. Only genuinely time-sensitive sources should be refreshed frequently.

## 4. Layer capability model

A source or derived layer advances through explicit states.

| Status | Meaning |
| --- | --- |
| `cataloged` | Source, schema, terms, and intended use are known |
| `ingested` | Supported-area data is downloaded, normalized, and reproducible |
| `visualizable` | Geometry or assets can be shown accurately with appropriate caveats |
| `routing-ready` | Coverage and validation are sufficient to affect route selection or a hard requirement |
| `detour-ready` | The layer can support burden, gap, or intervention analysis |
| `live-context` | Time-sensitive data can influence the current request within a defined freshness window |
| `experimental` | It provides context or research value but relies on incomplete coverage or a proxy |
| `rejected` | It is unsuitable for the proposed claim or geography |

A layer may have several capabilities. Sidewalk sheds, for example, may be visualizable and Detour-ready before their exact pedestrian effect is reliable enough for routing.

### Current preview capability snapshot

This table records runtime behavior, not the broader target registry. The implementation currently uses some layers whose registry validation remains `pending`; task 018 must reconcile those states so **used by routing** and **formally promoted to routing-ready** cannot disagree.

| Layer | Current use | Capability boundary | Remaining gate |
| --- | --- | --- | --- |
| OpenStreetMap pedestrian graph | Route geometry, time, distance, loops, wanders, and mapped-step exclusion | Route-affecting | Broader topology and manual street review |
| Building footprints + solar model | Time-aware shade ranking and receipt metrics | Route-affecting derived estimate | More field/visual shadow validation and wider geography |
| Trees + parks | Greenery ranking and context | Route-affecting with bounded claim | Coverage calibration; tree points do not prove canopy or current shade |
| Seating, restrooms, fountains, subway entrances | Waypoints, nearby assets, and endpoint candidates | Route-affecting inventory; current operation unknown | Network reach, hours, and manual operational checks |
| Explicit OSM covered ways/building passages | Rain preference and mapped-cover meters | Experimental route-affecting evidence; expanded generated slice is under reconciliation | More exact geometry and manual review; missing tags remain unassessed |
| Shed permits, POPS arcades, dated construction closures | Nearby cover/construction context and next-audit sources | Reference/display only | Exact current pedestrian geometry before any route effect |
| DEP 2050 stormwater flood model | Opt-in planner map and measured route/polygon overlap | Static model context only; never routing or present-condition evidence | Live official alerts remain separate; no-overlap must never become a safety claim |
| Civic data checks | Optional explicit-help waypoint and session observation | Simulated publisher; not official inventory or submission | Trusted publishing, moderation, persistence, and partner workflow |
| City shade what-if | Fixed-route exposure comparison and bounded candidate ranking | Experimental planner visualization | Representative journey cohort, repeated-gap proof, and counterfactual rerouting |

### `LayerDefinition`

```yaml
layer_id: seating
name: Mapped places to sit
source_ids:
  - nyc_dot_seating

capabilities:
  ingested: true
  visualizable: true
  routing_ready: true
  detour_ready: true
  live_context: false
  experimental: false

route_features:
  - time_to_first_seat
  - maximum_rest_gap
  - seating_detour_minutes

detour_features:
  - long_rest_gap
  - candidate_seating_intervention

visualization:
  kind: discrete_asset
  icon_id: seating
  default_visibility_rule: request_or_route_relevant

claims:
  allowed:
    - mapped place to sit
    - estimated walking time between mapped seating
  prohibited:
    - every available place to sit
    - currently unoccupied seating

freshness:
  source_updated_at: timestamp
  retrieved_at: timestamp
  validation_status: pending | passed | failed
```

## 5. Shared product contracts

### 5.1 `TripBrief`

```yaml
activity: walk | run
journey_shape: destination | loop | wander
origin: coordinates
destination_or_end_condition: object | null
departure_time: ISO-8601

walking_budget_minutes: number | null
distance_target:
  value: number
  unit: miles | kilometers
  normalized_miles: number
detour_allowance_minutes: number | null

preferences:
  - feature_id: string
    weight: number
    input_origin: prompt | quick_control | refinement | default

requirements:
  - requirement_id: string
    state: required | avoid
    confirmed: boolean

waypoint_needs:
  - asset_type: seating | restroom | water | public_space | transit
    state: prefer | required

context:
  weather: object | null
  alerts: []

unsupported_or_unverified:
  - phrase: string
    reason: string

clarification:
  required: boolean
  question: string | null
  material_reason: string | null
```

Destination requests use a detour allowance relative to a direct baseline. Loops and wanders have exactly one active target: time or distance. Explicit distance replaces time, explicit minutes replace distance, and ordinary refinements retain the active target. `activity: run` changes framing and the distance-oriented default; it does not authorize a running-speed estimate.

Persistent preference memory is not required for P1. Current-request taste anchors remain soft and cannot create hard requirements.

### 5.2 `RouteCandidate`

```yaml
candidate_id: string
journey_shape: destination | loop | wander
geometry_ref: string
endpoint_ref: string | null

travel:
  walking_seconds: number
  distance_meters: number
  extra_minutes_vs_baseline: number | null

constraints:
  valid: boolean
  violations: []

metrics:
  direct_sun_minutes: number | null
  shaded_share: number | null
  longest_exposed_minutes: number | null
  greenery_score: number | null
  mapped_step_edges: number | null
  total_ascent: number | null
  maximum_rest_gap_minutes: number | null
  restroom_detour_minutes: number | null
  construction_affected_meters: number | null

coverage:
  by_feature: object
  overall: number

confidence:
  by_feature: object
  recommendation: high | medium | low

source_ids: []
```

The model may explain supplied metrics. It may not recalculate them.

### 5.3 `Claim`

```yaml
claim_id: string
candidate_id: string
claim_type: improvement | compromise | warning | uncertainty | segment_reason
metric_id: string | null
selected_value: number | string | null
baseline_value: number | string | null
delta: number | string | null
source_ids: []
evidence_class: official | derived | inferred | observed | unknown
confidence: high | medium | low
resident_copy_key: string
```

### 5.4 `MapPresentation`

```yaml
primary_claim_id: string
ambient_layer_ids: []
route_segment_layer_ids: []
asset_ids: []
warning_ids: []
focus_edge_ids: []
callout_claim_ids: []
explanation_only_ids: []
```

This payload communicates semantic priority. The renderer controls style, density, collision, and required warnings.

## 6. Source registry record

```yaml
source_id: string
publisher: string
dataset_name: string
dataset_url: string
dataset_id: string | null
asset_type: dataset | api | calculation | community_graph

authority: official | community | derived
access_method: bulk_download | socrata_api | realtime_api | calculation
format: string
terms_url: string
attribution: string | null

refresh_target: string
freshness_window: string | null
source_updated_at: timestamp | null
retrieved_at: timestamp
snapshot_hash: string | null

geometry_type: string | null
source_crs: string | null
supported_area: object | null
coverage: number | null

derived_from: []
method_version: string | null
known_limitations: []
allowed_claims: []
prohibited_claims: []
capability_status: []
validation_status: pending | passed | failed
```

## 7. Target source registry

The source list should remain broad even when only part of it is routing-ready.

### 7.1 Graph, buildings, shade, and validation

| Source | ID | Product use | Claim boundary |
| --- | --- | --- | --- |
| OpenStreetMap | — | Pedestrian paths, crossings, access tags, mapped steps, and coarse POIs | Community graph with variable completeness; never call legally complete or accessible |
| NYC BUILDING | `5zhs-2jue` | Building footprints and roof heights for projected shade | Estimated building shade, not measured sidewalk temperature |
| Deterministic solar calculation / NREL SPA reference | — | Solar elevation and azimuth | Never use an LLM to estimate solar geometry |
| NYC Centerline | `3mf9-qshr` | City street identifiers and graph validation | A road-bed centerline is not a pedestrian graph |
| NYC Planimetric Sidewalk | `vfx9-tbb6` | Sidewalk geometry validation and research | Polygons do not automatically form connected routing topology |

### 7.2 Greenery and public space

| Source | ID | Product use | Claim boundary |
| --- | --- | --- | --- |
| Forestry Tree Points | `hn5i-inap` | Greener routing and route context | A point does not prove canopy size, condition, or current shade |
| Parks Properties | `enfh-gkve` | Park adjacency, loops, and public-space context | Boundary does not prove entrance, access, or current hours |
| Land Cover Raster, 2017 | `he6d-2qns` | Canopy and green-cover calibration | Materially dated for present-condition claims |
| Privately Owned Public Spaces | `qeta-4kqg` | Public indoor or outdoor pause locations | Official existence does not prove an open entrance or available seating now |

### 7.3 Access, effort, and friction

| Source | ID | Product use | Claim boundary |
| --- | --- | --- | --- |
| Mapped OpenStreetMap steps | — | Hard exclusion where tagged | Avoids steps shown in the graph; not an accessibility guarantee |
| One-foot Digital Elevation Model | `dpc8-z3jc` | Grade, ascent, and gentler-route research | Terrain model does not represent temporary conditions |
| Pedestrian Ramp Locations | `ufzp-rrqu` | Crossing context and Detour research | Measurements do not establish ADA compliance |
| DOB NOW sidewalk-shed permits | `rbx6-tga4` | Construction and field-audit context | Permit does not prove installation, exact pedestrian geometry, clear width, cover, or dryness; `2jy7-cddj` is a related broken saved view |
| Additional construction and closure sources | TBD | Temporary route friction | Do not infer obstruction without suitable current geometry or observation |

### 7.4 Amenities and endpoints

| Source | ID | Product use | Claim boundary |
| --- | --- | --- | --- |
| Seating Locations | `esmy-s8q5` | Rest opportunities and continuity | Covers listed DOT seating, not every possible place to sit |
| Public Restrooms | `i7jb-7jku` | Waypoint, endpoint, hours, and amenities | Published hours do not prove open status now |
| Parks Drinking Fountains | `qnv7-p7a2` | Water-access waypoint | Inventory does not prove operation |
| MTA Subway Entrances and Exits: 2024 | `i9wp-a4ja` | Wander endpoints and fallback anchors | Point-in-time inventory; not live service or elevator status |
| Facilities Database | `ji82-xba5` | Public destinations and Detour demand anchors | Requires public-access and schedule filtering |
| MTA developer resources | — | Future service and equipment context | Time-sensitive and transit-specific |

### 7.5 Activity, events, history, and other context

| Source | ID | Product use | Claim boundary |
| --- | --- | --- | --- |
| Bicycle and Pedestrian Count Sensors | `6up2-gnw8` | Identify measured locations | Sparse coverage |
| Bicycle and Pedestrian Counts | `ct66-47at` | Activity baselines near sensors | Do not generalize one sensor to every nearby street |
| NYC Permitted Event Information | `tvpp-9vvx` | Time-specific public-event context | Not a complete private-event or nightlife calendar |
| 311 Service Requests | `erm2-nwe9` | Historical condition research | Reporting behavior is not objective or live condition data |
| Restaurant Inspection Results | `43nn-pn8j` | Establishment universe and location context | Does not measure taste, atmosphere, popularity, or wait time |
| Landmark and Historic District Buildings | `7mgd-s57w` | Historical route anchors | Significance is not personal relevance |
| Parks Monuments | `6rrm-vxj9` | Cultural anchors | Presence does not imply relevance to the current user |

### 7.6 Future live context

| Source family | Product use | Boundary |
| --- | --- | --- |
| National Weather Service or another approved weather source | Current conditions, suggested defaults, and weather-aware explanations | Weather does not replace street-level evidence or solar calculation |
| Transit service and equipment alerts | Endpoint fallback and current access context | Must respect source freshness and geographic relevance |
| Current public-event feeds | Time-sensitive route context | Coverage will remain partial |
| Verified resident or partner observations | Restroom, obstruction, entrance, or asset updates | Must expire or be reconfirmed; never treated as permanent truth |

Live sources use the same layer and evidence contracts. A response must not imply current knowledge when the freshness window has expired.

## 8. Data preparation is part of the product

Raw public data should not flow directly into the mobile interface.

For every layer, the pipeline should:

- crop or partition to Manhattan south of Central Park;
- normalize coordinates, timestamps, units, and identifiers;
- remove duplicates and invalid geometry;
- derive concise resident-facing labels;
- separate inventory, schedule, and observed operational state;
- attach source, date, method, coverage, and confidence;
- simplify or tile geometry for the intended zoom levels;
- build network-distance indexes for amenities;
- output small fixtures and production-ready partitions;
- preserve the raw source separately for reproducibility.

### Data profiles

Maintain three profiles:

1. **Fixture** — small, readable examples for UI and AI development.
2. **Demo** — cleaned data for rehearsed journeys and nearby alternatives.
3. **Supported-area** — partitioned Manhattan coverage used by the deployed app.

These profiles should share schemas. The demo profile may be curated, but its route facts must remain real.

## 9. Feature derivation

### 9.1 Time-aware estimated shade

For each usable building height:

```text
shadow_length = building_height / tan(solar_elevation)
```

Project the geometry opposite solar azimuth. For each edge:

```text
shade_share = shaded_edge_length / edge_length
direct_sun_seconds = edge_walk_seconds × (1 − shade_share)
```

For each journey:

```text
direct_sun_minutes = Σ direct_sun_seconds / 60
longest_exposed_stretch = longest continuous substantially unshaded sequence
```

Preferred product claim:

> About 11 fewer minutes in estimated direct sun than the direct route.

Prohibited claim:

> This street will be 11 minutes cooler.

### 9.2 Greenery

```text
greenery_score = tree adjacency + park frontage + validated green-cover context
```

Keep greenery separate from shade.

### 9.3 Mapped-step avoidance and gentler routing

Mapped steps become a hard exclusion only when explicitly requested.

```text
effort_score = total ascent + sustained-grade penalty
             + mapped-step penalty + uncertain-crossing penalty
```

Allowed: “avoids steps shown in our map data” or “lower estimated ascent.”

Not allowed: “accessible route” without a much stronger audited network.

### 9.4 Rest continuity

Use walking-network distance to calculate:

- time to the first mapped place to sit;
- maximum time between mapped rest opportunities;
- seating detour;
- route segments responsible for long gaps.

### 9.5 Restrooms and water

Use route-compatible network detour and published hours. Keep inventory, scheduled availability, and current observed operation separate.

### 9.6 Construction friction and likely cover

The implemented cover ladder is:

1. path-aligned OpenStreetMap `covered` or building-passage geometry may contribute mapped-cover meters and influence an experimental rain preference;
2. shed permits, POPS arcade classifications, and dated construction closures may appear as nearby context or next-audit evidence;
3. proximity from those contextual records never creates covered meters, current construction friction, dryness, passability, or protection;
4. missing cover tags mean unassessed, not uncovered.

Future construction metrics may include:

- route length adjacent to current-enough shed or construction records;
- number of affected blocks;
- alternative route avoiding those records;
- explicitly mapped overhead-cover length.

Do not claim exact clear width, current presence, construction avoidance, or dryness unless a source supports it at the routed geometry and time.

### 9.7 Modeled stormwater flooding

The preview may show DEP's moderate-rain scenario with projected 2050 sea-level rise and calculate how much route geometry intersects each model category. The layer stays off by default and loads only after an explicit flood request or toggle.

It must not change route selection or imply current flooding, exact current or forecast depth, street passability, or a safe, dry, clear, low-risk, flood-free, or flood-avoiding route. No overlap means only that the route does not intersect the checked-in model snapshot. Current official alerts remain a separate external source.

### 9.8 Expected activity or quietness

These remain experimental composites from measured counters, events, establishments, traffic, construction, and historical reports.

The product must distinguish:

- measured activity near a sensor;
- expected activity from context;
- unknown conditions.

Never present 311 or venue density as live measured noise or crowding.

## 10. Journey generation

### Destination

Calculate a direct baseline, then generate practical alternatives within the selected minute allowance.

### Loop

Generate routes that:

- return near the starting point;
- fit the walking-time budget;
- avoid trivial backtracking and tiny repeated circuits;
- provide meaningful exposure to the requested features;
- remain easy to understand on the map.

### Wander

Generate endpoint-and-route candidates from:

- a direction or destination area;
- an endpoint category such as transit or public space;
- the walking-time budget;
- supported route preferences and requirements.

The endpoint generator must remain deterministic and evidence-backed. The model may interpret “finish near a subway”; it may not invent a place or silently exceed the time budget.

## 11. Intent compilation

The language layer maps human requests into a controlled vocabulary.

| Request language | Supported interpretation | Boundary |
| --- | --- | --- |
| “less sun” | minimize estimated direct-sun exposure | quantitative hero |
| “green” | favor mapped trees and parks | after validation |
| “avoid steps” | exclude mapped step edges | not an accessibility guarantee |
| “places to sit” | prefer or require mapped seating | inventory may be incomplete |
| “bathroom” | prefer or require a mapped restroom with relevant published hours | not guaranteed open now |
| “water” | prefer a mapped fountain or water asset | operation uncertain |
| “less construction” | avoid validated shed or construction evidence | exact obstruction may be unknown |
| “easy for my parents” | favor supported effort, seating, and restroom features | does not infer disability |
| “20-minute loop” | generate a loop inside the time budget | route must return near the start |
| “walk north and end near a train” | wander with direction and transit endpoint | endpoint and route remain computed |
| “safe” | unsupported | never infer personal safety |
| “fun” or “cool” | unsupported without explicit personal anchors and suitable data | the model does not supply taste |

Ask at most one clarification, only when the answer materially changes journey shape, endpoint, time budget, hard requirement, or whether an amenity is required.

## 12. Ranking, explanation, and product copy

The deterministic route engine supplies the baseline ranking.

Inference may break a close non-dominated tie only if:

- all candidates are valid;
- every considered metric is supplied;
- the model selects an immutable candidate ID;
- a deterministic validator rechecks the result;
- the choice can be explained through approved claims.

The simpler option—deterministic selection plus model-generated explanation—should be preferred when reranking adds little visible value.

### Best-extra-minute frontier

The engine may calculate:

```text
+2 minutes → 7 fewer estimated sun minutes
+4 minutes → 11 fewer estimated sun minutes
+8 minutes → 12 fewer estimated sun minutes
```

Resident explanation:

> Four extra minutes gets you almost all of the available shade benefit.

### Copy boundary

Internal values may be technical. Resident output must follow [UX.md](UX.md): human benefit first, plain language, concise caveats, and deeper source details on demand.

## 13. Presentation selection

The intelligence layer may select which registered evidence is relevant, but only through typed IDs.

Rules:

- required assets and warnings cannot be suppressed;
- one journey remains primary;
- use at most one continuous evidence layer by default;
- show assets only when requested, selected, route-relevant, or decision-relevant;
- move secondary evidence into the receipt or data drawer;
- deterministic rendering controls collision, density, zoom, styling, and accessibility.

## 14. Evidence and confidence

Evidence classes:

- **Official** — directly represented by an authoritative publisher;
- **Derived** — calculated from one or more sources;
- **Inferred** — estimated from supplied evidence;
- **Observed** — recently reported or verified;
- **Unknown** — insufficient evidence.

Confidence is calculated from evidence:

```text
confidence = authority × coverage × freshness × spatial precision
             × derivation validation × recommendation robustness
```

### Claim rules

| Claim | Minimum evidence |
| --- | --- |
| “11 fewer minutes in estimated direct sun” | validated shadow method and sufficient edge coverage on both routes |
| “avoids mapped steps” | audited graph evidence on the displayed route |
| “passes 3 mapped places to sit” | validated network join to the official inventory |
| “restroom with published hours” | source hours and route-compatible location |
| “open restroom” | current operational evidence in addition to hours |
| “likely covered” | current-enough cover evidence; never promise dryness |
| “expected quieter” | validated proxy and explicit expected label |
| “safe” | never permitted |

## 15. Validation gate

A layer cannot affect routing until it passes:

1. access, terms, and attribution review;
2. schema, null, and duplicate handling;
3. coordinate and geometry checks;
4. supported-area coverage measurement;
5. freshness and temporal-validity review;
6. feature-derivation tests;
7. product-language and prohibited-claim review;
8. representative visual or field checks;
9. graceful fallback when unavailable.

For every inference-assisted result:

- the candidate exists;
- the time budget holds;
- hard requirements hold;
- missing evidence is not favorable;
- numerical language matches deterministic output;
- unsupported claims fail validation.

## 16. Performance and delivery

Before the integrated demo:

- set an explicit initial-load and interaction budget;
- partition Manhattan graph and asset data;
- lazy-load only relevant time slices and layers;
- keep raw source snapshots out of the client bundle;
- precompute expensive deterministic features;
- cache by geography, time interval, and source version;
- preserve a deterministic no-model route path;
- preload the small data needed for rehearsed demos;
- test from a clean mobile browser.

The product may feel instant because expensive work was prepared—not because results were fabricated.

## 17. Access, terms, privacy, and observations

- Record publisher, dataset ID, retrieval time, snapshot hash, transformations, and attribution.
- Follow NYC Open Data and source-specific terms.
- Display required OpenStreetMap attribution.
- Do not send a person’s full route to many source APIs.
- Do not retain raw prompts, exact paths, or inferred context by default.
- Future observations and photos must have a clear purpose, limited retention, and an expiration or reconfirmation rule.
- Public-source records do not become personal-preference evidence.

## 18. Detour reuse

Every routing-ready layer should define whether it can support:

- route burden;
- continuity gap;
- asset absence or spacing;
- operating-hours gap;
- barrier impact;
- intervention simulation;
- high-impact data verification.

Examples:

- shade → unavoidable exposure and shade-continuity scenarios;
- seating → maximum rest gap and candidate bench placement;
- restrooms → route deviation and hours scenarios;
- mapped steps or ramps → connection-detour scenarios;
- sheds → construction-friction burden and removal scenarios.

Detour must reuse the same data and feature pipeline rather than create a second planning-only model.

## 19. Implementation sequence

1. Approve the docs and merge them to `main`.
2. Finalize shared schemas and realistic fixtures.
3. Build the Manhattan graph and data partitions.
4. Validate buildings, solar position, and shade.
5. Integrate greenery, steps, seating, restrooms, water, public spaces, transit, and sheds.
6. Build destination, loop, and wander candidate generation.
7. Promote layers to routing-ready only after route-level validation.
8. Connect Trip Brief features to the registered capabilities.
9. Connect claims and map presentation to source and confidence records.
10. Reuse one validated feature in the first Detour scenario.
11. Add live sources through freshness-aware adapters rather than special-case UI logic.

## 20. Open decisions

1. What partition scheme gives the best performance across Manhattan below Central Park?
2. What minimum shade and graph coverage permits quantified claims?
3. Which amenity or friction layer should become the third validated route capability?
4. Are sidewalk-shed records good enough for routing or only visualization and Detour?
5. Should the resident route winner remain fully deterministic for the demo?
6. What payload and warmed-route latency budgets should be enforced?
7. Which validated feature should power the first Detour scenario?
8. Which live-data adapter, if any, is worth adding after the core P1 experience is stable?
