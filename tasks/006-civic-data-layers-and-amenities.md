---
id: "006"
title: Civic data layers and amenities
phase: M1-M3
status: ready
depends_on: ["002"]
parallel_with: ["003", "004", "005"]
last_updated: 2026-08-15
---

# 006 — Civic data layers and amenities

## Outcome

Happy Path integrates a broad, coherent set of NYC public-realm data across Manhattan south of Central Park. Selected layers improve routes, waypoints, explanations, and Detour analysis while remaining fast, clean, and honest about coverage.

## Why this package exists

The hackathon should demonstrate that difficult City data can become a useful resident experience. The value is not the number of datasets alone; it is the ability to combine them around one walk without producing clutter, false precision, or technical language.

## Inputs and dependencies

- source registry and `LayerDefinition` contract from task 002;
- journey and metric contracts from task 003;
- map and product-language rules from task 004;
- target sources in [data-and-inference.md](../docs/data-and-inference.md).

## Deliverables

- normalized layer adapters;
- cleaned and partitioned Manhattan snapshots;
- resident-friendly asset labels;
- route, waypoint, explanation, and visualization features;
- capability and freshness status for each layer;
- coverage and validation notes;
- compact demo fixtures;
- Detour-ready metrics where appropriate;
- one forward-compatible pattern for live context.

## Work breakdown

### Environment and public realm

- [ ] `006-A` — Validate and integrate NYC Forestry Tree Points.
- [ ] `006-B` — Validate and integrate Parks properties.
- [ ] `006-C` — Integrate selected plazas, POPS, and other public places to pause.
- [ ] `006-D` — Evaluate land cover or canopy only as dated calibration or context.

### Friction and likely cover

- [ ] `006-E` — Ingest sidewalk-shed records and define display, routing, and Detour boundaries.
- [ ] `006-F` — Evaluate other construction, closure, or permit sources for route friction.
- [ ] `006-G` — Define careful language for likely cover without promising dryness.

### Amenities and useful endpoints

- [ ] `006-H` — Integrate DOT seating and calculate network-based rest opportunities.
- [ ] `006-I` — Integrate public restrooms with published hours, operator, amenities, and operational uncertainty.
- [ ] `006-J` — Integrate drinking fountains with explicit operational uncertainty.
- [ ] `006-K` — Integrate subway entrances as wander endpoints and fallback anchors.
- [ ] `006-L` — Evaluate public facilities as destinations and Detour demand anchors.

### Access and effort

- [ ] `006-M` — Preserve mapped-step evidence and audit its coverage.
- [ ] `006-N` — Integrate elevation and derive edge grade if validation passes.
- [ ] `006-O` — Ingest ramps and crossings for context and Detour research without claiming ADA compliance.

### Activity, events, and context

- [ ] `006-P` — Evaluate pedestrian counters only where measurement coverage exists.
- [ ] `006-Q` — Evaluate events, traffic, noise, and 311 as labeled context or research signals.
- [ ] `006-R` — Catalog cultural and historical assets for later personally relevant routing.

### Future live context

- [ ] `006-S` — Define a freshness-aware adapter for weather, alerts, or verified observations.
- [ ] `006-T` — Ensure stale live context cannot be presented as current.
- [ ] `006-U` — Keep live inputs optional so the core demo remains reliable without them.

### Product integration

- [ ] `006-V` — Define route features, Detour features, visualization, and claims for every layer.
- [ ] `006-W` — Normalize product-facing names, hours, categories, and caveats.
- [ ] `006-X` — Produce small fixtures and lazy-loadable supported-area partitions.
- [ ] `006-Y` — Make at least five official NYC datasets inspectable in the demo.
- [ ] `006-Z` — Make at least three independent layer families affect a route, requirement, waypoint, or receipt.

## Acceptance criteria

- [ ] Every layer has a clear resident or planning use.
- [ ] Every layer has catalog, ingest, visualization, routing, Detour, live-context, experimental, or rejected status.
- [ ] At least five official NYC datasets are integrated and inspectable.
- [ ] At least three layer families materially affect resident results.
- [ ] Data is cleaned and partitioned for responsive interaction.
- [ ] Published inventory is not presented as complete or currently operational without evidence.
- [ ] Noise, traffic, activity, and 311 proxies are never labeled as objective live conditions.
- [ ] Greenery remains distinct from shade.
- [ ] Mapped-step avoidance remains distinct from accessibility.
- [ ] Amenities use walking-network distance rather than only straight-line proximity.
- [ ] Resident-facing labels are understandable without source schema knowledge.
- [ ] Relevant metrics are reusable by Detour without a second ingestion system.
- [ ] At least four prompts activate meaningfully different layer combinations.

## Out of scope

- perfect citywide coverage;
- real-time verification for every asset;
- an unrestricted GIS layer browser;
- unsafe or invented civic tasks;
- neighborhood quality or safety scores.

## Risks and decisions

- Some layers may be valuable for explanation or Detour before they are useful for routing.
- A large layer count can undermine mobile performance and visual hierarchy.
- Published hours and actual operation are different evidence.
- Live sources can make a demo fragile; the product must remain useful without them.

## Verification

For every layer, record source version, supported-area count, coverage, data-cleaning steps, sample checks, route or UI examples, claim language, payload impact, and capability status. Demonstrate the four primary product flows using real source outputs.

## Handoff

Task 007 integrates selected layers across the journey engine, AI, and UI. Task 009 reuses Detour-ready features.