---
id: "004"
title: Core UX and map presentation
phase: M3
status: ready
owner: unassigned
depends_on: ["001"]
parallel_with: ["002", "003", "005"]
last_updated: 2026-08-15
---

# 004 — Core UX and map presentation

## Outcome

A mobile user can compose, inspect, receive, compare, understand, and refine a Happy Path without operating a GIS dashboard or reading a chat transcript.

## Why this package exists

The product requires a distinctive but simple map-first interaction. It also needs a scalable visual system for many city layers without showing them all simultaneously.

## Inputs and dependencies

- [Core UX specification](../docs/UX.md)
- [PRD](../docs/PRD.md)
- fixture `TripBrief`, `RouteCandidate`, `RouteReceipt`, and `MapPresentation` payloads;
- existing MapLibre UI from `codex/happy-path-mvp`.

## Deliverables

- mobile screen and state specification;
- component and interaction model;
- implemented compose, interpret, result, inspect, compare, and refine states;
- route-first map hierarchy;
- evidence drawer and City data used view;
- deterministic layer and collision rules;
- loading, failure, partial-coverage, and no-alternative states;
- responsive and accessibility review.

## Work breakdown

- [ ] `004-A` — Define final P0 information architecture and screen states.
- [ ] `004-B` — Design the natural-language composer and minimal quick controls.
- [ ] `004-C` — Implement an editable Trip Brief with visible unsupported criteria and requirements.
- [ ] `004-D` — Implement the recommended-route map and subdued fastest comparison.
- [ ] `004-E` — Implement the Route Receipt, tradeoff, confidence, and benefit frontier presentation.
- [ ] `004-F` — Implement segment-level Why this street inspection.
- [ ] `004-G` — Implement the City data used and coverage drawer.
- [ ] `004-H` — Define fixed visual primitives for continuous layers, discrete assets, warnings, and uncertainty.
- [ ] `004-I` — Implement deterministic layer priority, density, collision, and zoom rules.
- [ ] `004-J` — Implement refinement and route-delta presentation.
- [ ] `004-K` — Complete loading, outside-pilot, unsupported, partial-data, no-route, and inference-failure states.
- [ ] `004-L` — Review mobile layout, keyboard flow, focus, contrast, tap targets, and non-color distinctions.
- [ ] `004-M` — Decide whether custom icons add enough value to become a separate stretch task.

## Acceptance criteria

- [ ] A new user can create a supported route without opening a layer panel.
- [ ] The Trip Brief exposes the system interpretation and can be edited.
- [ ] One route is visually dominant.
- [ ] The primary benefit and cost are understandable within a few seconds.
- [ ] Every visible layer is relevant to the current request, result, or warning.
- [ ] A user can inspect the City sources supporting a claim.
- [ ] Fastest comparison is available without overwhelming the default map.
- [ ] Refinement updates the same route context rather than creating a disconnected conversation.
- [ ] Required warnings remain visible even when the map is dense.
- [ ] All required states work on a representative mobile viewport.

## Out of scope

- arbitrary user-controlled GIS layers;
- full turn-by-turn navigation;
- a complete custom icon family;
- Detour planner UI;
- visual redesign of the isometric prototype.

## Risks and decisions

- Too many default icons would weaken the route hierarchy.
- AI should propose semantic relevance but must not control pixel layout or suppress required warnings.
- Data-source detail must establish trust without turning the receipt into technical documentation.

## Verification

Review the three demo flows on mobile and desktop fixtures, test keyboard and touch interaction, and capture annotated screenshots of each required state.

## Handoff

Task 007 integrates the UI with live routing, data, and inference services. Task 008 uses the resulting flow for the demo narrative.
