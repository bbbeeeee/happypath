---
id: "025"
title: Expanded-area integration gate
phase: P0
status: done
owner: codex
builds_on: ["002", "007", "017", "018"]
last_updated: 2026-08-16
---

# 025 — Expanded-area integration gate

## Outcome

The Battery-to-60th-Street generated data behaves as one internally consistent, bounded, performant product baseline before additional demo work builds on it.

## Why this gates the roadmap

The expansion initially exposed data-contract, route-fixture, test-discovery, performance, and payload regressions. This gate records the shared-boundary, generated-snapshot, partition-loading, and verification work that resolved them before later demo work builds on the larger area.

## Work

- [x] Reconcile cover metadata, graph tags, source-registry counts, POPS/context records, and checked-in snapshots from one generation run.
- [x] Remap or replace stale saved node IDs used by end conditions, representative journeys, civic checks, and transit endpoints.
- [x] Make representative examples deterministic and bounded in duration, map span, and test runtime across the expanded graph.
- [x] Replace spread-based extrema checks with reductions that remain safe for full-area fixtures.
- [x] Keep Node TAP helpers outside Vitest discovery or convert them to the repository test runner.
- [x] Remove temporary diagnostic artifacts once their regression is captured in permanent tests.
- [x] Restore true partition loading; eliminate modules that are both statically and dynamically imported.
- [x] Enforce the 850 KB gzip initial-JavaScript and 310 KB selected-hour shade budgets in automation.
- [x] Run the full test, build, production smoke, and clean-session browser checks from a stable generated snapshot.

## Acceptance criteria

- [x] All generated counts and IDs agree across metadata, graph partitions, registries, route fixtures, and tests.
- [x] No representative route references an unknown node or times out under the normal test limit.
- [x] The complete suite passes with no test-discovery collisions or temporary repro files.
- [x] Initial JavaScript and the selected-hour shade payload stay within the documented preview guardrails.
- [x] Loading one supported area does not eagerly include every graph, greenery, or shade partition.
- [x] `npm run build` and `npm run deploy:check` pass from the same artifact tested by the suite.

## Verification

Retain the generation command and source versions, graph/registry/count reconciliation report, route-fixture results, bundle manifest with gzip sizes, full test output, production smoke output, and one clean browser run for each supported area.

## Review

Completed on the existing `codex/happy-path-p1-mvp` worktree on August 16, 2026.

- `npm run data:refresh` is the reproducible full generation sequence. The checked-in snapshot uses `manhattan-south-of-60th-v1`, one polygon-clipped boundary, and six horizontal routing/evidence partitions.
- The graph contains 38,932 nodes and 60,501 edges with a 99.1% largest-component share. A Battery-to-59th regression route exceeds 5 km, remains inside the polygon, and passes through the dynamically loaded partitions.
- The snapshot includes 20,989 buildings, 43,462 tree points, 190 park properties, 1,286 civic assets, 408 explicit mapped-cover edges, 1,589 shed-permit locations, 91 POPS arcade records, and 296 construction lines.
- `npm test` passed 32 files and 193 tests; `node --test scripts/lib/supported-area.node-test.mjs` passed 2 tests.
- `npm run deploy:check` passed. The enforced measurements are 746.75 KiB gzip for initial JavaScript and 281.83 KiB gzip for the largest hourly shade tile.
- A clean browser session rendered the expanded map, planned the built-in northbound wander, loaded the route and nearby evidence, and reported no console warnings or errors.
