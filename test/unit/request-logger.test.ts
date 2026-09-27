import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  handleAppError,
  redactApiPath,
  requestLogger,
  shouldLogRequest,
} from "../../src/middleware/request-logger.js";
import { app as realApp } from "../../src/index.js";

function buildApp() {
  const app = new Hono();
  app.use(requestLogger());
  app.onError(handleAppError);
  app.get("/api/v1/ok", (c) => c.json({ ok: true }));
  app.get("/api/v1/share-invites/:token", (c) => c.json({ ok: true }));
  app.post("/api/v1/share-invites/:token/accept", (c) => c.json({ ok: true }));
  app.get("/api/v1/bad-gateway", (c) => c.text("nope", 502));
  app.get("/api/v1/throws", () => {
    throw new Error("kaputt");
  });
  app.get("/api/v1/teapot", () => {
    throw new HTTPException(418, { message: "teapot" });
  });
  app.get("/api/v1/health/live", (c) => c.json({ alive: true }));
  app.get("*", (c) => c.text("spa"));
  return app;
}

describe("request logger", () => {
  let log: ReturnType<typeof vi.spyOn>;
  let err: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    err = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const allOutput = () => [...log.mock.calls, ...err.mock.calls].map((args) => args.join(" ")).join("\n");

  it("logs one stdout line with method, path, status and duration", async () => {
    await buildApp().request("/api/v1/ok");

    expect(err).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^\[http\] GET \/api\/v1\/ok 200 \d+ms$/);
  });

  it("never logs the query string", async () => {
    await buildApp().request("/api/v1/ok?token=supersecret&x=1");

    expect(log.mock.calls[0][0]).toMatch(/^\[http\] GET \/api\/v1\/ok 200 \d+ms$/);
    expect(allOutput()).not.toContain("supersecret");
    expect(allOutput()).not.toContain("?");
  });

  it("redacts share-invite tokens in the path", async () => {
    const app = buildApp();
    await app.request("/api/v1/share-invites/abc123secrettoken");
    await app.request("/api/v1/share-invites/abc123secrettoken/accept", { method: "POST" });

    expect(log.mock.calls[0][0]).toMatch(/^\[http\] GET \/api\/v1\/share-invites\/:token 200 \d+ms$/);
    expect(log.mock.calls[1][0]).toMatch(/^\[http\] POST \/api\/v1\/share-invites\/:token\/accept 200 \d+ms$/);
    expect(allOutput()).not.toContain("abc123secrettoken");
  });

  it("writes 5xx responses to stderr", async () => {
    await buildApp().request("/api/v1/bad-gateway");

    expect(log).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toMatch(/^\[http\] GET \/api\/v1\/bad-gateway 502 \d+ms$/);
  });

  it("logs unhandled errors with stack to stderr and answers 500", async () => {
    const response = await buildApp().request("/api/v1/throws");

    expect(response.status).toBe(500);
    const lines = err.mock.calls.map((args) => String(args[0]));
    expect(lines.some((l) => l.startsWith("[error] GET /api/v1/throws Error: kaputt"))).toBe(true);
    expect(lines.some((l) => /^\[http\] GET \/api\/v1\/throws 500 \d+ms$/.test(l))).toBe(true);
  });

  it("keeps non-5xx HTTPExceptions quiet on stderr", async () => {
    const response = await buildApp().request("/api/v1/teapot");

    expect(response.status).toBe(418);
    expect(err).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toMatch(/^\[http\] GET \/api\/v1\/teapot 418 \d+ms$/);
  });

  it("skips the liveness probe, CORS preflights and non-API requests", async () => {
    const app = buildApp();
    await app.request("/api/v1/health/live");
    await app.request("/api/v1/ok", { method: "OPTIONS" });
    await app.request("/recipe/42");
    await app.request("/_expo/static/js/web/entry-abcdef12.js");

    expect(log).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it("is wired into the real app", async () => {
    await realApp.request("/api/v1/does-not-exist?secret=1");
    await realApp.request("/api/v1/health/live");

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/^\[http\] GET \/api\/v1\/does-not-exist 404 \d+ms$/);
  });
});

describe("redactApiPath / shouldLogRequest", () => {
  it("leaves ordinary id paths alone", () => {
    expect(redactApiPath("/api/v1/recipes/42/share-invites")).toBe("/api/v1/recipes/42/share-invites");
    expect(redactApiPath("/api/v1/extract/react/job-123")).toBe("/api/v1/extract/react/job-123");
  });

  it("caps very long paths", () => {
    expect(redactApiPath(`/api/${"a".repeat(500)}`).length).toBeLessThanOrEqual(203);
  });

  it("only logs API paths other than the liveness probe", () => {
    expect(shouldLogRequest("GET", "/api/v1/health")).toBe(true);
    expect(shouldLogRequest("GET", "/api/v1/health/live")).toBe(false);
    expect(shouldLogRequest("GET", "/assets/Logo.png")).toBe(false);
    expect(shouldLogRequest("OPTIONS", "/api/v1/recipes")).toBe(false);
  });
});
