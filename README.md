# Happy Path P1 MVP

Happy Path turns one plain-language request into a visible Trip Brief, one considered walk, and an evidence-backed route receipt. This branch is a fresh P1 implementation based on the current product documents; the earlier prototype was used only as a source of useful fixtures and technical lessons.

The current preview supports:

- destination walks with a 0, 5, or 10 minute detour allowance;
- time-boxed loops and directional wandering, including ending near mapped transit;
- time-aware building shade, mapped greenery, mapped steps, seating, restrooms, drinking fountains, and subway entrances;
- optional, partner-authored city-data checks that a resident can route toward, verify, or photograph locally without changing official data;
- an editable Trip Brief, deterministic routing, baseline comparison, and natural-language refinement;
- one explicitly hypothetical Detour shade-planning scenario using the same route evidence;
- deterministic prompt interpretation by default, with optional OpenRouter interpretation behind a server-only API boundary.

## Run locally

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. No API key is required: the built-in interpreter covers the supported demo requests.

For optional model interpretation, copy `.env.example` to `.env.local` and set:

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-5.6-luna
```

The key is read only by the local Vite middleware and is never exposed through a `VITE_` browser variable. Model output may interpret the request into a typed brief, but it cannot create route facts; routing and receipts remain deterministic.

## Verify

```bash
npm test
npm run build
npm run deploy:check
```

## Deploy the preview

The production build includes a small Node server for the static app, same-origin model endpoints, health checks, caching, request limits, and graceful shutdown:

```bash
npm ci
npm run deploy:package
HOST=127.0.0.1 PORT=3000 npm start
```

The portable archive is written to `release/` and does not need `node_modules` at runtime. See [single-VM deployment](docs/DEPLOYMENT.md) for the environment contract, systemd service, HTTPS proxy, health checks, updates, rollback, and preview security boundary. No external environment is changed by these commands.

## Refresh data

The checked-in pilot snapshots make normal local development network-independent. Refresh commands intentionally contact upstream public-data services:

```bash
npm run data:osm
npm run data:buildings
npm run data:shade
npm run data:greenery
npm run data:civic
```

## Scope

This is an honest Lower Manhattan preview, currently bounded approximately by Canal Street, Washington Square, Union Square, and the East Village—not yet the full Battery-to-59th-Street P1 geography. Amenity inventory records do not prove current operation, mapped steps do not constitute an accessibility guarantee, and shade is a modeled estimate rather than measured temperature.

See [P1 implementation status](docs/P1_IMPLEMENTATION_STATUS.md) for verified coverage, payloads, and remaining gates, [Civic data checks](docs/CIVIC_DATA_CHECKS.md) for the contribution and layer-extension contract, and [Deployment](docs/DEPLOYMENT.md) for the release runbook. The product authority remains [PRD](docs/PRD.md), [UX](docs/UX.md), [data and inference](docs/data-and-inference.md), and [Detour](docs/DETOUR.md).
