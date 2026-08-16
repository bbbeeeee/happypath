# Happy Path P1 MVP

Happy Path turns one plain-language request into a visible Trip Brief, one considered walk, and an evidence-backed route receipt. This branch is a fresh P1 implementation based on the current product documents; the earlier prototype was used only as a source of useful fixtures and technical lessons.

The current preview supports:

- destination walks with a 0, 5, or 10 minute detour allowance;
- time-boxed loops and directional wandering, including ending near mapped transit;
- distance-shaped walk and run requests from 0.25 to 5 miles, without claiming a running pace;
- time-aware building shade, mapped greenery, mapped steps, seating, restrooms, drinking fountains, and subway entrances;
- a rain preference based only on sparse explicit mapped covered-way geometry, with permits and nearby records kept as context;
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
npm run data:refresh
```

The combined refresh runs the graph, buildings, greenery, shade, civic-asset, and cover-evidence generators in dependency order. The individual `data:*` commands remain available when only one checked-in snapshot needs to be rebuilt.

## Scope

The checked-in preview supports Manhattan from the Battery through 60th Street. A shared Manhattan polygon clips graph and evidence generation away from nearby boroughs, while six lazy routing/evidence partitions and smaller hourly shade tiles keep the expanded area within the preview payload budgets. Amenity inventory records do not prove current operation, mapped steps do not constitute an accessibility guarantee, and shade is a modeled estimate rather than measured temperature. Explicit mapped-cover geometry is route-affecting only where the graph has exact evidence; shed permits, POPS arcades, and construction records are context and do not prove a dry, present, passable, or covered path.

See [P1 implementation status](docs/P1_IMPLEMENTATION_STATUS.md) for verified coverage, payloads, and remaining gates; [Product and demo audit](docs/PRODUCT_DEMO_AUDIT.md) for the cohesion diagnosis and next roadmap; [Civic data checks](docs/CIVIC_DATA_CHECKS.md) for the contribution and layer-extension contract; and [Deployment](docs/DEPLOYMENT.md) for the release runbook. The product authority remains [PRD](docs/PRD.md), [UX](docs/UX.md), [data and inference](docs/data-and-inference.md), and [Detour](docs/DETOUR.md).
