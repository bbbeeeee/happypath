---
id: "012"
title: Civic Data Checks
phase: M1
status: done
depends_on: ["006", "010", "011"]
parallel_with: []
last_updated: 2026-08-16
---

# 012 — Civic Data Checks

## Outcome

Residents can ask for a walk that passes a small, safe city-data check, or notice one near an ordinary route. The map and City what-if mode can show these checks as a distinct, extensible layer without confusing a suggested observation with an official condition or a City work order.

## Product contract

- Checks are explicitly authored in a bounded demo registry; the agent never invents one from missing or stale data.
- Participation is optional and never required to receive a useful route.
- Allowed demo actions are verify, observe, or take a purpose-limited photo. Repair, hazard response, traffic intervention, and unsanctioned stewardship are prohibited.
- A selected photo is not uploaded or retained in this proof of concept.
- The map layer declares its routing, visualization, and planner capabilities in one catalog so a future dataset has a clear integration seam.

## Work breakdown

- [x] `012-A` — Add typed task, observation, and map-layer contracts with validated demo records.
- [x] `012-B` — Recognize civic-help intent in fallback and OpenRouter Trip Brief interpretation.
- [x] `012-C` — Route a wander toward eligible checks while preserving requested duration semantics.
- [x] `012-D` — Add resident and City what-if map presentation, selection, and completion states.
- [x] `012-E` — Add a no-upload photo path, privacy copy, evidence boundaries, and linked source context.
- [x] `012-F` — Test schema safety, routing relevance, prompt handling, layer extensibility, and UI behavior.
- [x] `012-G` — Run full tests, production build, and browser QA; record results.

## Acceptance criteria

- [x] “Help verify city data” produces a feasible time-aware walk near a published check.
- [x] Ordinary routes can surface one nearby check without changing the route.
- [x] Official inventory, suggested check, and session-only observation remain distinct.
- [x] Every check includes publisher, purpose, expiry, safety guidance, and underlying source links.
- [x] A photo is optional, remains local, and includes guidance to avoid faces, plates, and private information.
- [x] City what-if includes a readable check layer that makes verification gaps visible without neighborhood scoring.
- [x] New map data layers can declare their icon, visibility, source, routing, and planning behavior in one typed registry.

## Out of scope

- Persistence, identity, rewards, moderation, or submission to a City system.
- Open task publishing, repair work, hazard response, or replacing 311.
- Claims that a demo observation is official or current production evidence.

## Verification

- `npm test` — 26 files and 163 tests pass.
- `npm run build` — TypeScript and the production Vite build pass.
- Fresh-browser resident QA — the “Help” example creates a 25-minute wander with one published University Place verification check; the task sheet and source receipt open correctly.
- Fresh-browser planning QA — City what-if → Data checks shows five published demo checks, contribution boundaries, and no neighborhood score.
- Fresh-browser console — no warnings or errors beyond Vite connection and React development messages.
- Regression found and fixed — MapLibre start, destination, and waypoint markers now receive coordinates before being added to the map.
