# Happy Path — Data and inference specification

> Companion specification for the [Happy Path PRD](PRD.md). The PRD remains authoritative for product scope and acceptance criteria.

| Field | Decision |
| --- | --- |
| Product | Happy Path |
| Planning extension | Detour |
| Initial geography | One bounded, data-rich NYC pilot |
| First measurable route proof | Time-aware shade, presented as estimated direct-sun exposure rather than measured temperature |
| Other MVP dimensions | Add one or two only after pilot coverage and claim-quality checks |
| Data strategy | Preprocess public data into evidence on a pedestrian graph; do not query many City APIs during a route request |
| Last updated | 2026-08-15 |

## 1. Purpose

This document defines:

1. which public and open sources can support Happy Path;
2. how those sources become street- and route-level evidence;
3. where language inference is useful and where deterministic systems remain authoritative;
4. how route claims retain provenance, freshness, coverage, and confidence;
5. which sources belong in the MVP, later route modes, and the Detour extension.

It does not commit every listed source to the hackathon build. A feature enters the product only after its source passes the pilot validation gate in section 8.

## 2. System boundary

> **Inference interprets the user and the evidence. It does not invent the city.**

| System | Authority |
| --- | --- |
| Route engine | Pedestrian connectivity, geometry, distance, time, budget arithmetic, candidate generation, and hard-constraint enforcement |
| Feature pipeline | Spatial and temporal joins, route metrics, coverage, freshness, and deterministic feature derivation |
| Language and preference layer | Compile prompts and Quick Picks into the Trip Brief, map supported preferences, rank valid candidates, explain tradeoffs, and apply opted-in preferences |
| Evidence layer | Track source, derivation, observation date, confidence, allowed claims, and prohibited claims |

```text
prompt + Quick Picks + saved preferences
                    ↓
            editable Trip Brief
                    ↓
       valid endpoints and route candidates
                    ↓
       measured features + evidence records
                    ↓
      bounded ranking + deterministic checks
                    ↓
       evidence-linked route receipt
```

Inference may select or rank only candidates produced by the route engine. It may not create geometry, change time arithmetic, treat missing evidence as favorable, or silently relax a requirement.

## 3. Canonical planning contract

The user-facing journey shapes map to stable internal values:

| Product language | Internal value |
| --- | --- |
| Go somewhere | `destination` |
| Loop | `loop` |
| Wander | `wander` |

The Trip Brief must represent these implementation-relevant fields without creating a second hidden interpretation:

```yaml
journey_shape: destination | loop | wander
origin: coordinates
destination_or_end_condition: object | null
departure_time: ISO-8601

walking_budget_minutes: number | null
outing_budget_minutes: number | null
stop_dwell_minutes: number
detour_allowance_minutes: number

preferences: []
requirements: []
avoidances: []
taste_anchors: []

unsupported_or_unverified: []
clarification: object | null
```

Each interpreted field uses the metadata defined in the PRD:

```yaml
input_origin: prompt | quick_pick | refinement | saved_preference | default
requirement_state: prefer | required | avoid
interpretation_confidence: confirmed | high | medium | low
```

Walking time plus displayed stop dwell must not exceed the total outing budget. A saved preference is always soft; it cannot override the current request or create a hard requirement.

### Candidate contract

Every candidate passed to a model has an immutable ID and measured values:

```yaml
candidate_id: string
geometry_ref: string

travel:
  walking_seconds: number
  stop_dwell_seconds: number
  total_outing_seconds: number
  distance_meters: number
  extra_minutes_vs_fastest: number | null

constraints:
  valid: boolean
  violations: []

metrics: object

evidence:
  coverage: 0.0-1.0
  source_ids: []
  confidence: high | medium | low
```

The model may explain a supplied metric. It may not recalculate or fabricate one.

## 4. Public-data architecture

```text
public or open source
          ↓
source-specific download or API ingest
          ↓
schema, geometry, freshness, and license checks
          ↓
crop to pilot + normalize coordinates and time
          ↓
join to pedestrian edges or nearby assets
          ↓
candidate-route metrics
          ↓
evidence-linked product claims
```

Interactive route requests should read preprocessed pilot data. Only genuinely time-sensitive context, such as weather or transit outages, should be fetched or refreshed frequently.

### Source registry record

```yaml
source_id: string
publisher: string
dataset_name: string
dataset_url: string
canonical_url: string
dataset_id: string | null
asset_type: dataset | view | api | calculation

authority: official | community | derived
access_method: bulk_download | socrata_api | realtime_api | calculation
format: string
terms_url: string
attribution: string | null

refresh_target: string
source_updated_at: timestamp | null
retrieved_at: timestamp
last_successful_ingest: timestamp | null
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
validation_status: pending | passed | failed
```

