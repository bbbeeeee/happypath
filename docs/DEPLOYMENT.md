# Deploying Footnote on one VM

Footnote ships as a static Vite client plus a small Node server. The server owns the optional OpenRouter calls, serves the built client, exposes health checks, and has no runtime package dependencies. A small Linux VM with Node.js 22.12 or newer is enough for the preview.

This runbook prepares a deployment; it does not create infrastructure or change a live environment.

## Recommended shape

```text
Browser → HTTPS reverse proxy → Footnote Node server → OpenRouter (optional)
                                  ├─ static client and map snapshots
                                  ├─ /api/interpret
                                  ├─ /api/insights
                                  ├─ /healthz
                                  └─ /readyz
```

Use Caddy, nginx, or the VM provider’s load balancer for HTTPS. Keep the Node server on `127.0.0.1` when a proxy runs on the same VM. The checked-in data and deterministic interpreter let the resident experience continue when no OpenRouter key is configured or model interpretation fails.

## Build and prove the artifact

From a clean checkout:

```bash
npm ci
npm test
npm run deploy:check
```

`deploy:check` builds the client and production server, starts the compiled server on an ephemeral local port, and verifies both the page and `/healthz`.

Create the portable release archive:

```bash
npm run deploy:package
```

The resulting `release/footnote-mvp-0.1.0.tgz` contains `dist/`, `dist-server/`, `package.json`, and the deployment documentation. It does not need `node_modules` at runtime.

To inspect it locally:

```bash
mkdir -p /tmp/footnote-release
tar -xzf release/footnote-mvp-0.1.0.tgz -C /tmp/footnote-release --strip-components=1
cd /tmp/footnote-release
HOST=127.0.0.1 PORT=3000 npm start
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Address the Node server binds to. Use `127.0.0.1` behind a same-VM proxy. |
| `PORT` | `3000` | HTTP port. Hosting platforms may supply this. |
| `STATIC_DIR` | `dist` | Built client directory, resolved from the working directory. |
| `BUILD_SHA` | `unknown` | Release identifier returned by the health endpoints. |
| `OPENROUTER_API_KEY` | empty | Optional server-only model key. Never use a `VITE_` prefix. |
| `OPENROUTER_MODEL` | `openai/gpt-5.6-luna` | Structured interpretation and bounded planning-rank model. |
| `API_RATE_LIMIT_PER_MINUTE` | `30` | Per-client POST limit across the two model API routes. `0` disables it. |
| `TRUST_PROXY` | `false` | Trust the first `X-Forwarded-For` address. Enable only behind a proxy that overwrites this header. |

Invalid ports and rate limits stop startup with a readable error. `/healthz` reports service, build, and whether a model key is configured; it never returns the key. `/readyz` confirms that the process completed its static-build startup check.

## Install the release on Ubuntu

These commands assume a dedicated `footnote` system user and a release uploaded to `/tmp`. Keep releases in versioned directories so rollback is a symlink change rather than an in-place overwrite.

```bash
sudo install -d -o footnote -g footnote /opt/footnote/releases/0.1.0
sudo tar -xzf /tmp/footnote-mvp-0.1.0.tgz -C /opt/footnote/releases/0.1.0 --strip-components=1
sudo chown -R footnote:footnote /opt/footnote/releases/0.1.0
sudo ln -sfn /opt/footnote/releases/0.1.0 /opt/footnote/current
```

Confirm that `command -v node` points to Node.js 22.12 or newer. Keep that exact absolute path for `ExecStart` below. Then create the secret file so root can edit it and the service group can read it:

```bash
sudo install -o root -g footnote -m 0640 /dev/null /etc/footnote.env
sudoedit /etc/footnote.env
```

```dotenv
# Optional. Leave unset for the deterministic, keyless demo fallback.
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-5.6-luna
BUILD_SHA=replace-with-the-release-commit
```

Restrict that file to root and the service group. Do not put the key in the archive, repository, client build, or systemd unit.

Create `/etc/systemd/system/footnote.service`:

```ini
[Unit]
Description=Footnote preview
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=footnote
Group=footnote
WorkingDirectory=/opt/footnote/current
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=TRUST_PROXY=true
Environment=API_RATE_LIMIT_PER_MINUTE=30
EnvironmentFile=-/etc/footnote.env
# Replace this path with the exact output of: command -v node
ExecStart=/absolute/path/to/node dist-server/server/production.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
```

Start and inspect it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now footnote
curl -fsS http://127.0.0.1:3000/healthz
sudo journalctl -u footnote -n 100 --no-pager
```

The process handles `SIGTERM`, stops accepting new requests, and gives active requests up to ten seconds to finish.

## Put HTTPS in front

A minimal Caddy site is enough:

```caddyfile
footnote.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Point DNS at the VM before starting Caddy so it can provision TLS. If an external load balancer terminates HTTPS instead, bind the app to the appropriate private interface and restrict port 3000 with the VM firewall.

## Update and roll back

For an update, build a new archive from the reviewed commit, extract it into a new `/opt/footnote/releases/<release>` directory, repoint `/opt/footnote/current`, and restart the service. Verify both the build identifier and the home page:

```bash
sudo systemctl restart footnote
curl -fsS http://127.0.0.1:3000/readyz
curl -fsS https://footnote.example.com/healthz
```

To roll back, point `current` at the previous release and restart. Keep at least one known-good directory until the new build has passed the resident route and City what-if smoke flows.

## Preview security boundary

The server adds same-origin security headers, request-size bounds, API rate limiting, server-only secrets, safe static-path resolution, immutable caching for hashed assets, and graceful shutdown. This is appropriate for a limited preview, not unrestricted production traffic.

Before broad public exposure, add edge-level abuse controls and monitoring, set an OpenRouter spend cap, decide whether model features require access control, and run a dependency/security review. Civic photos remain local to the browser and are never sent to this server.

## Operational checks

- `GET /healthz` — liveness, build identifier, and model configuration state.
- `GET /readyz` — process completed startup with a readable static build.
- `POST /api/interpret` — optional OpenRouter Trip Brief interpretation; the browser falls back locally on failure.
- `POST /api/insights` — bounded model ranking with deterministic server fallback.
- Static assets under `/assets/` — one-year immutable cache; HTML and client routes use revalidation.
- Text assets — gzip when the browser accepts it. A reverse proxy may also add Brotli or cache responses.
