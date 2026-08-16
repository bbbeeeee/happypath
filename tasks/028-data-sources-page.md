---
id: "028"
title: Data sources audit and public page
phase: M4
status: done
owner: codex
depends_on: [002, 011, 017, 026]
parallel_with: []
last_updated: 2026-08-16
---

# 028 — Data sources audit and public page

## Outcome

People can visit `/datasources` to understand, at a glance, which evidence shapes Happy Path routes, which sources provide map context, how derived signals are made, and what integrations are still missing.

## Why this package exists

Happy Path already combines many civic, open, and derived datasets, but that breadth is visible only in route-level detail panels and implementation documents. A public source page should make the system legible without overstating current routing capability.

## Deliverables

- Audited inventory mapped from the runtime source registry and layer contracts
- Responsive `/datasources` page using the existing visual system
- Navigation from the main experience
- Explicit current-use, context-only, derived-method, and future-gap boundaries
- Focused tests and production build verification

## Work breakdown

- [x] `028-A` — Confirm the PR worktree and inspect source/layer contracts
- [x] `028-B` — Implement the page and main-app entry point
- [x] `028-C` — Verify route behavior, source counts, responsive structure, tests, and build

## Acceptance criteria

- [x] Every source presented as current is backed by the runtime registry or a registered derived method
- [x] Route-shaping and context-only evidence are visually distinct
- [x] Accessibility, shade/heat exposure, flood, greenery, stairs, transportation, amenities, and cover are represented with truthful capability labels
- [x] Potential additions and material gaps appear at the bottom
- [x] `/datasources` works on direct load and the main experience links to it
- [x] Existing tests and production build pass

## Out of scope

- New source ingestion or promotion of context-only data into routing
- Live weather, transit service, accessibility equipment, or flood alerts
- Deployment

## Risks and decisions

- “Heat” is presented as a modeled sun-exposure proxy until measured temperature or heat-index data exists.
- “Accessibility” is bounded to mapped-step avoidance and inventory/reference context; it is not described as verified step-free routing.
- Flood evidence remains planning context and does not affect route selection.

## Verification

- `npm test` — 42 files, 261 tests passed before the final direct-route assertion; the focused final suite passes with that assertion included.
- `npm run build` — TypeScript, Vite, bundle budgets, and server TypeScript passed. The page is a 4.94 KiB gzip lazy chunk and the initial JavaScript budget remains under 60 KiB gzip.
- Production server request to `/datasources` — HTTP 200 with the SPA shell.
- `git diff --check` — clean.

## Review

The page accounts for all 21 registry entries exactly once, separates 13 active upstream sources from three derived signals and five cataloged next integrations, and lists CARTO and OpenRouter separately as supporting services rather than route evidence. The audit also corrects GeoSearch from a reference-only label to an active submitted-address service.

## Handoff

The runtime source registry remains the provenance authority; future source work should update it and the page-facing capability map together.
