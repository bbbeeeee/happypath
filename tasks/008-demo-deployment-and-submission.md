---
id: "008"
title: Magical demo, deployment, and submission
phase: M4
status: blocked
owner: unassigned
depends_on: ["007"]
parallel_with: ["009"]
last_updated: 2026-08-15
---

# 008 — Magical demo, deployment, and submission

## Outcome

Happy Path is deployed and presented as a polished, believable product. The audience sees a simple resident interaction, real NYC data doing meaningful work, several delightful journeys, and a clear bridge to Detour.

## Why this package exists

Hackathon quality is not only feature count. The demo must feel fast, clean, friendly, and coherent. It should make the data work visible without turning the presentation into a technical architecture review.

## Inputs and dependencies

- integrated P1 application from task 007;
- validated Manhattan journeys and source evidence;
- one Detour proof from task 009;
- hackathon submission requirements;
- approved product copy and visual language.

## Deliverables

- production deployment;
- environment, caching, and secret configuration;
- four rehearsed resident demo flows;
- one Detour reveal;
- concise pitch narrative;
- source and evidence moment;
- polished screenshots and short backup video;
- deterministic fallback or prepared journey paths;
- final submission text, credits, and links;
- clean device and network test results.

## Demo principles

### Feel real

- Use real route geometry, City layers, assets, and calculated benefits.
- Use a supported Manhattan area and strong curated journeys.
- Clearly label estimated, published, or hypothetical information.

### Feel magical

- Get from one sentence to a useful route quickly.
- Make the route change visibly for a reason.
- Show what the detour buys in friendly language.
- Keep the map clean and the source evidence easy to reveal.
- Let one refinement update the same journey naturally.

### Be resilient

- Do not depend on a single live model or API call.
- Preprocess and cache expensive data.
- Prepare backup routes, screenshots, and video without fabricating outputs.

## Work breakdown

### Deployment

- [ ] `008-A` — Select hosting and configure production environment.
- [ ] `008-B` — Protect model keys and server-owned operations.
- [ ] `008-C` — Configure caching, asset delivery, geocoding, and fallbacks.
- [ ] `008-D` — Test first load and route flow on a clean device.

### Resident demos

- [ ] `008-E` — Prepare **Cooler Manhattan** destination demo.
- [ ] `008-F` — Prepare **Considered loop** with greenery, seating, and water.
- [ ] `008-G` — Prepare **Taking my parents** wander with mapped steps, rest, restroom, public space, and transit.
- [ ] `008-H` — Prepare **Rain and construction** or replace it with the strongest validated fourth case.
- [ ] `008-I` — Add one meaningful natural-language refinement to each relevant flow.
- [ ] `008-J` — Add a friendly **City data used** moment to each demo.

### Detour and story

- [ ] `008-K` — Prepare the resident-to-Detour transition.
- [ ] `008-L` — Show one route burden and before-and-after intervention clearly.
- [ ] `008-M` — Write the pitch: journey problem, magical interaction, City-data insight, resident proof, Detour extension, and future citizen connection.
- [ ] `008-N` — Explain limitations without derailing the product story.

### Polish and recovery

- [ ] `008-O` — Complete final copy, map, spacing, motion, and mobile polish.
- [ ] `008-P` — Remove all debug labels, technical jargon, unfinished toggles, and unsupported prompts.
- [ ] `008-Q` — Create backup video, screenshots, route outputs, and deterministic fallback.
- [ ] `008-R` — Rehearse timing, network failure, inference failure, and presenter recovery.
- [ ] `008-S` — Complete submission form, source credits, links, and attribution.

## Acceptance criteria

- [ ] Deployment opens from a clean phone and browser.
- [ ] A first-time viewer understands the product within the opening interaction.
- [ ] At least four prompts activate meaningfully different City-data combinations.
- [ ] At least one destination, loop, and wander are demonstrated.
- [ ] The hero route contains a clear calculated benefit.
- [ ] Resident claims use real data and actual route outputs.
- [ ] The audience can see which NYC sources contributed without reading technical docs.
- [ ] Copy is friendly, concise, and consistent throughout.
- [ ] The map stays clean while still revealing meaningful data.
- [ ] The demo survives an inference outage or network slowdown.
- [ ] The pitch makes clear why Happy Path is more than a shade map, chatbot, or open-data dashboard.
- [ ] Detour reuses the same route and data model.
- [ ] Hypothetical planning changes are clearly labeled.
- [ ] Submission credits publishers and third-party sources.

## Out of scope

- new unvalidated feature development after demo freeze;
- live improvisation with unsupported prompts;
- fake live conditions;
- merging experimental branches during presentation preparation;
- production-grade citywide reliability.

## Risks and decisions

- The fourth demo should be replaced if its data is weak.
- A prepared journey is acceptable when inputs, calculations, and source evidence remain real.
- Product copy, data cleaning, and visual polish need explicit time in the schedule.
- Breadth should never make the main demo harder to understand.

## Verification

Run a timed dress rehearsal from a clean browser and phone, record the deployed build, verify every number and source, test failure recovery, and complete the final P1 acceptance checklist.

The vendor-neutral packaging slice is complete in [013 — Single-VM deployment readiness](013-vm-deployment-readiness.md). This package remains blocked only on choosing and creating the actual environment, assigning a production URL, and completing the final public-demo rehearsal and submission.

## Handoff

After submission, move unfinished later work into explicit follow-up tasks rather than implying it shipped.
