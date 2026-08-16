# Happy Path

Happy Path helps people care about the journey, not only the destination.

A person says where and/or how they want to walk. Happy Path brings together NYC public data, computes a practical route or walk, and explains—in clear, friendly language—why that way fits the moment.

The product should feel simple and almost magical even though the work underneath is complex:

> **Say what you want → see what Happy Path understood → get a considered walk → adjust it naturally.**

The same city model also powers **Detour**, a planning extension for identifying where missing shade, access, amenities, or infrastructure make everyday journeys harder.

## Start here

- [Product requirements](docs/PRD.md)
- [Core experience, map UX, and product language](docs/UX.md)
- [Data and inference specification](docs/data-and-inference.md)
- [Detour planning extension](docs/DETOUR.md)
- [Build plan and dependencies](docs/BUILD.md)
- [Prototype inventory](docs/PROTOTYPES.md)
- [Project task board](tasks/README.md)

## Current direction

- **Geography:** Manhattan from the Battery through Midtown, approximately south of Central Park
- **Journey types:** destination routes, time-boxed loops, and directional wandering
- **Hero proof:** time-aware shade using NYC building geometry and solar position
- **City layers:** greenery, sidewalk sheds and construction, mapped steps, elevation, seating, restrooms, water, public spaces, transit, and other validated data
- **Experience:** one friendly request → an easy-to-check interpretation → one clear route → useful reasons → natural refinement
- **Planning connection:** one Detour proof using the same data and route features

This work establishes the product requirements and execution plan. Future implementation should build from these docs and may choose whatever technical and development workflow best satisfies them; no existing prototype branch or architecture is prescribed.