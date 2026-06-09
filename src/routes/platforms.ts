import { Hono } from "hono";
import { saveCredentialsToDisk, clearCredentialsFromDisk, getSessionStatus, clearSession } from "../fetchers/cookidoo.js";
import { requireUserAuth } from "../auth.js";

const app = new Hono();

// Cookidoo credentials management
app.get("/api/v1/cookidoo/status", requireUserAuth(), (c) => {
  try {
    const status = getSessionStatus();
    return c.json({
      connected: status.connected,
      hasFileCredentials: status.hasFileCredentials,
    });
  } catch (error) {
    console.error("Error getting Cookidoo status:", error);
    return c.json({ error: "Failed to get Cookidoo status" }, 500);
  }
});

app.post("/api/v1/cookidoo/credentials", requireUserAuth(), async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    saveCredentialsToDisk(email, password);
    clearSession();

    return c.json({
      success: true,
      message: "Cookidoo credentials saved successfully"
    });
  } catch (error) {
    console.error("Error saving Cookidoo credentials:", error);
    return c.json({ error: "Failed to save Cookidoo credentials" }, 500);
  }
});

app.delete("/api/v1/cookidoo/credentials", requireUserAuth(), (c) => {
  try {
    clearCredentialsFromDisk();
    clearSession();

    return c.json({
      success: true,
      message: "Cookidoo credentials removed"
    });
  } catch (error) {
    console.error("Error removing Cookidoo credentials:", error);
    return c.json({ error: "Failed to remove Cookidoo credentials" }, 500);
  }
});

// Pinterest credentials management (not yet implemented)
app.get("/api/v1/pinterest/status", requireUserAuth(), (c) => {
  return c.json({ error: { code: "not_implemented" } }, 501);
});

app.post("/api/v1/pinterest/credentials", requireUserAuth(), (c) => {
  return c.json({ error: { code: "not_implemented" } }, 501);
});

app.delete("/api/v1/pinterest/credentials", requireUserAuth(), (c) => {
  return c.json({ error: { code: "not_implemented" } }, 501);
});

// Facebook cookie management (not yet implemented)
app.get("/api/v1/facebook/status", requireUserAuth(), (c) => {
  return c.json({ error: { code: "not_implemented" } }, 501);
});

app.post("/api/v1/facebook/cookies", requireUserAuth(), (c) => {
  return c.json({ error: { code: "not_implemented" } }, 501);
});

app.delete("/api/v1/facebook/cookies", requireUserAuth(), (c) => {
  return c.json({ error: { code: "not_implemented" } }, 501);
});

// Image proxy for PDF export (bypasses browser CORS restrictions)
// INTENTIONALLY unauthenticated — used for PDF export before login
app.get("/api/v1/proxy/image", async (c) => {
  const url = c.req.query("url");
  if (!url || !url.startsWith("https://")) {
    return c.json({ error: "Invalid URL" }, 400);
  }

  // SSRF guard: block private/metadata IP ranges
  try {
    const { hostname } = new URL(url);
    const blocked = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];
    if (blocked.some((r) => r.test(hostname))) {
      return c.json({ error: "Invalid URL" }, 400);
    }
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return c.json({ error: "Upstream error" }, 502);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return c.json({ error: "Not an image" }, 415);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return c.json({ error: "Image too large" }, 413);
    }
    return new Response(buffer, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return c.json({ error: "Failed to fetch image" }, 502);
  }
});

export default app;
