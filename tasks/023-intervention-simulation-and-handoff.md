---
id: "023"
title: Intervention simulation and resident handoff
phase: P0
status: review
owner: codex
builds_on: ["021", "022"]
last_updated: 2026-08-16
---

# 023 — Intervention simulation and resident handoff

## Outcome

One resident route burden opens directly into Detour, where the same representative cohort is compared before and after a clearly hypothetical intervention.

## Work

- [ ] Add **“See this gap across more journeys”** to a qualifying route claim.
- [ ] Carry the selected segment, need, metric, route, and evidence IDs into Detour.
- [ ] Use one planner lens to control both analysis and map state.
- [ ] Apply one intervention to a copied graph or asset model and reroute the same cohort.
- [ ] Compare one intuitive lower-impact alternative.
- [ ] Show improved, unchanged, worsened, and remaining burdens.
- [ ] Present one recommended next step; collapse secondary ideas, sources, and assumptions.
- [ ] End with **“What to verify next”** and keep feasibility separate from modeled value.
- [ ] Preserve a fixed-route option only when causal isolation is the explicit question.

## Acceptance criteria

- [ ] The resident-to-planner transition requires no restatement or layer reselection.
- [ ] The same cohort and route policy are used before and after.
- [ ] Route geometry changes are visible when rerouting is claimed.
- [ ] A fixed-route comparison never implies rerouting or representative demand.
- [ ] The primary intervention has a material, validated demo delta.
- [ ] The result shows who benefits, who does not, what remains, and what is uncertain.
- [ ] Hypothetical value is not presented as design feasibility, budget priority, or City commitment.

## Verification

Persist scenario inputs and before/after outputs. Test deterministic replay, alternative comparison, no-benefit cases, missing evidence, and the complete resident-to-planner browser flow.
