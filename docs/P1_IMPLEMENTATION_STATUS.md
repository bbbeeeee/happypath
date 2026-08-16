# P1 MVP implementation status

Updated: 2026-08-16

This document records what the `codex/happy-path-p1-mvp` implementation proves today. It is evidence, not a replacement for the PRD or acceptance criteria.

## Working now

- One map-first responsive experience for destination, loop, and wander journeys.
- A visible, editable Trip Brief before routing and a compact route receipt afterward.
- Deterministic candidate generation, detour limits, time budgets, mapped-step exclusion, route selection, and refinement.
- One dominant route with an optional fastest-route comparison.
- Time-aware building-shadow estimates, tree and park greenery, and honest provenance language.
- Official pilot inventories for 27 seating records, 4 restroom records, 28 drinking-fountain records, and 41 MTA subway entrances. Current operation is deliberately treated as unknown.
- Transit-aware wander endpoints snapped to the pedestrian graph.
- Optional server-only OpenRouter request interpretation with strict structured output and deterministic fallback.
- Custom target durations that materially change loop and wander geometry, plus direct endpoint dragging and route steering when the interactive map is available.
- A rain-intent proof that visibly favors a deterministic simulated-cover signal while clearly withholding live-weather and guaranteed-cover claims.
- A resident-readable City what-if mode that compares shade changes across held-still routes and uses OpenRouter to rank only bounded, precomputed intervention candidates and evidence IDs.
- Linked official-source views for data used by the walk and high-value next evidence, including pedestrian ramps, pedestrian plazas, POPS, cooling options, and sidewalk-shed permit candidates.
- Graceful behavior when the model service or basemap is unavailable.

## Verification evidence

- `npm test`: 23 test files, 146 tests passing.
- `npm run build`: TypeScript and Vite production build passing.
- Deterministic route scorecard: 29.14-minute transit wander for a 30-minute target; 23.62-minute loop for a custom 23-minute target; 22.69-minute rain proof with 53.0% simulated cover versus 6.6% for the ordinary comparison; zero mapped-step edges in the constrained destination scenario.
- Live browser checks: OpenRouter interpretation and City intervention ranking, rain route, explicit destination precedence, linked resident/planner sources, desktop, 390 × 844 responsive layout, and clean console after reload.
- Generated graph: 4,487 directed edges; 10,671 stored polyline points; curved OSM way geometry retained.
- Initial JavaScript bundle: about 838 KB gzip.
- One lazily loaded hourly shade snapshot: about 293–296 KB gzip. Only the selected departure hour is requested.
- Initial CSS: about 18 KB gzip.

The current working payload guardrails are 850 KB gzip for initial JavaScript and 310 KB gzip for one hourly shade snapshot. These are preview budgets, not final production targets.

## Deliberate gaps before calling the full PRD complete

- Geography is the checked-in Lower Manhattan pilot bounding box (`40.726,-74.006,40.736,-73.988`), not yet Battery through 59th Street.
- Sidewalk-shed permit records are linked as reference-only planning evidence because a permit candidate does not prove installed, present, passable, or dry cover. Rain routing therefore uses a visibly simulated proof signal.
- Broader manual street review, device coverage, and accessibility audit remain before production use.
- External basemap fonts/styles and address geocoding still require network access; checked-in routing data does not.
- This branch is not deployed and no production environment or migration has been changed.
- The key-backed model endpoints are for the local/demo server. Add deployment-layer authentication and rate limiting before exposing them publicly.

## Data and claim boundaries

- OpenStreetMap supplies pedestrian connectivity and mapped steps; coverage can be incomplete.
- NYC building footprints and roof heights feed deterministic shadow geometry; shade is an estimate.
- NYC Parks tree and park records support greenery evidence; points do not prove canopy or present shade.
- NYC DOT seating, NYC public-restroom, NYC Parks drinking-fountain, and MTA entrance inventories are official records, not live operational checks.
- The product may say a route avoids **mapped steps**. It may not call the route accessible, ADA-compliant, safe, open, or obstruction-free.
