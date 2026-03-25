import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { config } from "./config.js";
import { ensureReactSchema } from "./db-react.js";
import reactApi from "./api-react.js";

const app = new Hono();

// Static file serving for public/
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
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
app.get("/changelog.json", (c) => {
  const fullPath = join(import.meta.dirname, "..", "frontend", "public", "changelog.json");
  try {
    const data = JSON.parse(readFileSync(fullPath, "utf-8"));
    const mtime = statSync(fullPath).mtime;
    data.lastUpdated = {
      date: mtime.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" }),
      time: mtime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    };
    return c.json(data);
  } catch {
    return c.text("Not found", 404);
  }
});

// Mount React API routes
app.route("/", reactApi);

// Start server
const port = config.port;
ensureReactSchema();
console.log(`Rezepti läuft auf http://localhost:${port}`);
serve({ fetch: app.fetch, port });
