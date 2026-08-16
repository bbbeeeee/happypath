---
id: "005"
title: AI Trip Brief, refinement, and explanations
phase: M3
status: ready
owner: unassigned
depends_on: ["001", "shared-fixtures"]
parallel_with: ["002", "003", "004"]
last_updated: 2026-08-15
---

# 005 — AI Trip Brief, refinement, and explanations

## Outcome

Natural language reliably becomes a typed, inspectable Trip Brief for destination, loop, or wander journeys. Follow-up language patches that brief, relevant City layers are selected from a supported registry, and explanations sound friendly while remaining evidence-linked and safe.

## Why this package exists

AI should make Footnote feel intuitive and considered. It is the interpretation and communication layer, not the source of route facts. The product needs enough intelligence to understand a short request without allowing the model to invent the city, expose technical jargon, or turn the interaction into a long chat.

## Inputs and dependencies

- [Data and inference specification](../docs/data-and-inference.md)
- [UX and product-language guide](../docs/UX.md)
- `TripBrief`, `RouteCandidate`, `RouteReceipt`, and `MapPresentation` fixtures
- supported journey, feature, asset, and claim vocabulary
- resident-facing terminology and prohibited-language rules

## Deliverables

- provider-neutral model adapter;
- schema-validated intent compiler;
- journey-shape and time-budget interpretation;
- one-question clarification policy;
- refinement-patch compiler;
- supported-layer relevance selection;
- candidate-selection or tie-break boundary;
- friendly evidence-linked explanation generator;
- typed map-presentation planner;
- deterministic validator and fallback;
- evaluation set covering product and copy quality.

## Work breakdown

### Trip understanding

- [ ] `005-A` — Finalize the supported Trip Brief and feature vocabulary.
- [ ] `005-B` — Implement a provider-neutral model adapter with structured output, timeouts, and fallback.
- [ ] `005-C` — Interpret destination, loop, and wander requests.
- [ ] `005-D` — Distinguish walking time, detour allowance, direction, endpoint type, and hard requirements.
- [ ] `005-E` — Merge natural language and quick controls into one visible brief.
- [ ] `005-F` — Implement precedence rules for explicit edits, requirements, refinements, and defaults.
- [ ] `005-G` — Ask at most one question when it materially changes the journey.
- [ ] `005-H` — Keep unsupported or unverified requests visible.

### Refinement and route selection

- [ ] `005-I` — Compile follow-up language as a patch to the current brief.
- [ ] `005-J` — Preserve retained endpoints, waypoints, budgets, and hard requirements.
- [ ] `005-K` — Select relevant registered data layers and claims for the request.
- [ ] `005-L` — Decide whether the model breaks deterministic near-ties or only explains the deterministic winner.
- [ ] `005-M` — Validate candidate existence, time budget, route constraints, and source coverage.

### Explanation and presentation

- [ ] `005-N` — Generate reasons only from supplied route metrics, source IDs, and claim objects.
- [ ] `005-O` — Lead with human benefit and put technical evidence one level deeper.
- [ ] `005-P` — Translate internal terminology into the approved resident vocabulary.
- [ ] `005-Q` — Generate a typed `MapPresentation` using registered layers, assets, segments, warnings, and callouts.
- [ ] `005-R` — Prevent unsupported adjectives, neighborhood judgments, safety claims, accessibility guarantees, and fabricated live conditions.

### Evaluation

- [ ] `005-S` — Build prompts for destination, loop, wander, amenities, mapped steps, ambiguity, unsupported requests, and refinement.
- [ ] `005-T` — Test latency, schema adherence, factual grounding, copy quality, and deterministic fallback.
- [ ] `005-U` — Review outputs for warmth, brevity, consistency, and absence of technical jargon.

## Acceptance criteria

- [ ] At least 16 of 20 scripted supported prompts produce an accepted Trip Brief.
- [ ] Destination, loop, and wander are distinguished correctly in the demo set.
- [ ] Equivalent text and quick-control inputs produce equivalent fields.
- [ ] No hard requirement is inferred from sensitive context without confirmation.
- [ ] Every selected candidate exists and passes deterministic validation.
- [ ] Every numerical explanation exactly matches route output.
- [ ] Relevant City layers are chosen from the registered vocabulary only.
- [ ] Primary copy sounds friendly and resident-facing rather than technical.
- [ ] Unsupported adjectives, safety claims, and fabricated live conditions fail validation.
- [ ] Refinement preserves retained requirements and updates the same brief.
- [ ] Inference failure returns a usable deterministic flow.
- [ ] Provider choice can change without rewriting product contracts.

## Out of scope

- LLM-generated route geometry;
- mature long-term preference learning;
- raw unbounded City-data analysis inside the model;
- autonomous City planning decisions;
- unrestricted live web browsing during route selection;
- generic open-ended itinerary generation.

## Risks and decisions

- Model latency can undermine the magical feeling even when routing is fast.
- Broad requests such as “fun,” “safe,” or “accessible” need narrow handling and explicit evidence.
- Over-explaining sources can make the product feel bureaucratic.
- Deterministic ranking may be sufficient; model reranking should only exist if it materially improves results.

## Verification

Commit evaluation prompts, expected briefs, validation failures, timing results, and representative resident-facing explanations. Review the outputs against `docs/UX.md`, not only schema correctness.

## Handoff

Task 007 integrates inference with the live journey engine and product UI.