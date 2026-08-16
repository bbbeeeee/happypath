---
id: "010"
title: Civic Assets & Actions
phase: later
status: later
depends_on: ["006", "009"]
parallel_with: []
last_updated: 2026-08-16
---

# 010 — Civic Assets & Actions

## Outcome

Happy Path and Detour can represent individual public assets, their official and recently observed state, responsible entity, open issue, and safe authorized action—without rating neighborhoods or outsourcing City responsibilities.

Residents may optionally help improve ground truth along a walk through a quick confirmation, structured observation, or purpose-limited photo.

## Why this package exists

Public data often says that an asset exists but not whether it works now. A shared asset and action registry could improve route evidence, planning analysis, and civic participation while connecting people more closely to the city around them.

## Inputs and dependencies

- integrated amenity and public-space layers from task 006;
- Detour gap and verification needs from task 009;
- trusted agency, nonprofit, BID, garden, or stewardship task publishers;
- privacy, consent, expiration, moderation, and image-handling policy.

## Deliverables

- `PublicAsset`, `AssetObservation`, and `CivicAction` schemas;
- official-versus-observed state model;
- evidence expiration and confidence rules;
- trusted publisher and authorization model;
- one low-risk observation task integrated into a route;
- optional photo-evidence flow with clear purpose and retention;
- one Detour verification loop;
- safety and responsibility policy.

## Work breakdown

- [ ] `010-A` — Define asset identity and joins across City datasets.
- [ ] `010-B` — Define official, observed, operational, stale, unknown, and disputed states.
- [ ] `010-C` — Define responsible entity, jurisdiction, and open-work fields.
- [ ] `010-D` — Define trusted action publishers and authorization requirements.
- [ ] `010-E` — Define safe action categories: verify, observe, photograph, attend, and approved stewardship.
- [ ] `010-F` — Define prohibited tasks involving pests, hazardous waste, traffic, infrastructure repair, or unsanctioned intervention.
- [ ] `010-G` — Add observation expiration, corroboration, correction, and conflict behavior.
- [ ] `010-H` — Add one route-compatible verification task, such as restroom status, missing bench, public-space entrance, or ramp obstruction.
- [ ] `010-I` — Define photo consent, framing guidance, metadata minimization, redaction, retention, and deletion.
- [ ] `010-J` — Feed verified evidence back into routing and one Detour analysis.
- [ ] `010-K` — Design privacy, moderation, abuse, and participation safeguards.
- [ ] `010-L` — Define whether and how observations connect to City or partner workflows.

## Acceptance criteria

- [ ] An asset’s existence is distinct from current operation.
- [ ] Resident observation is distinct from official state.
- [ ] Every requested action has a trusted purpose and safety boundary.
- [ ] No task is invented by inference.
- [ ] No unresolved City responsibility is silently converted into volunteer labor.
- [ ] Observations expire or are reconfirmed.
- [ ] Photos are optional, purpose-limited, and handled under a documented retention policy.
- [ ] People are discouraged from capturing faces, license plates, or unrelated private information.
- [ ] The route remains useful without participation.
- [ ] No universal block or neighborhood score is created.
- [ ] One observation demonstrably improves route or Detour evidence.

## Out of scope

- open task publishing by any user;
- handling hazardous conditions;
- replacing 311 or agency work-order systems;
- facial recognition or identity inference;
- gamifying pest encounters or neighborhood deficits;
- volunteer leaderboards that reward wealthier or higher-adoption areas.

## Risks and decisions

- Verification can create false confidence if observations do not expire.
- Images can capture people or private details unintentionally.
- Participation patterns are not representative of need.
- Task publication and City workflow integration require partnerships beyond the initial hackathon product.

## Verification

Review one end-to-end observation loop with a domain-appropriate partner or clearly simulated publisher. Test expiration, conflicting reports, photo refusal, deletion, no-participation, and downstream evidence updates.

## Handoff

Future work may integrate authorized observations and actions with agency or partner workflows after governance and operational ownership are established.

## P1 proof-of-concept slice

Task 012 implements a bounded demo of this later package: five simulated partner-authored checks, explicit task-aware routing, a session-only structured observation, a no-upload photo selection path, a City what-if layer, and source/safety boundaries. It deliberately does not claim trusted production publishing, persistence, moderation, City submission, or a feedback loop into official routing evidence.
