# Happy Path task board

This folder is the execution plan for Happy Path. Work is organized by **product work package**, not permanent team. Packages may be owned by people or agents and are designed to proceed in parallel through shared contracts.

The task plan defines outcomes, dependencies, and verification. It intentionally does not prescribe a branching strategy, issue structure, or development workflow for the future implementation team.

## Status vocabulary

- `proposed` — drafted but not approved
- `ready` — scoped and available to claim
- `in-progress` — active work
- `blocked` — waiting on a named dependency or decision
- `review` — deliverable exists and needs approval
- `done` — acceptance criteria and verification are complete
- `later` — outside the current P1 delivery target

## Current board

| ID | Work package | Milestone | Status | Depends on | Parallel work |
| --- | --- | --- | --- | --- | --- |
| [001](001-product-and-prototype-alignment.md) | Product and documentation alignment | M0 | Review | — | — |
| [002](002-data-platform-and-pilot-audit.md) | Manhattan data platform and audit | M1 | Ready after 001 | 001 | 003, 004, 005 |
| [003](003-routing-and-route-metrics.md) | Destination, loop, wander, and route metrics | M2 | Ready after contracts | 001; fixtures from 002 | 004, 005, 006 |
| [004](004-core-ux-and-map-presentation.md) | Core UX, map presentation, and product copy | M3 | Ready after 001 | 001 | 002, 003, 005 |
| [005](005-ai-trip-brief-and-explanations.md) | AI Trip Brief, refinement, and explanations | M3 | Ready after fixtures | 001; shared fixtures | 002, 003, 004 |
| [006](006-civic-data-layers-and-amenities.md) | Civic data layers and amenities | M1–M3 | Ready after 002 contract | 002 | 003, 004, 005 |
| [007](007-integration-quality-and-performance.md) | Integration, quality, performance, and polish | M4 | Blocked | 002–006 | QA begins early |
| [008](008-demo-deployment-and-submission.md) | Magical demo, deployment, and submission | M4 | Blocked | 007 | 009 when contracts stabilize |
| [009](009-detour-planning-extension.md) | Detour planning proof | M4 / P1 | Planned | stable 003, 006, 007 contracts | May begin as a data spike |
| [010](010-civic-assets-and-contributions.md) | Civic Assets & Actions | Later | Later | 006, 009 | — |
| [011](011-route-intelligence-data-and-polish.md) | Route intelligence, city evidence, and product polish | M4 / P1 | Done | 003, 005, 006, 009 | Verified resident and planner integration |
| [012](012-civic-data-checks.md) | Optional civic data checks and extensible map layer | M1 / P1 | Done | 006, 010, 011 | — |
| [013](013-vm-deployment-readiness.md) | Single-VM deployment readiness | M4 | Done | 007, 008 | — |

## Dependency shape

```text
001 Approve docs and plan
        │
        ├─────────────┬─────────────┬─────────────┐
        ↓             ↓             ↓             ↓
002 Data platform  003 Routing   004 Product UX  005 AI and copy
        │             │             │             │
        └──────┬──────┴──────┬──────┴─────────────┘
               ↓             ↓
       006 Civic layers   shared fixtures
               └──────┬──────┘
                      ↓
             007 Integration and polish
                      ↓
             008 Demo and deployment
                      ↘
                       009 Detour proof

010 Civic Assets & Actions follows the resident and planning foundations.
```

## Work philosophy

### Build the system broadly, show it selectively

The data platform can support many layers. The UI should surface only what makes the current walk more useful or understandable.

### Make it feel real

Use actual City and open data for route facts whenever practical. Clean, cache, crop, and curate the data so the product feels fast and coherent.

### Make it feel magical

The interaction should be simple, friendly, responsive, and polished. Technical complexity belongs behind the product experience.

### Keep the map complete

Optional evidence layers add to the map; they do not replace it. Streets without coverage in one dataset should remain ordinary, legible streets rather than blank or dimmed areas.

### Do not confuse completeness with quality

It is better to support a smaller Manhattan area and several excellent journeys than expose broad, unreliable coverage.

## How to run work

1. Read the [PRD](../docs/PRD.md), [UX guide](../docs/UX.md), relevant companion docs, and the work-package file.
2. Establish ownership and current status before substantial work begins.
3. Break large packages into independently verifiable implementation slices in whatever workflow the team chooses.
4. Record decisions, test evidence, source versions, copy decisions, and blockers.
5. Do not broaden scope without updating the PRD and affected acceptance criteria.
6. Keep resident-facing copy friendly and free of unexplained implementation language.
7. Mark a package `done` only after its verification section is complete.

## Task boundaries

- The PRD defines **what and why**.
- UX defines **how the product should feel, speak, and behave**.
- Data and inference define **evidence and system boundaries**.
- Detour defines **the planning extension**.
- Build defines **sequence and integration gates**.
- Task files define **the work required to deliver them**.
- Prototype branches are historical references, not implementation authority.

## Parallel-work contract

Parallel work meets through equivalent forms of:

- `LayerDefinition`
- `TripBrief`
- `RouteCandidate`
- `RouteReceipt`
- `MapPresentation`
- `DetourScenario`

Create realistic fixtures early so UI, AI, routing, and data work can proceed without waiting for full integration. The names describe information contracts, not required technologies or code structures.

## Adding or splitting work

Use [TEMPLATE.md](TEMPLATE.md) when useful. Create a new top-level package only when it has:

- a distinct outcome;
- clear dependencies;
- an independent verification path;
- a meaningful handoff.

Smaller implementation work should remain grouped under the relevant package unless the future team has a better execution structure.
