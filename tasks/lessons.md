# Product and implementation lessons

## 2026-08-16 — Verify rendered map pixels and dependent resources

- A map canvas, attribution, and controls only prove that the shell mounted. For WebGL maps, production verification must include a screenshot with rendered geography plus successful worker, glyph, and tile requests; a development-server check does not catch missing production worker assets.

## 2026-08-16 — Direct manipulation should feel direct

- For familiar map interactions, prefer clear hover, active, and cursor states over persistent explanatory copy. If focusing a location field arms the next map click, make that state visually obvious and let the interaction teach itself.

## 2026-08-16 — Verify transport provenance, not just dataset branding

- A public ArcGIS service can reproduce official-looking NYC data without being an official publisher. Before registering a source as official, verify the service item owner and organization, preserve the canonical NYC dataset separately from its transport endpoint, and reject unaffiliated mirrors even when their schemas are convenient.

## 2026-08-16 — Chat, controls, and model routing

- When chat and a dedicated field can both express intent, the explicit field wins. In particular, a populated **To** field must override a destination-free model classification while retaining needs such as rest or mapped-step avoidance.
- Enforce semantic invariants after structured model output. A destination journey with no destination is not plannable, so normalize a timed destination-free walk to a wander at the server boundary.
- With OpenRouter `provider.require_parameters: true`, every optional generation parameter can remove otherwise valid providers. Verify the exact selected model live; GPT-5.6 Luna supports the structured schema here but not `temperature`, so the unsupported parameter caused a complete model fallback.
- Example prompts are product contracts. Keep rain, loop, wander, and accessibility examples in both the prompt and deterministic regression suite so future copy changes cannot silently change route shape.
- A basemap failure must still leave a convincing, useful route experience. The checked-in fallback needs streets, route evidence, real amenity icons, selection state, and accessible interaction—not a blank placeholder.
- Prompts are not enforcement. Safety- and accessibility-relevant constraints need deterministic reconciliation after model output, even when a strict schema is used.
- Separate sources that computed a fact from sources worth consulting next. A permit or curb-ramp catalog can guide a field audit without becoming evidence for simulated cover or an unsurveyed route.

## 2026-08-16 — Ambient map layers and feedback

- Progressive disclosure must preserve discoverability. Keep the layer chooser available before a route exists and show one restrained, useful context layer by default; a quiet map should not become an empty map with hidden controls.
- Environmental evidence layers should compose. Use restrained opacity and clear geometry so shade, greenery, cover, and flood can be compared together instead of forcing a mutually exclusive lens.
- Density should change semantic form with scale: use a few neutral aggregate place counts at city scale, reveal category color and icons on zoom, and keep point-record icons out of neighborhood-scale evidence overlays.
- A map overview must react to map scale. Fixed-distance clusters do not become discoverable when the user zooms, so cluster size and record sampling should derive from the live viewport and clusters need an explicit expansion interaction.
- Spatial spread alone does not make a citywide overview feel useful. Budget enough viewport-balanced records to survive the side sheet and label collision, then reduce the sample at neighborhood scale so added context does not become clutter.
- Climate, place, and civic layers are context, not mutually exclusive destinations. Keep the route as the stable base and model supporting layers as independent toggles; reserve a separate focused state only for explanatory copy.
- Natural example copy is part of the parser surface. Phrases such as “half an hour” need deterministic fallback coverage before they appear in the UI.
- Loading polish should expose truthful activity, preserve the previous successful route during refinements, and retain failed input for an easy retry.

## 2026-08-16 — Distance as intent

- A stated distance is a primary route constraint, not descriptive prose. Explicit distance should replace time, explicit minutes should replace distance, and ordinary refinements must retain whichever constraint is active.
- Keep user-unit parsing and conversion deterministic. The language model can identify intent, but route geometry—not model arithmetic—must determine whether the result is near the requested distance.
- A running request does not establish a trustworthy running pace. Target the mapped distance, label the activity naturally, and preserve the pedestrian-graph duration as an internal estimate.
- Distance parsing needs context and bounds: do not confuse amenity search radii with route length, accept only positive values, and prevent fallback mode from creating impractically large searches.

## 2026-08-16 — Delightful copy with honest boundaries

- Lead with the resident outcome, not the implementation. “More shade along the way” belongs in the route summary; model inputs and source provenance belong one level deeper.
- Honest limitations do not need warning-card visual weight. Keep a legible, always-visible summary and let people expand the detail when it matters.
- Use natural evidence language such as “based on the sun and nearby buildings.” Reserve terms such as “synthetic,” “inventory,” and “simulation” for linked source detail where they add precision.
- Deep data panels should still feel like product copy: say what shaped the path, when a source was refreshed, and what may have changed.

## 2026-08-16 — Map layers at multiple scales

