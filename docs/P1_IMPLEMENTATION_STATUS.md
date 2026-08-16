# P1 MVP implementation status

Updated: 2026-08-16

This document records what the `codex/happy-path-p1-mvp` implementation proves today. It is evidence, not a replacement for the PRD or acceptance criteria.

## Working now

- One map-first responsive experience for destination, loop, and wander journeys.
- A visible, editable Trip Brief before routing and a compact route receipt afterward.
- Deterministic candidate generation, detour limits, time budgets, mapped-step exclusion, route selection, and refinement.
- One dominant route with an optional fastest-route comparison.
- Time-aware building-shadow estimates, tree and park greenery, and honest provenance language.
- Official supported-area inventories for 286 seating records, 99 restroom records, 299 drinking-fountain records, and 602 MTA subway entrances. Current operation is deliberately treated as unknown.
- One polygon-clipped Manhattan supported area from the Battery through 60th Street, with graph, greenery, shade, civic, and cover snapshots generated against the same boundary.
- Transit-aware wander endpoints snapped to the pedestrian graph.
- Optional server-only OpenRouter request interpretation with strict structured output and deterministic fallback.
- Custom target durations that materially change loop and wander geometry, plus direct endpoint dragging and route steering when the interactive map is available.
- Distance-aware walk and run requests from 0.25 to 5 miles. Running changes framing and the distance target; the displayed duration remains a pedestrian-graph estimate rather than a claimed running pace.
- A rain-intent preference that uses only explicit OpenStreetMap covered-way and building-passage geometry. Current shed permits, 91 POPS arcade listings, and dated construction closures appear as context without creating covered route meters.
- An opt-in NYC DEP 2050 stormwater-model layer with two patterned categories and measured route overlap. It is planning context only and cannot change or certify a route.
- A resident-readable City what-if mode that compares shade changes across held-still routes and uses OpenRouter to rank only bounded, precomputed intervention candidates and evidence IDs.
- Linked official-source views for data used by the walk and high-value next evidence, including pedestrian ramps, pedestrian plazas, POPS, cooling options, and sidewalk-shed permit candidates.
- Nine optional, published civic-data checks—including four tied to exact cover records—that can influence an explicitly helpful wander, remain separate from official inventory, and accept only session-local demo observations.
- A portable, dependency-free runtime archive and single-VM Node server with health checks, caching, gzip, bounded API traffic, and graceful shutdown.
- Graceful behavior when the model service or basemap is unavailable.

## Verification evidence

- The 2026-08-16 expanded-area snapshot passes `npm test` with 41 test files and 256 tests.
- `npm run deploy:check` passes against the same snapshot, including TypeScript, the production Vite build, enforced bundle budgets, static-server health, and page smoke checks.
- The generated pedestrian graph contains 38,932 nodes and 60,501 directed edges; 99.1% of graph nodes are in its largest connected component. Every stored node is checked against the supported-area polygon.
- Greenery and shade evidence cover all 60,501 edges. The greenery run includes 43,462 tree points and 190 park-property records; 64.3% of graph edges have positive nearby greenery evidence. Shade uses 20,989 clipped building footprints across 13 hourly snapshots.
- The build starts from a small bootstrap graph and loads six graph/greenery/shade partitions on demand. Detailed hourly shadows are emitted as 468 lazy JSON tiles across 36 spatial tiles rather than entering initial JavaScript.
- The build-time budget checker measures initial JavaScript at 762.69 KiB gzip and the largest hourly shade tile at 281.83 KiB gzip, and fails builds above 850 KiB or 310 KiB respectively.
- Clean browser runs rendered the full MapLibre basemap, the Battery-to-60th data coverage, and representative destination and northbound transit-ending journeys without exposing graph IDs in resident-facing labels.
- Deterministic route scorecard retains target-duration, distance, detour, and mapped-step constraints. Sparse cover evidence is reported as mapped geometry and is allowed to produce no route change rather than inventing a benefit.
- Live browser checks also cover OpenRouter interpretation and City intervention ranking, rain routing, explicit destination precedence, linked resident/planner sources, desktop, and 390 × 844 responsive layout.
- The expanded cover-context snapshot remains a separate 78.24 kB gzip chunk loaded only when its evidence is requested.
- The 90.80 KiB gzip flood snapshot is also lazy-loaded and guarded by a 100 KiB gzip budget; it never enters initial JavaScript.
- Initial CSS: about 19 KB gzip.

The current working payload guardrails are 850 KB gzip for initial JavaScript and 310 KB gzip for one hourly shade snapshot. These are preview budgets, not final production targets.

## Audit findings that remain open

- City what-if uses a transparent frozen cohort, identifies a repeated route burden, and reruns the same route policy after the intervention. It does not predict construction feasibility, behavior change, or population demand.
- Planner free text selects a supported lens or adjusts a bounded shade scenario. It is not a general query over arbitrary areas, populations, journey purposes, or citywide policies.
- Browser QA artifacts are retained for the desktop hero flows, and map/presentation behavior has focused component coverage. A production-grade browser end-to-end suite, device lab, and accessibility audit remain future work.
- External basemap styles and free-form address geocoding still depend on network services. The checked-in hero landmarks, route graph, evidence, and deterministic prompt interpretation remain available without them.

The earlier prompt-truth, representative-journey, expanded-area, direction-token, and raw-endpoint-label findings are resolved in this preview. Remaining production gaps are tracked in the [product and demo audit](PRODUCT_DEMO_AUDIT.md).

## Deliberate gaps before calling the full PRD complete

- Geography is the checked-in Manhattan supported area from the Battery through 60th Street, not yet all five boroughs.
- 408 graph edges across 313 OSM ways currently carry explicit mapped cover tags. Shed permits, POPS arcade points, and construction lines remain context because they do not prove exact installed, present, passable, or dry cover geometry.
- No complete current public awning geometry was found, so awnings are not inferred.
- Broader manual street review, device coverage, and accessibility audit remain before production use.
- External basemap fonts/styles and address geocoding still require network access; checked-in routing data does not.
- This branch is not deployed and no production environment or migration has been changed. It now produces a dependency-free runtime archive with a VM runbook, health checks, graceful shutdown, static caching, gzip, and bounded model API traffic.
- The key-backed model endpoints are suitable for a limited preview behind HTTPS and the included request limit. Add edge abuse controls, monitoring, and an explicit access policy before broad public exposure.

## Data and claim boundaries

- OpenStreetMap supplies pedestrian connectivity and mapped steps; coverage can be incomplete.
- OpenStreetMap also supplies sparse, path-aligned covered-way tags. Missing tags mean unassessed, not uncovered.
- DOB shed permits, POPS arcade classifications, and DOT construction closures are nearby records, not route-cover geometry or current-condition checks.
- DEP stormwater polygons describe one modeled moderate-rain scenario with projected 2050 sea-level rise. They do not report current flooding, forecast depth, passability, or route safety.
- NYC building footprints and roof heights feed deterministic shadow geometry; shade is an estimate.
- NYC Parks tree and park records support greenery evidence; points do not prove canopy or present shade.
- NYC DOT seating, NYC public-restroom, NYC Parks drinking-fountain, and MTA entrance inventories are official records, not live operational checks.
- The product may say a route avoids **mapped steps**. It may not call the route accessible, ADA-compliant, safe, open, or obstruction-free.
