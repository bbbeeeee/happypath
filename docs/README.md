# Happy Path documentation

This folder contains the durable product and system documentation for Happy Path.

The current pull request establishes the product contract and delivery plan. Implementation follows later through focused pull requests to `main`.

## Canonical documents

| Document | Responsibility |
| --- | --- |
| [PRD](PRD.md) | Product purpose, P1 scope, geography, requirements, and acceptance criteria |
| [UX and product language](UX.md) | Resident interaction, map behavior, copy, visual hierarchy, demo quality, and screen states |
| [Data and inference](data-and-inference.md) | Source registry, cleaned layer contracts, evidence rules, feature derivation, AI boundary, live-data direction, and validation |
| [Detour](DETOUR.md) | Planning proof, journey burdens, amenity gaps, intervention simulation, and future workflow direction |
| [Build](BUILD.md) | Delivery sequence, shared contracts, quality gates, and implementation workflow |
| [Prototypes](PROTOTYPES.md) | What existing branches prove and how they may be referenced without becoming the implementation base |
| [Ideas](ideas/README.md) | Possibilities that are not committed product scope |
| [Tasks](../tasks/README.md) | End-to-end work packages, status, dependencies, and acceptance criteria |

## Working agreement

1. **The PRD owns product scope.** Do not place live task status or engineering checklists in it.
2. **UX owns the resident experience and voice.** Primary screens should feel friendly, polished, and free of implementation jargon.
3. **Data and inference own truth boundaries.** A layer may be shown before it is safe to use for routing or planning claims.
4. **Detour reuses the resident city model.** Do not create a separate planning-only ingestion stack.
5. **Task files own execution.** The task board summarizes status and dependencies.
6. **Build broadly, show selectively.** The data platform can be thorough while the visible route remains simple.
7. **Real data, curated delivery.** Cropping, cleaning, caching, and preparing strong demos are encouraged; fabricated route benefits are not.
8. **Prototype branches are references.** No existing branch is the designated implementation base, and `bryan` is not part of the current visual direction.
9. **Update linked artifacts together.** A scope or quality-bar change should update the PRD, companion docs, and affected task criteria in the same pull request.