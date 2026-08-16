# Happy Path task board

This folder is the execution source of truth for Happy Path. Work is organized by **product work package**, not by permanent team. Packages are designed so different people or agents can work in parallel and meet through documented contracts.

## Status vocabulary

- `proposed` — drafted but not approved for execution
- `ready` — scoped and available to claim
- `in-progress` — active work
- `blocked` — cannot proceed until a named dependency or decision resolves
- `review` — deliverable exists and needs approval or verification
- `done` — acceptance criteria and verification are complete
- `later` — intentionally outside the current milestone

## Current board

| ID | Work package | Phase | Status | Depends on | Can run in parallel with |
| --- | --- | --- | --- | --- | --- |
| [001](001-product-and-prototype-alignment.md) | Product and prototype alignment | M0 | Review | — | — |
| [002](002-data-platform-and-pilot-audit.md) | Data platform and pilot audit | M1 | Ready | 001 | 003, 004, 005 |
| [003](003-routing-and-route-metrics.md) | Routing and route metrics | M2 | Ready | 001; data fixtures from 002 | 004, 005, 006 |
| [004](004-core-ux-and-map-presentation.md) | Core UX and map presentation | M3 | Ready | 001 | 002, 003, 005 |
| [005](005-ai-trip-brief-and-explanations.md) | AI Trip Brief and explanations | M3 | Ready | 001; fixture contracts | 002, 003, 004 |
| [006](006-civic-data-layers-and-amenities.md) | Civic data layers and amenities | M1–M3 | Ready | 002 | 003, 004, 005 |
| [007](007-integration-quality-and-performance.md) | Integration, quality, and performance | M4 | Blocked | 002–006 | QA can begin early |
| [008](008-demo-deployment-and-submission.md) | Demo, deployment, and submission | M4 | Blocked | 007 | 009 only if core is stable |
| [009](009-detour-planning-extension.md) | Detour planning extension | Later / stretch | Later | 003, 006, stable 007 contracts | May spike without blocking P0 |
| [010](010-civic-assets-and-contributions.md) | Civic Assets & Actions | Later | Later | 006, 009 | — |

## Dependency shape

```text
001 Product alignment
        │
        ├─────────────┬─────────────┬─────────────┐
        ↓             ↓             ↓             ↓
002 Data platform  003 Routing   004 Core UX   005 AI
        │             │             │             │
        └──────┬──────┴──────┬──────┴─────────────┘
               ↓             ↓
       006 Civic layers   shared fixtures
               └──────┬──────┘
                      ↓
             007 Integration and QA
                      ↓
             008 Demo and deployment

009 Detour reuses stable route and layer contracts.
010 Civic Assets & Actions follows Detour and trusted task sources.
```

## How to claim and run work

1. Read the [PRD](../docs/PRD.md), relevant companion docs, and the full work-package file.
2. Set the package owner and status before substantial work begins.
3. Split implementation into independently reviewable pull requests where possible.
4. Record decisions, test evidence, source versions, and blockers in the package file or linked deliverable.
5. Do not broaden scope without updating the PRD and affected acceptance criteria.
6. Update the package front matter and this board in the same pull request when status changes.
7. Mark a package `done` only after its verification section is complete.

## Task boundaries

- The PRD defines **what** the product must do.
- Companion docs define **how the system should behave**.
- Task files define **the work required to get there**.
- Prototype branches provide reusable assets but do not supersede the docs.
- A dataset being available does not make it routing-ready.
- A visual layer being implemented does not make its claim validated.

## Parallel work contract

Parallel work should integrate through these shared schemas:

- `LayerDefinition`
- `TripBrief`
- `RouteCandidate`
- `RouteReceipt`
- `MapPresentation`
- `DetourScenario`

Fixture examples should be committed early so UI, AI, routing, and data work do not block each other unnecessarily.

## Adding or splitting work

Use [TEMPLATE.md](TEMPLATE.md). Create a new work package only when it has:

- a distinct outcome;
- a clear owner or handoff;
- explicit dependencies;
- acceptance criteria that can be verified independently.

Small implementation subtasks should normally remain inside their parent package or become GitHub issues linked from that file, rather than creating dozens of overlapping Markdown files.
