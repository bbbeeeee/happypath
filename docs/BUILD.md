# Happy Path — Build Plan

> Detailed work packages live in [`tasks/`](../tasks/README.md). This document defines the delivery sequence, shared contracts, and quality gates without prescribing a particular engineering workflow.

## 1. Current phase

The branch contains a working Lower Manhattan preview. The resident route engine, Trip Brief, map, route receipt, time- and distance-shaped journeys, evidence layers, refinement, fixed-route City what-if, deterministic fallbacks, tests, and deployable artifact already exist.

The current phase is **cohesion and proof completion**:

1. reconcile product claims, layer capability, and implementation status;
2. make three or four visible route queries fully truthful end to end;
3. simplify the resident experience around one obvious request-to-route loop;
4. make the route receipt answer what the extra time bought;
5. connect one resident burden directly to a representative-journey Detour analysis;
6. compare the same cohort before and after one intervention;
7. freeze and rehearse one cohesive resident-to-planner demo.

Battery-to-59th-Street coverage, a general planning workspace, agency integration, and additional data breadth remain targets rather than current behavior. Implementation truth lives in [P1 implementation status](P1_IMPLEMENTATION_STATUS.md); product and demo findings live in [Product and demo audit](PRODUCT_DEMO_AUDIT.md).

## 2. Delivery goal

Build a P1 demonstration that feels like a real, polished consumer product inside its supported Manhattan area.

The visible product should be simple:

> **One friendly request → an easy-to-check Trip Brief → one considered walk → clear reasons → natural refinement.**

The underlying system should be broad enough to combine many NYC data layers and reuse the same features for Detour.

### P1 resident target

- Manhattan from the Battery through Midtown, approximately south of Central Park;
- destination, loop, and wander journey shapes;
- conversational Trip Brief and one refinement;
- time-aware shade plus several additional civic-data layers;
- at least three validated layer families affecting the result;
- at least five official NYC datasets integrated and inspectable;
- friendly, polished mobile UI and copy;
- route claims grounded primarily in actual City and open data.

### P1 planning target

- one question-led Detour analysis reached from a resident route burden;
- an inspectable representative-journey cohort and weights;
- one repeated route burden that is not merely asset density;
- one hypothetical intervention and one intuitive comparison;
- before-and-after rerouting of the same cohort;
- changed, unchanged, and remaining burden;
- clear assumptions and uncertainty.

## 3. Delivery principles

### 3.1 Real underneath, magical on top

The product may preprocess, cache, simplify, and curate data aggressively. Resident-facing route facts and numerical benefits should come from real source data and deterministic calculations.

### 3.2 Curate for quality

A bounded supported area and rehearsed demo journeys are acceptable. The product should not expose locations, prompts, or layers that have not reached a credible quality bar.

### 3.3 Clean data is a product feature

Data preparation includes:

- deduplication;
- geometry cleanup;
- sensible labeling;
- compact payloads;
- source and date metadata;
- coverage and confidence;
- resident-friendly display fields.

### 3.4 Keep technical language backstage

Internal contracts can be precise and technical. Resident UI and demo language should be friendly, concise, and product-forward.

### 3.5 Detour reuses the resident system

Do not build a separate planning ingestion stack. Detour should reuse the graph, layer registry, route features, evidence, and validation system.

## 4. Work-package dependency graph

```text
001 Product and documentation alignment
        │
        ├─────────────┬─────────────┬─────────────┐
        ↓             ↓             ↓             ↓
002 Data platform  003 Routing   004 Product UX  005 AI and copy
        │             │             │             │
        └──────┬──────┴──────┬──────┴─────────────┘
               ↓             ↓
       006 Civic layers   shared fixtures
               └──────┬──────┘
                      ↓
             007 Integration and polish
                      ↓
             008 Demo and deployment
                      ↘
                       009 Detour proof

010 Civic Assets & Actions follows the core product and Detour.
```

Tasks 002–006 can proceed substantially in parallel after the docs and shared contracts are accepted.

## 5. Milestones

### M0 — Approve the plan

Exit conditions:

- PRD, UX, data/inference, Detour, build, and task docs approved;
- Manhattan supported area accepted;
- P1 scope understood;
- future builders have clear product outcomes and quality bars without being locked into an existing prototype or workflow.

Primary task: [001](../tasks/001-product-and-prototype-alignment.md)

### M1 — Grounded Manhattan model

Exit conditions:

- supported-area boundary and preprocessing partitions defined;
- source registry has capability status for target layers;
- pedestrian graph, buildings, and shade pass core validation;
- priority amenity and friction layers are ingested or explicitly rejected;
- real data is transformed into compact product-ready fixtures;
- every feature retains source, date, coverage, method, and confidence.

Primary tasks: [002](../tasks/002-data-platform-and-pilot-audit.md), [006](../tasks/006-civic-data-layers-and-amenities.md)

### M2 — Evidence-backed journey engine

Exit conditions:

- destination routes work across the supported area;
- loop and wander produce credible journeys for the demo set;
- explicit time budgets are enforced;
- route alternatives are distinct and plausible;
- at least three validated data families affect route, requirement, waypoint, or receipt;
- continuity and amenity metrics exist;
- route results expose stable evidence contracts.

