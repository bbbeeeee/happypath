---
id: "002"
title: Manhattan data platform and audit
phase: M1
status: ready
owner: unassigned
depends_on: ["001"]
parallel_with: ["003", "004", "005"]
last_updated: 2026-08-15
---

# 002 — Manhattan data platform and audit

## Outcome

Happy Path has a reproducible, product-ready city-data foundation covering Manhattan from the Battery through Midtown, approximately south of Central Park. Routing, AI, UI, and Detour can consume compact, versioned layers with known coverage, freshness, claim boundaries, and confidence.

## Why this package exists

The value of Happy Path depends on turning fragmented City data into information that feels coherent and trustworthy. Raw datasets are not a product. They must be cleaned, joined, simplified, labeled, validated, and delivered at a speed and scale appropriate for a polished mobile demo.

## Inputs and dependencies

- [Data and inference specification](../docs/data-and-inference.md)
- [PRD city-data target](../docs/PRD.md#8-city-data-capability-target)
- useful ingestion and audit work from existing prototype branches, evaluated file by file
- accepted Manhattan geography from task 001

## Deliverables

- canonical `LayerDefinition` and evidence-record schemas;
- source registry with capability status for every target layer;
- reproducible Manhattan snapshots, partitions, and transformation metadata;
- pedestrian graph, buildings, and shade audit;
- compact realistic fixtures for UI, AI, and routing work;
- product-ready labels and display fields;
- data attribution and license requirements;
- validation report with pass, fail, experimental, or display-only decisions;
- payload, caching, and partitioning strategy.

## Work breakdown

- [ ] `002-A` — Define the Battery-to-59th-Street supported-area boundary and practical data partitions.
- [ ] `002-B` — Finalize `LayerDefinition`, evidence, freshness, and source-registry schemas.
- [ ] `002-C` — Catalog every target source as ingested, visualizable, routing-ready, Detour-ready, experimental, or rejected.
- [ ] `002-D` — Build and audit the pedestrian graph, including connectivity, access exclusions, crossings, steps, attribution, and named streets.
- [ ] `002-E` — Ingest NYC building geometry and heights; audit nulls, units, anomalies, geometry, and spatial coverage.
- [ ] `002-F` — Validate solar position and shadow derivation against an accepted implementation.
- [ ] `002-G` — Review representative blocks across Lower and Midtown Manhattan at morning, noon, and afternoon.
- [ ] `002-H` — Measure route-edge and asset coverage and define minimum thresholds for each product claim.
- [ ] `002-I` — Record source update time, retrieval time, snapshot hash, transformation version, terms, and attribution.
- [ ] `002-J` — Normalize resident-friendly names, hours, categories, and uncertainty labels.
- [ ] `002-K` — Produce small, realistic fixtures for destination, loop, wander, amenity, and Detour work.
- [ ] `002-L` — Partition, compress, cache, or tile large graph, shadow, and asset data.
- [ ] `002-M` — Define graceful fallback when a source, region, or feature is unavailable.
- [ ] `002-N` — Create a repeatable data-refresh and validation command sequence.

## Acceptance criteria

- [ ] The Manhattan supported area and data partitions are explicit.
- [ ] The largest routable component and known graph gaps are documented.
- [ ] Building-height and shadow coverage meet an explicit threshold or the claim is narrowed.
- [ ] Every integrated source has allowed and prohibited claims.
- [ ] Missing data is never interpreted as absence of a condition.
- [ ] Representative Lower and Midtown samples are visually reviewed.
- [ ] Data can be reproduced from documented commands.
- [ ] Fixtures are compact enough for parallel development.
- [ ] Production payloads do not require eagerly loading all Manhattan layers or time slices.
- [ ] Product-facing fields use clean labels rather than raw source values.
- [ ] OpenStreetMap and City-source attribution requirements are documented.

## Out of scope

- citywide ingestion;
- production streaming infrastructure;
- guaranteed live operational state for every asset;
- route-ranking policy;
- UI layout and product copy.

## Risks and decisions

- The larger geography may require partitioning that the Lower Manhattan prototype did not need.
- Sidewalk polygons may not support true side-of-street topology in the available time.
- Several sources are inventories rather than guarantees of current operation.
- Data completeness should not be pursued at the expense of demo quality or performance.

## Verification

Record ingestion commands, source versions, coverage statistics, sample locations, screenshots or field notes, payload sizes, route examples, and validation status in the data specification or linked audit artifacts.

## Handoff

Tasks 003 and 006 consume routing-ready layers. Tasks 004 and 005 consume compact fixtures, friendly labels, and claim metadata. Task 009 consumes Detour-ready metrics.