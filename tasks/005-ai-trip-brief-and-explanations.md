---
id: "005"
title: AI Trip Brief and explanations
phase: M3
status: ready
owner: unassigned
depends_on: ["001", "shared-fixtures"]
parallel_with: ["002", "003", "004"]
last_updated: 2026-08-15
---

# 005 — AI Trip Brief and explanations

## Outcome

Natural language reliably becomes a typed, inspectable Trip Brief; follow-up language patches that brief; and route explanations remain concise, evidence-linked, and safe.

## Why this package exists

AI is the product interface and reasoning layer, not the source of route facts. This package defines and implements the boundary so the experience feels intelligent without allowing unsupported map or city claims.

## Inputs and dependencies

- [Data and inference specification](../docs/data-and-inference.md)
- [PRD intelligence boundary](../docs/PRD.md#9-ai-and-inference-boundary)
- `TripBrief`, `RouteCandidate`, `RouteReceipt`, and `MapPresentation` fixtures;
- supported feature vocabulary and claim rules.

## Deliverables

- model-provider adapter;
- schema-validated intent compiler;
- one-question clarification policy;
- refinement-patch compiler;
- candidate-selection or tie-break boundary;
- evidence-linked explanation generator;
- typed map-presentation planner;
- deterministic output validator;
- fallback behavior;
- evaluation set and results.

## Work breakdown

- [ ] `005-A` — Finalize the supported Trip Brief schema and feature vocabulary.
- [ ] `005-B` — Implement a provider-neutral model adapter with timeouts and structured output.
- [ ] `005-C` — Compile natural language and quick controls into one Trip Brief.
- [ ] `005-D` — Implement precedence rules for explicit input, requirements, refinements, and defaults.
- [ ] `005-E` — Ask at most one clarification when it materially changes the route or hard requirement.
- [ ] `005-F` — Preserve unsupported or unverified requests visibly.
- [ ] `005-G` — Compile refinements as patches to the current brief.
- [ ] `005-H` — Generate explanations only from supplied candidate metrics, source IDs, and claim objects.
- [ ] `005-I` — Implement the typed `MapPresentation` plan using registered layer, segment, warning, and callout IDs.
- [ ] `005-J` — Define whether the model may break deterministic near-ties or only explain the deterministic winner.
- [ ] `005-K` — Validate candidate existence, time budget, hard requirements, numerical claims, and prohibited language.
- [ ] `005-L` — Implement deterministic quick-mode fallback when inference fails.
- [ ] `005-M` — Build and run an evaluation set covering destination, amenities, mapped steps, unsupported accessibility, ambiguity, and refinement.

## Acceptance criteria

- [ ] At least 16 of 20 scripted supported prompts produce an accepted Trip Brief.
- [ ] Equivalent text and quick-control inputs produce equivalent fields.
- [ ] No hard requirement is inferred from sensitive context without confirmation.
- [ ] Every selected candidate exists and passes deterministic validation.
- [ ] Every numerical explanation exactly matches route output.
- [ ] Unsupported adjectives or claims fail validation.
- [ ] The model cannot create geometry, map styling, source facts, or intervention impact.
- [ ] Refinement preserves retained requirements.
- [ ] Inference failure returns a usable deterministic route flow.
- [ ] Provider choice can change without rewriting product contracts.

## Out of scope

- open-ended itinerary generation;
- mature preference learning;
- raw city-data analysis inside the language model;
- autonomous planning decisions;
- live web browsing during route selection.

## Risks and decisions

- Latency may make the conversational layer feel slower than route computation.
- Broad prompts such as “fun” or “safe” must not produce invented confidence.
- Candidate reranking may be unnecessary if deterministic ranking plus explanation is sufficient for P0.

## Verification

Commit the evaluation prompts, expected briefs, validation failures, timing results, and representative explanation outputs. Record the chosen provider and model only as an implementation decision, not a product dependency.

## Handoff

Task 007 integrates the AI services with the live route and UI contracts.
