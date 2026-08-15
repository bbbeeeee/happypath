# Happy Path — 24-Hour Implementation Plan

## Goal

Build a demoable Manhattan web app that finds walking routes optimized for:

1. **Shade** — minimize direct-sun exposure using building height + solar geometry.
2. **Stay Dry** — prefer blocks with likely overhead cover, starting with sidewalk sheds.
3. **Greenest** — prefer tree-lined and park-adjacent streets.

The app should compare each environmental route with the fastest route and show the tradeoff clearly, e.g.:

> **+3 min walking · ~11 min less direct sun**

Side-of-street routing is a high-value experiment, but it is strictly timeboxed.

---

## Proposed Stack

- **Frontend:** Next.js + TypeScript + MapLibre
- **Backend:** Python + FastAPI
- **Geo tooling:** GeoPandas, Shapely, PyProj, NetworkX, NumPy
- **Storage:** GeoParquet + serialized routing graph
- **Database:** none initially; add SQLite/PostGIS only if profiling proves necessary

NYC OpenData should be downloaded and preprocessed locally rather than queried during every route request.

---

## Approved Data Sources

- **Building Footprints** → footprint geometry + roof height for shadow projection
- **Street Centerline** → base pedestrian routing graph
- **Sidewalk / Sidewalk Centerline** → side-of-street routing experiment
- **Sidewalk Sheds** → Stay Dry scoring
- **Street Tree Census** → later tree shade / Greenest scoring
- **Parks/Open Space** → later Greenest scoring

Awnings/overhangs are not on the critical path unless a usable OpenData source is found quickly.

---

## Core Architecture

```text
NYC OpenData
    ↓
Manhattan preprocessing
    ↓
Pedestrian graph + spatial layers
    ↓
Route request
    ↓
Solar / rain / green edge scoring
    ↓
Weighted shortest-path search
    ↓
Fastest vs recommended route
    ↓
Interactive web map
```

All spatial calculations should use a projected NYC coordinate system; convert back to latitude/longitude for the frontend.

---

## Shade Model

For each building:

```text
shadow_length = building_height / tan(solar_elevation)
```

Project the footprint opposite the sun direction to create an approximate shadow polygon.

For each street or sidewalk edge:

```text
shade_score = shaded_length / edge_length
sun_exposure_time = walk_time × (1 - shade_score)
```

Routing objective:

> Minimize estimated direct-sun exposure while limiting detours.

Use several environmental weightings, discard routes over ~25% longer than fastest, and choose the lowest-exposure valid route.

Only compute shadows for buildings near the origin/destination corridor rather than all Manhattan buildings.

---

## Stay Dry Model

Match active sidewalk sheds to nearby street/sidewalk edges.

For each edge:

```text
rain_cover_score = estimated covered length / edge length
rain_exposure = walk_time × (1 - rain_cover_score)
```

Route to minimize estimated rain exposure subject to the same detour cap.

UI language should say **“estimated”** or **“likely covered”** because permit data may not precisely describe usable overhead coverage.

---

## Greenest Model

For each edge:

- count nearby trees
- optionally weight by trunk diameter
- add park adjacency bonus
- normalize to a `green_score`

Then reuse the same weighted routing engine.

Greenest should remain distinct from Shade.

---

## Side-of-Street Experiment

Attempt true sidewalk-side routing only after street-level Shade works.

**Timebox: 2–3 hours.**

Success means we can reliably route:

```text
sidewalk → intersection → cross street → sidewalk
```

If sidewalk topology is too messy, stop.

Fallback:

- keep street-level routing
- estimate left/right sidewalk shade independently
- display a recommendation such as **“walk on the south side”**

This preserves most of the product value without blocking the demo.

---

## Minimal API

### `POST /route`

Input:

```json
{
  "origin": [-73.99, 40.73],
  "destination": [-73.98, 40.75],
  "mode": "shade",
  "datetime": "2026-08-15T15:30:00",
  "preference": "balanced"
}
```

Return:

- fastest route geometry
- recommended route geometry
- distance
- walking time
- shade / rain / green metrics
- environmental benefit vs fastest

Additional lightweight endpoints can expose shadow, shed, and tree layers as GeoJSON.

---

## 24-Hour Build Sequence

### Hours 0–2
- bootstrap frontend/backend
- download and crop approved datasets
- build Manhattan street graph
- render shortest walking route

**Checkpoint:** A → B route appears on map.

### Hours 2–5
- solar position
- building shadow projection
- time slider
- render moving shadows

**Checkpoint:** shadows visibly change with time.

### Hours 5–8
- intersect street edges with shadows
- calculate exposure
- visualize shaded vs exposed streets

**Checkpoint:** plausible per-edge shade scores.

### Hours 8–10
- weighted Shade routing
- detour cap
- fastest vs shaded comparison

**Checkpoint:** core product demo works.

### Hours 10–12
- test Sidewalk Centerline routing
- continue only if topology is clean enough

### Hours 12–15
- preprocess sidewalk sheds
- add Stay Dry routing

### Hours 15–17
- polish UX, legends, route cards, loading states

### Hours 17–19
- add Greenest if core product is stable

### Hours 19–21
- test multiple Manhattan routes and fix obvious failures

### Hours 21–24
- choose best demo route
- tune defensible parameters
- README, screenshots, fallback demo state

---

## Priority / Kill Rules

| Feature | Priority | Rule |
|---|---|---|
| Basic routing | P0 | Never cut |
| Building shadows | P0 | Never cut |
| Shade routing | P0 | Never cut |
| Route comparison | P0 | Never cut |
| Time slider | P0 | Simplify if needed |
| Side-of-street | P0.5 | Stop after 2–3h if messy |
| Stay Dry | P1 | Simplify shed geometry if needed |
| Awnings | P2 | Stop after ~45m research |
| Greenest | P2 | Cut if Shade/Stay Dry are unstable |
| Production DB | P3 | Do not build |
| Citywide support | P3 | Do not build |

---

## Open Questions

1. **Sidewalk topology:** Can NYC Sidewalk Centerline produce a usable pedestrian graph without heavy cleanup?
2. **Shed precision:** Can permits be mapped convincingly to covered sidewalk length, or should coverage be binary/probabilistic?
3. **Awnings:** Is there a useful OpenData source for awnings/overhangs?
4. **Trees:** Should trees contribute to Shade v0, or only Greenest? Default recommendation: buildings first.
5. **Geocoding:** Use an external service, NYC-specific service, or preset demo locations?
6. **Detour UX:** Use `Fastest / Balanced / Maximum` rather than a continuous slider?
7. **Time control:** Default to “Now,” but allow a selectable time for the demo.

---

## Definition of Done

The project is successful if a user can:

1. choose two Manhattan locations,
2. see the fastest walking route,
3. switch to **Shade** and get a meaningfully different route based on real building geometry and sun position,
4. understand the tradeoff in walking time vs direct-sun exposure,
5. change the time of day and see shadows/routes respond,
6. switch to **Stay Dry** and see shed-aware routing.

True sidewalk-side routing and Greenest are valuable additions, but they are not required for the core demo.
