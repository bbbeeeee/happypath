---
id: "004"
title: Core UX, map presentation, and product language
phase: M3
status: ready
owner: unassigned
depends_on: ["001"]
parallel_with: ["002", "003", "005"]
last_updated: 2026-08-15
---

# 004 — Core UX, map presentation, and product language

## Outcome

Happy Path feels like a polished, friendly, intelligent consumer map. A user can describe a destination, loop, or wander; check what the product understood; receive one considered walk; understand why it fits; and refine it naturally.

## Why this package exists

The demo must feel real and magical, not like a technical proof. The interface has to hide substantial data and routing complexity behind a clean hierarchy, excellent product copy, fast transitions, and thoughtful failure states.

## Inputs and dependencies

- [UX and product-language guide](../docs/UX.md)
- [PRD](../docs/PRD.md)
- realistic `TripBrief`, `RouteCandidate`, `RouteReceipt`, and `MapPresentation` fixtures
- supported city-layer vocabulary and resident-facing labels

## Deliverables

- mobile information architecture and screen states;
- implemented destination, loop, and wander compose flows;
- editable Trip Brief;
- map-first result, comparison, inspection, and refinement;
- Route Receipt and City data used view;
- fixed visual system for route qualities, amenities, warnings, and uncertainty;
- complete friendly product-copy library;
- polished loading, empty, partial-data, and failure states;
- motion, responsive, accessibility, and demo-readiness review.

## Work breakdown

### Experience architecture

- [ ] `004-A` — Define final P1 information architecture and all screen states.
- [ ] `004-B` — Design one composer supporting destination, loop, and wander without mode overload.
- [ ] `004-C` — Design minimal quick controls that edit the same Trip Brief.
- [ ] `004-D` — Implement an editable Trip Brief with visible assumptions, requirements, and unsupported criteria.

### Route result

- [ ] `004-E` — Implement one visually dominant Happy Path and an optional subdued baseline.
- [ ] `004-F` — Implement friendly Route Receipt language emphasizing human benefit and tradeoff.
- [ ] `004-G` — Implement **Why this way?** segment and claim inspection.
- [ ] `004-H` — Implement natural-language refinement and a clear route-change summary.
- [ ] `004-I` — Add restrained motion so route recomputation feels immediate and understandable.

### City layers and evidence

- [ ] `004-J` — Implement the City data used drawer with plain-language source explanations.
- [ ] `004-K` — Define fixed primitives for continuous layers, assets, warnings, and uncertainty.
- [ ] `004-L` — Implement deterministic priority, collision, density, and zoom rules.
- [ ] `004-M` — Ensure broad layer integration never turns the map into a GIS dashboard.

### Product language and states

- [ ] `004-N` — Write friendly copy for compose, loading, result, compare, inspect, refine, and evidence states.
- [ ] `004-O` — Create a translation layer from technical claims to resident language.
- [ ] `004-P` — Implement first-use, geocoding, outside-area, no-route, hard-requirement, inference-failure, partial-data, no-better-route, and recovery states.
- [ ] `004-Q` — Remove raw dataset fields, source IDs, schema names, debug text, and unexplained jargon from primary screens.

### Quality

- [ ] `004-R` — Review phone and desktop layout, keyboard use, focus, contrast, tap targets, reduced motion, and non-color distinctions.
- [ ] `004-S` — Run product-copy review for warmth, clarity, consistency, and honest uncertainty.
- [ ] `004-T` — Test the complete flows from a clean session with realistic fixtures.

## Acceptance criteria

- [ ] A new user understands the product from the first screen.
- [ ] Destination, loop, and wander share one coherent interaction model.
- [ ] A supported walk can be created without opening a layer panel.
- [ ] The Trip Brief is clear, editable, and not overly technical.
- [ ] One route is visually dominant.
- [ ] The primary benefit and cost are understandable within a few seconds.
- [ ] Every visible layer is relevant to the current request, result, or warning.
- [ ] City data is inspectable without dominating the main experience.
- [ ] Copy is friendly, calm, concise, and product-forward in every primary state.
- [ ] Technical jargon does not leak into resident-facing screens.
- [ ] Refinement visibly updates the same route context.
- [ ] Loading and failure states feel intentional and preserve a next action.
- [ ] The product feels complete on a representative mobile viewport.
- [ ] Rehearsed demo flows are understandable without narration.

## Out of scope

- arbitrary user-controlled GIS layers;
- full turn-by-turn navigation;
- a bespoke icon family unless it clearly improves the demo after core polish;
- the Detour planner interface;
- redesigning the `bryan` prototype.

## Risks and decisions

- Feature breadth can quickly destroy visual hierarchy.
- Technical transparency should be available one level deeper, not placed in the primary receipt.
- AI may suggest relevant content but cannot control pixel layout or hide required warnings.
- Copy and data-cleaning work are part of product quality, not final-stage decoration.

## Verification

Run destination, loop, wander, amenity, partial-data, and failure scenarios on mobile and desktop. Capture screenshots or recordings and complete a copy, accessibility, and map-cleanliness review.

## Handoff

Task 007 connects the polished UX to real data, routing, and inference. Task 008 uses the final flows for the hackathon demo.