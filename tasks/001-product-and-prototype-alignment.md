---
id: "001"
title: Product and prototype alignment
phase: M0
status: review
owner: unassigned
depends_on: []
parallel_with: []
last_updated: 2026-08-15
---

# 001 — Product and prototype alignment

## Outcome

The project has one approved product contract, one documented prototype disposition, and a clean execution plan that downstream work can follow without inventing scope.

## Why this package exists

The repository currently contains a broad product PRD and two materially different prototype branches. Before implementation is combined, the team needs to agree on the resident P0, the city-data platform, the role of Detour, and which prototype assets are retained.

## Inputs and dependencies

- [Product requirements](../docs/PRD.md)
- [Core UX](../docs/UX.md)
- [Data and inference](../docs/data-and-inference.md)
- [Detour](../docs/DETOUR.md)
- [Prototype inventory](../docs/PROTOTYPES.md)
- `codex/happy-path-mvp`
- `bryan`

## Deliverables

- approved canonical docs;
- confirmed P0 and deferred scope;
- confirmed pilot boundary;
- selected implementation base;
- list of exact reusable prototype files or systems;
- branch-integration strategy;
- updated task board.

## Work breakdown

- [x] `001-A` — Audit `main` documentation and task files.
- [x] `001-B` — Audit the purpose and major assets of both prototype branches.
- [x] `001-C` — Consolidate resident product, city-data platform, and Detour direction.
- [x] `001-D` — Replace stale task scaffolding with end-to-end work packages.
- [ ] `001-E` — Confirm or revise the Lower Manhattan pilot.
- [ ] `001-F` — Confirm `codex/happy-path-mvp` as the implementation base.
- [ ] `001-G` — Decide whether selected visual concepts from `bryan` should be retained.
- [ ] `001-H` — Approve P0, stretch, P1, and later boundaries.
- [ ] `001-I` — Create the implementation-integration branch or pull-request sequence.

## Acceptance criteria

- [ ] The team can state the P0 resident experience in one paragraph.
- [ ] The role of NYC public data is explicit and measurable.
- [ ] Detour is connected architecturally but cannot block the resident proof.
- [ ] Every prototype branch has a retain, extract, archive, or reject disposition.
- [ ] No live task depends on superseded requirements.
- [ ] Downstream packages have stable shared contracts to target.

## Out of scope

- implementation changes;
- merging prototype branches;
- data validation;
- final visual design.

## Risks and decisions

- Expanding P0 to every desired route mode would make the project difficult to integrate and validate.
- Treating either prototype as automatically canonical would bypass product and evidence decisions.

## Verification

Approval should be recorded in the documentation pull request. Any requested changes must update the PRD and affected work-package acceptance criteria before this package is marked `done`.

## Handoff

Packages 002–006 may proceed in parallel once the product contract and implementation base are approved.
