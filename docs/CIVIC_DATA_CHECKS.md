# Civic data checks proof of concept

Footnote can now treat a small, safe data contribution as part of a walk. The resident may explicitly ask for a route where they can help, or notice one nearby after an ordinary route is complete. Participation is always optional.

## What the demo proves

- A typed Trip Brief can preserve an explicit `verify`, `observe`, or `photo` intent through fallback and OpenRouter interpretation.
- The deterministic router can pass a pre-published check without relaxing time, endpoint, or mapped-step rules. If it cannot, the original useful route still succeeds.
- Official inventory, a partner-authored check, and a resident’s session-only observation remain separate evidence classes.
- A check can target an exact civic asset, stable mapped-cover way, permit candidate, public-space record, or construction record without pretending they are the same kind of evidence.
- City what-if can show discrete ground-truth needs without producing a neighborhood score.
- A photo can be selected locally with purpose and framing guidance. This proof of concept does not upload, persist, or submit the file.

The bundled publisher and nine checks are simulated. Four cover-focused checks ask about one exact OSM or NYC source record; the other five cover seating, restroom, and fountain inventory. None is an NYC request, work order, 311 report, or evidence that a problem exists.

## Core contracts

- `src/data/civicAssets.ts` owns official inventory records and their current-operation boundary.
- `src/data/civicTasks.ts` owns validated task, publisher, expiry, safety, and session-observation contracts.
- `src/data/mapLayerCatalog.ts` declares each layer’s sources, icon token, evidence boundary, default visibility, and routing/planner capabilities.
- `src/planning/civicTaskRouting.ts` resolves a published check against deterministic route candidates. The model never selects coordinates or creates tasks.
- `src/data/source-registry.json` links every displayed layer and underlying inventory to its source or method.

## Safety and privacy boundary

Allowed demo actions are limited to low-risk verification, observation, and focused public-asset photography. Checks must be possible from an ordinary public walking path. They may not ask someone to enter traffic, construction, private space, handle hazards or waste, make a repair, move infrastructure, or perform unsanctioned stewardship.

Responses use fixed options. A session observation stores only a task ID, selected response, timestamp, and expiry in React state. It is not persisted, transmitted, published, or used to change official state. Photo selection stores only the local file name while the panel is open; the image is never read or uploaded.

The cover checks always include “I couldn’t confirm safely.” They ask only about a visible structure, entrance, or signed detour from an ordinary public walking path. A response can identify a record for later steward review, but it cannot create route-cover geometry or establish dryness, access, usable width, structural condition, or continuous coverage. Temporary shed and construction observations expire after 24 hours.

The flood model deliberately creates no resident data check. Footnote must not invite someone toward standing water or ask them to verify flooding during hazardous conditions. Future flood-data partnerships need a remote, agency-directed workflow with explicit safety rules rather than an opportunistic walking task.

Production photo collection would require explicit partner authorization plus consent, EXIF removal, redaction, moderation, retention, deletion, correction, and abuse-handling policies. Production task publishing would also require authenticated publishers and a real City or partner workflow.

## Adding a new dataset or map layer

1. Add provenance and claim boundaries to `source-registry.json`.
2. Normalize features behind a typed loader with runtime validation; do not feed raw provider fields directly into UI or routing.
3. Register the layer in `mapLayerCatalog.ts`, including routing activation, evidence boundary, default visibility, icon token, and source IDs.
4. Add its focused MapLibre presentation and equivalent `FallbackMap` glyph. Keep selection and completion state in feature properties rather than inferring it from color.
5. Add contract tests for unique IDs, known sources, expiry/freshness, allowed claims, safety, routing behavior, and map presentation.

Broad data belongs underneath the product; the default resident map should show only route-relevant features. Full coverage or clusters belong in an explicit planner lens.

## Verification

The automated suite covers task validation, source links, privacy guidance, observation expiry, prompt interpretation, explicit-only routing activation, target-duration routing, no-participation behavior, and map presentation. Browser QA covers verification, local-photo gating, linked evidence, and the City what-if layer.
