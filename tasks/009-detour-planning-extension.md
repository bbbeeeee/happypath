---
id: "009"
title: Detour planning extension
phase: later
status: later
owner: unassigned
depends_on: ["003", "006", "007-stable-contracts"]
parallel_with: ["008-if-core-stable"]
last_updated: 2026-08-15
---

# 009 — Detour planning extension

## Outcome

The same route and city-layer system produces one credible planning analysis that identifies a repeated journey burden and compares a hypothetical intervention before and after.

## Why this package exists

Detour demonstrates that Happy Path is not only a consumer routing feature. The same public-data model can help the City understand where missing amenities, access, or infrastructure create network-level burdens.

## Inputs and dependencies

- [Detour PRD](../docs/DETOUR.md)
- stable route engine and feature registry;
- Detour-ready layer metrics;
- representative trip anchors;
- validated resident feature such as shade, seating, mapped steps, or restrooms.

## Deliverables

- typed `DetourScenario` contract;
- representative journey set;
- baseline burden calculation;
- gap identification;
- one intervention model;
- before-and-after rerouting;
- map or prepared visualization;
- evidence-linked intervention card;
- assumptions and limitations.

## Work breakdown

- [ ] `009-A` — Choose the first planning lens based on validated resident data.
- [ ] `009-B` — Define representative origins, destinations, and weights.
- [ ] `009-C` — Compute baseline need-aware routes and burden metrics.
- [ ] `009-D` — Identify one specific gap, barrier, or high-impact uncertainty.
- [ ] `009-E` — Define a realistic hypothetical intervention and implementation horizon.
- [ ] `009-F` — Modify the copied network or asset model.
- [ ] `009-G` — Reroute the same representative journeys.
- [ ] `009-H` — Calculate changed, unchanged, improved, and remaining burdens.
- [ ] `009-I` — Test sensitivity to reasonable demand and evidence assumptions.
- [ ] `009-J` — Build the burden, route, scenario, and confidence presentation.
- [ ] `009-K` — Generate an exportable intervention brief.
- [ ] `009-L` — Show at least one low-impact or counterintuitive alternative for comparison.

## Acceptance criteria

- [ ] Every burden derives from actual route results.
- [ ] The representative journey set is inspectable.
- [ ] The same journeys are compared before and after.
- [ ] Changed and unchanged routes are visible.
- [ ] Intervention value is separated from feasibility.
- [ ] Demand assumptions and uncertainty are explicit.
- [ ] App usage is not the sole demand signal.
- [ ] No neighborhood receives a universal quality score.
- [ ] The scenario reuses the Happy Path source and feature contracts.
- [ ] The result can be reproduced from stored source and scenario versions.

## Out of scope

- automated capital budgeting;
- official City recommendations;
- citywide production planning;
- multi-user workflow and approvals;
- unrestricted natural-language planning queries.

## Risks and decisions

- The first scenario should use the best-validated layer, not the most politically ambitious one.
- A map of missing assets is insufficient; the project must show journey consequences.
- A hypothetical intervention must be clearly labeled and cannot imply engineering feasibility.

## Verification

Record scenario inputs, source versions, representative journeys, baseline and intervention metrics, sensitivity results, and screenshots or exported intervention card.

## Handoff

A stable Detour layer can later support city-planning workflow integration and task 010 verification loops.
