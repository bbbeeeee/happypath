# Happy Path MVP implementation plan

## First vertical slice

Deliver one explainable choice: fastest versus shaded walking between two points in a bounded Lower Manhattan pilot.

The first slice includes fixed endpoints, departure time, a 25% detour ceiling, one recommended route, a fastest baseline, and a quantified receipt. Modeled demo evidence is explicitly labeled until NYC source ingestion is complete.

## Architecture

The React client consumes a `PilotGraph` containing nodes and enriched pedestrian edges. A deterministic routing module calculates the fastest path, generates several shade-weighted candidates, rejects candidates beyond the detour ceiling, and selects the valid route with the least direct-sun exposure.

The graph boundary is intentionally small and replaceable. NYC ingestion should emit the same structure rather than changing route or UI code.

## Milestones

1. **Interactive vertical slice:** demo graph, routing, time control, route receipt, tests.
2. **Grounded street graph (implemented; validation pending):** crop an OpenStreetMap pilot snapshot, derive walkable topology, record source metadata, and audit connectivity.
3. **Grounded shade (ingestion implemented):** crop NYC building footprints/heights, calculate time-specific shadows, and validate sampled blocks.
4. **Conversational refinement:** compile “greener,” “shorter,” and time changes into explicit route parameters.
5. **Additional journey shapes:** time-boxed loops, then directional wandering.

## Exit criteria for grounded shade

- Every edge records source, observation/publication date, and derivation version.
- Fastest routing is checked against at least ten known pedestrian journeys.
- Shade estimates are visually checked at three times across at least twenty sampled blocks.
- No recommended route exceeds its configured detour ceiling.
- The UI distinguishes official, derived, and uncertain claims.
