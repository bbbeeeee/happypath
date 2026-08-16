# Happy Path — Data and Inference Specification

> Companion to the [Happy Path PRD](PRD.md). The PRD owns product scope; this document owns source, feature, evidence, inference, and validation contracts.

| Field | Decision |
| --- | --- |
| Initial geography | Bounded Lower Manhattan pilot |
| First journey | Fixed origin to destination |
| First quantitative proof | Time-aware estimated direct-sun exposure |
| Data strategy | Broad layer registry; route only on validated evidence |
| Inference strategy | Interpret and explain; never invent route or city facts |
| Planning extension | Detour reuses the same graph, layers, and metrics |
| Last updated | 2026-08-15 |

## 1. Purpose

This document defines:

1. how public and open sources become usable city layers;
2. how those layers attach to pedestrian routes and public assets;
3. which layers may be visualized, used for routing, or used by Detour;
4. how natural-language inference interacts with deterministic routing;
5. how product claims retain provenance, coverage, freshness, and confidence;
6. how additional NYC data can be integrated without redesigning the product.

The goal is not to expose every dataset as a filter. The goal is to let Happy Path intelligently select the evidence relevant to a person’s request while preserving a broad, extensible city model underneath.

## 2. Core rule

> **Inference interprets the user and the evidence. It does not invent the city.**

| System | Authority |
| --- | --- |
| Route engine | Pedestrian connectivity, geometry, distance, time, candidate generation, detour limits, and hard requirements |
| Feature pipeline | Spatial and temporal joins, physical derivations, route metrics, source coverage, and freshness |
| Language layer | Compile natural language into a Trip Brief, request clarification, patch refinements, and select supported feature IDs |
| Ranking policy | Deterministic baseline; optional bounded model tie-break among supplied valid candidates |
| Explanation layer | Express supplied benefits, compromises, sources, and uncertainty in natural language |
| Evidence layer | Retain source, method, date, coverage, confidence, allowed claims, and prohibited claims |
| Renderer | Convert registered layer and presentation IDs into fixed map treatments and collision behavior |
| Detour engine | Generate representative trips, calculate burdens, apply interventions, and reroute before and after |

Inference may not create geometry, change time arithmetic, treat missing evidence as favorable, silently relax a requirement, or calculate intervention impact.

## 3. End-to-end architecture

```text
NYC and open sources
        ↓
source registry + validation
        ↓
normalized city layers and public assets
        ↓
enriched pedestrian graph
        ↓
measured route candidates
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

Interactive route requests should read preprocessed pilot data. Do not query many City APIs during a route request. Only genuinely time-sensitive sources should be refreshed frequently.

## 4. Layer capability model

A source or derived layer advances through explicit states.

| Status | Meaning |
| --- | --- |
| `cataloged` | Source, schema, access method, terms, and intended use are known |
| `ingested` | Pilot data is downloaded, normalized, and reproducible |
| `visualizable` | Geometry or assets can be shown accurately with appropriate uncertainty |
| `routing-ready` | Coverage and validation are sufficient for the layer to affect route selection or a hard requirement |
| `detour-ready` | The layer can support burden, gap, or intervention analysis |
| `experimental` | It provides context or research value but depends on incomplete coverage or a proxy |
| `rejected` | It is unsuitable for the proposed claim or pilot |

A layer may hold multiple capability flags. For example, sidewalk sheds may be visualizable and Detour-ready before exact pedestrian-width effects are reliable enough for routing.

### LayerDefinition

```yaml
layer_id: seating
name: NYC DOT seating
source_ids:
  - nyc_dot_seating

capabilities:
  ingested: true
  visualizable: true
  routing_ready: true
  detour_ready: true
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
    - mapped seating location
    - estimated network walking time between mapped seating
  prohibited:
    - all available seating
    - currently free seating

freshness:
  source_updated_at: timestamp
  retrieved_at: timestamp
  validation_status: pending | passed | failed
