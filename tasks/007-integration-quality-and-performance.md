---
id: "007"
title: Integration, quality, and performance
phase: M4
status: blocked
owner: unassigned
depends_on: ["002", "003", "004", "005", "006"]
parallel_with: []
last_updated: 2026-08-15
---

# 007 — Integration, quality, and performance

## Outcome

The selected implementation is integrated into one reliable P0 application whose routing, inference, evidence, UI, licensing, privacy, and mobile performance satisfy the PRD.

## Why this package exists

Data, routing, AI, and UI can proceed in parallel, but the product succeeds only when the same request produces a valid route, truthful receipt, relevant map layers, and safe failure behavior.

## Inputs and dependencies

- approved prototype disposition;
- validated layer fixtures;
- route API and metrics;
- Trip Brief and explanation services;
- implemented core UX.

## Deliverables

- integrated application branch;
- stable end-to-end contracts;
- automated and manual test suite;
- payload and performance plan;
- attribution and privacy implementation;
- route-review corpus;
- resolved P0 defects and documented residual limitations.

## Work breakdown

- [ ] `007-A` — Create a clean integration branch from the approved base.
- [ ] `007-B` — Merge or port only selected assets from `codex/happy-path-mvp`.
- [ ] `007-C` — Connect compose and Trip Brief to route generation.
- [ ] `007-D` — Connect route metrics to receipt, evidence drawer, segment inspection, and map presentation.
- [ ] `007-E` — Connect refinement patches to deterministic rerouting.
- [ ] `007-F` — Implement inference timeout, validation failure, and deterministic fallback.
- [ ] `007-G` — Verify all hard-requirement and unsupported-request paths.
- [ ] `007-H` — Audit source attribution, third-party notices, and dataset terms.
- [ ] `007-I` — Review privacy: avoid retaining raw prompts, precise paths, or inferred context by default.
- [ ] `007-J` — Define and meet route-computation, inference, page-load, and interaction budgets.
- [ ] `007-K` — Reduce or lazy-load graph, shadow, and layer payloads.
- [ ] `007-L` — Test desktop and representative mobile browsers.
- [ ] `007-M` — Review ten route pairs and twenty blocks or assets.
- [ ] `007-N` — Test the three primary demo prompts and failure variants.
- [ ] `007-O` — Document known limitations and kill nonessential unstable features.

## Acceptance criteria

- [ ] A complete supported request works from input through explanation.
- [ ] Every visible numerical claim matches deterministic output.
- [ ] At least five City datasets are inspectable and at least three layer families materially influence the result.
- [ ] No hard requirement is violated in the test corpus.
- [ ] Partial or missing evidence is visible.
- [ ] The application works when the inference provider is unavailable.
- [ ] Ten route pairs and twenty sampled blocks or assets are reviewed.
- [ ] Mobile load and warmed interactions meet explicit budgets.
- [ ] Attribution and privacy requirements are implemented.
- [ ] Noncritical unstable features are removed rather than left misleading.

## Out of scope

- broad post-hackathon refactoring;
- citywide scaling;
- mature observability;
- full Detour interface;
- persistent personalization.

## Risks and decisions

- Large committed pilot datasets may dominate bundle size.
- Integration may expose conflicting schemas created by parallel work; fixture contracts should prevent this.
- Feature breadth must not reduce trust in the hero route.

## Verification

Record test commands, performance measurements, route-review results, source attributions, mobile screenshots, and a final P0 acceptance checklist.

## Handoff

Task 008 packages the integrated application for deployment and presentation. Task 009 may proceed only if this package’s route and feature contracts are stable.
