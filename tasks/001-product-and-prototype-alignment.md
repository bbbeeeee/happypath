---
id: "001"
title: Product and documentation alignment
phase: M0
status: review
owner: unassigned
depends_on: []
parallel_with: []
last_updated: 2026-08-15
---

# 001 — Product and documentation alignment

## Outcome

The project has one coherent product contract, one documentation structure, and one end-to-end work plan ready to merge to `main` before implementation begins.

## Decisions recorded

- Supported geography targets Manhattan from the Battery through Midtown, approximately south of Central Park.
- The delivery target is the P1 resident experience plus one Detour planning proof.
- Destination routing is the technical foundation; Loop and Wander are P1 journeys.
- The product should integrate a broad set of NYC public-data layers while keeping the resident experience simple.
- Real City and open data should support resident route facts wherever practical.
- The demo should feel polished, friendly, and magical rather than like a technical prototype.
- The base map remains visually complete even where individual evidence layers have partial coverage.
- No existing branch, technical stack, or architecture is designated as the implementation base.
- No visual or architectural concepts from `bryan` are retained in the current plan.
- This work updates docs and task planning only.
- Future builders may choose the implementation and collaboration workflow that best satisfies these docs.

## Deliverables

- approved [PRD](../docs/PRD.md);
- approved [UX and product-language guide](../docs/UX.md);
- approved [data and inference specification](../docs/data-and-inference.md);
- approved [Detour PRD](../docs/DETOUR.md);
- approved [build plan](../docs/BUILD.md);
- approved [prototype notes](../docs/PROTOTYPES.md);
- approved task board and work packages;
- documentation merged to `main`.

## Work breakdown

- [x] `001-A` — Audit `main` documentation and task files.
- [x] `001-B` — Audit the purpose and major assets of both prototype branches.
- [x] `001-C` — Consolidate resident product, civic-data platform, and Detour direction.
- [x] `001-D` — Replace stale task scaffolding with end-to-end work packages.
- [x] `001-E` — Set the Manhattan geography target through Midtown.
- [x] `001-F` — Decide that no prototype branch or architecture is the implementation base.
- [x] `001-G` — Decide not to retain `bryan` visual concepts.
- [x] `001-H` — Set P1 as the delivery target and later scope explicitly.
- [x] `001-I` — Keep future implementation workflow intentionally unprescribed.
- [x] `001-J` — Require a full base map even where optional evidence coverage is partial.
- [ ] `001-K` — Complete final product review and requested edits.
- [ ] `001-L` — Merge the documentation to `main`.

## Acceptance criteria

- [ ] The product can be summarized in one clear paragraph.
- [ ] The role of NYC public data is explicit and measurable.
- [ ] The P1 user experience and demo quality bar are clear.
- [ ] The map remains full and legible independent of optional layer coverage.
- [ ] Detour is connected to the same city model and included as one planning proof.
- [ ] Prototype branches are historical references only.
- [ ] No live task depends on superseded requirements.
- [ ] Downstream packages have stable information contracts and clear dependencies.
- [ ] The docs do not unnecessarily prescribe implementation technology or collaboration workflow.
- [ ] The documentation can be merged without application-code changes.

## Out of scope

- application implementation;
- selecting a final technical stack;
- prescribing a branching or issue-management strategy;
- merging prototype branches;
- validating City datasets;
- deploying the demo.

## Verification

Review the full documentation set and PR diff. Confirm that geography, P1 scope, product voice, real-data standard, map completeness, prototype disposition, Detour role, task sequence, and implementation freedom are consistent before merging.

## Handoff

After the docs merge, tasks 002–006 can begin in parallel in whatever execution workflow the future team chooses.