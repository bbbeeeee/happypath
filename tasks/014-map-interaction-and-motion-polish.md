# 014 — Map interaction and motion polish

## Goal

Make the map useful before and after route generation: nearby places remain legible, clusters expand, climate layers combine, shade changes over time, and planning work has fast, friendly feedback.

## Checklist

- [x] Show a restrained, viewport-aware amenity overview before a route exists.
- [x] Make clusters clickable and dissolve them progressively as the map zooms.
- [x] Reduce amenity and civic-check coverage halos.
- [x] Keep the route visible while shade, cover, places, and checks are toggled independently.
- [x] Restore visible building-shadow and route-shade changes as the time slider moves.
- [x] Rewrite example requests around natural time availability.
- [x] Add quick thinking feedback for initial planning and route adjustments.
- [x] Move detailed civic-task evidence behind disclosure controls.
- [x] Verify unit tests, build budget, live desktop interaction, responsive rules, and reduced motion.
- [x] Push the completed polish to PR #3.

## Review

Implemented a viewport-balanced amenity layer, zoom-aware cluster expansion, additive climate/place/check controls, debounced shade polygons with immediate route-shade updates, compact thinking feedback, and progressive civic evidence. Live browser QA covered compose, initial planning, stacked layers, time control, route refinement, and civic disclosure. Verification: 26 test files / 161 tests and production build + smoke test.
