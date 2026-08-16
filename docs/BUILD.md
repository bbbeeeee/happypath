# Happy Path — Build Plan

> The detailed work packages live in [`tasks/`](../tasks/README.md). This document defines milestones, dependencies, and integration gates without duplicating live task status.

## 1. Delivery strategy

Build one coherent resident vertical slice first, while designing the data contracts broadly enough to support additional city layers and Detour.

The implementation should proceed through five milestones:

1. **Align** — approve product scope and select reusable prototype assets.
2. **Ground** — validate the pilot graph, source registry, and core city layers.
3. **Route** — compute evidence-backed alternatives and route metrics.
4. **Experience** — add the Trip Brief, map UX, receipt, and refinement.
5. **Prove** — validate, deploy, present several data-rich demos, then add one Detour scenario.

## 2. Work-package dependency graph

```text
001 Product and prototype alignment
        │
        ├─────────────┬─────────────┬─────────────┐
        ↓             ↓             ↓             ↓
002 Data platform  003 Routing   004 Core UX   005 AI contracts
        │             │             │             │
        └──────┬──────┴──────┬──────┴─────────────┘
               ↓             ↓
       006 Civic layers   shared fixtures
               └──────┬──────┘
                      ↓
             007 Integration and QA
                      ↓
             008 Demo and deployment

009 Detour begins after route metrics and selected civic layers are stable.
010 Civic Assets & Actions remains a later extension.
```

Tasks 002–006 are designed to proceed substantially in parallel after the product contract is approved. They meet through explicit data, route, Trip Brief, receipt, and map-presentation schemas.

## 3. Milestones

### M0 — Product alignment

Exit conditions:

- consolidated PRD approved;
- Lower Manhattan retained or replaced through an explicit decision;
- `codex/happy-path-mvp` disposition recorded;
- `bryan` visual prototype disposition recorded;
- P0 and deferred scope understood;
- task owners can work without inventing product requirements.

Primary task: [001](../tasks/001-product-and-prototype-alignment.md)

### M1 — Grounded city model

Exit conditions:

- source registry has capability status for target layers;
- pilot graph and building-height data pass coverage checks;
- shade model is visually and numerically reviewed;
- core amenity and friction layers are ingested or explicitly rejected;
- every feature record retains source, date, method, coverage, and confidence;
- fixture datasets are available to frontend and AI work.

Primary tasks: [002](../tasks/002-data-platform-and-pilot-audit.md), [006](../tasks/006-civic-data-layers-and-amenities.md)

### M2 — Evidence-backed routing

Exit conditions:

- fastest route is credible for the pilot;
- minute-based detour limits replace percentage-only controls;
- distinct route alternatives are generated and deduplicated;
- at least three layer families influence route, requirement, waypoint, or receipt;
- best-extra-minute frontier is available;
- hard constraints are validated;
- route results expose stable evidence contracts.

Primary task: [003](../tasks/003-routing-and-route-metrics.md)

### M3 — Resident experience

Exit conditions:

- mobile compose, interpret, result, inspect, and refine states exist;
- natural-language input and deterministic quick controls edit one Trip Brief;
- route receipt and City data used drawer are evidence-linked;
- AI failure falls back safely;
- data layers are selected contextually rather than through a large layer panel;
- loading, unsupported, partial-coverage, and no-route states are complete.

Primary tasks: [004](../tasks/004-core-ux-and-map-presentation.md), [005](../tasks/005-ai-trip-brief-and-explanations.md)

### M4 — Integrated proof

Exit conditions:

- ten route pairs and twenty sampled blocks or assets reviewed;
- three demo scenarios use meaningfully different city-data combinations;
- mobile payload and warmed interaction meet the agreed budget;
- production deployment is stable;
- hackathon narrative clearly connects resident utility, city data, and Detour;
- one prepared Detour scenario is available if it does not endanger the resident demo.

Primary tasks: [007](../tasks/007-integration-quality-and-performance.md), [008](../tasks/008-demo-deployment-and-submission.md), optionally [009](../tasks/009-detour-planning-extension.md)

## 4. Shared contracts

Parallel work should meet through these stable interfaces:

### LayerDefinition

Describes source, capability status, route features, Detour features, visualization, freshness, and claim boundaries.

### TripBrief

Describes origin, destination, time, detour allowance, supported preferences, hard requirements, waypoint needs, and unsupported criteria.

### RouteCandidate

Contains immutable geometry reference, travel metrics, hard-constraint status, layer metrics, evidence coverage, and confidence.

### RouteReceipt

Contains benefits, costs, compromises, evidence-linked claims, source IDs, and confidence.

### MapPresentation

Contains allowed ambient layers, route-segment emphasis, required icons, warnings, callouts, and explanation-only evidence. It expresses semantic priority, not pixel placement.

### DetourScenario

Contains geography, representative trips, planning lens, intervention, baseline burden, scenario burden, evidence, and assumptions.

## 5. Integration gates

### Data gate

A source cannot affect routing until it passes the validation gate in [data-and-inference.md](data-and-inference.md).

### Claim gate

Every displayed numerical or qualitative claim must map to a deterministic metric or explicit personal-preference record.

### UX gate

A new layer cannot add a default control or icon merely because it exists. It must support a user need, route reason, warning, or planning analysis.

### Scope gate

Loop, Wander, persistent personalization, custom icons, contribution, and broad Detour tooling cannot delay the fixed-destination resident proof.

### Demo gate

A prepared scenario must use real route and source outputs. Mocked operational states or intervention effects must be labeled and must not be presented as City findings.

## 6. Current implementation assets

See [PROTOTYPES.md](PROTOTYPES.md) for full disposition.

The current recommended implementation base is `codex/happy-path-mvp` because it already contains:

- a cropped Lower Manhattan pedestrian graph;
- NYC building, tree, and park ingestion;
- time-specific shadow data;
- Shade and Greener routing;
- mapped-step exclusion;
- MapLibre UI and route receipt;
- tests and a pilot audit.

This is an asset, not an automatic final architecture. Reuse should follow the approved contracts and validation requirements.

## 7. Definition of done

A work package is done only when:

1. its deliverable exists in the agreed location;
2. acceptance criteria are checked;
3. tests or review evidence are recorded;
4. documentation and source/claim boundaries are updated;
5. downstream fixtures or interfaces are available;
6. known limitations and follow-up work are explicit;
7. the task board status is updated in the same change.

## 8. Scope discipline

When time is constrained, preserve in this order:

1. credible pedestrian routing;
2. validated time-aware shade;
3. evidence and confidence;
4. Trip Brief and Route Receipt;
5. several meaningful city-data layers;
6. refinement and map inspection;
7. additional resident modes;
8. Detour scenario;
9. custom visuals and later extensions.