Primary task: [003](../tasks/003-routing-and-route-metrics.md)

### M3 — Magical resident experience

Exit conditions:

- compose, interpret, loading, result, inspect, compare, and refine states exist;
- destination, loop, and wander share one interaction model;
- UI copy follows [UX.md](UX.md);
- the base map remains visually complete across the supported area even when a particular evidence layer has partial coverage;
- overlays add information without hiding ordinary streets or making uncovered areas feel missing;
- City data used is understandable and inspectable;
- route changes feel immediate and intentional;
- technical jargon and debug output are absent from resident screens.

Primary tasks: [004](../tasks/004-core-ux-and-map-presentation.md), [005](../tasks/005-ai-trip-brief-and-explanations.md)

### M4 — Integrated P1 proof

Exit conditions:

- real data and resident UI are integrated end to end;
- supported journeys are reviewed and polished;
- mobile load, map rendering, and refinement meet explicit performance budgets;
- loading and failure behavior is graceful;
- one resident hero and one planner continuation are rehearsed end to end, with supporting scenarios kept secondary;
- one Detour scenario works from the same feature registry;
- the product feels coherent from a clean browser session.

Primary tasks: [007](../tasks/007-integration-quality-and-performance.md), [008](../tasks/008-demo-deployment-and-submission.md), [009](../tasks/009-detour-planning-extension.md)

## 6. Shared contracts

Parallel work meets through these stable interfaces.

### `LayerDefinition`

Source, capability status, product fields, route features, Detour features, visualization, freshness, confidence, and claim boundaries.

### `TripBrief`

Journey shape, origin, destination or end condition, time budget, supported preferences, hard requirements, waypoint needs, and unsupported criteria.

### `RouteCandidate`

Immutable geometry reference, travel metrics, hard-constraint status, feature metrics, evidence coverage, and confidence.

### `RouteReceipt`

Human benefits, costs, compromises, source-linked claims, and uncertainty.

### `MapPresentation`

Registered layers, emphasized segments, required assets, warnings, and callouts. It expresses semantic priority, not pixel placement.

### `DetourScenario`

Geography, representative journeys, planning lens, intervention, baseline burden, scenario burden, evidence, and assumptions.

These are interface contracts, not stack requirements. They may be implemented in whatever form the future team considers appropriate, provided parallel components can exchange equivalent information reliably.

## 7. Quality gates

### Data gate

A source can be shown before it is routing-ready, but it cannot affect route selection until its coverage and claim boundaries are accepted.

### Route gate

Every recommended route must be a valid returned candidate inside its time and hard constraints.

### Claim gate

Every resident-facing numerical or factual claim must map to route output, source evidence, or explicit user preference.

### Product-language gate

Primary screens must not expose raw dataset fields, source IDs, internal schema names, debug logs, or engineering language. Technical details remain available in deeper evidence views.

### Visual gate

A new data layer cannot add clutter merely because it exists. It appears only when it helps answer the current request or explain the route.

The base map must remain complete and legible independent of optional layer coverage. Missing evidence should be communicated locally or in details—not by blanking, heavily dimming, or visually erasing streets where a layer has no data.

### Demo gate

Resident claims use real source data and deterministic outputs. Hypothetical planning scenarios are clearly labeled. Prepared demo journeys are allowed; fabricated route benefits are not.

### Performance gate

The app should load only the geography, time slices, and layers needed for the current interaction. Large graph, shadow, and asset payloads must be partitioned, compressed, cached, or loaded on demand.

## 8. Implementation freedom

The documentation deliberately does not prescribe:

- a repository branching strategy;
- a specific frontend or backend framework;
- a specific database or hosting provider;
- whether route computation runs client-side or server-side;
- whether existing prototype code is reused;
- a particular issue or pull-request structure.

Builders should choose implementation details based on delivery speed, product quality, reproducibility, performance, and the evidence requirements above.

## 9. Demo realism strategy

### Acceptable

- supporting only Manhattan below Central Park;
- choosing strong demo origins and destinations;
- preprocessing City data;
- precomputing shadows or other expensive features;
- caching expensive interpretation for rehearsed requests while retaining a usable fallback;
- hiding unsupported prompts;
- showing one scripted hypothetical Detour intervention.

### Not acceptable

- hard-coded route benefits not produced by the engine;
- fake live amenity, crowd, weather, or construction status;
- hypothetical City changes presented as implemented;
- unsupported destinations silently snapping to a prepared demo;
- technical failures disguised as confidence.

## 10. Definition of done

A work package is done only when:

1. its deliverable exists in the agreed location;
2. acceptance criteria are checked;
3. test or review evidence is recorded;
4. data and product-language boundaries are documented;
5. downstream fixtures or interfaces are available;
6. known limitations and follow-up work are explicit;
7. the task board status is updated in the same change.

## 11. Scope discipline

When time is constrained, preserve in this order:

1. a coherent, friendly resident experience;
2. credible pedestrian routes;
3. validated City-data benefits and honest uncertainty;
4. fast, clean, visually complete map presentation;
5. destination, loop, and wander demo coverage;
6. natural-language refinement;
7. broad additional layers;
8. one Detour proof;
9. later live data and civic contribution features.
