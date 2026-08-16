# Happy Path product and demo audit

Updated: 2026-08-16
Audited worktree: `codex/happy-path-p1-mvp`, Full MVP preview candidate

## Executive diagnosis

Happy Path already proves substantially more than its first impression communicates. The implementation has real route computation, a useful Trip Brief, destination/loop/wander behavior, time- and distance-shaped routes, route refinement, mapped-step exclusion, time-aware shade, greenery, amenities, sparse real cover evidence, civic checks, bounded model interpretation, and a City what-if surface.

The problem is not missing breadth. It is hierarchy.

Resident planning, map layers, running, civic checks, route editing, source detail, City what-if, intervention ideas, and data-verification prompts all compete to explain what the product is. A viewer can see many capable pieces without experiencing one inevitable story.

The product should make one idea unmistakable:

> **Happy Path turns a human need into a better path, shows what changed and why, then uses the same journey evidence to reveal and test a city-scale gap.**

The highest-value work is therefore to tighten the resident query loop and make Detour a direct continuation of it. New data layers are secondary until that story is obvious.

## What the current prototype genuinely proves

| Area | Working now | Important boundary |
| --- | --- | --- |
| Request interpretation | Natural-language destination, loop, wander, distance, run, rain, mapped-step, amenity, and civic-help requests; editable controls; deterministic fallback | Supported semantics need a visible, regression-tested prompt corpus. Some displayed examples currently promise more than the parser or router enforces. |
| Route computation | Deterministic alternatives, target duration and distance, detour limits, mapped-step exclusion, baseline comparison, refinement, endpoint dragging, and path steering across Manhattan from the Battery through 60th Street | The preview is not a five-borough router, and mapped-step avoidance is not an accessibility guarantee. |
| Route value | Shade, greenery, amenity, cover, step, time, and distance evidence can change or explain a route; the receipt foregrounds the smallest useful detour on a measured value frontier | Environmental evidence remains modeled or inventory-based rather than a live-condition guarantee. |
| Map and evidence | One dominant route, time-aware shade, nearby places, clusters, civic checks, progressive source detail, and fallback-map behavior | Optional layers and disclosures can still compete with the path itself. Sparse cover evidence should be allowed to produce no route change. |
| City what-if | A resident-to-planner handoff, transparent representative journeys, repeated-gap metrics, a rerun of the same route policy after a hypothetical shade change, source links, and explicit hypothetical labels | The frozen proof does not establish population demand, construction feasibility, behavior change, or policy priority. |
| Civic participation | Safe simulated checks, optional routing influence, session-only responses, and privacy-gated photo selection | This is a useful secondary proof, not the main resident-to-planner story. No observation is submitted, persisted, or official. |
| Delivery | Production build, health checks, dependency-free release archive, deterministic fallbacks, and bounded model endpoints | It is not deployed. Broad exposure still needs edge abuse controls, monitoring, spend policy, and operational ownership. |

## Verification snapshot

The integrated preview candidate passes:

- `npm test`: 41 files and 256 tests;
- `npm run deploy:package`: TypeScript, production Vite build, bundle budgets, production-server smoke, portable archive creation, and release-archive smoke;
- initial JavaScript: 762.69 KiB gzip against an 850 KiB preview guardrail;
- largest hourly shade tile: 281.83 KiB gzip against a 310 KiB guardrail;
- lazy flood context: 90.80 KiB gzip; frozen planner scenario: 4.33 KiB gzip;
- a dependency-free 37 MB release archive containing the static client and small Node runtime.

The six curated examples are route-level contracts rather than sample copy: tests assert substantial geometry, destination span, loop closure and repetition, transit arrival, mapped cover, civic-task selection, and a 1.8–2.2 mile shaded-run tolerance. Browser QA retained full-basemap destination and wander captures and confirmed that resident-facing endpoints use landmarks or intersections rather than OSM graph IDs. The canonical status is maintained in [P1 implementation status](P1_IMPLEMENTATION_STATUS.md).

