---
id: "006"
title: Civic data layers and amenities
phase: M1-M3
status: ready
owner: unassigned
depends_on: ["002"]
parallel_with: ["003", "004", "005"]
last_updated: 2026-08-15
---

# 006 — Civic data layers and amenities

## Outcome

Happy Path demonstrates that its shared city-layer platform can integrate several important NYC datasets beyond building shade and use them honestly for routing, waypoint selection, explanation, visualization, and later Detour analysis.

## Why this package exists

The hackathon should visibly leverage NYC public data in an insightful way. Broad integration is valuable, but each layer needs a clear user purpose, capability status, and claim boundary.

## Inputs and dependencies

- validated source registry and `LayerDefinition` contract from task 002;
- route metric contract from task 003;
- map presentation rules from task 004;
- target sources in [data-and-inference.md](../docs/data-and-inference.md).

## Deliverables

- normalized layer adapters;
- pilot snapshots and metadata;
- route, waypoint, explanation, and visualization features;
- capability status for each layer;
- coverage and validation notes;
- Detour-ready metrics where appropriate.

## Work breakdown

### Environment and public realm

- [ ] `006-A` — Validate and integrate NYC Forestry Tree Points.
- [ ] `006-B` — Validate and integrate Parks properties and selected public-space layers.
- [ ] `006-C` — Evaluate land cover or canopy only as dated calibration/context.

### Friction and cover

- [ ] `006-D` — Ingest sidewalk-shed records and define visualizable, routing, and likely-cover boundaries.
- [ ] `006-E` — Evaluate other construction or closure sources for route friction.

### Amenities

- [ ] `006-F` — Integrate DOT seating and calculate network-based rest opportunities.
- [ ] `006-G` — Integrate public restrooms with published hours, operator, accessibility fields, and operational uncertainty.
- [ ] `006-H` — Integrate drinking fountains with explicit operation uncertainty.
- [ ] `006-I` — Integrate plazas, POPS, parks, or other public places to pause where useful.
- [ ] `006-J` — Integrate transit entrances as endpoints and fallback anchors.

### Access and effort

- [ ] `006-K` — Preserve mapped-step evidence and audit route coverage.
- [ ] `006-L` — Evaluate elevation and edge-grade derivation.
- [ ] `006-M` — Ingest ramps or crossing evidence for visualization and Detour research without claiming ADA compliance.

### Contextual experiments

- [ ] `006-N` — Evaluate pedestrian counters for measured activity only near covered sensors.
- [ ] `006-O` — Evaluate events, traffic, noise, and 311 only as labeled context or research signals.

### Platform integration

- [ ] `006-P` — Define route features, Detour features, visualization, and claims for every integrated layer.
- [ ] `006-Q` — Ensure at least five official NYC datasets are inspectable in the resident demo.
- [ ] `006-R` — Ensure at least three independent layer families influence route, requirement, waypoint, or receipt.

## Acceptance criteria

- [ ] Every layer has catalog, ingest, visualization, routing, Detour, or experimental status.
- [ ] Every layer has a user need and is not included solely because data exists.
- [ ] At least five official NYC datasets are integrated and inspectable.
- [ ] At least three layer families materially affect the resident result.
- [ ] Published inventory is not presented as complete or currently operational without evidence.
- [ ] Noise, traffic, activity, and 311 proxies are never labeled as objective live conditions.
- [ ] Greenery remains distinct from shade.
- [ ] Mapped-step avoidance remains distinct from accessibility.
- [ ] Amenities use walking-network distance rather than only straight-line proximity.
- [ ] Relevant metrics can be reused by Detour without a second ingestion system.

## Out of scope

- perfect citywide coverage;
- real-time verification for every asset;
- unrestricted layer browser;
- unsafe or invented civic tasks;
- claims of neighborhood quality or safety.

## Risks and decisions

- Some datasets may add map clutter without improving a route.
- Several layers may be best used for explanation or Detour before they affect routing.
- Published operating hours and actual operational status are different evidence.

## Verification

For each layer, record source version, pilot count, coverage, sample checks, route or UI examples, claim language, and capability status. Demonstrate at least three prompts that activate different layer combinations.

## Handoff

Task 007 integrates selected layers across routing, AI, and UI. Task 009 reuses Detour-ready features.
