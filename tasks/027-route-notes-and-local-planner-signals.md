---
id: "027"
title: Route notes and local planner signals
phase: M4
status: done
owner: codex
depends_on: ["009", "016"]
parallel_with: []
last_updated: 2026-08-16
---

# 027 — Route notes and local planner signals

## Outcome

People can leave lightweight feedback on a mapped route, and the City what-if view can turn locally saved route history and notes into a legible planning signal without accounts or server persistence.

## Why this package exists

Happy Path currently connects one resident route to planning evidence, but it does not retain the route or the resident's lived observation. This package closes that loop while keeping the prototype private, reversible, and simple enough to replace with account-backed storage later.

## Inputs and dependencies

- Current route result and trip brief in `src/App.tsx`
- Existing guarded local preference storage pattern in `src/preferences.ts`
- Existing City what-if map lenses and fallback-map presentation

## Deliverables

- A versioned, bounded local route-activity store with pure summaries and GeoJSON presentation
- A collapsed route-note interaction on the resident result sheet
- A planner lens for route traces, note markers, summary signals, and recent local logs
- Focused unit tests plus build and browser verification

## Work breakdown

- [x] `027-A` — Define and test local route-log and feedback storage
- [x] `027-B` — Add the resident route-note interaction
- [x] `027-C` — Add the planner analysis and map visualization
- [x] `027-D` — Verify desktop, mobile, empty, saved, and reload states

## Acceptance criteria

- [x] Each newly mapped or materially edited route is saved locally with bounded geometry and route metrics
- [x] A resident can save one or more concise route notes with a useful signal category
- [x] Storage failures and malformed older data fail safely without breaking routing
- [x] The planner view distinguishes route volume from resident feedback and states that the data is browser-local
- [x] Empty, single-route, and multi-note states are useful and accessible
- [x] Tests, build, and browser checks pass

## Out of scope

- Accounts, cross-device sync, shared planner datasets, moderation, identity, or submission to NYC
- SQLite, production migrations, or server APIs
- Claims that local prototype activity represents population need

## Risks and decisions

- Browser-local data is intentionally a prototype data source, not a civic dataset.
- Keep at most 60 recent route logs and trim stored geometry to protect localStorage capacity.
- Visualize individual local traces without ranking neighborhoods or implying statistical representativeness.

## Verification

- `npm run build` — passed, including TypeScript, Vite, bundle budgets, and server TypeScript
- `npx vitest run src/routeActivity.test.ts` — 8 tests passed
- `npm test` — 254/255 tests passed; one graph-coverage test exceeded the shared 15-second timeout
- `npx vitest run src/placeLabels.test.ts --testTimeout=60000` — the timed-out file passed 5/5 in 3.37 seconds when isolated
- Browser QA at 900×1500 and 390×844 — route-note form, saved-note state, Routes, Notes, and direct What-if entry verified
- Mobile overflow audit — 390 px document and sheet widths, no overflowing controls, largest inline SVG 21 px
- Browser console — no warnings or errors during the verified flow

## Review

- Kept persistence behind a small versioned local adapter instead of introducing SQLite for a browser-only prototype.
- Made route notes and data provenance equal compact tools rather than adding another full-width section.
- Kept the City handoff focused on the representative What-if while making local Routes and Notes available as adjacent, compact tabs.
- Kept local activity explicitly contextual: individual traces and notes are not presented as demand or a neighborhood score.

## Handoff

The versioned activity adapter can later be backed by an authenticated API while preserving the route-note and planner-analysis contracts.
