---
id: "015"
title: Distance-aware routes
phase: P1
status: done
owner: codex
builds_on: ["003", "005", "011"]
last_updated: 2026-08-16
---

# 015 — Distance-aware routes

## Goal

Let residents ask naturally for a route by distance—especially requests such as a shaded two-mile run—while preserving the MVP’s evidence boundaries and existing time-based behavior.

## Checklist

- [x] Add walking/running activity and an optional route-distance target to the Trip Brief.
- [x] Interpret miles and kilometers deterministically, with safe demo bounds.
- [x] Default destination-free runs to loops and destination-free walks to wanders.
- [x] Make explicit distance replace time, explicit time replace distance, and ordinary refinements retain the active constraint.
- [x] Target distance through the routing engine’s existing geometry-equivalent budget.
- [x] Add distance controls and compact result/closest-feasible copy.
- [x] Add a shaded two-mile run to the deterministic product scenario suite.
- [x] Verify focused/full tests, production build, and live OpenRouter/browser behavior.
- [x] Push the completed work to PR #3.

## Product boundary

Distance is measured from route geometry. The routing engine’s duration remains a pedestrian-graph estimate and is not presented as a claimed running pace. The preview supports targets from 0.25 to 5 miles.

## Review

The composer now understands miles and kilometers, walk/run language, natural loop defaults, constraint switching, and distance-based refinements. A real OpenRouter call interpreted “Map me a shaded 2-mile run that loops back here” as a two-mile shaded running loop; live browser QA rendered a 1.9-mile result with no console errors. Verification: 26 test files / 171 tests, production build, and the exact deployment package smoke test.
