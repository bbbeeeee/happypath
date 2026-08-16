# Happy Path — Prototype Notes

> Existing prototype branches are historical references and evidence. They do not define product scope, architecture, implementation workflow, or the future build.

## 1. Current decision

This work establishes the product requirements and execution plan.

Future builders should use the approved docs as the source of truth and may choose whatever technical approach best satisfies them. No existing prototype branch is designated as the implementation base, and no prototype-specific branch strategy is required.

## 2. `main`

`main` is the canonical repository branch for the approved product documentation and future integrated work.

## 3. `codex/happy-path-mvp`

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

## 4. `bryan`

This branch contains a vendored `isometric-nyc` rendering and tile-generation project.

No Happy Path visual or architectural concepts from this branch are part of the current plan.

Keep it as historical experimentation only unless a future product decision explicitly changes that.

## 5. Principle

> **The docs define the product. Prototypes only show what has been tried.**

Future implementation should be evaluated against the PRD, UX, data, Detour, build, and task documents rather than against any existing branch.