# Happy Path — Prototype Inventory

> Prototype branches are evidence and reusable assets. They do not define product scope by themselves.

## 1. `main`

### What it contains

- product documentation;
- data and inference source registry;
- idea workspace;
- docs-first task management.

### Role

`main` remains the decision branch until the consolidated documentation and implementation plan are approved.

### Disposition

Keep as the canonical documentation base. Merge implementation intentionally after reviewing the prototype branches.

## 2. `codex/happy-path-mvp`

### What it proves

- cropped Lower Manhattan OpenStreetMap pedestrian graph;
- address and map endpoint selection;
- fastest-route calculation;
- time-specific projected building shade;
- Shade and Greener route comparison;
- official NYC building, tree, and park ingestion;
- mapped-step exclusion;
- MapLibre resident interface;
- route receipt and initial evidence language;
- tests and a pilot audit.

### Current strengths

- closest implementation to the approved resident product;
- replaceable graph and data-ingestion boundary;
- useful preprocessing scripts and committed pilot fixtures;
- deterministic routing and route metrics;
- explicit validation-pending language.

### Current gaps

- fixed 25% detour ceiling rather than explicit minute budgets;
- limited candidate diversity and no benefit frontier;
- no natural-language Trip Brief or refinement;
- limited layer presentation and amenity integration;
- no Detour scenario;
- validation of shade, crossings, and route distinctness remains incomplete;
- large committed data payloads need performance review.

### Recommended disposition

Use as the implementation base after a focused technical review. Preserve reusable data pipelines, graph, route logic, tests, and map UI where they satisfy the consolidated contracts. Do not rewrite the stack merely to match an earlier architecture proposal.

## 3. `bryan`

### What it contains

A large vendored `isometric-nyc` rendering and tile-generation project, including:

- isometric pixel-art city map;
- OpenSeaDragon viewer;
- Python and Three.js tile-generation pipelines;
- model-inference tooling;
- upstream task history and pipeline documentation.

### What it may contribute

- aesthetic direction;
- visual storytelling references;
- map-layer and city-character ideas;
- selected screenshots or presentation concepts.

### Risks

- architecture is centered on rendered image tiles rather than dynamic pedestrian routing;
- substantial upstream code and documentation are unrelated to Happy Path;
- tile hosting and proxy behavior create deployment dependencies;
- merging wholesale would obscure the core routing product and task structure.

### Recommended disposition

Keep isolated as a visual experiment. Extract design references into the UX or an idea note. Do not use it as the application base and do not merge the vendored stack wholesale.

## 4. Reconciliation checklist

Before implementation moves to `main`:

- [ ] approve the consolidated PRD;
- [ ] verify the Lower Manhattan pilot remains the right boundary;
- [ ] compare prototype contracts with the new Trip Brief, layer, route, receipt, and map-presentation schemas;
- [ ] identify exact files to retain from `codex/happy-path-mvp`;
- [ ] record code or data that requires attribution or license notices;
- [ ] archive or document rejected approaches;
- [ ] create an integration branch rather than merging both prototypes together;
- [ ] run route, build, and payload checks after integration.
