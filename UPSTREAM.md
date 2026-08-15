# Upstream code

The map renderer and tile-generation pipeline in this repo were vendored from
the open-source `isometric-nyc` project by Andy Coenen, used here under the MIT
license. The upstream copyright and complete license text are retained in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

We are building the Happy Path routing experience on top of it. See
[README.md](README.md) for the product docs.

## What came from upstream

| Path                  | What it is                                        |
| --------------------- | ------------------------------------------------- |
| `src/app/`            | React + OpenSeaDragon tiled map viewer            |
| `src/isometric_nyc/`  | Python tile generation / postprocessing pipeline  |
| `src/web_render/`     | Three.js 3D tile renderer                         |
| `src/layers/`         | Visual layer demos (dark mode, water, snow)       |
| `inference/`          | Modal-hosted model inference server               |
| `docs/`               | Upstream pipeline docs (see note below)           |
| `tasks/ISOMETRIC-NYC-TASKS.md` and `tasks/0*_*.md` | Upstream's task history |

Files under `docs/` other than our own product docs describe the upstream
generation pipeline, not Happy Path. They are kept for reference.

## Map tile data

The rendered NYC tiles are **not** in this repo — they are served from the
upstream project's public bucket, which is currently the only place they are
published. The host is configured in one place:

```
TILES_HOST=https://isometric-nyc-tiles.cannoneyed.com
```

Set `TILES_HOST` in `.env` to point at our own bucket once we publish tiles.
Until then, removing this value leaves the viewer with no map to render.

Note that this host only allows cross-origin requests from its own site, so the
dev server proxies `/dzi` to it (see `src/app/vite.config.ts`). Deploying this
app to our own domain will require either hosting our own tiles or a similar
server-side proxy.

## Pulling upstream changes

```bash
git fetch upstream
git log upstream/main
```
