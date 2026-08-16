---
id: "019"
title: Query truth and evidence reconciliation
phase: P0
status: review
owner: codex
builds_on: ["002", "003", "005", "017", "018", "025"]
last_updated: 2026-08-16
---

# 019 — Query truth and evidence reconciliation

## Outcome

Every phrase in a visible demo request has an observable, tested consequence in the Trip Brief, route policy, ranking, receipt, or unsupported state. Every route-affecting layer has a capability and validation status that agrees with runtime behavior.

## Why this is first

A magical path query stops feeling intelligent the moment one phrase is decorative. This preview resolves the earlier park-ending, direction-token, example-time, and unsupported-language findings; review now focuses on keeping that contract intact as prompts expand.

## Work

- [ ] Fix park-ending wander routing and add an end-to-end regression test.
- [ ] Match direction words as complete tokens and cover “at least” explicitly.
- [ ] Audit every visible example prompt phrase by phrase.
- [ ] Remove, reword, support, or visibly reject unenforced semantics, including fixed-destination total time and “calmer.”
- [ ] Define three to four hero prompts and a deterministic fallback expectation for each.
- [ ] Reconcile registry validation status with every layer that currently affects routing, ranking, waypoints, receipts, or planner claims.
- [ ] Distinguish route-affecting, display-only, reference-only, simulated-publisher, and fixed-route planner capabilities.
- [ ] Update implementation status and evidence docs from the verified results.

## Acceptance criteria

- [ ] Every hero phrase maps to a typed field, deterministic behavior, receipt claim, or visible limitation.
- [ ] Prompt and deterministic-fallback interpretations are semantically equivalent for the hero corpus.
- [ ] Park endpoints and direction constraints pass route-level tests.
- [ ] No source marked pending or reference-only silently affects a route without an explicit documented exception and resolution plan.
- [ ] Unsupported qualities never disappear silently.
- [ ] The complete test and production-smoke suites pass.

## Verification

Record the hero prompt corpus with expected Trip Brief patches, selected route constraints, receipt claims, fallbacks, source IDs, and screenshots. Re-run each from a clean session.
