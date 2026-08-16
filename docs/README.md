# Happy Path documentation

This folder contains the durable product and system documentation for Happy Path.

## Canonical documents

| Document | Responsibility |
| --- | --- |
| [PRD](PRD.md) | Product goals, scope, phases, requirements, and acceptance criteria |
| [UX](UX.md) | Resident interaction, map behavior, route receipt, and screen states |
| [Data and inference](data-and-inference.md) | Source registry, evidence rules, feature derivation, inference boundary, and validation |
| [Detour](DETOUR.md) | City-planning use case, burden metrics, gap analysis, and intervention simulation |
| [Build](BUILD.md) | Milestones, dependencies, parallel work, and completion gates |
| [Prototypes](PROTOTYPES.md) | What each branch proves, what is reusable, and what should remain isolated |
| [Ideas](ideas/README.md) | Possibilities that are not committed product scope |
| [Tasks](../tasks/README.md) | Current work packages, status, ownership, dependencies, and acceptance criteria |

## Working agreement

1. **The PRD owns product scope.** Do not place live task status or implementation checklists in it.
2. **Companion docs own detail.** UX, data, inference, and Detour details should not be duplicated throughout the PRD.
3. **Task files own execution.** Each work package has one file under `tasks/`; the task board summarizes status and dependencies.
4. **Evidence strength controls product language.** A layer may be visualizable before it is safe to use for routing or planning claims.
5. **Keep the interface simple even when the data platform is broad.** The route is primary; evidence appears when it helps explain or refine the result.
6. **Prototype branches are inputs, not automatic architecture decisions.** Record what is retained or rejected in [PROTOTYPES.md](PROTOTYPES.md).
7. **Update linked artifacts together.** A product-scope change should update the PRD and affected task acceptance criteria in the same pull request.