- A cluster disk and its count are one visual object even when the map renderer uses separate layers. Force the count to share the disk’s placement behavior so label collision can never leave an empty ring.
- Detailed evidence needs an intentional viewing scale. A cropped pilot snapshot that works block by block looks like a broken tile at island scale; hide or fade the raw geometry there while keeping route-level evidence and a clear zoom cue.
- Expanding a visualization is not the same as expanding evidence. Scale citywide shade through partitioned data and routing coverage rather than stretching or implying detail beyond the supported area.

## 2026-08-16 — Product cohesion and planning insight

- More proof points do not create a more magical demo when they compete on the opening screen. Make one query-to-path loop unmistakable and reveal secondary capabilities only when the story calls for them.
- Footnote and Detour should feel causal: a resident route reveals a burden, then the same segment, need, evidence, and route metric become a question across representative journeys.
- A planner needs journey consequences, not asset counts. Lead with exposed minutes, longest continuity gaps, deviation, affected journeys, and remaining burden; keep inventory density as supporting context.
- Every visible example prompt is an executable product promise. Each meaningful phrase must control a typed field or deterministic behavior, or appear as an explicit limitation.
- One route and its alternatives do not establish population need. Use transparent public-anchor cohorts for the planning proof and keep individual Footnote usage out of it.

## 2026-08-16 — Curated examples are complete journeys

- A shortcut cannot be prompt copy alone. Pin a considered origin, destination when relevant, time or distance intent, and any required data partition so the same click reliably produces a representative map.
- Audit the visible result, not only parser fields: destination span, closed-loop quality, transit arrival, mapped cover, civic-task selection, and distance tolerance are the promises people actually experience.
- Curated examples should avoid decorative constraints. A fixed-destination walk does not use a total walking-time budget, so describe the allowed detour instead of implying that it does.

## 2026-08-16 — Routing identifiers are not place names

- Internal graph labels such as OSM node IDs must never cross the product-copy boundary. Resolve generated and dragged endpoints through one shared human-label formatter that prefers a nearby landmark or intersection and has a neutral fallback.
- Fix presentation leaks at every state transition—default values, examples, endpoint drags, and route-edit feedback—not as one-off copy on the opening screen.

## 2026-08-16 — New UI must be verified with its real styles

- Ship new markup and its scoped responsive styles as one unit. Before exposing a preview, exercise the actual resident and planner flows at desktop and mobile widths so intrinsic SVG sizing and browser-default button, fieldset, or textarea styles cannot leak into the product.
- Add a bounded layout check alongside screenshots: the document and primary sheet should match the viewport width, controls must remain within it, and inline icons should retain their intended dimensions.

## 2026-08-16 — Reserve map corners by control family

- Keep persistent navigation controls together near the map edge and leave data-layer controls near their content context. Before raising a panel to avoid a collision, check whether the smaller native control can move to a clearer corner instead.

## 2026-08-16 — Defaults should demonstrate the map's value

- When the product's value comes from comparing environmental context, enable the restrained continuous layers by default and keep the amenity layer discoverable. Use scale-aware detail and clustering to control density instead of hiding the useful data at first load.

## 2026-08-16 — Layer breadth needs progressive disclosure

- When adding more human-context signals, keep them in the established bottom-right layer control, group related choices, and reveal secondary toggles on demand. Do not answer a broader data model with more permanent panels or a taller always-open menu.

## 2026-08-16 — Data copy should lead with resident utility

- On public data pages, name the human need first—accessibility, safety context, shade and comfort, greenery and enjoyment, amenities, or transit—then explain the source or method. Keep audit vocabulary in expandable provenance instead of primary headings and descriptions.
- On the primary planning screen, lead with the experience and agency the product enables; keep form mechanics in short supporting copy.

## 2026-08-16 — Endpoint fields are user authority

- Defaults must be real, connected routing anchors while retaining the canonical place name people recognize; bootstrap enough local graph data for the first render and load the broader route network on demand.
- Demo shortcuts add route intent, but they must preserve populated **From** and **To** fields. When a prompt names a curated destination, reflect the selected destination in that prompt instead of displaying conflicting instructions.
- Autocomplete is an optional aid, not a gate. Keep free-text submission working, debounce lookups, support keyboard selection, and retain the chosen result’s snapped node so planning does not geocode it a second time.

## 2026-08-16 — Logo sketches should stay literal

- When the requested brand mark is a simple geometric sketch, preserve its primitive silhouette first. Do not add extra footprint pads, decorative geometry, or visual metaphors before the basic shape has been accepted.
- When the user chooses a typographic wordmark instead, remove the rejected mark and its assets completely. Use native text semantics—such as a real superscript—rather than recreating typography as SVG.

## 2026-08-16 — Treat an active rename as the working baseline

- Before isolating or reverting concurrent copy and asset changes, check whether they represent an approved product rename. New pages, API identifiers, accessibility labels, generated-data user agents, and documentation should use the active brand consistently while repository URLs may remain unchanged.