```

## 5. Shared product contracts

### 5.1 TripBrief

P0 supports `destination`; `loop` and `wander` remain forward-compatible values.

```yaml
journey_shape: destination | loop | wander
origin: coordinates
destination_or_end_condition: object | null
departure_time: ISO-8601

detour_allowance_minutes: number
walking_budget_minutes: number | null

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

unsupported_or_unverified:
  - phrase: string
    reason: string

clarification:
  required: boolean
  question: string | null
  material_reason: string | null
```

P0 does not require persistent preference memory. Later profiles remain soft and cannot create hard requirements.

### 5.2 RouteCandidate

```yaml
candidate_id: string
geometry_ref: string

travel:
  walking_seconds: number
  distance_meters: number
  extra_minutes_vs_fastest: number

constraints:
  valid: boolean
  violations: []

metrics:
  direct_sun_minutes: number | null
  shaded_share: number | null
  longest_exposed_minutes: number | null
  greenery_score: number | null
  mapped_step_edges: number | null
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

### 5.3 Claim

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
allowed_display_text: string
```

### 5.4 MapPresentation

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
source_updated_at: timestamp | null
retrieved_at: timestamp
snapshot_hash: string | null

geometry_type: string | null
source_crs: string | null
pilot_bbox: object | null
pilot_coverage: number | null

derived_from: []
method_version: string | null
known_limitations: []
allowed_claims: []
prohibited_claims: []
capability_status: []
validation_status: pending | passed | failed
```

## 7. Target source registry

The exact source list should remain broad even when only a subset is routing-ready.

### 7.1 Core graph, shade, and validation

| Source | ID | Role | Current state | Claim boundary |
| --- | --- | --- | --- | --- |
| OpenStreetMap export | — | Pedestrian paths, crossings, access tags, mapped steps, coarse POIs | Ingested on prototype; audit pending | Community graph with variable completeness; never call legally complete or accessible |
| NYC BUILDING | `5zhs-2jue` | Building footprints and `HEIGHT_ROOF` for projected shade | Ingested on prototype; validation pending | Estimated building shade, not measured sidewalk temperature |
| Deterministic solar calculation / NREL SPA reference | — | Solar elevation and azimuth | Implemented approximation; comparison pending | Never use an LLM to estimate solar geometry |
| NYC Centerline | `3mf9-qshr` | City street identifiers and graph validation | Cataloged | Road-bed centerline is not a pedestrian graph |
| NYC Planimetric Sidewalk | `vfx9-tbb6` | Sidewalk geometry validation and research | Cataloged | Polygons do not automatically form connected routing topology |

### 7.2 Greenery and public space

| Source | ID | Role | Current state | Claim boundary |
| --- | --- | --- | --- | --- |
| Forestry Tree Points | `hn5i-inap` | Tree adjacency and Greener routing | Ingested on prototype; route validation pending | A point does not prove canopy size, condition, or current shade |
| Parks Properties | `enfh-gkve` | Park adjacency and public-space context | Ingested on prototype | Boundary does not prove entrance, current access, or open hours |
| Land Cover Raster, 2017 | `he6d-2qns` | Canopy and green-cover calibration | Cataloged, experimental | Materially dated for current-condition claims |
| Privately Owned Public Spaces | `qeta-4kqg` | Public indoor or outdoor pause locations | Cataloged | Official existence does not prove an open entrance or free seating now |

### 7.3 Access, effort, and friction

| Source | ID | Role | Current state | Claim boundary |
| --- | --- | --- | --- | --- |
| Mapped OSM steps | — | Hard exclusion where tagged | Ingested on prototype | Avoids mapped steps; never relabel as accessible |
| One-foot Digital Elevation Model | `dpc8-z3jc` | Edge grade, ascent, and Gentler research | Cataloged | Terrain model does not represent temporary surface conditions |
| Pedestrian Ramp Locations | `ufzp-rrqu` | Crossing context and Detour research | Cataloged | City measurements do not establish ADA compliance |
| Sidewalk Sheds | `2jy7-cddj` | Construction friction and likely-cover context | Cataloged | Record does not prove presence, passable width, or dryness |
| Additional construction and closure sources | TBD | Temporary route friction | Source selection pending | Do not infer obstruction without suitable current geometry or observation |

