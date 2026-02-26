import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { config } from "./config.js";
import { processURL } from "./pipeline.js";
import { ensureDatabase } from "./notion.js";
import type { PipelineEvent } from "./types.js";
import { streamSSE } from "hono/streaming";

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

// Design variants
for (const v of ["v1", "v2", "v3", "v4"]) {
  app.get(`/${v}`, (c) => {
    const html = readFileSync(
      join(import.meta.dirname, "..", "public", `${v}.html`),
      "utf-8"
    );
    return c.html(html);
  });
}

app.get("/public/*", (c) => {
  const filePath = c.req.path.replace("/public/", "");
  const fullPath = join(import.meta.dirname, "..", "public", filePath);
  const ext = extname(fullPath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  try {
    const content = readFileSync(fullPath);
    return c.body(content, 200, { "Content-Type": contentType });
  } catch {
    return c.text("Not found", 404);
  }
});

// SSE endpoint for recipe processing
app.get("/api/extract", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "URL-Parameter fehlt" }, 400);
  }

  return streamSSE(c, async (stream) => {
    const sendEvent = async (event: PipelineEvent) => {
      await stream.writeSSE({
        event: event.stage,
        data: JSON.stringify(event),
      });
    };

    await processURL(url, sendEvent);
  });
});

// Health check
app.get("/api/health", async (c) => {
  const checks: Record<string, boolean> = {
    server: true,
  };

  // Check Ollama
  try {
    const res = await fetch(`${config.ollama.baseUrl}/api/tags`);
    checks.ollama = res.ok;
  } catch {
    checks.ollama = false;
  }

  // Check Notion
  checks.notion = !!config.notion.token;

  return c.json(checks);
});

// Start server
const port = config.port;
console.log(`Rezepti läuft auf http://localhost:${port}`);

if (config.notion.token) {
  ensureDatabase()
    .then(() => console.log("Notion-Datenbank bereit."))
    .catch((e) => console.warn("Notion-Warnung:", e.message));
}

serve({ fetch: app.fetch, port });