## Product decisions carried into the preview

### 1. Resident routing is the first obvious job

The opening sheet now leads with one human request, four rehearsed shortcuts—destination, loop, wander, and a shaded two-mile run—and a quiet Trip Brief. Route editing, evidence layers, civic checks, and planning detail arrive after the first path; City view remains a compact expert shortcut rather than a second opening form.

**Keep:** protect this hierarchy as new datasets and planning proofs are added.

### 2. Path-query magic needs a maintained truth contract

A good prompt is not merely parseable. Every important phrase must change the Trip Brief, constrain the route, affect ranking, or appear as unsupported. The preview now keeps typed contracts for its four opening prompts and route-level checks for six representative journeys; complete-token direction parsing and park/transit endings prevent earlier silent interpretation errors.

**Keep:** treat every new visible prompt as an executable product promise. Add its interpretation, route, receipt, fallback, and source expectations before shipping the copy.

### 3. The route receipt leads with the decision

The receipt now leads with the primary benefit, the extra time, retained needs, and a measured value frontier when it clarifies the choice. The fastest route, methods, freshness, and secondary evidence stay available without competing with the conclusion.

**Keep:** prefer one legible tradeoff over a stack of technically correct metrics.

### 4. City what-if starts with a planning question

The planner proof now answers a bounded, inspectable sequence:

1. What need are we studying?
2. Which representative journeys experience it?
3. Where does the burden repeat?
4. What evidence makes this a gap rather than sparse data?
5. What changes under a specific intervention?
6. Who benefits, who does not, and what remains?

**Keep:** make the repeated gap, affected journeys, and remaining burden the hero—not an inventory count or layer control.

### 5. The resident and planner surfaces share a causal handoff

From a resident receipt, **“See this gap across more journeys”** carries the need into the representative-journey proof. The header shortcut still lets a planner open City view directly, but the rehearsed product story begins with a concrete walk.

**Keep:** future planner modes should begin with a resident or public-anchor need rather than an abstract layer browser.

### 6. Planner insight uses public anchors without surveillance

The frozen proof uses six equally weighted, inspectable public-anchor journeys. Browser-local route notes are displayed separately and explicitly do not represent population need.

**Keep:** future app-derived demand must be aggregated, thresholded, optional, and separate from individual routes.

## Rendered experience audit

The final preview was reviewed in the interactive MapLibre experience and in the network-independent fallback at desktop and narrow responsive sizes.

- **Visual design: A- for a preview.** The product now has one strong route line, compact geometric controls, real category icons, small map popovers, composable climate layers, and a restrained evidence hierarchy.
- **Product cohesion: B+.** Chat is the resident entry point; adjustments follow a successful route; City view is a causal handoff from a specific gap while remaining available to planners from the header.
- **Claim discipline: B+.** Useful route conclusions lead, while freshness, provenance, modeled assumptions, and missing-data boundaries remain available one level deeper.

The destination hero visibly explains what a small detour buys, overlays the fastest route on demand, and keeps shade, greenery, places, cover, and checks composable. The frozen Seward Park planning proof identifies one repeated corridor across six public-anchor journeys; the primary scenario avoids 7.34 weighted direct-sun minutes, improves all six journeys, and changes two selected routes under the same route policy.

Remaining preview watch items are:

1. **External map services remain a demo dependency.** The basemap and free-form geocoder require network access, although checked-in routing, examples, evidence, and the fallback visualization continue without them.
2. **The planner proof is intentionally bounded.** It demonstrates an inspectable method, not a general city simulation or an investment recommendation.
3. **Local route notes are not demand data.** City view labels browser-local traces separately from the frozen public-anchor cohort and must keep doing so if persistence changes.
4. **The full evidence package is substantial.** Lazy loading protects the opening experience, but the portable archive is roughly 37 MB and would benefit from CDN/object-storage delivery beyond a single-VM preview.
5. **Production UX validation remains.** A broader device, keyboard, screen-reader, and outdoor-legibility pass is still required before public launch.

