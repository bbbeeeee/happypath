---
id: "022"
title: Representative-journey gap analysis
phase: P0
status: review
owner: codex
builds_on: ["002", "003", "009", "019", "025"]
last_updated: 2026-08-16
---

# 022 — Representative-journey gap analysis

## Outcome

Detour starts with one plain planning question, an inspectable public-anchor journey cohort, and a repeated route burden that is meaningfully different from an inventory or density map.

## Recommended first question

Start with the most validated and visually legible of:

- where one exposed corridor breaks otherwise shaded walks between transit and public destinations;
- where one place to rest would reduce the longest seating gap across public-facility journeys.

## Work

- [ ] Define origins, destinations, journey purposes, weights, geography, and exclusions from public anchors.
- [ ] Show the cohort and weighting method in the product.
- [ ] Calculate burden per journey and cohort summaries such as exposed minutes, longest gap, or deviation.
- [ ] Identify a repeated segment or asset gap and distinguish it from sparse source coverage.
- [ ] Render affected and unaffected representative journeys on the map.
- [ ] Explain which groups of modeled journeys are represented without claiming real population demand.
- [ ] Keep individual Footnote usage out of the proof.
- [ ] End the gap view with the best next action: verify, operate, repair/remove, or build.

## Acceptance criteria

- [ ] The cohort is reproducible from stored anchors, weights, route rules, and source versions.
- [ ] Every burden derives from route results.
- [ ] The gap repeats across multiple visible journeys.
- [ ] Missing or weak evidence is separated from an observed or modeled burden.
- [ ] Inventory count and complaint volume are not used as proxies for user need.
- [ ] The audience can explain why the location matters before seeing an intervention.

## Verification

Save cohort fixtures, route outputs, burden distributions, coverage checks, sensitivity cases, screenshots, and the exact one-minute explanation used in the demo.
