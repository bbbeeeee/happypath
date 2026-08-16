---
id: "024"
title: Cohesive demo freeze and rehearsal
phase: P0
status: review
owner: codex
builds_on: ["020", "021", "022", "023"]
last_updated: 2026-08-16
---

# 024 — Cohesive demo freeze and rehearsal

## Outcome

One resident hero and one planner hero run as a reliable, memorable product story from a clean phone or browser, with verified numbers and graceful recovery.

## Demo freeze

- [ ] Choose one resident hero request and one supporting request.
- [ ] Choose one planner question, cohort, gap, and intervention with a material deterministic result.
- [ ] Hide unsupported prompts, unfinished lenses, and unrelated secondary proofs from the hero path.
- [ ] Reduce the planner result to one insight, one action, and expandable evidence.
- [ ] Use a stable bundled basemap or make fallback-map status unobtrusive.
- [ ] Enforce initial and lazy payload budgets in automation.
- [ ] Add component or browser coverage for the hero flow and retain final QA artifacts.
- [ ] Verify desktop, tablet, and mobile touch targets, text size, panel scroll, layer reset, and comparison legibility.
- [ ] Prepare deterministic fallback, screenshots, and a short backup video.
- [ ] Rehearse inference, geocoder, basemap, and network failure recovery.

## Acceptance criteria

- [ ] The opening interaction communicates the product in under ten seconds.
- [ ] The resident and planner acts feel like one causal story.
- [ ] Every displayed number is regenerated from the frozen scenario inputs.
- [ ] The planner intervention produces a meaningful visible and numeric delta.
- [ ] No raw IDs, stale state, duplicated controls, tiny essential text, or unexplained technical language appear.
- [ ] The full demo succeeds from a clean mobile session with model and network fallbacks.
- [ ] Tests, production smoke, payload budgets, screenshots, and rehearsal notes are retained.

## Verification

Run the timed script three times from a clean browser and once on a representative phone. Record duration, failures, console output, network behavior, screenshots, exact route/scenario metrics, and recovery steps before setting this task to `done`.
