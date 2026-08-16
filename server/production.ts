import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";
import { createRouteCityInsightMiddleware } from "./insights.ts";
import {
  createInterpretMiddleware,
  DEFAULT_OPENROUTER_MODEL,
  type OpenRouterConfig,
} from "./interpret.ts";
import { createWeatherMiddleware } from "./weather.ts";

const DEFAULT_PORT = 3000;
const DEFAULT_RATE_LIMIT = 30;
const ONE_MINUTE_MS = 60_000;

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface ProductionConfig {
  host: string;
  port: number;
  staticDir: string;
  buildSha: string;
  apiRateLimitPerMinute: number;
  trustProxy: boolean;
  openRouter: OpenRouterConfig;
}

export interface ProductionServerOptions extends ProductionConfig {
  now?: () => number;
}

function parseInteger(value: string | undefined, fallback: number, label: string, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return parsed;
}

export function loadProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
  workingDirectory = process.cwd(),
): ProductionConfig {
  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port: parseInteger(env.PORT, DEFAULT_PORT, "PORT", 1, 65_535),
    staticDir: resolve(workingDirectory, env.STATIC_DIR?.trim() || "dist"),
    buildSha: env.BUILD_SHA?.trim() || "unknown",
    apiRateLimitPerMinute: parseInteger(
      env.API_RATE_LIMIT_PER_MINUTE,
      DEFAULT_RATE_LIMIT,
      "API_RATE_LIMIT_PER_MINUTE",
      0,
      600,
    ),
    trustProxy: env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true",
    openRouter: {
      apiKey: env.OPENROUTER_API_KEY?.trim() || "",
      model: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    },
  };
}

function setSecurityHeaders(response: ServerResponse) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "geolocation=(), microphone=(), payment=(), usb=()");
}

function sendJson(request: IncomingMessage, response: ServerResponse, status: number, body: unknown) {
  const encoded = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", Buffer.byteLength(encoded));
  response.end(request.method === "HEAD" ? undefined : encoded);
}

function requestAddress(request: IncomingMessage, trustProxy: boolean) {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.socket.remoteAddress || "unknown";
}

function createRateLimiter(limit: number, trustProxy: boolean, now: () => number) {
  let activeWindow = Math.floor(now() / ONE_MINUTE_MS);
  const counts = new Map<string, number>();
  return (request: IncomingMessage) => {
    if (limit === 0) return { allowed: true, retryAfterSeconds: 0 };
    const currentWindow = Math.floor(now() / ONE_MINUTE_MS);
    if (currentWindow !== activeWindow) {
      counts.clear();
      activeWindow = currentWindow;
    }
    const address = requestAddress(request, trustProxy);
    const nextCount = (counts.get(address) ?? 0) + 1;
    counts.set(address, nextCount);
    return {
      allowed: nextCount <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil(((currentWindow + 1) * ONE_MINUTE_MS - now()) / 1_000)),
    };
  };
}

async function resolveStaticFile(staticDir: string, pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { status: 400 as const, path: null };
  }
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const candidate = resolve(staticDir, relative);
  if (candidate !== staticDir && !candidate.startsWith(`${staticDir}${sep}`)) {
    return { status: 404 as const, path: null };
  }
  try {
    const metadata = await stat(candidate);
    if (metadata.isFile()) return { status: 200 as const, path: candidate, metadata };
  } catch {
    // Extension-free client routes fall through to the SPA shell.
  }
  if (!extname(relative)) {
    const indexPath = resolve(staticDir, "index.html");
    try {
      const metadata = await stat(indexPath);
      if (metadata.isFile()) return { status: 200 as const, path: indexPath, metadata };
    } catch {
      // The startup check normally catches a missing index.
    }
  }
  return { status: 404 as const, path: null };
}

function isCompressible(contentType: string, size: number) {
  return size >= 1_024 && (
    contentType.startsWith("text/")
    || contentType.startsWith("application/json")
    || contentType.startsWith("application/javascript")
    || contentType.startsWith("image/svg+xml")
  );
}

