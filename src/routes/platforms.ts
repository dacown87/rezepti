import { Hono } from "hono";
import { getUserAuth, requireUserAuth } from "../auth.js";
import { removeLegacyCookidooFiles } from "../fetchers/cookidoo.js";
import { ResponseTooLargeError, SsrfBlockedError, safeFetch } from "../utils/safe-fetch.js";
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

// Allowlist: safe raster formats only. SVG is excluded because it can contain
// <script> tags — serving it from our origin would enable XSS.
const SAFE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

// Verifies the actual bytes against known image signatures instead of trusting
// the upstream Content-Type header alone.
function detectImageType(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF: "GIF8" (GIF87a / GIF89a)
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  // WebP: "RIFF" + 4 bytes + "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // AVIF: ISO-BMFF "ftyp" box with an "avif"/"avis" major brand
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

// Image proxy for PDF export (bypasses browser CORS restrictions). User-scoped:
// the only consumer (web PDF export) sends the Bearer header. SSRF-guarded via
// safeFetch; `Cache-Control: private` so authenticated images are never shared.
app.get("/api/v1/proxy/image", requireUserAuth(), async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "Invalid URL" }, 400);
  }

  let response: Response;
  try {
    response = await safeFetch(url, {}, { maxBytes: 5 * 1024 * 1024 });
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      console.warn(`[proxy] blocked ${error.host} (${error.reason})`);
      return c.json({ error: "Invalid URL" }, 400);
    }
    return c.json({ error: "Failed to fetch image" }, 502);
  }

  if (!response.ok) {
    return c.json({ error: "Upstream error" }, 502);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const headerMime = contentType.split(";")[0].trim().toLowerCase();
  if (!SAFE_IMAGE_TYPES.includes(headerMime)) {
    return c.json({ error: "Unsupported image type" }, 415);
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await response.arrayBuffer();
  } catch (error) {
    if (error instanceof ResponseTooLargeError) {
      return c.json({ error: "Image too large" }, 413);
    }
    return c.json({ error: "Failed to fetch image" }, 502);
  }

  const detectedType = detectImageType(new Uint8Array(buffer));
  if (!detectedType || !SAFE_IMAGE_TYPES.includes(detectedType)) {
    return c.json({ error: "Unsupported image type" }, 415);
  }

  return new Response(buffer, {
    headers: { "Content-Type": detectedType, "Cache-Control": "private, max-age=3600" },
  });
});

export default app;
