---
id: "003"
title: Journey generation and route metrics
phase: M2
status: ready
owner: unassigned
depends_on: ["001", "002-fixtures"]
parallel_with: ["004", "005", "006"]
last_updated: 2026-08-15
---

# 003 — Journey generation and route metrics

## Outcome

The system generates credible destination routes, time-boxed loops, and directional wanders inside explicit time budgets. It calculates evidence-backed metrics, enforces hard requirements, and returns stable route and journey candidates for the product experience and Detour.

## Why this package exists

The route must feel thoughtfully composed rather than arbitrarily different. Happy Path needs plausible alternatives, good continuity, useful endpoints, honest amenity handling, and metrics that explain why a journey fits.

## Inputs and dependencies

- approved PRD and UX;
- Manhattan graph and feature fixtures from task 002;
- useful routing code from existing prototypes, evaluated file by file;
- `LayerDefinition`, `TripBrief`, `RouteCandidate`, and evidence contracts.

## Deliverables

- credible fastest or direct baseline;
- explicit minute and walking-time budgets;
- destination, loop, and wander candidate generation;
- geographically distinct alternatives and deduplication;
- shade, greenery, step, amenity, grade, and selected friction metrics;
- continuity metrics;
- endpoint and waypoint constraints;
- best-extra-minute frontier;
- hard-requirement validator;
- deterministic baseline ranking;
- route and metric tests;
- realistic fixtures for UI and AI.

## Work breakdown

### Shared routing foundation

- [ ] `003-A` — Select or implement the pedestrian path algorithm and document tradeoffs.
- [ ] `003-B` — Support fastest, +5, and +10 minute destination budgets with an internal sanity ceiling.
- [ ] `003-C` — Generate geographically distinct candidates rather than near-duplicate weighted paths.
- [ ] `003-D` — Reject disconnected, restricted, looping, dominated, or implausible candidates.
- [ ] `003-E` — Return route geometry, named streets, turns or segments, source coverage, and confidence.

### Destination

- [ ] `003-F` — Produce a valid direct baseline and best-fit alternative.
- [ ] `003-G` — Calculate the benefit frontier and identify diminishing returns.

### Loop

- [ ] `003-H` — Generate practical loops for 15-, 20-, 25-, and 30-minute budgets.
- [ ] `003-I` — Avoid trivial retracing, awkward tails, excessive overlap, and implausible turn patterns.
- [ ] `003-J` — Ensure loop length, shape, and experience metrics remain inside tolerance.

### Wander

- [ ] `003-K` — Support a direction, destination area, endpoint type, or time budget.
- [ ] `003-L` — Generate candidate endpoints from transit, parks, public spaces, and other supported anchors.
- [ ] `003-M` — Select endpoint and path together without becoming an open-ended itinerary engine.

### Metrics and constraints

- [ ] `003-N` — Calculate direct-sun minutes, shade share, and longest exposed stretch.
- [ ] `003-O` — Calculate greenery without conflating trees with current shade.
- [ ] `003-P` — Enforce mapped-step exclusion when explicitly required.
- [ ] `003-Q` — Calculate rest continuity, amenity detours, and route-compatible waypoint options.
- [ ] `003-R` — Add grade and construction-friction metrics only after source validation.
- [ ] `003-S` — Ensure missing evidence never improves a score.
- [ ] `003-T` — Define deterministic ranking and the narrow boundary for AI tie-breaking.
- [ ] `003-U` — Benchmark destination, loop, and wander computation and define latency budgets.

## Acceptance criteria

- [ ] Every recommendation is a returned valid candidate ID.
- [ ] No journey exceeds the stated walking or detour budget beyond documented tolerance.
- [ ] Hard requirements are never silently weakened.
- [ ] Destination, loop, and wander each pass several manually reviewed examples.
- [ ] Candidate alternatives are materially distinct when the graph permits.
- [ ] Loop routes feel intentional and do not simply retrace the same blocks.
- [ ] Wander endpoints satisfy the stated direction or end condition.
- [ ] Route metrics reproduce from edge and asset evidence.
- [ ] Continuity metrics catch long exposed or amenity-free stretches.
- [ ] Missing evidence is neutral or penalized, never treated as favorable.
- [ ] The best-extra-minute output identifies diminishing returns where present.
- [ ] Computation meets the agreed interaction budget inside the supported area.

## Out of scope

- full turn-by-turn navigation;
- unrestricted multi-stop itinerary generation;
- citywide routing;
- guaranteed accessibility;
- LLM-generated geometry;
- subjective endpoint selection without explicit evidence.

## Risks and decisions

- Loop and wander introduce more quality failure modes than destination routing and require curated review.
- K-shortest paths may remain too similar without explicit diversity penalties.
- Amenity requirements may require waypoint-constrained search rather than simple edge weights.
- The best demo route is not automatically the highest scalar score; coherent route experience matters.

## Verification

Run automated tests, inspect geometries on the map, compare metrics with source evidence, and maintain a review set covering Lower and Midtown destination routes, loops, and wanders.

## Handoff

Tasks 004, 005, 007, and 009 consume the journey contracts, metrics, and fixtures.