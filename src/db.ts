import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
import { recipes } from "./schema.js";
import type { RecipeData } from "./types.js";

function openDb() {
  const path = config.sqlite.path;
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema: { recipes } });
}

// Lazy singleton
let _db: ReturnType<typeof openDb> | null = null;
function getDb() {
  if (!_db) _db = openDb();
  return _db;
}

export function ensureSchema() {
  const db = getDb();
  // Create table if not exists (simple migration without drizzle-kit)
  db.$client.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      emoji       TEXT,
      source_url  TEXT,
      image_url   TEXT,
      servings    TEXT,
      duration    TEXT,
      calories    INTEGER,
      tags        TEXT,
      ingredients TEXT NOT NULL,
      steps       TEXT NOT NULL,
      transcript  TEXT,
      tried       INTEGER DEFAULT 0,
      created_at  INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function saveRecipe(
  recipe: RecipeData,
  sourceUrl: string,
  transcript?: string
): number {
  const db = getDb();
  const result = db.insert(recipes).values({
    name:        recipe.name,
    emoji:       recipe.emoji,
    source_url:  sourceUrl,
    image_url:   recipe.imageUrl,
    servings:    recipe.servings,
    duration:    recipe.duration,
    calories:    recipe.calories,
    tags:        JSON.stringify(recipe.tags),
    ingredients: JSON.stringify(recipe.ingredients),
    steps:       JSON.stringify(recipe.steps),
    transcript,
  }).returning({ id: recipes.id }).get();

  return result.id;
}

export function getAllRecipes() {
  const db = getDb();
  return db.select().from(recipes).orderBy(recipes.created_at).all().map(deserialize);
}

export function getRecipeById(id: number) {
  const db = getDb();
  const row = db.select().from(recipes).where(eq(recipes.id, id)).get();
  return row ? deserialize(row) : null;
}

function deserialize(row: typeof recipes.$inferSelect) {
  return {
    ...row,
    tags:        JSON.parse(row.tags ?? "[]") as string[],
    ingredients: JSON.parse(row.ingredients) as string[],
    steps:       JSON.parse(row.steps) as string[],
  };
}
