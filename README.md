# Happy Path

Happy Path is an intelligent walking-route interface over New York City public data.

A person describes how they want to move through the city, Happy Path turns that request into an inspectable Trip Brief, computes a valid route from street-level evidence, and explains what the detour buys. The same city model later powers **Detour**, a planning workspace for identifying amenity and infrastructure gaps.

## Start here

- [Product requirements](docs/PRD.md)
- [Core experience and map UX](docs/UX.md)
- [Data and inference specification](docs/data-and-inference.md)
- [Detour planning extension](docs/DETOUR.md)
- [Build plan and dependencies](docs/BUILD.md)
- [Prototype inventory](docs/PROTOTYPES.md)
- [Project task board](tasks/README.md)

## Current direction

- **Pilot:** bounded Lower Manhattan area
- **First journey:** fixed origin to destination
- **Hero proof:** time-aware shade using NYC building geometry and solar position
- **Broader platform:** greenery, sheds and construction, mapped steps, elevation, seating, restrooms, water, public spaces, transit, and other validated city layers
- **Interaction:** one sentence → visible Trip Brief → computed route → evidence-backed receipt → natural refinement

`main` is documentation-first while implementation prototypes remain on separate branches. See [PROTOTYPES.md](docs/PROTOTYPES.md) before merging or replacing any prototype work.