### 7.4 Amenities and endpoints

| Source | ID | Role | Current state | Claim boundary |
| --- | --- | --- | --- | --- |
| Seating Locations | `esmy-s8q5` | Rest opportunities and rest continuity | Cataloged; high-priority integration | Covers listed DOT seating, not every possible place to sit |
| Public Restrooms | `i7jb-7jku` | Waypoint, endpoint, hours, and amenities | Cataloged; high-priority integration | Published hours do not prove open status now |
| Parks Drinking Fountains | `qnv7-p7a2` | Water-access waypoint | Cataloged; high-priority integration | Inventory does not prove operation |
| MTA Subway Entrances and Exits: 2024 | `i9wp-a4ja` | Endpoint and fallback anchors | Cataloged | Point-in-time inventory; does not represent service or elevator status |
| Facilities Database | `ji82-xba5` | Public destinations and Detour demand anchors | Cataloged | Requires category, public-access, and schedule filtering |
| MTA developer resources | — | Later live accessibility and equipment context | Cataloged | Time-sensitive and transit-specific |

### 7.5 Activity, events, and experiential context

| Source | ID | Role | Current state | Claim boundary |
| --- | --- | --- | --- | --- |
| Bicycle and Pedestrian Count Sensors | `6up2-gnw8` | Identify measured locations | Cataloged, experimental | Sparse coverage |
| Bicycle and Pedestrian Counts | `ct66-47at` | Activity baselines near sensors | Cataloged, experimental | Do not generalize a sensor to every nearby street |
| NYC Permitted Event Information | `tvpp-9vvx` | Time-specific public-event context | Cataloged | Not a complete private-event or nightlife calendar |
| 311 Service Requests | `erm2-nwe9` | Historical condition research | Cataloged, experimental | Reporting behavior is not objective or live condition data |
| Restaurant Inspection Results | `43nn-pn8j` | Establishment universe and location context | Cataloged | Does not measure taste, atmosphere, popularity, or live wait |
| Landmark and Historic District Buildings | `7mgd-s57w` | Historical route anchors | Cataloged | Significance is not personal relevance |
| Parks Monuments | `6rrm-vxj9` | Cultural anchors | Cataloged | Presence does not imply relevance to the current user |
| National Weather Service API | — | Current weather context and suggested defaults | Cataloged | Weather context does not replace street-level evidence or solar calculation |

## 8. Current prototype baseline

The `codex/happy-path-mvp` branch currently reports:

- 2,794 graph nodes and 4,487 derived edges in the main pilot component;
- 35 mapped-step edges;
- 2,681 NYC building footprints with positive usable roof heights in the snapshot;
- 4,239 official tree points and 22 park-property polygons;
- precomputed shade samples for 13 hourly positions on August 15;
- 100% computed edge coverage for the current shadow output;
- validation still pending for geometry, solar method, sampled blocks, crossings, and route distinctness.

These figures describe the current prototype snapshot, not a validated product claim. Task [002](../tasks/002-data-platform-and-pilot-audit.md) owns reconciliation and validation.

## 9. Feature derivation

### 9.1 Time-aware estimated shade

For each usable building height:

```text
shadow_length = building_height / tan(solar_elevation)
```

Project the building geometry opposite solar azimuth. For each route edge:

```text
shade_share = shaded_edge_length / edge_length
direct_sun_seconds = edge_walk_seconds × (1 − shade_share)
```

For each route:

```text
direct_sun_minutes = Σ direct_sun_seconds / 60
longest_exposed_stretch = longest continuous substantially unshaded edge sequence
```

Preferred claim:

> About 11 fewer minutes in estimated direct sun than the fastest route.

Prohibited claim:

> This street will be 11 minutes cooler.

### 9.2 Greenery