## 5. Source registry

### 5.1 MVP core

These sources establish routable paths, the first measurable experience, Greener evidence, and the demo's transit endpoint. Direct catalog links use each source's stable dataset ID.

| Source | ID | Role | Access and refresh | Claim boundary |
| --- | --- | --- | --- | --- |
| [OpenStreetMap export](https://www.openstreetmap.org/export) | — | Pedestrian network, paths, crossings, mapped stairs, access tags, and coarse place categories | Cropped prototype snapshot; refresh deliberately | Completeness varies. Audit every pilot route and attribute OpenStreetMap contributors. Do not call the result legally complete or step-free. |
| [NYC BUILDING](https://data.cityofnewyork.us/d/5zhs-2jue) | `5zhs-2jue` | Building geometry and usable `HEIGHT_ROOF` inputs for projected shade | Download, crop, and preprocess; validate zero, null, and anomalous heights | Supports estimated building shade, not measured sidewalk temperature. |
| [NREL Solar Position Algorithm](https://midcdmz.nrel.gov/spa/) | — | Sun elevation and azimuth for the requested place and time | Versioned deterministic calculation per request or cached interval | Never use a language model to estimate solar geometry; review the implementation notice before choosing a library. |
| [Forestry Tree Points](https://data.cityofnewyork.us/d/hn5i-inap) | `hn5i-inap` | Tree adjacency and Greener ranking | Cropped pilot snapshot | A mapped tree does not establish canopy size, present condition, or shade. |
| [Parks Properties](https://data.cityofnewyork.us/d/enfh-gkve) | `enfh-gkve` | Park adjacency and End near park | Cropped pilot snapshot | A property boundary does not prove current access, hours, or an entrance location. |
| [MTA Subway Entrances and Exits: 2024](https://data.ny.gov/d/i9wp-a4ja) | `i9wp-a4ja` | End near transit and endpoint candidates | Point-in-time pilot snapshot | The August 2024 inventory may miss later changes and does not represent service or elevator status. |
| [NYC Centerline](https://data.cityofnewyork.us/d/3mf9-qshr) | `3mf9-qshr` | City street references and graph validation | Static pilot snapshot | A road-bed centerline is not a pedestrian graph. |
| [NYC Planimetric Database: Sidewalk](https://data.cityofnewyork.us/d/vfx9-tbb6) | `vfx9-tbb6` | Sidewalk geometry validation and possible side-of-street experiments | Static pilot snapshot | Polygons do not automatically provide connected routing topology. |

Time-aware shade is the first proposed hero because it creates a visible, quantitative comparison. It still advances only if building-height coverage and shadow validation pass in the selected pilot.

### 5.2 MVP when exposed

These sources enter the MVP only if the corresponding control or requirement is included and the pilot audit passes.

| Source | ID | Potential use | Material limitation |
| --- | --- | --- | --- |
| [One-foot Digital Elevation Model](https://data.cityofnewyork.us/d/dpc8-z3jc) | `dpc8-z3jc` | Edge grade, ascent, and Gentler routing | Terrain data does not represent current temporary conditions; validate source age and vertical accuracy. |
| [Seating Locations](https://data.cityofnewyork.us/d/esmy-s8q5) | `esmy-s8q5` | Rest opportunities and maximum rest-gap metrics | Covers listed DOT seating, not every place someone can sit. |
| [Public Restrooms](https://data.cityofnewyork.us/d/i7jb-7jku) | `i7jb-7jku` | Restroom stops, endpoint conditions, hours, and amenities | Published hours do not prove a facility is open now. |

Recommended selection order after time-aware shade:

1. **Greener**, if tree and park coverage produces a distinct route comparison.
2. **Amenities**, if restroom and seating records are sufficiently complete for the demo area.
3. **Gentler**, only after elevation, mapped-stair, and crossing evidence pass route-level review.

### 5.3 Post-MVP and contextual sources

These sources can support canopy calibration, construction context, expected activity, personal-interest anchors, Detour demand, or contribution features. They are outside the MVP critical path.

| Source | ID | Potential use | Boundary |
| --- | --- | --- | --- |
| [Land Cover Raster Data (2017), six-inch resolution](https://data.cityofnewyork.us/d/he6d-2qns) | `he6d-2qns` | Canopy and green-cover calibration | The 2017 source is materially dated for present-condition claims. |
| [Sidewalk Sheds](https://data.cityofnewyork.us/d/2jy7-cddj) | `2jy7-cddj` | Construction-friction and likely-cover proxy | A permit record does not prove physical presence, passable width, or dryness. |
| [Pedestrian Ramp Locations](https://data.cityofnewyork.us/d/ufzp-rrqu) | `ufzp-rrqu` | Crossing-continuity research | NYC DOT states the measurements do not establish ADA compliance; some locations require further review. |
| [NYC Parks Drinking Fountains](https://data.cityofnewyork.us/d/qnv7-p7a2) | `qnv7-p7a2` | Water-access stops | Inventory presence does not prove current operation. This is the base dataset, not its map view. |
| [National Weather Service API](https://www.weather.gov/documentation/services-web-api) | — | Optional forecast and observation context | Weather may affect defaults and wording; it does not replace street-level evidence or calculate solar position. |
| [Bicycle and Pedestrian Count Sensors](https://data.cityofnewyork.us/d/6up2-gnw8) | `6up2-gnw8` | Identify instrumented locations | Coverage is limited to selected locations. |
| [Bicycle and Pedestrian Counts](https://data.cityofnewyork.us/d/ct66-47at) | `ct66-47at` | Historical activity and time-of-week baselines | Do not generalize a sensor reading to every nearby street. |
| [NYC Permitted Event Information](https://data.cityofnewyork.us/d/tvpp-9vvx) | `tvpp-9vvx` | Time-specific public-event context | Not a complete nightlife or private-event calendar. |
| [311 Service Requests from 2020 to Present](https://data.cityofnewyork.us/d/erm2-nwe9) | `erm2-nwe9` | Historical condition research | Complaints reflect reporting behavior, not objective or live street conditions. |
| [Restaurant Inspection Results](https://data.cityofnewyork.us/d/43nn-pn8j) | `43nn-pn8j` | Restaurant universe and cuisine/location context | Inspections do not measure taste, atmosphere, popularity, or live wait. |
| [Privately Owned Public Spaces](https://data.cityofnewyork.us/d/qeta-4kqg) | `qeta-4kqg` | Publicly usable indoor and outdoor spaces | Official existence does not prove a currently open entrance or available seating. |
| [Facilities Database](https://data.cityofnewyork.us/d/ji82-xba5) | `ji82-xba5` | Public destinations and Detour demand anchors | Requires category, public-access, and schedule filtering. |
| [Landmark and Historic District Buildings](https://data.cityofnewyork.us/d/7mgd-s57w) | `7mgd-s57w` | Historical and Interesting anchors | Historical significance is not a proxy for personal taste. |
| [Parks Monuments](https://data.cityofnewyork.us/d/6rrm-vxj9) | `6rrm-vxj9` | Historical and cultural anchors | Presence does not imply relevance to the current user. |
| [MTA developer resources](https://new.mta.info/developers) | — | Transit endpoints, accessibility feeds, and current equipment status | Use only for transit-linked journeys; outages remain time-sensitive. |

“Independent places” is not a reliable public-data flag. The MVP must use a small curated and verified pilot POI list or show that part of the request as unsupported. OpenStreetMap may support a venue's category and location where mapped, but not its ownership, atmosphere, current hours, or quality.

Public data can identify an asset. It usually cannot establish that a specific resident action is needed or authorized. Any future Public Assets & Actions task must come from a trusted publisher; inference may match a task to a route but may not invent one.

### 5.4 Coverage status

The catalog-level sources and IDs are identified, but no source has passed the pilot gate yet because the pilot boundary is still open. All source records begin with `validation_status: pending`.

The pilot audit must report at least:

- the share of routable OpenStreetMap edges with relevant access and stair attributes;
- the share of nearby buildings with usable roof heights;
- the share of candidate-route edges covered by the shadow model;
- tree and park adjacency coverage for Greener comparisons;
- the number and network reach of transit endpoints, restrooms, and seating assets;
- elevation coverage and extreme-value checks if Gentler is exposed.

The team must set the minimum acceptable coverage for each user-facing claim before that feature affects ranking.

## 6. Feature derivation and product claims

### Time-aware shade: first proof

For each usable building height:

```text
shadow_length = building_height / tan(solar_elevation)
```

Project building geometry opposite the solar azimuth. For each route edge and route:

```text
shade_share = shaded_edge_length / edge_length
direct_sun_seconds = edge_walk_seconds × (1 - shade_share)
direct_sun_minutes = Σ direct_sun_seconds / 60
```

Also calculate the longest continuous exposed stretch. Prefer a comparative claim:

> About 11 fewer minutes in estimated direct sun than the fastest route.

Do not claim:

> This street will be cooler.

### Greener

Keep greenery separate from shade:

```text
greenery_score = tree adjacency + canopy intersection + park or green-space frontage
```

A building-shaded street may have little greenery; a tree-lined street may provide limited shade at the requested time.

### Gentler

```text
effort_score = total ascent + sustained-grade penalty + mapped-stair penalty + uncertain-crossing penalty
```

If avoiding mapped stairs is required, mapped stair segments become a hard exclusion. The product still does not claim ADA compliance or guaranteed accessibility.

### Amenities and rest continuity

Use walking-network distance, not straight-line distance, to calculate time to the first amenity, maximum gap between rest opportunities, and facility detour. Published hours and live operational state remain different evidence.

### Personal fit

Personal fit may use browser-local saved places, route qualities, and explicit More/Less feedback. It must name the supplied connection and cannot claim objective coolness, quality, or neighborhood desirability.

## 7. Evidence and confidence

Use five evidence classes:

- **Official:** directly represented by an authoritative publisher.
- **Derived:** calculated from one or more sources.
- **Inferred:** estimated from supplied evidence.
- **Observed:** recently reported or verified by a person.
- **Unknown:** insufficient evidence.

Confidence is derived rather than improvised:

```text
confidence = authority × coverage × freshness × spatial precision
             × derivation validation × recommendation robustness
```

Every displayed claim must reference a route metric or supported preference, a baseline when relevant, one or more source IDs, an evidence class, and confidence.

| Claim | Minimum evidence or rule |
| --- | --- |
| “11 fewer minutes in estimated direct sun” | Validated shadow method and sufficient edge coverage for both routes |
| “Avoids mapped stairs” | Audited graph coverage for the displayed route; never relabel as accessible |
| “Operational restroom” | Current operational evidence plus hours; otherwise show published hours and uncertainty |
| “Likely covered” | Current-enough shed evidence; never promise dryness |
| “Quieter” | Validated historical proxy; never imply live measured sound without a sensor |
| “Livelier” | Relevant sensor evidence or an explicit expected-activity label |
| “Similar to places you saved” | User-provided anchors and explainable shared attributes |
| “Safe” | Not permitted |

## 8. Validation gate

A source cannot affect routing until it passes:

1. access, terms, and attribution review;
2. schema and null handling;
3. coordinate-reference and geometry sanity checks;
4. pilot coverage measurement;
5. freshness and temporal-validity review;
6. feature-derivation tests;
7. product-language and prohibited-claim review;
8. at least ten pilot samples checked against current visual or field evidence;
9. graceful fallback when the source or a metric is unavailable.

For every inference-ranked result:

- the candidate ID exists;
- walking and outing budgets hold;
- hard requirements hold;
- missing evidence is not treated as favorable;
- each numerical explanation matches deterministic output;
- an unsupported adjective or claim fails validation.

## 9. Access, terms, and privacy

- NYC datasets are governed by the [NYC Open Data Terms of Use](https://opendata.cityofnewyork.us/overview/#termsofuse) and any additional publisher terms. The City does not warrant completeness, accuracy, or fitness; data can be corrected or refreshed. Each ingest records the publisher, dataset ID, retrieval time, snapshot hash, and transformations.
- OpenStreetMap data is licensed under the ODbL and requires visible [OpenStreetMap attribution](https://www.openstreetmap.org/copyright), including `© OpenStreetMap contributors` and a license link.
- The NWS API provides open government data, has rate limits, and requires a User-Agent. Cache responses according to their useful lifetime.
- Download and crop public data for the pilot rather than sending origins, destinations, or full route geometry to multiple source APIs.
- The MVP preference profile remains browser-local. Public-source records do not contain or create user preference evidence.
- Do not retain raw prompts or paths server-side merely to improve feature weights.

## 10. Build order and unresolved choices

1. Build and audit the pedestrian graph.
2. Ingest building geometry and validate usable heights.
3. Calculate solar position and projected shade.
4. Compare valid time-aware-shade candidates against the fastest route.
5. Attach source IDs, coverage, and confidence to the receipt.
6. Select one or two additional dimensions only after their pilot audit.
7. Keep learned ranking, contribution, and Detour simulation outside the MVP critical path.

Open choices:

1. Which pilot has strong alternate walking routes and sufficient building-height coverage?
2. What minimum edge coverage permits a quantified direct-sun claim?
3. Which one or two candidate dimensions best complement time-aware shade?
4. Should current weather affect ranking or only suggested defaults and explanation language?
5. Can sidewalk polygons support credible side-of-street guidance inside the hackathon timebox?
