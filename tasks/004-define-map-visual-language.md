---
id: "004"
title: Define map visual language and icon system
status: ready
owner: unassigned
depends_on: ["002"]
last_updated: 2026-08-15
---

# 004 — Define map visual language and icon system

## Goal

Define how Happy Path visually communicates route qualities, amenities, constraints, evidence, and uncertainty on a map without implementing the interface.

The result should make the map answer two questions quickly:

1. **Where does this route go?**
2. **Why is it a better fit for this trip?**

## Context

Happy Path needs to show more than pins and a route line. The map may need to communicate estimated shade, greenery, benches, restrooms, transit endpoints, mapped stairs, route tradeoffs, and personal-fit anchors while remaining legible on a phone.

The visual system must respect the [PRD](../docs/PRD.md) and [data and inference specification](../docs/data-and-inference.md). A symbol cannot imply stronger knowledge than the underlying evidence supports. For example, a restroom record is not proof that it is open now, and mapped-stair avoidance is not an accessibility guarantee.

This is a documentation and design-exploration task only. It does not include map-library selection, UI code, production components, or engineering implementation.

## Visual inventory

The exploration should cover at least these categories:

| Category | Concepts to represent |
| --- | --- |
| Route structure | The Happy Path, direction, origin, destination, loop, and stops |
| Continuous route qualities | Estimated direct sun or shade, greenery, gentler grade, experimental quieter or livelier segments |
| Amenities and endpoints | Bench or seating, restroom, drinking water, transit, park, coffee, food |
| Constraints and friction | Mapped stairs, steep segment, construction or shed evidence, unavailable connection |
| Personal fit | Saved place, taste anchor, remembered preference, route segment chosen for personal relevance |
| Evidence state | Official, derived, inferred, observed, unknown; high, medium, or low confidence |
| Operational state | Available, unavailable, published-hours only, unverified, or stale |
| Preference state | Preferred, required, avoided, prefilled from saved preferences, explicitly selected for this trip |

The visual system should distinguish:

- continuous conditions from point amenities;
- measured or derived evidence from inference;
- route benefits from warnings or hard constraints;
- absence of a feature from absence of data;
- current trip input from a remembered preference.

## Confirmed direction

### Default map

- Show one recommended Happy Path rather than drawing the fastest baseline or alternatives on the default map.
- Render estimated shade as an ambient map layer. The route line must remain visually dominant above it.
- Show significant evidence relevant to the current request. Because route-level data density should usually be modest, multiple useful layers may remain visible together when they do not compete.
- Use icons for discrete, location-specific things such as benches, restrooms, water, transit entrances, mapped stairs, and selected anchors.
- Use optional toggles for secondary evidence. Do not make the user configure a large layer panel before the first result.
- Move overlapping, lower-priority, or explanatory detail into the route receipt or detail sheet unless the user enables its layer.

### Amenity visibility

Show an amenity by default when it:

1. is a selected stop or endpoint;
2. satisfies a stated need or requirement;
3. materially explains why the route was selected; or
4. is significant enough to affect the current decision.

Nearby amenities that do not affect the plan belong in a toggle or the detail sheet. Tapping a visible amenity should connect its map icon to the same information in the route detail.

### Display-priority contract

Use a hybrid decision model:

- intelligence or route policy proposes what is semantically relevant;
- deterministic map layout handles collision, density, and available screen space;
- the explanation layer receives anything relevant that the map cannot show clearly.

The display order is:

1. the Happy Path itself;
2. required amenities, selected stops, and endpoint conditions;
3. evidence that materially affected route selection;
4. other significant evidence requested by the user;
5. optional context, moved to toggles or explanation when space is limited.

A future presentation payload may use this shape:

```yaml
ambient_layers: [shade]
active_evidence_layers: []
route_icons: []
optional_toggles: []
explanation_only: []
```

This payload communicates semantic priority, not pixel placement. It cannot suppress a warning or required stop merely to make the map cleaner.

### Evidence and accessibility

- Highlight stale, incomplete, or unverified evidence in the explanation and amenity detail rather than covering the map in status badges.
- Use a subtle map-level stale or uncertain state only when it changes the immediate route decision.
- Maintain reasonable contrast between the basemap, ambient layers, route, and icons.
- Reinforce critical distinctions with shape, outline, label, or line style where practical. Full grayscale equivalence is not required for the hackathon exploration.

