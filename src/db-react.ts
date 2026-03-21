import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { recipes } from "./schema.js";
import type { RecipeData } from "./types.js";

/**
 * React-specific database connection
 * This uses a separate database file for React frontend
 */

function openReactDb() {
  const path = config.sqlite.reactPath;
  // Ensure we're using a relative path from current working directory
  const resolvedPath = path.startsWith('/') ? path : join(process.cwd(), path);
  const dir = dirname(resolvedPath);
  if (dir !== '.' && dir !== '/' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(resolvedPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema: { recipes } });
}

// Lazy singleton for React database
let _reactDb: ReturnType<typeof openReactDb> | null = null;
function getReactDb() {
  if (!_reactDb) _reactDb = openReactDb();
  return _reactDb;
}

/**
 * Ensure React database schema exists
 */
export function ensureReactSchema() {
  const db = getReactDb();
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

/**
 * Save recipe to React database
 */
export function saveRecipeToReactDb(
  recipe: RecipeData,
  sourceUrl: string,
  transcript?: string
): number {
  const db = getReactDb();
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

/**
 * Get all recipes from React database
 */
export function getAllRecipesFromReactDb() {
  const db = getReactDb();
  return db.select().from(recipes).orderBy(recipes.created_at).all().map(deserialize);
}

/**
 * Get single recipe by ID from React database
 */
export function getRecipeByIdFromReactDb(id: number) {
  const db = getReactDb();
  const row = db.select().from(recipes).where(eq(recipes.id, id)).get();
  return row ? deserialize(row) : null;
}

/**
 * Update recipe in React database
 */
export function updateRecipeInReactDb(id: number, fields: Partial<RecipeData>): boolean {
  const db = getReactDb();
  const values: Record<string, unknown> = {};
  if (fields.name        !== undefined) values.name        = fields.name;
  if (fields.emoji       !== undefined) values.emoji       = fields.emoji;
  if (fields.servings    !== undefined) values.servings    = fields.servings;
  if (fields.duration    !== undefined) values.duration    = fields.duration;
  if (fields.calories    !== undefined) values.calories    = fields.calories;
  if (fields.imageUrl    !== undefined) values.image_url   = fields.imageUrl;
  if (fields.tags        !== undefined) values.tags        = JSON.stringify(fields.tags);
  if (fields.ingredients !== undefined) values.ingredients = JSON.stringify(fields.ingredients);
  if (fields.steps       !== undefined) values.steps       = JSON.stringify(fields.steps);
  if (Object.keys(values).length === 0) return false;
  const result = db.update(recipes).set(values).where(eq(recipes.id, id)).returning({ id: recipes.id }).get();
  return !!result;
}

/**
 * Delete recipe from React database
 */
export function deleteRecipeFromReactDb(id: number): boolean {
  const db = getReactDb();
  const result = db.delete(recipes).where(eq(recipes.id, id)).returning({ id: recipes.id }).get();
  return !!result;
}

/**
 * Deserialize JSON fields from database row
 */
function deserialize(row: typeof recipes.$inferSelect) {
  return {
    ...row,
    tags:        JSON.parse(row.tags ?? "[]") as string[],
    ingredients: JSON.parse(row.ingredients) as string[],
    steps:       JSON.parse(row.steps) as string[],
  };
}