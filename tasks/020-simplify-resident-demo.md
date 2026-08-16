---
id: "020"
title: Simplify the resident demo
phase: P0
status: review
owner: codex
builds_on: ["004", "016", "019"]
last_updated: 2026-08-16
---

# 020 — Simplify the resident demo

## Outcome

A first-time viewer understands Footnote after one screen and reaches one considered route without choosing among product modes, overlapping layer controls, or secondary proofs.

## Product edit

- [ ] Make resident planning the only primary opening job.
- [ ] Use the direct prompt **“Where and how would you like to walk?”**
- [ ] Show at most three curated examples or the three journey shapes; remove cover, civic-help, and running proofs from the opening quick row.
- [ ] Present a compact, editable Trip Brief before or alongside generation.
- [ ] Keep one primary workspace: map plus one decision panel.
- [ ] Move the generic layer palette, manual route steering, civic checks, raw evidence, and secondary proofs behind contextual actions.
- [ ] Replace the top-level City mode as the hero entry with a result action tied to a concrete burden.
- [ ] Reset panel scroll and transient layer state when the user starts over or changes the active lens.
- [ ] Replace raw OSM-node labels with stable local place labels for demo origins.
- [ ] Distinguish geocoder unavailable from address not found.

## Acceptance criteria

- [ ] Five first-time evaluators can state what Footnote does after the opening interaction without explanation.
- [ ] One clear action leads from request to route.
- [ ] The default map never accumulates unrelated planner and resident layers.
- [ ] Starting over restores a clean, human-labeled state.
- [ ] Hero landmarks work without a live geocoder.
- [ ] No opening control exists only to advertise a secondary feature.
- [ ] Mobile primary actions have at least 44px touch targets and essential copy remains legible.

## Verification

Capture clean-session desktop, tablet, and mobile flows. Record the click path, visible words, active controls, map layers, labels, errors, and time to first useful route.
