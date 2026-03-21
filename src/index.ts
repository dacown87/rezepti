import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { config } from "./config.js";
import { processURL } from "./pipeline.js";
import { ensureSchema, getAllRecipes, getRecipeById, deleteRecipe, updateRecipe } from "./db.js";
import { ensureReactSchema } from "./db-react.js";
import type { PipelineEvent } from "./types.js";
import { streamSSE } from "hono/streaming";
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

// List all saved recipes
app.get("/api/recipes", (c) => {
  const recipes = getAllRecipes();
  return c.json(recipes);
});

// Get a single recipe by ID
app.get("/api/recipes/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Ungültige ID" }, 400);
  const recipe = getRecipeById(id);
  if (!recipe) return c.json({ error: "Nicht gefunden" }, 404);
  return c.json(recipe);
});

// Update a recipe by ID
app.patch("/api/recipes/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Ungültige ID" }, 400);
  const body = await c.req.json();
  const updated = updateRecipe(id, body);
  if (!updated) return c.json({ error: "Nicht gefunden" }, 404);
  return c.json({ success: true });
});

// Delete a recipe by ID
app.delete("/api/recipes/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Ungültige ID" }, 400);
  const deleted = deleteRecipe(id);
  if (!deleted) return c.json({ error: "Nicht gefunden" }, 404);
  return c.json({ success: true });
});

// Health check
app.get("/api/health", (c) => {
  return c.json({
    server: true,
    groq: !!config.groq.apiKey,
  });
});

// Mount React API routes
app.route("/", reactApi);

// Start server
const port = config.port;
ensureSchema();
ensureReactSchema();
console.log(`Rezepti läuft auf http://localhost:${port}`);
console.log(`Legacy database: ${config.sqlite.path}`);
console.log(`React database:  ${config.sqlite.reactPath}`);
serve({ fetch: app.fetch, port });
