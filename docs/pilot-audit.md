# Lower Manhattan pilot audit

Status: **in progress**. Source validation remains pending until visual sampling and feature-derivation checks are complete.

## Boundary

The current crop is `40.726,-74.006,40.736,-73.988`, covering a compact Lower Manhattan area with many alternate walking paths.

## Pedestrian graph

- Source: cropped OpenStreetMap snapshot, with ODbL attribution.
- 2,794 nodes and 4,487 derived edges in the largest connected component.
- 99.4% of derived edges belong to that component.
- Ways tagged `access=no`, `access=private`, `foot=no`, or `foot=private` are excluded.
- The app now exposes “Avoid mapped steps” as a hard exclusion across 35 tagged edges. This remains a mapped-data claim, not an accessibility claim.
- Turn restrictions and the completeness of crossings/access tags still require review.

## Buildings

- Source: NYC BUILDING dataset `5zhs-2jue` through the Socrata API.
- 2,681 cropped building footprints.
- 100% contain a positive, non-anomalous `HEIGHT_ROOF` value in this snapshot.
- Heights are stored in source feet and must be converted by the shadow derivation.
- Geometry, height distributions, and at least 20 sampled blocks still require visual review.

## Greener

- Sources: NYC Forestry Tree Points `hn5i-inap` and Parks Properties `enfh-gkve`.
- The pilot contains 4,239 official tree points and 22 park-property polygons.
- Every graph edge receives an evidence record; 85.5% have positive tree or park adjacency.
- Route receipts count unique tree IDs rather than summing edge matches.
- Greener remains separate from building shade and does not claim canopy, current tree condition, park access, or cooling.
- Visual sampling and route-distinctness review remain pending.

## Current claim boundary

The app may state that it uses mapped pedestrian geometry. It may not call the graph legally complete, accessible, or guaranteed step-free. Shade remains modeled demo evidence and cannot yet be presented as validated building shade.

## Next gate

The pipeline now calculates deterministic solar position, projects building footprints by roof height, and samples all 4,487 graph edges every eight meters for 13 hourly positions on August 15. Computed edge coverage is 100%.

The remaining gate is validation: review at least 20 blocks at morning, noon, and afternoon; examine concave-building overstatement; and compare the solar approximation with an accepted SPA implementation. Until then the result is labeled derived but `validation_status` remains `pending`.
