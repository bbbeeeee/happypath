---
id: "013"
title: Single-VM deployment readiness
phase: M4
status: done
depends_on: ["007"]
parallel_with: ["008"]
last_updated: 2026-08-16
---

# 013 — Single-VM deployment readiness

## Outcome

The reviewed MVP can be built into a portable artifact and run on one ordinary Linux VM without using the Vite development server or installing runtime packages. Operators have a concise path for secrets, HTTPS, service supervision, health checks, updates, and rollback.

## Work breakdown

- [x] Add a compiled production server for the client and same-origin API routes.
- [x] Validate startup configuration and the presence of the static build.
- [x] Add liveness/readiness endpoints without exposing secrets.
- [x] Add static-path protection, security headers, caching, gzip, API request limits, and graceful shutdown.
- [x] Add a runtime smoke test and portable npm release archive.
- [x] Document a vendor-neutral systemd and reverse-proxy deployment.
- [x] Document keyless fallback, preview boundaries, update, and rollback behavior.

## Acceptance criteria

- [x] `npm start` serves the compiled application and both existing API handlers.
- [x] A release archive runs with Node alone and no runtime `node_modules`.
- [x] `/healthz` and `/readyz` report a build identifier and safe model-configuration state.
- [x] Invalid port or request-limit settings fail before binding.
- [x] Model API traffic is bounded per client without changing ordinary static traffic.
- [x] Hashed assets are immutable; the SPA shell and client routes revalidate.
- [x] The app can deploy without an OpenRouter key and retain deterministic fallback behavior.
- [x] Documentation covers a single-VM install, TLS proxy, service manager, secrets, checks, update, and rollback.

## Boundary

This package prepares deployment but does not choose a hosting vendor, create infrastructure, publish an environment, or make the preview suitable for unrestricted production traffic. A public launch still needs an access/abuse policy, monitoring, a spend cap, and a security review.

## Verification

- `npm test` passes 25 unique files and 156 tests, covering production configuration, health, caching, SPA fallback, malformed request containment, rate limiting, and missing-build startup failure.
- `npm run deploy:package` builds and smoke-tests the production server, creates a 4.6 MB compressed release archive containing 25 files and no runtime `node_modules`, extracts it, then verifies its entry assets, one lazy shade chunk, and both keyless API fallbacks.
- The extracted archive starts with `npm start`, returns build `archive-smoke` from `/healthz`, serves immutable hashed assets, and logs graceful `SIGINT` shutdown.
