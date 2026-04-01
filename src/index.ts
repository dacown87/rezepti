import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { config } from "./config.js";
import { ensureReactSchema } from "./db-react.js";
import reactApi from "./api-react.js";

const app = new Hono();

// CORS for mobile/dev clients (Expo web, local frontends)
app.use("/api/*", cors({
  origin: (origin) => origin ?? "*",
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

app.get("/", (c) => {
  const html = readFileSync(
    join(import.meta.dirname, "..", "public", "index.html"),
    "utf-8"
  );
  return c.html(html);
});

// Serve all static files from public/ (assets, icons, etc.)
function servePublicFile(c: any, filePath: string) {
  const fullPath = join(import.meta.dirname, "..", "public", filePath);
  const ext = extname(fullPath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  try {
    const content = readFileSync(fullPath);
    return c.body(content, 200, { "Content-Type": contentType });
  } catch {
    return c.text("Not found", 404);
  }
}

app.get("/public/*", (c) => servePublicFile(c, c.req.path.replace("/public/", "")));
app.get("/assets/*", (c) => servePublicFile(c, c.req.path.slice(1)));
app.get("/vite.svg", (c) => servePublicFile(c, "vite.svg"));
app.get("/Logo.png", (c) => servePublicFile(c, "Logo.png"));
app.get("/changelog.json", (c) => {
  const fullPath = join(import.meta.dirname, "..", "frontend", "public", "changelog.json");
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
        return c.body(content, 200, { "Content-Type": contentType });
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
  return c.html(html);
});

// Start server
const port = config.port;
ensureReactSchema();
console.log(`Rezepti läuft auf http://localhost:${port}`);
serve({ fetch: app.fetch, port });
