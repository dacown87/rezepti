import { Hono } from "hono";
import { saveCredentialsToDisk, clearCredentialsFromDisk, getSessionStatus, getCredentials, clearSession } from "../fetchers/cookidoo.js";
import { savePinterestCredentialsToDisk, clearPinterestCredentialsFromDisk, getPinterestStatus, getPinterestCredentials } from "../fetchers/pinterest.js";
import { hasFacebookCookies, getFacebookCookieDomains, validateFacebookCookies, saveFacebookCookies, clearFacebookCookies } from "../fetchers/facebook.js";

const app = new Hono();

// Cookidoo credentials management
app.get("/api/v1/cookidoo/status", (c) => {
  try {
    const status = getSessionStatus();
    const creds = getCredentials();
    return c.json({
      connected: status.connected,
      hasFileCredentials: status.hasFileCredentials,
      email: creds ? creds.email : null,
    });
  } catch (error) {
    console.error("Error getting Cookidoo status:", error);
    return c.json({ error: "Failed to get Cookidoo status" }, 500);
  }
});

app.post("/api/v1/cookidoo/credentials", async (c) => {
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

app.delete("/api/v1/cookidoo/credentials", (c) => {
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

// Pinterest credentials management
app.get("/api/v1/pinterest/status", (c) => {
  try {
    const status = getPinterestStatus();
    const creds = getPinterestCredentials();
    return c.json({
      connected: status.connected,
      hasFileCredentials: status.hasFileCredentials,
      hasAccessToken: !!(creds && creds.accessToken),
    });
  } catch (error) {
    console.error("Error getting Pinterest status:", error);
    return c.json({ error: "Failed to get Pinterest status" }, 500);
  }
});

app.post("/api/v1/pinterest/credentials", async (c) => {
  try {
    const { clientId, clientSecret, accessToken, refreshToken } = await c.req.json();

    if (!clientId || !clientSecret || !accessToken || !refreshToken) {
      return c.json(
        { error: "clientId, clientSecret, accessToken, and refreshToken are required" },
        400
      );
    }

    savePinterestCredentialsToDisk({ clientId, clientSecret, accessToken, refreshToken });

    return c.json({
      success: true,
      message: "Pinterest credentials saved successfully",
    });
  } catch (error) {
    console.error("Error saving Pinterest credentials:", error);
    return c.json({ error: "Failed to save Pinterest credentials" }, 500);
  }
});

app.delete("/api/v1/pinterest/credentials", (c) => {
  try {
    clearPinterestCredentialsFromDisk();
    return c.json({
      success: true,
      message: "Pinterest credentials removed",
    });
  } catch (error) {
    console.error("Error removing Pinterest credentials:", error);
    return c.json({ error: "Failed to remove Pinterest credentials" }, 500);
  }
});

// Facebook cookie management
app.get("/api/v1/facebook/status", (c) => {
  try {
    const hasCookies = hasFacebookCookies();
    const domains = getFacebookCookieDomains();
    return c.json({
      hasCookies,
      domains: hasCookies ? domains : [],
    });
  } catch (error) {
    console.error("Error getting Facebook cookie status:", error);
    return c.json({ error: "Failed to get Facebook cookie status" }, 500);
  }
});

app.post("/api/v1/facebook/cookies", async (c) => {
  try {
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      const body = await c.req.text();
      const validation = validateFacebookCookies(body);
      if (!validation.valid) {
        return c.json({ error: validation.error }, 400);
      }
      saveFacebookCookies(body);
      return c.json({
        success: true,
        message: "Facebook cookies saved successfully",
      });
    }

    const formData = await c.req.formData();
    const file = formData.get("cookies");
    if (!file || typeof file === "string") {
      return c.json({ error: "No cookie file provided" }, 400);
    }

    const content = await file.text();
    const validation = validateFacebookCookies(content);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    saveFacebookCookies(content);
    return c.json({
      success: true,
      message: "Facebook cookies saved successfully",
    });
  } catch (error) {
    console.error("Error saving Facebook cookies:", error);
    return c.json({ error: "Failed to save Facebook cookies" }, 500);
  }
});

app.delete("/api/v1/facebook/cookies", (c) => {
  try {
    clearFacebookCookies();
    return c.json({
      success: true,
      message: "Facebook cookies removed",
    });
  } catch (error) {
    console.error("Error removing Facebook cookies:", error);
    return c.json({ error: "Failed to remove Facebook cookies" }, 500);
  }
});

// Image proxy for PDF export (bypasses browser CORS restrictions)
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