```text
greenery_score = tree adjacency + park frontage + validated green-cover context
```

Keep greenery separate from shade. A building-shaded street may have little greenery, and a mapped tree does not prove current shade.

### 9.3 Mapped-step avoidance and Gentler research

Mapped steps become a hard exclusion only when explicitly selected.

```text
effort_score = total ascent + sustained-grade penalty
             + mapped-step penalty + uncertain-crossing penalty
```

The product may say “avoids mapped steps” or “lower estimated ascent” after validation. It may not claim full accessibility.

### 9.4 Rest continuity

Use walking-network distance to calculate:

- time to first mapped seating;
- maximum time between mapped rest opportunities;
- seating detour;
- route segments responsible for long gaps.

Informal, private, or unavailable seating may not be represented.

### 9.5 Restrooms and water

Use route-compatible network detour and published hours. Keep inventory, scheduled availability, and current observed operation as separate evidence.

### 9.6 Construction friction and likely cover

Possible metrics include:

- route length intersecting or adjacent to current-enough shed records;
- number of affected blocks;
- alternative route avoiding those records;
- likely overhead-cover adjacency.

Do not claim exact clear width or dryness unless a source supports it.

### 9.7 Expected activity or quietness

These remain experimental composites from measured counters, events, establishments, traffic, construction, and historical reports.

The interface must distinguish:

- measured activity near a sensor;
- expected activity from context;
- unknown conditions.

Never present 311 or venue density as live measured noise or crowding.

## 10. Intent compilation

The language layer maps human expressions into a controlled feature vocabulary.

| Request language | Supported interpretation | Boundary |
| --- | --- | --- |
| “less sun” | minimize estimated direct-sun exposure | P0 |
| “green” | favor mapped trees and parks | after validation |
| “avoid steps” | hard exclusion of mapped step edges | not an accessibility guarantee |
| “places to sit” | prefer or require mapped seating within route constraints | inventory may be incomplete |
| “bathroom” | prefer or require a mapped restroom with relevant published hours | not guaranteed open now |
| “water” | route-compatible mapped fountain or water asset | operation uncertain |
| “less construction” | avoid validated shed or construction-friction evidence | exact obstruction may be unknown |
| “easy for my parents” | soft preference for supported effort and rest features | does not infer disability or hard access needs |
| “safe” | unsupported | never infer personal safety |
| “fun” or “cool” | unsupported without explicit personal anchors and validated features | model does not supply taste |

### Clarification policy

Ask one question only when the answer materially changes:

- journey shape;
- destination or endpoint;
- time budget;
- hard requirement;
- whether an amenity is required or preferred.

## 11. Candidate selection and route explanation

The deterministic route engine provides the baseline recommendation policy.

Inference may be used to break a close non-dominated tie only if:

- all candidates are valid;
- every considered metric is supplied;
- the model selects an immutable candidate ID;
- the deterministic validator rechecks the result;
- the selection can be explained through approved claims.

The simpler P0 option is deterministic selection plus model-generated explanation. This should be preferred if reranking adds limited demonstrable value.

### Best-extra-minute frontier

The route engine calculates:

```text
+2 minutes → 7 fewer estimated sun minutes
+4 minutes → 11 fewer estimated sun minutes
+8 minutes → 12 fewer estimated sun minutes
```

Inference may explain:

> Four extra minutes captures nearly all of the available shade improvement.

## 12. Presentation selection

The intelligence layer may choose which registered evidence is relevant to the current request, but only through typed IDs.

Rules:

- required assets and warnings cannot be suppressed;
- the route remains primary;
- use at most one continuous evidence layer by default;
- show discrete assets only when selected, required, route-relevant, or decision-relevant;
- move secondary evidence into the receipt or evidence drawer;
- deterministic rendering handles collision, density, zoom, color, and accessibility.

## 13. Evidence and confidence

Evidence classes:

