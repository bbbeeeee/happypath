---
id: "007"
title: Integration, quality, performance, and polish
phase: M4
status: blocked
owner: unassigned
depends_on: ["002", "003", "004", "005", "006"]
parallel_with: ["009-data-spike"]
last_updated: 2026-08-15
---

# 007 — Integration, quality, performance, and polish

## Outcome

Happy Path becomes one reliable P1 product whose real data, journeys, AI interpretation, map presentation, copy, evidence, licensing, privacy, and mobile performance work together from a clean session.

## Why this package exists

Data, routing, AI, and UX can be developed separately, but the demo only feels magical when the seams disappear. A short request must produce a credible journey, relevant map, friendly explanation, honest uncertainty, and fast refinement without exposing implementation complexity.

## Inputs and dependencies

- approved documentation;
- validated Manhattan data layers and fixtures;
- destination, loop, and wander engine;
- Trip Brief and explanation services;
- implemented UX and copy system;
- selected civic-data layers and amenities.

## Deliverables

- integrated P1 application;
- stable end-to-end information contracts;
- destination, loop, and wander flows;
- automated and manual test suite;
- resident-copy review;
- payload and performance plan;
- source attribution and privacy implementation;
- route and asset review corpus;
- resolved P1 defects and explicit residual limitations.

## Work breakdown

### Integration

- [ ] `007-A` — Establish shared contracts and realistic fixtures in the chosen implementation.
- [ ] `007-B` — Integrate any reusable historical prototype work only where it genuinely reduces risk.
- [ ] `007-C` — Connect compose and Trip Brief to destination, loop, and wander generation.
- [ ] `007-D` — Connect route metrics to the receipt, map, City data used view, and segment inspection.
- [ ] `007-E` — Connect refinements to deterministic rerouting and route-change summaries.
- [ ] `007-F` — Connect relevant amenities, public spaces, and warnings without clutter.
- [ ] `007-G` — Implement inference timeout, validation failure, and deterministic fallback.

### Truth and safety

- [ ] `007-H` — Verify hard requirements and unsupported-request behavior.
- [ ] `007-I` — Verify every resident claim against deterministic output and source evidence.
- [ ] `007-J` — Audit attribution, third-party notices, and dataset terms.
- [ ] `007-K` — Review privacy and avoid retaining raw prompts, precise routes, or inferred context by default.
- [ ] `007-L` — Confirm hypothetical Detour data is visually distinct from observed City conditions.

### Product polish

- [ ] `007-M` — Remove developer copy, raw IDs, schema names, debug states, and technical jargon.
- [ ] `007-N` — Run full product-copy review for warmth, clarity, consistency, and useful uncertainty.
- [ ] `007-O` — Polish loading, map transitions, route changes, empty states, and recovery.
- [ ] `007-P` — Verify all visible layers are relevant to the current journey.
- [ ] `007-Q` — Verify the base map remains complete and legible when optional evidence coverage is sparse or uneven.
- [ ] `007-R` — Review destination, loop, and wander for coherent visual and interaction behavior.

### Performance and validation

- [ ] `007-S` — Define route, inference, first-load, map-render, and refinement budgets.
- [ ] `007-T` — Partition, compress, cache, or lazy-load graph, shadow, and asset data.
- [ ] `007-U` — Test clean desktop and representative mobile browsers.
- [ ] `007-V` — Review at least ten destination routes plus representative loops and wanders.
- [ ] `007-W` — Review at least twenty blocks or assets across Lower and Midtown Manhattan.
- [ ] `007-X` — Test the four primary demo prompts and several failure variants.
- [ ] `007-Y` — Remove noncritical unstable features rather than leaving them misleading.

## Acceptance criteria

- [ ] A complete supported request works from input through route explanation and refinement.
- [ ] Destination, loop, and wander each work in the supported demo set.
- [ ] Every visible numerical and factual claim matches deterministic output and source evidence.
- [ ] At least five official NYC datasets are inspectable.
- [ ] At least three layer families materially influence the result.
- [ ] No hard requirement is violated in the test corpus.
- [ ] Partial or missing evidence is visible in friendly language.
- [ ] The application remains useful when inference is unavailable.
- [ ] Primary screens contain no unexplained technical jargon or debug output.
- [ ] The base map remains visually complete across the supported geography regardless of optional evidence coverage.
- [ ] The product feels coherent and responsive on a representative phone.
- [ ] Data payload and interaction budgets are met.
- [ ] Attribution and privacy requirements are implemented.
- [ ] Resident route facts use real supported-area data rather than hard-coded demo claims.
- [ ] Noncritical unstable features are removed or clearly deferred.

## Out of scope

- broad post-hackathon refactoring;
- citywide or multimodal scaling;
- mature production observability;
- full planning-workflow integration;
- persistent personalization;
- Civic Assets & Actions;
- prescribing how the future team structures branches, issues, or releases.

## Risks and decisions

- Large Manhattan datasets can make a credible product feel slow or fragile.
- Copy and visual inconsistency can expose seams between parallel workstreams.
- Loop and wander may need more curated test coverage than destination routes.
- Feature breadth must not reduce trust or simplicity.

## Verification

Record test results, performance measurements, route-review results, product-copy review, source attributions, clean-session recordings, and a final P1 acceptance checklist.

## Handoff

Task 008 packages the integrated product for deployment and presentation. Task 009 reuses stable route and layer contracts for the Detour proof.