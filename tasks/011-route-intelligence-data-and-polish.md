---
id: "011"
title: Route intelligence, city evidence, and product polish
phase: P1
status: done
owner: codex
depends_on: ["003", "005", "006", "009"]
last_updated: 2026-08-16
---

# 011 — Route intelligence, city evidence, and product polish

## Outcome

Footnote produces clearly different, credible destination, loop, wander, rainy-day, and mapped-step-free walks; explains them from deterministic evidence; links every dataset to its official source; and presents the experience with a compact, geometric, friendly interface.

> Historical note: this task records the simulated-cover proof that existed when the slice closed. Task 017 superseded that implementation with sparse explicit mapped-cover geometry and reference-only shed, POPS, and construction context. The verification numbers below remain historical evidence rather than current status.

## Build checklist

- [x] Define a reproducible sample-route scorecard for the five primary journey situations.
- [x] Fix route generation or ranking defects exposed by that scorecard.
- [x] Treat accessibility language as a mapped-step-free request plus an explicit evidence boundary.
- [x] Add high-value official NYC sources with honest capability and freshness status.
- [x] Make City data references clickable in resident and planning views.
- [x] Add a bounded OpenRouter planning-insight contract grounded in supplied route and source facts.
- [x] Improve Detour from a technical proof into a clear gap → intervention → change story.
- [x] Tighten typography, radii, spacing, map controls, and responsive behavior.
- [x] Verify fallback and interactive-map states, keyboard/focus behavior, console health, tests, and build.

## Product guardrails

- Route geometry, time, shade, amenity counts, and intervention deltas remain deterministic.
- The model may interpret intent and write grounded explanations; it may not invent streets, assets, conditions, or impact.
- “Accessible” narrows to avoiding mapped steps and never becomes an ADA claim.
- Simulated cover and hypothetical interventions remain visibly labeled.
- Reference-only datasets never affect resident routing until their validation status supports it.

## Review

- Deterministic route scorecard covers destination, 30-minute transit wander, custom 23-minute loop, rain-cover proof, and mapped-step avoidance.
- Representative results: 29.14-minute wander, 23.62-minute loop, 22.69-minute rain proof with 46.4 percentage points more simulated cover, and zero mapped-step edges in the constrained destination scenario.
- Live OpenRouter checks passed for custom loops, rain intent, accessibility intent, and AI-ranked City what-if interventions. Model output only selects bounded fact and candidate IDs; route geometry, impact, source links, and copy remain server-controlled.
- Desktop and 390 × 844 browser checks passed for chat-first compose, resident results, data details, rainy-day cover, destination precedence, City what-if, and responsive scrolling. Clean reload has no console errors.
- `npm test`: 23 files and 146 tests passed.
- `npm run build`: passed; initial JavaScript is 837.77 KB gzip and hourly shade chunks remain below 296 KB gzip.
