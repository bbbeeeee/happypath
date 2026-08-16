---
id: "010"
title: Civic Assets & Actions
phase: later
status: later
owner: unassigned
depends_on: ["006", "009"]
parallel_with: []
last_updated: 2026-08-15
---

# 010 — Civic Assets & Actions

## Outcome

Happy Path and Detour can represent individual public assets, their official and recently observed state, responsible entity, open issue, and safe authorized action—without rating neighborhoods or outsourcing City responsibilities.

## Why this package exists

Public data often says that an asset exists but not whether it works now or what a resident may safely do. A shared asset and action registry could improve route evidence, planning analysis, and optional civic participation.

## Inputs and dependencies

- integrated amenity and public-space layers from task 006;
- Detour gap and verification needs from task 009;
- trusted agency, nonprofit, BID, garden, or stewardship task publishers;
- privacy, expiration, and moderation policy.

## Deliverables

- `PublicAsset`, `AssetObservation`, and `CivicAction` schemas;
- official-versus-observed state model;
- evidence expiration and confidence rules;
- trusted publisher and authorization model;
- one low-risk observation task integrated into a route;
- one Detour verification loop;
- safety and responsibility policy.

## Work breakdown

- [ ] `010-A` — Define asset identity and joins across City datasets.
- [ ] `010-B` — Define official, observed, operational, stale, unknown, and disputed states.
- [ ] `010-C` — Define responsible entity, jurisdiction, and open-work fields.
- [ ] `010-D` — Define trusted action publishers and authorization requirements.
- [ ] `010-E` — Define safe action categories: verify, observe, attend, and approved stewardship.
- [ ] `010-F` — Define prohibited tasks involving pests, hazardous waste, traffic, infrastructure repair, or unsanctioned intervention.
- [ ] `010-G` — Add observation expiration, corroboration, and correction behavior.
- [ ] `010-H` — Add one optional route-compatible verification task, such as restroom open status or ramp obstruction.
- [ ] `010-I` — Feed verified evidence back into routing and one Detour analysis.
- [ ] `010-J` — Design privacy, moderation, abuse, and participation safeguards.

## Acceptance criteria

- [ ] An asset’s existence is distinct from current operation.
- [ ] Resident observation is distinct from official state.
- [ ] Every action has a trusted publisher and safety boundary.
- [ ] No task is invented by inference.
- [ ] No unresolved City responsibility is silently converted into volunteer labor.
- [ ] Observations expire or are reconfirmed.
- [ ] The route remains useful without participation.
- [ ] No universal block or neighborhood score is created.
- [ ] One observation demonstrably improves route or Detour evidence.

## Out of scope

- open task publishing by any user;
- handling hazardous conditions;
- replacing 311 or agency work-order systems;
- gamifying pest encounters or neighborhood deficits;
- volunteer leaderboards that reward wealthier or higher-adoption areas.

## Risks and decisions

- Verification can create false confidence if observations do not expire.
- Participation patterns are not representative of need.
- Task publication and City workflow integration require partnerships beyond a hackathon prototype.

## Verification

Review the schema and one end-to-end observation loop with a domain-appropriate partner or clear simulated publisher. Test expiration, conflicting reports, refusal, and no-participation paths.

## Handoff

Future work may integrate authorized actions with agency or partner workflows after governance and operational ownership are established.
