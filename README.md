# Happy Path

Happy Path is a hackathon project exploring new ways to map paths through New York City.

The project is intentionally documentation-first. We will shape the product together before choosing an engineering stack or adding application code.

## Start here

- [Product requirements document](docs/PRD.md)
- [Data and inference specification](docs/data-and-inference.md)
- [Idea workspace](docs/ideas/README.md)
- [Parallel task board](tasks/README.md)

## Current scope

The first vertical slice compares a fastest walking route with a modeled shaded route on a cropped OpenStreetMap pedestrian graph in Lower Manhattan. It includes time-of-day control, a detour ceiling, and an evidence-aware route receipt.

```bash
npm install
npm run data:osm # refresh the committed pilot snapshot
npm run data:buildings && npm run data:shade
npm run data:greenery
npm run dev
```

Run `npm test` for routing tests and `npm run build` for a production build.

The pedestrian graph is a reproducible community-data snapshot with visible attribution. Shade and Greener scores use official NYC inputs and remain labeled as derived with validation pending. See the [implementation plan](docs/IMPLEMENTATION_PLAN.md) for the remaining milestones.