- **Official** — directly represented by an authoritative publisher;
- **Derived** — calculated from one or more sources;
- **Inferred** — estimated from supplied evidence;
- **Observed** — recently reported or verified by a person;
- **Unknown** — insufficient evidence.

Confidence is calculated from evidence rather than improvised by the model:

```text
confidence = authority × coverage × freshness × spatial precision
             × derivation validation × recommendation robustness
```

### Claim rules

| Claim | Minimum evidence |
| --- | --- |
| “11 fewer minutes in estimated direct sun” | validated shadow method and sufficient edge coverage on both routes |
| “avoids mapped steps” | audited graph evidence on displayed route |
| “passes 3 mapped seating locations” | validated network join to official inventory |
| “restroom with published hours” | source hours and route-compatible location |
| “operational restroom” | current operational evidence in addition to hours |
| “likely covered” | current-enough shed or cover evidence; never promise dryness |
| “expected quieter” | validated proxy and explicit expected label |
| “safe” | never permitted |

## 14. Validation gate

A layer cannot affect routing until it passes:

1. access, terms, and attribution review;
2. schema and null handling;
3. coordinate and geometry sanity checks;
4. pilot coverage measurement;
5. freshness and temporal-validity review;
6. feature-derivation tests;
7. product-language and prohibited-claim review;
8. at least ten relevant samples checked against current visual or field evidence;
9. graceful fallback when the layer is unavailable.

For every inference-assisted result:

- candidate ID exists;
- minute budget holds;
- hard requirements hold;
- missing evidence is not treated as favorable;
- numerical explanation matches deterministic output;
- unsupported adjectives or claims fail validation.

## 15. Performance and delivery

The current prototype contains large committed graph, building, greenery, and hourly shadow payloads. Before integration:

- set an explicit initial-load budget;
- lazy-load only the relevant time slice and layer data;
- consider server-side route computation or compact binary/vector formats where useful;
- keep full raw source snapshots out of the client bundle;
- cache deterministic outputs by pilot, time interval, and source version;
- preserve a deterministic no-model route path.

## 16. Access, terms, and privacy

- Record publisher, dataset ID, retrieval time, snapshot hash, transformations, and attribution.
- Follow NYC Open Data terms and any source-specific conditions.
- Display `© OpenStreetMap contributors` and required license links.
- Do not send a user’s full route to many public-data APIs during interaction.
- Do not retain raw prompts, exact paths, or inferred personal context by default.
- User observations, when added later, must expire or be reconfirmed.
- Public-source records do not become personal-preference evidence.

## 17. Detour reuse

Every routing-ready layer should define whether it can also support:

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
- restrooms → route deviation and operating-hours scenarios;
- mapped steps or ramps → connection detour scenarios;
- sheds → construction-friction burden and removal scenarios.

Detour must reuse the same source and feature pipeline rather than creating a second planning-only data model.

## 18. Implementation sequence

1. Approve the LayerDefinition and evidence schemas.
2. Complete the graph, buildings, solar, and shade audit.
3. Produce compact route and layer fixtures.
4. Make shade, greenery, and mapped steps routing-ready if validation passes.
5. Integrate seating, restrooms, water, public space, transit, and sheds as visualizable layers.
6. Promote selected amenities or friction layers to routing-ready after route-level validation.
7. Connect Trip Brief feature IDs to registered route capabilities.
8. Connect claims and map presentation to source and confidence records.
9. Reuse one validated feature in the first Detour scenario.
10. Add new sources through the registry and validation gate rather than special-case product logic.

## 19. Open decisions

1. Does the current Lower Manhattan pilot provide strong enough demo routes for all three resident scenarios?
2. What minimum shadow and graph coverage permits quantified claims?
3. Which amenity layer should become the third validated route capability after shade and greenery or mapped steps?
4. Are sidewalk-shed records current and precise enough to affect routing, or only visualization and Detour?
5. Should the P0 route winner remain fully deterministic?
6. What client payload and warmed route latency budgets should be enforced?
7. Which source can support a credible current construction-friction layer?
8. Which validated feature should power the first Detour scenario?