### Generated icons and SVGs

The exploration should generate a small, coherent SVG concept set for discrete map objects. Start with bench, restroom, water, transit, park, mapped stairs, selected stop, and stale or uncertain evidence.

Use a shared grid, stroke system, corner language, and optical-size review. Test icons at 16, 20, and 24 pixels. Generated icons remain exploratory until their geometry, naming, licensing, contrast, and small-size legibility are reviewed.

## Remaining design work

### Map treatment

- Which ambient-shade treatment stays readable across light and dark basemap areas?
- Should other continuous evidence use ambient layers, route-segment treatments, or both?
- What collision fallback works best for the small number of icons likely to overlap: hide, stack, offset, or summarize?
- How should toggles communicate that additional evidence exists without becoming a filter panel?

### Icon system

- Should the generated SVGs extend an existing licensed visual family or define a small custom Happy Path family?
- What exact grid, stroke weight, corner style, and filled-versus-outline rules work at small map sizes?
- Which icons require state variants such as available, uncertain, closed, selected, or required?
- How will related concepts—tree, greenery, park, shade, and direct-sun exposure—remain visually distinct?
- What licensing, attribution, or redistribution rules apply to any adopted icon source?

### Information hierarchy

- What significance threshold earns a default map appearance?
- How many simultaneous symbols or layers can the mobile map support before collision handling or progressive disclosure is required?
- Which toggles are essential for the hackathon demo, if any?

## Deliverable

Create `docs/ideas/map-visual-language.md` containing:

1. a visual inventory and semantic rules;
2. two or three treatments within the confirmed ambient-layer and discrete-icon model;
3. an icon and marker matrix with required states;
4. route-line, segment, overlay, and comparison rules;
5. a compact legend concept;
6. accessibility, confidence, and provenance behavior;
7. an icon-source strategy with licensing notes;
8. a request-driven display-priority specification and collision fallback;
9. a small generated SVG icon concept set;
10. one recommended direction for the MVP and the reasons it wins;
11. a short list of decisions that should be promoted to the PRD later.

Exploratory images and SVGs may be saved under `docs/ideas/assets/map-visual-language/` and embedded in the note.

## Using Codex for visual exploration

Codex can generate exploratory image assets for this task, including:

- icon concept sheets;
- map legend variations;
- route-overlay treatments;
- visual-direction boards;
- annotated interface concepts.

Generated raster concepts should be treated as design exploration, not automatically as production icons. Codex can generate or help author SVG concepts, but a final reusable icon system still requires small-size, alignment, stroke, licensing, and accessibility review.

## Acceptance criteria

- [ ] Every MVP route quality, amenity, constraint, and evidence state has a proposed visual treatment.
- [ ] The default map shows one visually dominant Happy Path rather than competing route alternatives.
- [ ] Estimated shade is demonstrated as an ambient layer that does not obscure the route.
- [ ] Unknown, stale, or unsupported evidence cannot be mistaken for a confirmed condition.
- [ ] Shade and greenery are visually and semantically distinct.
- [ ] Bench, restroom, water, transit, and park symbols have documented normal and uncertain states.
- [ ] Amenity visibility follows the selected-stop, stated-need, route-reason, or significance rule.
- [ ] The display-priority contract keeps request-relevant evidence visible and moves collisions or secondary detail to toggles or explanation.
- [ ] The system remains legible at representative mobile map and icon sizes.
- [ ] At least two treatments within the confirmed direction are compared using the same criteria.
- [ ] The recommended direction identifies what is visible by default and what appears after interaction.
- [ ] The exploratory SVG set uses a coherent grid and remains legible at 16, 20, and 24 pixels.
- [ ] Any external icon or visual source includes license and attribution notes.
- [ ] No visual treatment makes a claim stronger than the data and inference specification permits.
- [ ] The output remains documentation and design exploration; no application code is added.

## Notes

Start with the smallest hackathon legend that can explain the hero route. Treat the full inventory as a system to grow into, not a requirement to show every layer simultaneously.

## Verification

Compare the completed note against PRD sections 5 and 8 and data-spec sections 5–8. Review the recommended direction for reasonable contrast, representative color-vision conditions, layer collisions, and small mobile-map scale. Full grayscale equivalence is not a completion requirement. Record any unresolved data or licensing dependency before marking the task `done`.