async function serveStatic(request: IncomingMessage, response: ServerResponse, staticDir: string, pathname: string) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(request, response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Use GET to load this page." } });
    return;
  }
  const resolved = await resolveStaticFile(staticDir, pathname);
  if (!resolved.path || !resolved.metadata) {
    sendJson(request, response, resolved.status, { error: { code: resolved.status === 400 ? "INVALID_PATH" : "NOT_FOUND", message: "This page could not be found." } });
    return;
  }

  const contentType = contentTypes[extname(resolved.path).toLowerCase()] ?? "application/octet-stream";
  const etag = `W/\"${resolved.metadata.size}-${Math.floor(resolved.metadata.mtimeMs)}\"`;
  response.setHeader("Content-Type", contentType);
  response.setHeader("ETag", etag);
  response.setHeader("Cache-Control", pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache");
  if (request.headers["if-none-match"] === etag) {
    response.statusCode = 304;
    response.end();
    return;
  }
  response.statusCode = 200;
  const compressible = isCompressible(contentType, resolved.metadata.size);
  if (compressible) response.setHeader("Vary", "Accept-Encoding");
  if (request.method === "HEAD") {
    response.setHeader("Content-Length", resolved.metadata.size);
    response.end();
    return;
  }

  const acceptsGzip = /(?:^|,)\s*gzip(?:\s*;|\s*,|$)/i.test(request.headers["accept-encoding"] ?? "");
  const stream = createReadStream(resolved.path);
  stream.on("error", () => {
    if (!response.headersSent) sendJson(request, response, 500, { error: { code: "STATIC_ERROR", message: "This page could not be loaded." } });
    else response.destroy();
  });
  if (acceptsGzip && compressible) {
    response.setHeader("Content-Encoding", "gzip");
    stream.pipe(createGzip()).pipe(response);
  } else {
    response.setHeader("Content-Length", resolved.metadata.size);
    stream.pipe(response);
  }
}

export function createProductionServer(options: ProductionServerOptions): Server {
  const interpret = createInterpretMiddleware(options.openRouter);
  const insights = createRouteCityInsightMiddleware(options.openRouter);
  const weather = createWeatherMiddleware({ now: options.now });
  const rateLimit = createRateLimiter(
    options.apiRateLimitPerMinute,
    options.trustProxy,
    options.now ?? Date.now,
  );

  return createServer(async (request, response) => {
    setSecurityHeaders(response);
    let pathname: string;
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      sendJson(request, response, 400, { error: { code: "INVALID_PATH", message: "This request path could not be read." } });
      return;
    }

    try {
      if (pathname === "/healthz" || pathname === "/readyz") {
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.setHeader("Allow", "GET, HEAD");
          sendJson(request, response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Use GET for this check." } });
          return;
        }
        sendJson(request, response, 200, {
          status: pathname === "/readyz" ? "ready" : "ok",
          service: "footnote",
          build: options.buildSha,
          model: {
            configured: Boolean(options.openRouter.apiKey),
            name: options.openRouter.model || DEFAULT_OPENROUTER_MODEL,
          },
        });
        return;
      }

      if (pathname === "/api/weather") {
        await weather(request, response);
        return;
      }

      if (pathname === "/api/interpret" || pathname === "/api/insights") {
        if (request.method === "POST") {
          const limit = rateLimit(request);
          if (!limit.allowed) {
            response.setHeader("Retry-After", limit.retryAfterSeconds);
            sendJson(request, response, 429, { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again in a moment." } });
            return;
          }
        }
        await (pathname === "/api/interpret" ? interpret(request, response) : insights(request, response));
        return;
      }

      if (pathname.startsWith("/api/")) {
        sendJson(request, response, 404, { error: { code: "NOT_FOUND", message: "This API route does not exist." } });
        return;
      }

      await serveStatic(request, response, options.staticDir, pathname);
    } catch {
      if (!response.headersSent) {
        sendJson(request, response, 500, { error: { code: "INTERNAL_ERROR", message: "Footnote could not complete this request." } });
      } else {
        response.destroy();
      }
    }
  });
}

export async function assertStaticBuild(staticDir: string) {
  const indexPath = resolve(staticDir, "index.html");
  const metadata = await stat(indexPath).catch(() => null);
  if (!metadata?.isFile()) {
    throw new Error(`Production build not found at ${indexPath}. Run npm run build first.`);
  }
}

export async function startProductionServer(config = loadProductionConfig()) {
  await assertStaticBuild(config.staticDir);
  const server = createProductionServer(config);
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : config.port;
  console.log(`Footnote listening on http://${config.host}:${boundPort}`);

  const close = (signal: NodeJS.Signals) => {
    console.log(`${signal} received; finishing active requests.`);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  return server;
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  startProductionServer().catch((error) => {
    console.error(error instanceof Error ? error.message : "Footnote could not start.");
    process.exitCode = 1;
  });
}
