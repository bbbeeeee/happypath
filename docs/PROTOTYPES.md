# Happy Path — Prototype Inventory

> Prototype branches are evidence and reusable references. They do not define product scope or the implementation base.

## 1. Current decision

This pull request updates product documentation and project planning only.

After the docs are approved and merged to `main`, implementation should proceed through focused branches and pull requests based on the approved requirements. The team may copy or adapt useful code from an existing prototype, but no prototype branch is designated as the application base.

## 2. `main`

### Role

`main` is the canonical product and planning branch.

After this documentation PR is approved, it should contain:

- the core PRD;
- resident UX and product-language guidance;
- data and inference contracts;
- Detour requirements;
- build sequencing;
- end-to-end work packages.

Implementation should be merged to `main` later through reviewable PRs.

## 3. `codex/happy-path-mvp`

### What it proves

- a cropped Lower Manhattan pedestrian graph;
- address and map endpoint selection;
- fastest-route calculation;
- time-specific projected building shade;
- Shade and Greener route comparison;
- official NYC building, tree, and park ingestion;
- mapped-step exclusion;
- a MapLibre route UI;
- route tests and an initial pilot audit.

### Potentially reusable work

- source-ingestion scripts;
- pilot graph and feature derivations;
- shadow and greenery calculations;
- route tests and sample fixtures;
- selected map and receipt components.

### Important limitations

- geography is smaller than the current Battery-to-59th-Street target;
- fixed A-to-B routing only;
- fixed percentage detour ceiling;
- limited candidate diversity;
- no conversational Trip Brief, loop, wander, or Detour proof;
- validation and payload work remain incomplete.

### Disposition

Keep as a technical reference. During implementation, evaluate individual files and concepts against the approved contracts. Do not merge the branch wholesale and do not let its current architecture narrow the product requirements.

## 4. `bryan`

### What it contains

A vendored `isometric-nyc` rendering and tile-generation project with an isometric pixel-art map, OpenSeaDragon viewer, Python and Three.js generation pipelines, model-inference tooling, and upstream project documentation.

### Disposition

No Happy Path visual concepts or implementation dependencies are being retained from this branch in the current plan.

Keep it isolated as historical experimentation. Do not merge its vendored stack, tasks, docs, tile-host dependencies, or rendering architecture into the Happy Path implementation unless a future explicit decision reopens that question.

## 5. Implementation-start checklist

Before implementation begins:

- [ ] merge the approved documentation PR to `main`;
- [ ] confirm the Manhattan supported area and data-preprocessing strategy;
- [ ] convert the work packages into implementation issues or PR-sized work;
- [ ] define fixture versions for `LayerDefinition`, `TripBrief`, `RouteCandidate`, `RouteReceipt`, `MapPresentation`, and `DetourScenario`;
- [ ] audit reusable prototype code file by file;
- [ ] create focused implementation branches from current `main`;
- [ ] preserve relevant attribution and license notices;
- [ ] avoid combining prototype histories or unrelated upstream code.

## 6. Principle

> **Reuse evidence, not assumptions.**

A prototype is valuable when it proves a route, data, or interface idea. The approved docs decide what the product becomes.