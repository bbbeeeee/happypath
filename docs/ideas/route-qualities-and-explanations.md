---
title: Route qualities and explanations
status: promoted
owner: unassigned
last_updated: 2026-08-15
---

# Route qualities and explanations

## Status

The core idea has been promoted into:

- [Footnote PRD](../PRD.md)
- [Core UX specification](../UX.md)
- [Data and inference specification](../data-and-inference.md)

This note remains as historical context rather than active scope.

## Original user value

People may prefer a path that fits their situation or desired experience, even when it is not the default or shortest route.

The original route qualities included:

- quieter;
- scenic;
- shadier;
- likely rain cover;
- accessible or lower effort;
- green;
- less pedestrian traffic.

The route should explain why it matches the request and distinguish strong physical evidence from incomplete or qualitative proxies.

## Product decisions now made

- The route is the primary output.
- Time-aware estimated shade is the first quantitative proof.
- Greenery remains distinct from shade.
- Mapped-step avoidance is not an accessibility guarantee.
- Noise, traffic, and activity remain expected or experimental unless measured directly.
- The interface should not expose every quality as a filter.
- AI selects supported criteria and explains evidence; deterministic systems calculate routes and physical metrics.
- Additional city layers enter through a shared registry and validation gate.
- The same route features can support Detour planning analysis.

## Remaining research questions

- Which amenity or friction feature should become the third validated route capability?
- Which incomplete layers are still valuable for visualization or Detour before routing?
- Which personal or experiential qualities can be supported without pretending the model has universal taste?
