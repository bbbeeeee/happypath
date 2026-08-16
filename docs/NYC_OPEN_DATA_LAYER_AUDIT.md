# NYC Open Data layer audit

Updated: 2026-08-16

This audit evaluates additional NYC Open Data support against the implementation in PR #3 at commit `d573eec`. Dataset metadata, schemas, and citywide record counts were checked against the official NYC Open Data catalog and APIs on the date above. The recommendations remain a point-in-time backlog; the focused cover follow-up below has since been implemented in the same worktree.

## Implemented flood-context follow-up

The planner now offers an opt-in [NYC DEP Stormwater Flood Map](https://data.cityofnewyork.us/d/9i7c-xyvv) layer for the moderate-rain scenario with projected 2050 sea-level rise. The supported-area snapshot contains 741 nuisance-ponding components and 324 deep-and-contiguous-flooding components. It is lazy-loaded, rendered with two distinct patterns, selectable, and measured against the current route geometry.

This is a static planning model, not current or forecast flooding. It never selects, penalizes, excludes, certifies, or clears a resident route. “No model overlap” remains unknown rather than becoming “safe” or “dry,” and the product points people to Notify NYC for current official alerts. The first convenient ArcGIS endpoint found during implementation was rejected after its item ownership proved unaffiliated; the checked-in snapshot comes from an NYC DEP-owned feature service and records the owner and service item ID.

## Implemented cover follow-up

The synthetic cover pattern is now removed. Routing can favor 408 graph edges across 313 OSM ways that match explicit `covered` or `tunnel=building_passage` tags. A lazy supported-area context layer also contains 1,589 deduplicated, currently dated DOB sidewalk-shed permit locations, 91 completed POPS arcade listings, and 296 construction-closure records whose published windows include the snapshot day.

Only the path-aligned OpenStreetMap geometry changes route scoring. Shed permits, the POPS point, and construction lines are nearby context because none establishes the exact covered pedestrian footprint, current access, or dryness. No usable current public awning geometry was identified, so awnings are not inferred. Missing cover evidence remains unassessed rather than treated as exposed.

## Recommendation

The best first shippable change is a grouped **public spaces and waterfront** capability. The best new-source spike is **Open Streets**: it adds a new kind of route value without depending on subjective neighborhood scores, but the current feed's published end dates stop in 2025. Treat it as program inventory until the City feed supplies a current schedule; do not ship an “active now” or scheduled route preference from stale dates.

The next deeper investment should be **grade and crossing-support evidence**. That work advances the mobility promise more than another amenity feed, but it requires graph-level modeling and careful language.

Do not add a switch for every dataset. Group sources into a few resident concepts:

- **Better streets** — Open Streets and, later, validated street-work context;
- **Places to pause** — plazas, POPS, waterfront access, seating, restrooms, water, and seasonal cooling amenities;
- **Things to notice** — monuments, landmarks, public art, markets, and time-bounded events;
- **Gentler crossings** — grade, mapped ramps, accessible pedestrian signals, and exclusive pedestrian phases.

The audit found that the simulated-cover layer should be replaced by real, bounded street-condition evidence. The implemented follow-up does this without treating construction or permit proximity as favorable route cover.

## Current foundation

PR #3 already has a good evidence model and two practical extension rails:

1. point assets that can appear near a route or resolve an end condition; and
2. edge-scored signals keyed to pedestrian-graph edge IDs.

The checked-in pilot currently contains:

- a 4,487-edge OpenStreetMap pedestrian graph;
- time-aware building-shade estimates from NYC BUILDING;
- tree and park adjacency from 4,239 tree records and 22 park properties;
- 27 DOT seating records, 4 public restrooms, 28 Parks drinking fountains, and 41 MTA entrances;
- nine simulated civic data checks, including four tied to exact cover-evidence records;
- ingested cover-context entries for sidewalk-shed permits, POPS arcade candidates, and dated construction closures, plus reference-only entries for pedestrian ramps, pedestrian plazas, spray showers, cooling options, and the Facilities Database.
- an opt-in DEP-owned 2050 stormwater model snapshot with route-overlap context but no routing effect.

That foundation has four important limits:

- `MapLayerDefinition` documents layers, but MapLibre rendering, fallback rendering, toggles, planner lenses, icons, prompts, and receipts are still wired separately.
- The journey engine supports only one experimental extra edge-preference signal at a time. Several simultaneous street signals need a composite edge-feature contract.
- Amenity proximity and graph snapping are straight-line approximations, not walking-network access or verified entrances.
- Initial JavaScript remains separately budgeted after graph partitioning. Cover and flood context are both lazy-loaded; the flood fixture is 90.89 KiB gzip and remains outside initial load.

All currently ingested and derived registry entries still have `validation_status: pending`; reference-only entries are `cataloged`. Promoting existing evidence safely is at least as valuable as increasing the source count.

## Evaluation criteria

Candidates were ranked by:

1. the resident or planner decision they improve;
2. whether the source can truthfully affect routing, an endpoint, an explanation, or only a map;
3. usable geometry and stable join keys;
4. update cadence and the cost of stale data;
5. fit with the current pilot and payload budget;
6. overlap with sources already in the registry; and
7. risk of turning incomplete public data into a claim about safety, accessibility, neighborhood quality, or current conditions.

## Ranked opportunities

| Rank | Capability and official source | Best product use | Join and delivery path | Claim boundary | Effort |
| --- | --- | --- | --- | --- | --- |
| 1 | [Open Streets Locations (`uiay-nctu`)](https://data.cityofnewyork.us/d/uiay-nctu) | Program context now; later, “prefer Open Streets,” better loops, and wanders | Clip `MultiLineString` geometry to the pilot; retain segment IDs, status, dates, weekdays, and daily hours; spatially join to graph edges | The source was refreshed in August 2026, but published end dates stop in 2025. Until corrected, it is inventory—not an active schedule. It also does not prove car-free, unobstructed, or safer conditions | Medium |
| 2 | [Waterfront Public Access Areas (`388s-pnvc`)](https://data.cityofnewyork.us/d/388s-pnvc) plus [access points (`9y58-8zvz`)](https://data.cityofnewyork.us/d/9y58-8zvz) | Waterfront loops, “walk me to the water,” promenade and pause destinations | Join polygons and entrances on `wpaa_id`; route to validated access points rather than polygon centroids | A mapped access area does not prove current hours, entrance access, seating, shade, or an uninterrupted waterfront path | Medium |
| 3 | Existing [pedestrian plazas (`k5k6-6jex`)](https://data.cityofnewyork.us/d/k5k6-6jex) and [POPS (`rvih-nhyn`)](https://data.cityofnewyork.us/d/rvih-nhyn) | “End at a public place,” pause anchors, planner amenity gaps | Promote the existing reference entries; derive or manually verify graph-adjacent entrances; group with waterfront access | Official inventory and required hours do not prove an entrance is open, exact, accessible, shaded, or currently usable | Small–medium |
| 4 | [Greenstreets (`mk9u-qu7i`)](https://data.cityofnewyork.us/d/mk9u-qu7i) | Micro-greenery context, climate-learning routes, and City what-if | Filter active `featurestatus`; intersect `MultiPolygon` geometry with route buffers; preserve `gispropnum`, `omppropid`, and `parentid` for Parks joins | A planted median or traffic island is not necessarily walkable, enterable, shaded, or a place to pause; keep it distinct from the current tree/park score first | Small–medium |
| 5 | [Accessible Pedestrian Signals (`de3m-c5p4`)](https://data.cityofnewyork.us/d/de3m-c5p4), [exclusive pedestrian signals (`8kuj-2n3u`)](https://data.cityofnewyork.us/d/8kuj-2n3u), existing ramps, and [one-foot DEM (`dpc8-z3jc`)](https://data.cityofnewyork.us/d/dpc8-z3jc) | Gentler-route research, crossing-support evidence, grade and ascent in route receipts | Precompute per-edge grade; snap signal and ramp points to audited intersections; preserve source-specific installation dates | These sources do not establish an ADA-compliant, accessible, safe, working, or continuously step-free journey; the DEM is based on 2010 LiDAR | Large |
| 6 | [Street closures due to construction (`i6b5-j7bu`)](https://data.cityofnewyork.us/d/i6b5-j7bu), [street-construction permits (`tqtj-sjs8`)](https://data.cityofnewyork.us/d/tqtj-sjs8), and DOB NOW sidewalk-shed permits (`rbx6-tga4`) | Broaden sparse mapped-cover and construction context; support City data checks | Normalize active windows and line/address geometry into one `street_conditions` family; keep records display/reference-only until exact pedestrian geometry is validated | A permit window does not prove current installation, pedestrian closure, side of street, passable width, overhead cover, or dryness; never hard-exclude or add cover without pedestrian-specific verification | Large |
| 7 | [Temporary Art Program (`3r2x-bnmj`)](https://data.cityofnewyork.us/d/3r2x-bnmj), [Outdoor Public Art Inventory (`2pg3-gcaa`)](https://data.cityofnewyork.us/d/2pg3-gcaa), existing [Parks Monuments (`6rrm-vxj9`)](https://data.cityofnewyork.us/d/6rrm-vxj9), and [Individual Landmark Sites (`buis-pvji`)](https://data.cityofnewyork.us/d/buis-pvji) | “Give me an interesting walk,” one to three story-worthy stops, route receipts with provenance | Normalize coordinates; reject malformed point text; filter temporary art by installation/removal dates; transform or geocode sources without WGS84 points offline | Official designation is not universal interest, current condition, visibility, present access, event status, or a reason to overrule the user's route constraints | Small–medium |
| 8 | [NYC Permitted Event Information (`tvpp-9vvx`)](https://data.cityofnewyork.us/d/tvpp-9vvx), [Farmers Markets (`8vwk-6iz2`)](https://data.cityofnewyork.us/d/8vwk-6iz2), and [Dining Out NYC (`fpeh-f7ci`)](https://data.cityofnewyork.us/d/fpeh-f7ci) | Time-aware destinations and “something happening” or “somewhere to eat” requests | Query or snapshot by bounding box and active date; normalize schedules; geocode event street descriptions offline when coordinates are absent | Permit, license, or annual schedule does not prove an event, market, restaurant, or outdoor table is operating now; do not infer quality or popularity | Medium |
| 9 | [Parks public-restroom status (`9byw-znpj`)](https://data.cityofnewyork.us/d/9byw-znpj) and [inspection ratings (`mp8v-wjtf`)](https://data.cityofnewyork.us/d/mp8v-wjtf) | Enrich a high-value existing amenity with winterization, long-term closure, and dated inspection evidence | Build an audited crosswalk from Parks `prop_id`/`cs_id` and inspection `csnumber` to the public-restroom point inventory; do not fuzzy-join at runtime | An inspection or non-closure record does not prove the restroom is open, clean, accessible, or functioning now | Medium |
| 10 | [Bus Stop Shelters (`t4f2-8md7`)](https://data.cityofnewyork.us/d/t4f2-8md7) | Rain-aware pause points and transit-adjacent shelter context | Ingest point geometry and stable `shelter_id`; treat as a request-only amenity or cover candidate | Annual inventory does not prove a seat, useful cover, current presence, condition, service, accessibility, or dryness | Small |
| 11 | [DEP Green Infrastructure (`df32-vzax`)](https://data.cityofnewyork.us/d/df32-vzax) | City what-if, climate-learning routes, rain-garden data checks | Pilot-crop point assets by `asset_id`/`gi_id`; display type, status, and construction date; keep planner-first | A mapped installation is not a park, public amenity, shade source, flood guarantee, or proof of present condition | Small |
| 12 | [Parks Active and Passive Recreation (`kcqe-vnci`)](https://data.cityofnewyork.us/d/kcqe-vnci) | Match loops or destinations to exercise versus strolling intent | Join polygons using `gispropnum`; use category as place context rather than a fine-grained edge score | The dataset is designed for CEQR open-space analysis; percentages do not prove entrances, conditions, hours, crowding, or personal suitability | Medium |

### Best immediate outcome

Ship plazas, POPS, and waterfront access as one `public_spaces` family first. In parallel, spike Open Streets geometry and wait for a current schedule before using it as an active route preference. This unlocks several clear requests:

- “Give me a 30-minute loop with more Open Streets.” (after current schedules validate)
- “Walk me to the waterfront and finish near the subway.”
- “I have 20 minutes—find me a public place to sit.”
- “Show me one interesting thing along the way.”

Those requests fit the existing destination, loop, wander, explicit preference, end-condition, and route-receipt models. They are also easy to explain without claiming that a neighborhood is objectively better.

## Source size and freshness notes

Official API counts observed during the audit are citywide and are provided only for sizing, not as coverage guarantees.

| Dataset | Citywide records | Published cadence | Delivery implication |
| --- | ---: | --- | --- |
| Open Streets | 391 citywide / 8 pilot intersections | Monthly | Small pilot line chunk, but current published end dates stop in 2025 |
| Waterfront access areas / access points | 78 / 66 | As needed | Very small; preserve the `wpaa_id` relationship |
| Bus shelters | 3,381 | Annually | Small pilot point chunk, but operational confidence is low |
| Dining Out NYC | 2,156 citywide / 192 pilot points | Daily | Small point slice; active license is not open-now evidence |
| Greenstreets | 2,755 citywide / 20 pilot polygons | Monthly | Filter inactive records and do not treat planted areas as walkable space |
| DEP green infrastructure | 16,231 | Monthly | Pilot-crop and cluster or keep planner-only |
| Temporary Art Program | 543 | Monthly | Small after active-date and pilot filters |
| Construction street closures | 4,941 | Weekly | Date-filter and pilot-crop; still not pedestrian-closure proof |
| Parks active/passive recreation | 2,936 | As needed | Polygon simplification and entrance resolution matter more than raw size |
| Outdoor public-art inventory | 780 citywide / about 20 pilot points | As needed | Reject malformed coordinate text; useful but less fresh than the temporary-art feed |
| Accessible Pedestrian Signals | 4,266 citywide / 28 pilot points | Monthly | Intersection matching and operating-state uncertainty are the real costs |
| Pedestrian plazas | 93 citywide / 3 pilot polygons | Monthly | Already cataloged; access-point derivation matters more than payload |
| Parks spray showers | 1,119 citywide / 6 pilot points | As needed | Already cataloged; no operational field |

## Promote, add, defer, or reject

### Promote existing registry entries

- Pedestrian plazas, POPS, and spray showers are the lowest-cost useful additions.
- Explicit path-aligned covered-way geometry is the strongest current route evidence. Sidewalk-shed permit candidates remain high-value field-audit context, not a route-cover substitute.
- Ramps should enter City what-if and field checks before they influence resident routing.
- The Facilities Database should be filtered into small, explicit public-destination types rather than added as a generic 34,000-record layer.

### Add to the registry now

- Open Streets and the waterfront area/access-point pair;
- Greenstreets, initially as visual and planner context rather than a favorable route score;
- APS and exclusive pedestrian signals;
- construction closure lines as reference-only pending pedestrian-scope validation;
- temporary art and individual landmark sites;
- Parks restroom status/inspection sources;
- farmers markets, Dining Out NYC, bus shelters, and DEP green infrastructure.

### Defer

- NYC Wi-Fi Hotspot Locations (`yjub-udmw`): the underlying rows were last updated in 2019 and the catalog metadata is old. Revisit through a current LinkNYC source rather than presenting the inventory as current.
- Parks event listing tables: their catalog metadata changed recently, but the underlying event and location rows were last updated in 2021. The daily permitted-event feed is the safer temporal starting point.
- Bike routes as a running signal: the dataset has useful `grnwy` and on/off-street fields, but a bike facility is not automatically a pleasant, legal, or safe pedestrian path. Only audited shared/off-street greenway segments should be considered.
- Step Streets Locations (`u9au-h79y`): useful for auditing OSM mapped-step coverage, but it has no geometry or stable segment ID and no records in the current small pilot. Resolve and manually verify street ranges before it can supplement a hard exclusion.
- Automated Traffic Volume Counts (`7ym2-wayt`): potentially useful for sampled activity research, but observations are sparse in space and time and reference an older LION version. Do not turn it into a live “quiet street” surface.

### Do not use for resident route quality

- 311 complaints;
- crash counts;
- noise complaints;
- sparse pedestrian counters generalized beyond a sensor; and
- Sidewalk Management Database violations (`6kbp-uz6m`).

These sources reflect reporting, enforcement, exposure, inspection, and sensor-placement patterns. They can support bounded City audits or candidate data checks, but should not create “safe,” “unsafe,” “quiet,” “clean,” “busy,” or neighborhood-quality scores.

## Architecture work before several more layers

### 1. Make the catalog executable

Move repeated layer behavior behind adapters so a definition can provide:

- a lazy data loader;
- MapLibre and fallback renderers;
- selection and clustering behavior;
- route/end-condition adapters;
- source and freshness presentation; and
- evidence-boundary copy.

Adding an ID to `MapLayerId` should not require discovering every hard-coded switch independently.

### 2. Use four normalized artifact shapes

- **point assets** — amenities, art, markets, signals, checks;
- **polygons plus access points** — parks, plazas, POPS, waterfront areas;
- **edge features** — shade, greenery, grade, Open Streets, possible cover/friction;
- **temporal records** — events, markets, permits, closures, schedules.

Every artifact should carry source IDs, retrieved and source-update timestamps, snapshot hash, supported bounds, transformation version, validation status, allowed claims, and prohibited claims.

### 3. Generalize route evidence carefully

Replace the single extra edge preference with a bounded composite model. Missing evidence must remain unknown and must never earn a favorable score. New hard exclusions require stronger evidence than new display or soft-preference signals.

### 4. Resolve real access, not centroids

Create a reusable polygon/point-to-graph resolver that prefers official access points, mapped entrances, and verified paths. A plaza, park, POPS, or waterfront polygon centroid is not a valid default destination.

### 5. Partition optional data

Keep optional layer chunks outside initial JavaScript. A practical preview target is 50–75 KB gzip per optional family after pilot cropping, simplification, and field selection. Load by visible bounds or active request and provide the same semantic fallback when WebGL is unavailable.

## Proposed implementation sequence

### Phase 0 — settle evidence debt

1. Validate current graph, building, shade, greenery, and amenity snapshots.
2. Choose one canonical POPS view and one canonical sidewalk-shed input.
3. Centralize the supported-area bounds used by ingestion scripts.
4. Record explicit `display`, `endpoint`, `soft_route`, `hard_route`, and `planner_only` capability states.

### Phase 1 — fast, delightful support

1. Promote plazas and POPS; add waterfront polygons and access points.
2. Ingest Open Streets geometry and schedule fields, but keep it inventory-only until current schedule dates validate.
3. Add Greenstreets as visual/planner context and assess whether it adds anything beyond the tree/park model.
4. Add monuments, temporary art, and landmarks behind one `things_to_notice` preference.
5. Keep the resident map contextual: no citywide pin cloud and no new dataset-per-toggle UI.

### Phase 2 — mobility evidence

1. Derive edge grade from the DEM and expose distance-weighted ascent/descent.
2. Add APS, exclusive pedestrian phases, and ramp evidence at audited crossings.
3. Validate complete sample journeys before strengthening any “gentler” or access-related copy.

### Phase 3 — temporal city and real street context

1. Add permitted events, farmers markets, and Dining Out as request-only temporal destinations.
2. Normalize construction and closure candidates into a freshness-aware street-conditions family.
3. Expand beyond sparse mapped cover only after exact candidate geometry and route behavior pass manual block review.
4. Add a server-side refresh/cache path only if runtime freshness is worth the preview reliability cost.

## Verification gates for every promoted layer

- A documented resident or planner decision improves because the layer exists.
- Source ID, URL, cadence, retrieval time, snapshot hash, license/terms, and attribution are recorded.
- Pilot counts, invalid geometry, duplicates, nulls, and representative records are audited.
- The spatial join and stable-ID strategy survive a source refresh.
- Missing records are shown as missing coverage, not absence of a condition.
- Routing claims are narrower than display claims unless the evidence justifies more.
- Source freshness and the allowed/prohibited claims are visible in the evidence panel.
- MapLibre and fallback-map behavior agree.
- The layer is lazy-loaded and measured against payload guardrails.
- At least one route-level test proves activation, one proves non-activation, and one proves the constraint cannot weaken time, distance, destination, or mapped-step requirements.

## Source canonicalization decisions to make

Two existing documentation differences should be resolved before ingestion work:

- POPS is canonicalized to `rvih-nhyn`; `qeta-4kqg` is retained only as a historical related view.
- Sidewalk-shed permits are canonicalized to filtered DOB NOW data `rbx6-tga4`; `2jy7-cddj` is retained as the related broken saved view.

The guiding rule remains: build the data system broadly, but show only the evidence that helps the current walk.
