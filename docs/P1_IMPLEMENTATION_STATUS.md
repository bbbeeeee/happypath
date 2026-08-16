# P1 MVP implementation status

Updated: 2026-08-15

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
- One guided Detour proof modeling shade on a selected exposed route block. The UI labels it hypothetical and explicitly excludes design, approval, cost, construction, maintenance, and City-wide prioritization claims.
- Graceful behavior when the model service or basemap is unavailable.

## Verification evidence

- `npm test`: 13 test files, 60 tests passing.
- `npm run build`: TypeScript and Vite production build passing.
- Generated graph: 4,487 directed edges; 10,671 stored polyline points; curved OSM way geometry retained.
- Initial JavaScript bundle: about 808 KB gzip.
- One lazily loaded hourly shade snapshot: about 293–296 KB gzip. Only the selected departure hour is requested.
- Initial CSS: about 15 KB gzip.

The current working payload guardrails are 850 KB gzip for initial JavaScript and 310 KB gzip for one hourly shade snapshot. These are preview budgets, not final production targets.

## Deliberate gaps before calling the full PRD complete

- Geography is the checked-in Lower Manhattan pilot bounding box (`40.726,-74.006,40.736,-73.988`), not yet Battery through 59th Street.
- Construction and sidewalk-shed routing evidence is not exposed because the available pilot evidence has not passed validation. Requests are shown as unsupported instead of silently scored.
- The required manual street review, representative-journey audit, broader device matrix, and accessibility audit remain to be completed and recorded.
- External basemap fonts/styles and address geocoding still require network access; checked-in routing data does not.
- This branch is not deployed and no production environment or migration has been changed.

## Data and claim boundaries

- OpenStreetMap supplies pedestrian connectivity and mapped steps; coverage can be incomplete.
- NYC building footprints and roof heights feed deterministic shadow geometry; shade is an estimate.
- NYC Parks tree and park records support greenery evidence; points do not prove canopy or present shade.
- NYC DOT seating, NYC public-restroom, NYC Parks drinking-fountain, and MTA entrance inventories are official records, not live operational checks.
- The product may say a route avoids **mapped steps**. It may not call the route accessible, ADA-compliant, safe, open, or obstruction-free.
