# Product and implementation lessons

## 2026-08-16 — Chat, controls, and model routing

- When chat and a dedicated field can both express intent, the explicit field wins. In particular, a populated **To** field must override a destination-free model classification while retaining needs such as rest or mapped-step avoidance.
- Enforce semantic invariants after structured model output. A destination journey with no destination is not plannable, so normalize a timed destination-free walk to a wander at the server boundary.
- With OpenRouter `provider.require_parameters: true`, every optional generation parameter can remove otherwise valid providers. Verify the exact selected model live; GPT-5.6 Luna supports the structured schema here but not `temperature`, so the unsupported parameter caused a complete model fallback.
- Example prompts are product contracts. Keep rain, loop, wander, and accessibility examples in both the prompt and deterministic regression suite so future copy changes cannot silently change route shape.
- A basemap failure must still leave a convincing, useful route experience. The checked-in fallback needs streets, route evidence, real amenity icons, selection state, and accessible interaction—not a blank placeholder.
- Prompts are not enforcement. Safety- and accessibility-relevant constraints need deterministic reconciliation after model output, even when a strict schema is used.
- Separate sources that computed a fact from sources worth consulting next. A permit or curb-ramp catalog can guide a field audit without becoming evidence for simulated cover or an unsurveyed route.

## 2026-08-16 — Ambient map layers and feedback

- A map overview must react to map scale. Fixed-distance clusters do not become discoverable when the user zooms, so cluster size and record sampling should derive from the live viewport and clusters need an explicit expansion interaction.
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
