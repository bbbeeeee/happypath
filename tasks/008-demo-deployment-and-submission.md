---
id: "008"
title: Demo, deployment, and submission
phase: M4
status: blocked
owner: unassigned
depends_on: ["007"]
parallel_with: ["009-if-core-stable"]
last_updated: 2026-08-15
---

# 008 — Demo, deployment, and submission

## Outcome

Happy Path is deployed, resilient, clearly presented, and supported by a concise hackathon narrative demonstrating resident utility, intelligent NYC data integration, and the path to Detour.

## Why this package exists

A strong system can still fail as a hackathon project if the demo is unreliable or the story does not make the civic-data insight obvious.

## Inputs and dependencies

- integrated P0 application from task 007;
- validated demo routes and source evidence;
- optional prepared Detour scenario;
- hackathon submission requirements.

## Deliverables

- production deployment;
- environment and secret configuration;
- three rehearsed resident demo flows;
- optional Detour reveal;
- pitch narrative and presentation assets;
- source and attribution slide;
- backup video, screenshots, and deterministic fallback;
- final submission text and links.

## Work breakdown

- [ ] `008-A` — Select hosting and configure production environment.
- [ ] `008-B` — Ensure model keys and server-owned operations are not exposed to the client.
- [ ] `008-C` — Validate production data paths, caching, geocoding, and fallback behavior.
- [ ] `008-D` — Prepare Cooler Manhattan demo.
- [ ] `008-E` — Prepare Taking my parents demo.
- [ ] `008-F` — Prepare Rain and construction demo or replace it with the strongest validated third case.
- [ ] `008-G` — Prepare a City data used and evidence moment for each route.
- [ ] `008-H` — Prepare the resident-to-Detour transition if task 009 is stable.
- [ ] `008-I` — Write the pitch: problem, interaction, city-data insight, proof, planning extension, and limits.
- [ ] `008-J` — Create a backup demo recording and static screenshots.
- [ ] `008-K` — Test on venue network assumptions and a clean browser.
- [ ] `008-L` — Complete submission form, credits, links, and source attributions.
- [ ] `008-M` — Rehearse timing and failure recovery.

## Acceptance criteria

- [ ] Production deployment opens from a clean device.
- [ ] At least three prompts activate meaningfully different city-data combinations.
- [ ] The hero route contains a clear measured benefit.
- [ ] The audience can see which NYC sources contributed without opening technical docs.
- [ ] Claims and uncertainty match the product.
- [ ] The demo survives an inference outage or network slowdown through fallback or backup.
- [ ] The pitch explains why this is more than a shade map or generic chatbot.
- [ ] Detour is shown only if it is credible and does not endanger the resident demo.
- [ ] Submission credits data publishers and third-party projects.

## Out of scope

- new feature development after demo freeze;
- unvalidated citywide claims;
- live improvisation with unsupported prompts;
- merging experimental branches during presentation preparation.

## Risks and decisions

- The third demo should be replaced if its data is weak; breadth is less valuable than credibility.
- The primary demo must not depend on a single external model call.
- A prepared route is acceptable if the live inputs and calculations remain real and the bounds are disclosed.

## Verification

Run a timed dress rehearsal from a clean browser, record the deployed version, verify every link and attribution, and complete the final acceptance checklist.

## Handoff

After submission, move incomplete stretch work to P1 rather than leaving it implied as finished.
