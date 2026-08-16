# Happy Path — Prototype Notes

> Existing prototype branches are historical references and evidence. They do not define product scope, architecture, implementation workflow, or the future build.

## 1. Current decision

`codex/happy-path-p1-mvp` is the active PR #3 preview implementation. The PRD and companion docs remain product authority; [P1 implementation status](P1_IMPLEMENTATION_STATUS.md) records what this branch actually proves and [Product and demo audit](PRODUCT_DEMO_AUDIT.md) records the next cohesion work.

Earlier branches remain historical references. They do not override current product scope or make their implementation patterns mandatory.

## 2. `main`

`main` is the canonical repository branch for the approved product documentation and future integrated work.

## 3. `codex/happy-path-p1-mvp`

This branch contains the current Lower Manhattan preview: resident route planning, editable Trip Brief, destination/loop/wander and distance behavior, route evidence and refinement, civic checks, City what-if, tests, and deployable preview packaging.

Its supported geography and planner proof remain narrower than the full P1 target. Treat current behavior as an implementation baseline, not proof that every PRD acceptance criterion is complete.

## 4. `codex/happy-path-mvp`

This branch contains useful historical experiments, including:

- a cropped Lower Manhattan pedestrian graph;
- address and map endpoint selection;
- fastest-route calculation;
- time-specific projected building shade;
- Shade and Greener route comparison;
- official NYC building, tree, and park ingestion;
- mapped-step exclusion;
- a MapLibre route UI;
- route tests and an initial pilot audit.

These experiments demonstrate that several core ideas are feasible. Future builders may inspect them for reference, but they are not required to reuse the code, stack, architecture, data layout, or interaction patterns.

## 5. `bryan`

This branch contains a vendored `isometric-nyc` rendering and tile-generation project.

No Happy Path visual or architectural concepts from this branch are part of the current plan.

Keep it as historical experimentation only unless a future product decision explicitly changes that.

## 6. Principle

> **The docs define the product. Prototypes only show what has been tried.**

Implementation should be evaluated against the PRD, UX, data, Detour, build, implementation-status, audit, and task documents rather than against historical branches.
