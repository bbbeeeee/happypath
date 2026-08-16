---
id: "009"
title: Detour planning proof
phase: M4-P1
status: in-progress
owner: unassigned
depends_on: ["003", "006", "007-stable-contracts"]
parallel_with: ["008"]
last_updated: 2026-08-16
---

# 009 — Detour planning proof

## Outcome

The same route and city-layer system produces one credible planning analysis that identifies a repeated journey burden and compares a hypothetical intervention before and after.

## Why this package exists

Detour completes the civic story. Happy Path helps one person find a better journey; Detour uses the same evidence to show where many journeys are difficult and where a specific City or public-realm intervention might help.

The P1 goal is one polished proof, not a complete planner platform.

## Implemented slice

The current City what-if carries a resident route into a shade scenario, selects a segment, holds route geometry fixed, compares exposure across the route and its alternatives, ranks only bounded intervention candidates, and exposes assumptions and sources. This proves contract reuse and honest counterfactual presentation.

It does not complete this package. The sample is not representative demand, the gap is not shown to repeat across public journeys, routes are not recomputed after the intervention, and no sensitivity or lower-impact comparison exists. Those remaining outcomes are split into tasks 022 and 023.

## Inputs and dependencies

- [Detour PRD](../docs/DETOUR.md)
- stable journey engine and feature registry;
- Detour-ready layer metrics;
- representative trip anchors across the supported Manhattan area;
- one well-validated resident feature such as shade, seating, restrooms, mapped steps, or construction burden.

## Deliverables

- typed `DetourScenario` contract;
- inspectable representative journey set;
- baseline burden calculation;
- one gap, barrier, amenity deficit, or high-impact uncertainty;
- one hypothetical intervention;
- before-and-after rerouting;
- clean planning map or guided visualization;
- friendly evidence-linked intervention card;
- assumptions, limitations, and sensitivity check;
- a short resident-to-planner demo transition.

## Work breakdown

### Choose the proof

- [ ] `009-A` — Compare shade, seating, restroom, mapped-step, and construction scenarios using validation strength, clarity, and visual impact.
- [ ] `009-B` — Choose one scenario that can be explained in under a minute.
- [ ] `009-C` — Define representative origins, destinations, weights, and planning question.

### Calculate the burden

- [ ] `009-D` — Compute baseline need-aware journeys and burden metrics.
- [ ] `009-E` — Identify the specific segment, asset gap, or condition producing repeated burden.
- [ ] `009-F` — Confirm that the finding is more than a raw asset-density or complaint map.

### Test the intervention

- [ ] `009-G` — Define a realistic hypothetical intervention and implementation horizon.
- [ ] `009-H` — Apply it to a copied graph or asset model.
- [ ] `009-I` — Reroute the same representative journeys.
- [ ] `009-J` — Calculate changed, unchanged, improved, and remaining burdens.
- [ ] `009-K` — Test sensitivity to reasonable demand and evidence assumptions.
- [ ] `009-L` — Compare at least one intuitive but lower-impact alternative.

### Present the finding

- [ ] `009-M` — Build a clean burden, route, and before-and-after visualization.
- [ ] `009-N` — Write an intervention card in plain planning language.
- [ ] `009-O` — Show source data, confidence, and limitations without dominating the visual.
- [ ] `009-P` — Create the transition from a resident Happy Path route to the repeated planning gap.
- [ ] `009-Q` — Make clear that the intervention is hypothetical and not an official City recommendation.

## Acceptance criteria

- [ ] Every burden derives from actual route results.
- [ ] The representative journey set and weights are inspectable.
- [ ] The same journeys are compared before and after.
- [ ] Changed and unchanged routes are visible.
- [ ] The audience can understand the gap and intervention quickly.
- [ ] Intervention value is separated from feasibility and policy priority.
- [ ] Demand assumptions and uncertainty are explicit.
- [ ] Happy Path usage is not the sole demand signal.
- [ ] No neighborhood receives a universal quality score.
- [ ] The proof reuses the Happy Path source, layer, route, and evidence contracts.
- [ ] Hypothetical conditions are not presented as observed City facts.
- [ ] The result can be reproduced from stored source and scenario versions.
- [ ] The proof is polished enough to appear in the hackathon demo without weakening the resident product.

## Out of scope

- automated capital budgeting;
- official City recommendations;
- citywide production planning;
- multi-user workflow and approvals;
- unrestricted natural-language planning queries;
- full integration with agency planning systems.

## Risks and decisions

- The strongest validated and most legible scenario should win, not the most ambitious policy idea.
- A map of missing assets is insufficient; the proof must show journey consequences.
- The planning view should feel related to Happy Path without copying the resident mobile UI.
- Detour must not endanger the quality or reliability of the resident demo.

## Verification

Record scenario inputs, source versions, representative journeys, baseline and intervention metrics, sensitivity results, screenshots, and the final intervention card. Rehearse the complete resident-to-Detour sequence.

## Handoff

After P1, Detour may expand into interactive scenario exploration, planning-tool integration, and the verification loops described in task 010.