## The cohesive demo

### Act 1 — A better path for one person

1. Start with one validated request, for example: **“Give me a shaded 30-minute loop, avoid mapped steps, and pass drinking water.”**
2. Show a compact Trip Brief. Every phrase maps to a visible field or limitation.
3. Generate one dominant route and a subdued baseline.
4. Lead with the value: **“Three extra minutes buys nine fewer estimated minutes in direct sun; mapped steps are still avoided; one mapped fountain is on the way.”**
5. Refine once: **“Five minutes shorter, but keep the fountain.”** Show the delta and retained requirements.
6. Inspect the exposed segment responsible for the remaining burden.

### Act 2 — The same evidence becomes a planning question

1. Select **“See this gap across more journeys.”**
2. Detour opens with the same segment and need, plus a transparent cohort such as transit-to-park or transit-to-public-facility walks.
3. Show the repeated burden, affected and unaffected journeys, evidence quality, and missing evidence.
4. Test one hypothetical intervention. Compare the same cohort before and after.
5. Show improved journeys, unchanged journeys, remaining burden, assumptions, and the best next verification step.

This is one story, not two demos: personal need reveals a street condition; route analysis shows whether it repeats; simulation shows what a change could and could not improve.

## Simplify before adding

For the primary demo path:

- keep one resident composer, one route, one primary benefit, one tradeoff, and one refinement;
- move City what-if from a co-equal opening mode to a contextual result action;
- choose one planner lens for the hero proof, with other lenses shown only as credible next applications;
- keep civic checks out of the hero flow unless the story is specifically about verification;
- collapse source, method, freshness, and claim-boundary detail into one consistent evidence drawer;
- hide manual route steering, secondary layer controls, and unsupported prompts until the presenter deliberately reveals them;
- delete or rewrite any copy that does not orient, explain status, enable action, or disclose a material boundary.

## Implementation checkpoint and next work

| State | Work | Why it is high value | Exit signal |
| --- | --- | --- | --- |
| Implemented | Expanded-area integration gate | Prevents product work from building on mismatched fixtures and eagerly loaded citywide data | Full suite, production smoke, generated IDs/counts, route fixtures, partition loading, and payload budgets are green from one stable artifact |
| Implemented | Query truth and hero prompt corpus | Trust collapses if visible phrases do not affect the route | Three opening prompt contracts and six route-level example audits pass; earlier park, direction, and example gaps are fixed |
| Implemented | Resident experience simplification | Makes the product understandable in the first interaction | One chat-first composer leads to an editable brief and compact receipt |
| Implemented | Route-value frontier | Turns routing into an insight rather than an alternate line | The receipt answers what the extra time bought and where added detour stops paying off |
| Implemented | Resident-to-Detour handoff | Creates one cohesive product narrative | A route gap opens directly into the representative planning question |
| Implemented | Representative-journey gap analysis | Makes City what-if useful to an actual planner | The cohort and weights are inspectable; a repeated burden is distinct from asset density or one resident route |
| Implemented | Intervention comparison | Completes identify → simulate → analyze | The same cohort is compared before and after with changed, unchanged, and remaining burdens plus assumptions |
| Review | Visual, copy, and demo freeze | Converts capability into a reliable presentation | Final cross-device and accessibility QA, presentation rehearsal, and a hosted preview remain |
| Later | Secondary production proofs | Preserves useful breadth without diluting the story | Live operations, wider geography, stronger cover data, and shared planner signals have explicit owners and trust boundaries |

The executable work and review state are tracked in [tasks](../tasks/README.md). The canonical requirements remain in the [PRD](PRD.md), resident behavior in [UX](UX.md), planner behavior in [Detour](DETOUR.md), implementation truth in [P1 implementation status](P1_IMPLEMENTATION_STATUS.md), and evidence rules in [data and inference](data-and-inference.md).
