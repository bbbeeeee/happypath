# Delightful copy hierarchy

## Plan

- [x] Audit route, evidence, limitation, place, and City what-if copy in the rendered product.
- [x] Put resident benefits before implementation and provenance language.
- [x] Make unsupported or changing conditions small, calm, and expandable.
- [x] Keep source links, refresh dates, and evidence boundaries available one level deeper.
- [x] Run the full test and production-build suites.
- [x] Capture and inspect route, rain, access-note, source, and City what-if screenshots.
- [x] Push the finished pass to the Full MVP preview PR.

## Review

The primary route view now leads with the benefit and keeps changing-condition notes in a small, collapsed disclosure. City what-if uses resident and planner language instead of implementation terms, while source titles, links, refresh dates, and expandable coverage limits remain available.

Verification on August 16, 2026:

- 26 Vitest files and 171 tests pass.
- The TypeScript and Vite production build passes.
- Browser checks passed at 1440×1000 and 390×844 for shaded access, rain, City what-if, and source-detail states.
- The OpenRouter-backed interpretation endpoint returned 200 for the final route check; the browser console was clean.
