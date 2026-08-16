---
id: "021"
title: Route value frontier and comparison
phase: P0
status: review
owner: codex
builds_on: ["003", "020"]
last_updated: 2026-08-16
---

# 021 — Route value frontier and comparison

## Outcome

The route result immediately answers **“What did the extra time buy?”** and shows where additional detour stops producing a meaningful benefit.

## Work

- [ ] Calculate a best-extra-minute frontier from valid destination alternatives.
- [ ] Select the smallest detour that captures most of the available requested benefit when evidence supports that claim.
- [ ] Lead the receipt with one primary gain, one cost, and retained hard requirements.
- [ ] Pair the recommendation with a subdued baseline mini-receipt.
- [ ] Make baseline geometry and legend visually distinct without competing with the Footnote.
- [ ] Highlight the route segments responsible for the main delta.
- [ ] Keep sources, method, freshness, and caveats in one consistent deeper disclosure.
- [ ] Define no-meaningful-alternative behavior that recommends the direct route honestly.

## Acceptance criteria

- [ ] Every value claim is recomputed from deterministic candidate metrics.
- [ ] The first result view makes both benefit and cost clear within five seconds.
- [ ] Baseline line, legend, and paired metrics are visually legible on desktop and mobile.
- [ ] The route never recommends extra time when the measured gain is negligible.
- [ ] A refinement updates the frontier and reports the delta without losing retained requirements.

## Verification

Use golden routes with strong, weak, and absent benefits. Assert candidate selection, frontier calculation, receipt copy, comparison geometry, and no-benefit fallback.
