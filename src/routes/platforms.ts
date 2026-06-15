import { Hono } from "hono";
import { getUserAuth, requireUserAuth } from "../auth.js";
import { removeLegacyCookidooFiles } from "../fetchers/cookidoo.js";
import {
  deleteHouseholdCookidooShare,
  deleteUserCookidooCredentials,
  getCookidooStatus,
  saveUserCookidooCredentials,
  shareCookidooCredentialsToHousehold,
} from "../db-react.js";

const app = new Hono();

// Cookidoo credentials management
app.get("/api/v1/cookidoo/status", requireUserAuth(), async (c) => {
  try {
    removeLegacyCookidooFiles();
    const auth = getUserAuth(c);
    const status = await getCookidooStatus(auth);
    return c.json(status);
  } catch (error) {
    console.error("Error getting Cookidoo status:", error);
    return c.json({ error: "Failed to get Cookidoo status" }, 500);
  }
});

app.post("/api/v1/cookidoo/credentials", requireUserAuth(), async (c) => {
  try {
    removeLegacyCookidooFiles();
    const auth = getUserAuth(c);
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    await saveUserCookidooCredentials(auth.userId, email, password);

    return c.json({
      success: true,
      scope: "user",
      message: "Cookidoo credentials saved successfully"
    });
  } catch (error) {
    console.error("Error saving Cookidoo credentials:", error);
    return c.json({ error: "Failed to save Cookidoo credentials" }, 500);
  }
});

app.delete("/api/v1/cookidoo/credentials", requireUserAuth(), async (c) => {
  try {
    removeLegacyCookidooFiles();
    const auth = getUserAuth(c);
    await deleteUserCookidooCredentials(auth.userId);

    return c.json({
      success: true,
      scope: "user",
      message: "Cookidoo credentials removed"
    });
  } catch (error) {
    console.error("Error removing Cookidoo credentials:", error);
    return c.json({ error: "Failed to remove Cookidoo credentials" }, 500);
  }
});

app.post("/api/v1/cookidoo/credentials/share", requireUserAuth(), async (c) => {
  try {
    removeLegacyCookidooFiles();
    const auth = getUserAuth(c);
    const shared = await shareCookidooCredentialsToHousehold(auth).catch((error) => {
      if (error instanceof Error && error.message.includes("Private Cookidoo credentials")) {
        return error;
      }
      throw error;
    });

    if (shared instanceof Error) {
      return c.json({ error: shared.message }, 400);
    }

    if (!shared) {
      return c.json({ error: "Only household owners can manage Cookidoo sharing" }, 403);
    }

    return c.json({
      success: true,
      scope: "household",
      message: "Cookidoo credentials shared with household",
    });
  } catch (error) {
    console.error("Error sharing Cookidoo credentials:", error);
    return c.json({ error: "Failed to share Cookidoo credentials" }, 500);
  }
});

app.delete("/api/v1/cookidoo/credentials/share", requireUserAuth(), async (c) => {
  try {
    removeLegacyCookidooFiles();
    const auth = getUserAuth(c);
    const removed = await deleteHouseholdCookidooShare(auth);
    if (!removed) {
      return c.json({ error: "Only household owners can manage Cookidoo sharing" }, 403);
    }

    return c.json({
      success: true,
      scope: "household",
      message: "Cookidoo household sharing removed",
    });
  } catch (error) {
    console.error("Error removing Cookidoo household share:", error);
    return c.json({ error: "Failed to remove Cookidoo household share" }, 500);
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
    // Allowlist: safe raster formats only. SVG is excluded because it can contain
    // <script> tags — serving it from our origin would enable XSS.
    const SAFE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
    const mimeType = contentType.split(";")[0].trim();
    if (!SAFE_IMAGE_TYPES.includes(mimeType)) {
      return c.json({ error: "Unsupported image type" }, 415);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return c.json({ error: "Image too large" }, 413);
    }
    return new Response(buffer, {
      headers: { "Content-Type": mimeType, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return c.json({ error: "Failed to fetch image" }, 502);
  }
});

export default app;
