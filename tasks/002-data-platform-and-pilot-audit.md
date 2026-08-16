---
id: "002"
title: Data platform and pilot audit
phase: M1
status: ready
owner: unassigned
depends_on: ["001"]
parallel_with: ["003", "004", "005"]
last_updated: 2026-08-15
---

# 002 — Data platform and pilot audit

## Outcome

Happy Path has a validated, versioned Lower Manhattan city-data foundation with a shared layer contract, known coverage, claim boundaries, and lightweight fixtures that routing, AI, UI, and Detour can consume.

## Why this package exists

The product depends on integrating many City datasets without overstating what they prove. Source discovery is substantially complete, but pilot-level coverage, freshness, geometry, licensing, and field validation remain incomplete.

## Inputs and dependencies

- [Data and inference specification](../docs/data-and-inference.md)
- [PRD data capability target](../docs/PRD.md#8-city-data-capability-target)
- current ingestion scripts and pilot audit on `codex/happy-path-mvp`
- approved pilot boundary from task 001

## Deliverables

- canonical `LayerDefinition` schema;
- source registry with capability status for every target layer;
- reproducible pilot snapshots and transformation metadata;
- graph, buildings, and shade audit;
- lightweight fixtures for parallel frontend and AI work;
- data attribution and license requirements;
- validation report with pass, fail, or experimental decisions.

## Work breakdown

- [ ] `002-A` — Freeze or revise the pilot boundary and record the decision.
- [ ] `002-B` — Define the `LayerDefinition` and evidence-record schemas.
- [ ] `002-C` — Inventory every target source as cataloged, ingested, visualizable, routing-ready, Detour-ready, or experimental.
- [ ] `002-D` — Reproduce the OpenStreetMap graph snapshot and audit connectivity, exclusions, crossings, steps, and attribution.
- [ ] `002-E` — Reproduce NYC building ingestion and audit nulls, heights, geometry, units, and anomalies.
- [ ] `002-F` — Validate solar position and shadow derivation against an accepted implementation.
- [ ] `002-G` — Review at least twenty blocks at morning, noon, and afternoon.
- [ ] `002-H` — Measure route-edge coverage and define minimum thresholds for each claim.
- [ ] `002-I` — Record source retrieval time, source update time, snapshot hash, method version, and terms.
- [ ] `002-J` — Produce compact route and layer fixtures for tasks 003–005.
- [ ] `002-K` — Define fallback behavior when a source or feature is unavailable.

## Acceptance criteria

- [ ] The largest routable component and known graph gaps are documented.
- [ ] Building-height and shadow coverage meet an explicit threshold or the hero claim is narrowed.
- [ ] Every integrated source has allowed and prohibited claims.
- [ ] Missing data cannot be interpreted as absence of a condition.
- [ ] At least ten route samples and twenty block or asset samples are reviewed.
- [ ] The data pipeline is reproducible from documented commands.
- [ ] Fixture files are small enough for parallel development and do not expose unnecessary raw data.
- [ ] OpenStreetMap and City-source attribution requirements are documented.

## Out of scope

- full citywide ingestion;
- production streaming infrastructure;
- live operational verification;
- route-ranking policy;
- map interaction design.

## Risks and decisions

- Current committed shadow files may be too large for a mobile prototype.
- Sidewalk polygons may not support connected side-of-street routing in the available time.
- Several sources are inventories, not guarantees of current operation.

## Verification

Record ingestion commands, source versions, coverage statistics, sampled locations, screenshots or field notes, and validation status in the data specification or a linked pilot-audit artifact.

## Handoff

Tasks 003 and 006 consume routing-ready features. Tasks 004 and 005 consume compact fixtures and claim metadata.
