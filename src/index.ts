import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import type { Context } from "hono";
import { config } from "./config.js";
import reactApi from "./api-react.js";

export const app = new Hono();

// Gzip/Brotli compression for all responses
app.use(compress());

// CORS for mobile/dev clients (Expo web, local frontends)
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "https://p01--rezepti-app--2s7hvlwm5zc5.code.run",
];
app.use("/api/*", cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin ?? "") ? origin : null,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "x-groq-key"],
  exposeHeaders: [],
  maxAge: 86400,
}));

// Static file serving for public/
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

// HTML never cached — JS/CSS assets have content hashes and can be cached long-term
const NO_CACHE = "no-cache, no-store, must-revalidate";
const IMMUTABLE = "public, max-age=31536000, immutable";

function isHashedAsset(filePath: string): boolean {
  // Expo web output: _expo/static/js/web/entry-<hash>.js etc.
  return /[._-][a-f0-9]{8,}\./.test(filePath);
}

app.get("/", (c) => {
  const html = readFileSync(
    join(import.meta.dirname, "..", "public", "index.html"),
    "utf-8"
  );
  return c.html(html, 200, { "Cache-Control": NO_CACHE });
});

// Serve all static files from public/ (assets, icons, etc.)
function shouldUseLogoFallback(filePath: string): boolean {
  return /^assets\/Logo[^/]*\.png$/i.test(filePath);
}

function servePublicFile(c: Context, filePath: string) {
  const fullPath = join(import.meta.dirname, "..", "public", filePath);
  const ext = extname(fullPath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  try {
    const content = readFileSync(fullPath);
    const cacheControl = ext === ".html" || !isHashedAsset(filePath) ? NO_CACHE : IMMUTABLE;
    return c.body(content, 200, { "Content-Type": contentType, "Cache-Control": cacheControl });
  } catch {
    return c.text("Not found", 404);
  }
}

app.get("/public/*", (c) => servePublicFile(c, c.req.path.replace("/public/", "")));
app.get("/assets/*", (c) => {
  const filePath = c.req.path.slice(1);
  const fullPath = join(import.meta.dirname, "..", "public", filePath);

  try {
    statSync(fullPath);
  } catch {
    if (shouldUseLogoFallback(filePath)) {
      return servePublicFile(c, "Logo.png");
    }
  }

  return servePublicFile(c, filePath);
});
app.get("/vite.svg", (c) => servePublicFile(c, "vite.svg"));
app.get("/Logo.png", (c) => servePublicFile(c, "Logo.png"));
app.get("/changelog.json", (c) => {
  // Try public/ first (Expo web export output), fall back to frontend/public/ (Vite dev)
  const candidates = [
    join(import.meta.dirname, "..", "public", "changelog.json"),
    join(import.meta.dirname, "..", "frontend", "public", "changelog.json"),
  ];
  const fullPath = candidates.find(p => { try { statSync(p); return true; } catch { return false; } }) ?? candidates[1];
  try {
    const data = JSON.parse(readFileSync(fullPath, "utf-8"));
    const mtime = statSync(fullPath).mtime;
    data.lastUpdated = {
      date: mtime.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Berlin" }),
      time: mtime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }),
    };
    return c.json(data);
  } catch {
    return c.text("Not found", 404);
  }
});

// Mount React API routes
app.route("/", reactApi);

// SPA fallback: try public/ first, then serve index.html
app.get("*", (c) => {
  const path = c.req.path;
  if (path.startsWith("/api/")) {
    return c.text("Not found", 404);
  }
  // Try to serve as static file from public/
  const filePath = path.startsWith("/") ? path.slice(1) : path;
  if (filePath) {
    const fullPath = join(import.meta.dirname, "..", "public", filePath);
    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext];
    if (contentType) {
      try {
        const content = readFileSync(fullPath);
        const cacheControl = ext === ".html" || !isHashedAsset(filePath) ? NO_CACHE : IMMUTABLE;
        return c.body(content, 200, { "Content-Type": contentType, "Cache-Control": cacheControl });
      } catch {
        // file not found, fall through to SPA
      }
    }
  }
  // SPA fallback
  const html = readFileSync(
    join(import.meta.dirname, "..", "public", "index.html"),
    "utf-8"
  );
  return c.html(html, 200, { "Cache-Control": NO_CACHE });
});

// Start server
if (!process.env.VITEST) {
  const port = config.port;
  console.log(`Rezepti läuft auf http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
