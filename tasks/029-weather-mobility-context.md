---
id: "029"
title: Live weather and mobility context
phase: M4
status: done
owner: codex
depends_on: [019, 025, 028]
parallel_with: []
last_updated: 2026-08-16
---

# 029 — Live weather and mobility context

## Outcome

Footnote adds a small, reliable live weather/heat signal and the easiest truthful mobility and human-context evidence, exposes them through a compact bottom-right layer control, and updates `/datasources` without claiming a verified accessible or live-safe route.

## Deliverables

- Official-source audit for live weather/heat and mobility evidence
- Minimal live weather integration with bounded caching/failure behavior
- Low-friction NYC mobility/context additions that fit existing graph and map primitives
- Compact, progressively disclosed layer controls
- Updated source registry, public data page, tests, and verification

## Work breakdown

- [x] `029-A` — Verify official sources, schemas, freshness, and claim boundaries
- [x] `029-B` — Implement selected weather and mobility/context data
- [x] `029-C` — Condense and extend the map layer control
- [x] `029-D` — Update `/datasources` and the source audit
- [x] `029-E` — Verify, review, commit, and push the PR branch

## Acceptance criteria

- [x] Weather/heat context comes from an official, credential-free source and degrades quietly when unavailable
- [x] New mobility evidence never strengthens “avoids mapped stairs” into an accessibility guarantee
- [x] Context-only records cannot silently affect routing
- [x] The bottom-right control remains compact at desktop and mobile sizes
- [x] Every added source has provenance, freshness, and claim boundaries
- [x] Focused tests, type checks, and the production build pass

## Out of scope

- A certified ADA/step-free routing product
- Turning complaint density into neighborhood quality
- Adding a separate permanent weather or accessibility dashboard
- Production deployment

## Risks and decisions

- “Continuous network” means continuity of evidence state across the route, including explicit unknown gaps; sparse point datasets cannot certify continuous accessibility.
- Live weather may describe a representative Manhattan observation rather than block-level microclimate.
- The Footnote rename and concurrent route-input/map-presentation work are the active product baseline and are verified together with this package.

## Verification

- 35 focused tests pass across weather, access context, cooling options, source audit, source registry, layer catalog, and layer state.
- The full Vitest suite passes in the final combined Footnote worktree.
- `npx tsc -b --pretty false` passes.
- `npm run build` passes.
- Desktop and mobile browser checks confirm the collapsed layer control remains compact, secondary layers expand in place, `/datasources` is responsive, and context markers remain restrained.
- Live `/api/weather` returned an NWS Manhattan forecast; access context and NYC Cool Options loaded in the fallback and WebGL map paths.
- The combined Footnote rename, route-input changes, and data-context package pass the full test and production-build gates together.
