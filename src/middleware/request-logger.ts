import type { Context, ErrorHandler, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// Minimal access log for the API. One line per request:
//   [http] GET /api/v1/recipes 200 12ms
// Deliberately logs only method, path, status and duration: no query string
// (it can carry tokens), no headers, no bodies, no user ids.

// Liveness probe is hit by Northflank every 30s and carries no information.
const SKIPPED_PATHS = new Set(["/api/v1/health/live"]);

// Path segments that are credentials. The share-invite token is the only
// secret that travels in a path today (every other `:param` is a row id).
const SECRET_SEGMENT_PATTERNS: Array<[RegExp, string]> = [
  [/^\/api\/v1\/share-invites\/[^/]+/, "/api/v1/share-invites/:token"],
];

const MAX_PATH_LENGTH = 200;

export function redactApiPath(path: string): string {
  let redacted = path;
  for (const [pattern, replacement] of SECRET_SEGMENT_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted.length > MAX_PATH_LENGTH ? `${redacted.slice(0, MAX_PATH_LENGTH)}...` : redacted;
}

export function shouldLogRequest(method: string, path: string): boolean {
  if (!path.startsWith("/api/")) return false; // static assets + SPA fallback
  if (method === "OPTIONS") return false; // CORS preflights
  return !SKIPPED_PATHS.has(path);
}

export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    // c.req.path never contains the query string.
    const path = c.req.path;
    const method = c.req.method;
    if (!shouldLogRequest(method, path)) return next();

    const start = performance.now();
    let status = 500;
    try {
      await next();
      status = c.res.status;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      const line = `[http] ${method} ${redactApiPath(path)} ${status} ${durationMs}ms`;
      if (status >= 500) console.error(line);
      else console.log(line);
    }
  };
}

// App-level error handler: unhandled errors become a 500 and are logged to
// stderr with the stack. HTTPExceptions keep their own response; only 5xx
// ones are logged.
export const handleAppError: ErrorHandler = (err, c: Context) => {
  const status = err instanceof HTTPException ? err.status : 500;
  if (status >= 500) {
    const where = `${c.req.method} ${redactApiPath(c.req.path)}`;
    console.error(`[error] ${where} ${err.stack ?? err.message}`);
  }
  if (err instanceof HTTPException) return err.getResponse();
  return c.text("Internal Server Error", 500);
};
