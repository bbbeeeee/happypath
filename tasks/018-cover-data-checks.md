---
id: "018"
title: Cover evidence data checks
phase: M1–M3
status: review
depends_on: ["012", "017"]
parallel_with: []
last_updated: 2026-08-16
---

# 018 — Cover evidence data checks

## Outcome

Residents can optionally help review one exact mapped passage, sidewalk-shed permit candidate, POPS arcade listing, or sidewalk-construction record without turning a session response into official or routable evidence.

## Plan

- [x] Generalize task targets beyond civic amenities while preserving exact source IDs.
- [x] Add four bounded, public-path-only cover checks.
- [x] Give temporary shed and construction observations short expiry windows.
- [x] Preserve session-only storage and fixed response options.
- [x] Run focused contract/routing tests, production smoke, and browser QA.
- [ ] Re-run the full shared-worktree suite after expanded-area fixture generation settles.

## Boundaries

- No task asks someone to enter a passage, work area, roadway, or private space.
- Every cover task offers “I couldn’t confirm safely.”
- Responses may flag an exact source record for steward review; they do not overwrite NYC data or OpenStreetMap.
- One observation cannot establish dryness, accessibility, public access, full geometry, structural condition, or route continuity.
- The awning option records only what someone selected in this demo session; it does not create awning geometry or route cover.

## Review

- Added four bounded cover checks, bringing the bundled demo registry to nine checks: one mapped passage, one sidewalk-shed/awning observation, one POPS arcade entrance observation, and one signed construction-detour observation.
- Each check targets an exact source record or stable OpenStreetMap way ID, offers a safe skip, expires, and stores only a session observation that cannot mutate NYC or OpenStreetMap data.
- Focused verification passes: `npm test -- src/data/civicTasks.test.ts src/planning/civicTaskRouting.test.ts src/mapPresentation.test.ts src/coverEvidence.test.ts src/data/data.test.ts src/data/sourceRegistry.test.ts --reporter=dot --maxWorkers=1` (6 files, 40 tests).
- `npm run deploy:check` passes the production build and smoke check. Browser QA confirms a 25-minute data-observation walk can surface the University Place cover check, accept the awning/canopy response, and label it session-only and not sent to NYC.
- The full suite was attempted while another workstream was regenerating the expanded graph and shade fixtures; unrelated expanded-area tests and transient files changed during that run. Leave this slice in review until that shared integration gate is green.
