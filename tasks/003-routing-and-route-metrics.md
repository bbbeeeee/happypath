---
id: "003"
title: Routing and route metrics
phase: M2
status: ready
owner: unassigned
depends_on: ["001", "002-fixtures"]
parallel_with: ["004", "005", "006"]
last_updated: 2026-08-15
---

# 003 — Routing and route metrics

## Outcome

The system generates credible pedestrian alternatives inside an explicit minute budget, calculates evidence-backed route metrics, enforces hard requirements, and returns stable `RouteCandidate` and `RouteReceipt` inputs.

## Why this package exists

The existing prototype proves fastest, Shade, and Greener routing but uses a fixed percentage detour ceiling and a small set of weighted shortest paths. The production demo needs clearer user-time controls, route diversity, continuity metrics, and deterministic validation.

## Inputs and dependencies

- approved product scope;
- pilot graph and feature fixtures from task 002;
- current routing implementation on `codex/happy-path-mvp`;
- `LayerDefinition`, `RouteCandidate`, and evidence contracts.

## Deliverables

- fastest-route baseline;
- minute-based detour constraints;
- geographically distinct candidate generation;
- route deduplication and plausibility checks;
- shade, greenery, mapped-step, amenity, and selected friction metrics;
- best-extra-minute frontier;
- hard-constraint validator;
- route and metric tests;
- stable route-response fixtures.

## Work breakdown

- [ ] `003-A` — Review and retain or replace the existing shortest-path implementation.
- [ ] `003-B` — Replace percentage-only detour control with fastest, +5, and +10 minute budgets; keep an internal sanity ceiling.
- [ ] `003-C` — Generate geographically distinct candidates rather than near-duplicate weighted paths.
- [ ] `003-D` — Reject disconnected, illegal, looping, dominated, or implausible candidates.
- [ ] `003-E` — Calculate direct-sun minutes, shade share, and longest exposed stretch.
- [ ] `003-F` — Calculate greenery metrics without conflating trees with current shade.
- [ ] `003-G` — Enforce mapped-step exclusion as a hard requirement when selected.
- [ ] `003-H` — Add route-compatible amenity metrics from task 006, such as maximum rest gap or restroom detour.
- [ ] `003-I` — Add construction-friction metrics only if their source passes validation.
- [ ] `003-J` — Calculate the benefit frontier across practical extra-time budgets.
- [ ] `003-K` — Define deterministic baseline ranking and the narrow boundary for AI tie-breaking.
- [ ] `003-L` — Return evidence coverage, source IDs, and confidence inputs with every metric.
- [ ] `003-M` — Benchmark warmed route computation and define a performance budget.

## Acceptance criteria

- [ ] Every recommended route is a returned valid candidate ID.
- [ ] No route exceeds the selected minute budget.
- [ ] Hard requirements are never silently weakened.
- [ ] Candidate alternatives are materially distinct when the graph permits.
- [ ] Route metrics reproduce from edge-level evidence.
- [ ] Continuity metrics detect long exposed or amenity-free stretches.
- [ ] Missing evidence does not improve a route score.
- [ ] At least ten representative origin-destination cases pass manual review.
- [ ] The best-extra-minute output identifies diminishing returns where present.
- [ ] Route computation meets the agreed pilot performance budget.

## Out of scope

- general endpoint recommendation;
- turn-by-turn navigation;
- citywide routing;
- guaranteed accessibility;
- LLM-generated geometry.

## Risks and decisions

- K-shortest paths may produce structurally similar routes without explicit diversity penalties.
- A route with a better average metric may contain a worse uninterrupted stretch; continuity must be first-class.
- Some amenity requirements may require waypoint-constrained routing rather than simple edge weights.

## Verification

Run automated route tests, inspect geometries on the map, compare metrics with edge evidence, and record the ten-route review set and timing results.

## Handoff

Tasks 004, 005, 007, and 009 consume the route contracts and fixtures.
