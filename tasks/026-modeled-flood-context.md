---
id: "026"
title: Modeled flood context
phase: M1–M3
status: review
depends_on: ["002", "004", "017"]
parallel_with: []
last_updated: 2026-08-16
---

# 026 — Modeled flood context

## Outcome

Residents and planners can inspect one official NYC DEP stormwater scenario without confusing a planning model with live flooding or route-safety evidence.

## Plan

- [x] Verify an NYC DEP-owned queryable source and preserve its service item provenance.
- [x] Ingest the moderate-rain scenario with projected 2050 sea-level rise for the supported area.
- [x] Add an off-by-default, lazy, patterned, selectable map layer with fallback rendering.
- [x] Measure route/polygon overlap without changing route selection or scoring.
- [x] Link the canonical model and current official alerts with explicit claim boundaries.
- [x] Add source, layer, geometry, prompt, fallback, and bundle-budget checks.
- [x] Complete production build and browser QA.

## Boundaries

- The polygons are a static model, not live or forecast conditions.
- The layer never selects, penalizes, excludes, certifies, or clears a route.
- No overlap does not prove that a street is safe, dry, clear, passable, low-risk, or flood-free.
- The model categories are scenario bands, not a point-specific current-depth reading.
- No civic task asks a resident to approach or verify floodwater.

## Review

- The checked-in snapshot contains 741 nuisance-ponding and 324 deep-and-contiguous model components intersecting the supported Manhattan area.
- The integrated suite passes with 41 test files and 256 tests. `npm run build` also passes TypeScript, Vite, server compilation, and the bundle guards; the lazy flood-context chunk is 90.80 KiB gzip against its 100 KiB budget.
- Production smoke checks pass. A production browser run planned the built-in 30-minute loop, then confirmed that enabling Flood preserves the route while showing the patterned `Flood potential · 2050 model` key and `Model · not live` status. Source, overlap-receipt, prompt, and inference-boundary behavior are additionally covered by contract tests.
