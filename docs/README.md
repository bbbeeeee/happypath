# Happy Path documentation

This folder contains the durable product and system documentation for Happy Path.

The branch contains a working Lower Manhattan preview. The PRD and UX documents define intended behavior; [P1 implementation status](P1_IMPLEMENTATION_STATUS.md) records what the current worktree proves; and the [product and demo audit](PRODUCT_DEMO_AUDIT.md) identifies the highest-value path to a more cohesive resident-to-planner demonstration.

## Canonical documents

| Document | Responsibility |
| --- | --- |
| [PRD](PRD.md) | Product purpose, P1 scope, geography, requirements, and acceptance criteria |
| [UX and product language](UX.md) | Resident interaction, map behavior, copy, visual hierarchy, demo quality, and screen states |
| [Data and inference](data-and-inference.md) | Source registry, cleaned layer contracts, evidence rules, feature derivation, AI boundary, live-data direction, and validation |
| [Detour](DETOUR.md) | Planning proof, journey burdens, amenity gaps, intervention simulation, and future workflow direction |
| [Build](BUILD.md) | Delivery sequence, shared contracts, quality gates, and implementation principles |
| [Deployment](DEPLOYMENT.md) | Production artifact, single-VM service, HTTPS proxy, health checks, rollback, and preview security boundary |
| [Product and demo audit](PRODUCT_DEMO_AUDIT.md) | Current capability audit, cohesion diagnosis, integrated demo narrative, simplification choices, and prioritized roadmap |
| [NYC Open Data layer audit](NYC_OPEN_DATA_LAYER_AUDIT.md) | Ranked next-layer opportunities, source and claim boundaries, integration paths, and phased recommendations |
| [Prototypes](PROTOTYPES.md) | What existing branches prove without making them implementation authority |
| [Ideas](ideas/README.md) | Possibilities that are not committed product scope |
| [Tasks](../tasks/README.md) | End-to-end work packages, status, dependencies, and acceptance criteria |

## Working agreement

1. **The PRD owns product scope.** Do not place live task status or engineering checklists in it.
2. **UX owns the resident experience and voice.** Primary screens should feel friendly, polished, and free of implementation jargon.
3. **Data and inference own truth boundaries.** A layer may be shown before it is safe to use for routing or planning claims.
4. **Detour reuses the resident city model.** Do not create a separate planning-only ingestion stack.
5. **Task files own execution outcomes.** The task board summarizes status and dependencies without prescribing the team’s development workflow.
6. **Build broadly, show selectively.** The data platform can be thorough while the visible route remains simple.
7. **Keep the map complete.** Optional evidence overlays add context; they do not visually erase streets that lack coverage in one dataset.
8. **Real data, curated delivery.** Cropping, cleaning, caching, and preparing strong demos are encouraged; fabricated route benefits are not.
9. **Implementation status is explicit.** `codex/happy-path-p1-mvp` is the active PR preview; historical prototype branches remain references and `bryan` is not part of the current visual direction.
10. **Update linked artifacts together.** A scope or quality-bar change should update the PRD, companion docs, and affected task criteria together.
