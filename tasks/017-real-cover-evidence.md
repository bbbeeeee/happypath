---
id: "017"
title: Real cover evidence
phase: M1–M3
status: done
owner: codex
depends_on: ["002", "003", "011"]
parallel_with: []
last_updated: 2026-08-16
---

# 017 — Real cover evidence

## Outcome

Rain-friendly routes use a small, checked-in pilot snapshot of defensible cover evidence instead of a synthetic street pattern. The product distinguishes mapped covered ways from permit and public-space candidates and does not infer awnings or construction canopies without usable geometry.

## Plan

- [x] Preserve relevant OpenStreetMap cover and building-passage tags on graph edges.
- [x] Ingest current sidewalk-shed permit candidates and arcade-like POPS records inside the pilot bounds.
- [x] Derive a direct mapped-cover signal on graph edges with explicit source attribution.
- [x] Replace simulated resident and planner copy with bounded real-evidence language.
- [x] Keep construction records as source context only unless they establish pedestrian cover.
- [x] Add focused data, route, source, and presentation tests.
- [x] Run the full test and production-build suites.

## Boundaries

- No computer-vision or guessed awning geometry.
- No claim that an active permit proves an installed, dry, clear, or accessible path.
- No construction permit becomes favorable cover evidence by proximity alone.
- Missing evidence remains unknown rather than unfavorable.

## Review

Implemented on the PR worktree with 408 graph edges across 313 OSM ways carrying explicit covered-way or building-passage evidence, 1,589 deduplicated shed permit locations from 1,690 currently dated DOB NOW permit records, 91 POPS arcade listings, and 296 dated construction-closure records inside the Battery–60th Street supported area. Only the OSM geometry influences routing. The City records are lazy-loaded context, and awnings remain explicitly unsupported.

Verification on August 16, 2026:

- `npm run data:cover` completed and regenerated the checked-in pilot snapshot.
- `npm test -- --reporter=dot` passed 29 files and 182 tests in the latest worktree.
- `npm run deploy:check` passed after the supported-area expansion; initial JavaScript is 769.34 KB gzip and the lazy cover-context chunk is 78.24 KB gzip.
- Browser QA passed the rainy-walk and City what-if cover flows with no console warnings or errors.

## Handoff

The implementation slice is complete. Source-capability promotion, registry-state reconciliation, phrase-level demo validation, and broader representative review continue in tasks 018 and 019. Sparse mapped cover is allowed to produce no route change; later work must not convert nearby permits or public-space records into favorable cover by proximity.
