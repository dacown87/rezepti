import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, gte, lt } from "drizzle-orm";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { recipes, ingredientDictionary, shoppingList, mealPlan } from "./schema.js";
import type { RecipeData } from "./types.js";
import { isSimilar } from "./ingredient-dictionary.js";

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
  return drizzle(sqlite, { schema: { recipes, ingredientDictionary, shoppingList, mealPlan } });
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
      created_at  INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  // Migration: add created_at column to older DBs that lack it
  try { db.$client.exec(`ALTER TABLE recipes ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))`); } catch {}
  // Migration: rating + notes (Phase 3a)
  try { db.$client.exec(`ALTER TABLE recipes ADD COLUMN rating INTEGER`); } catch {}
  try { db.$client.exec(`ALTER TABLE recipes ADD COLUMN notes TEXT`); } catch {}
  // Migration: ingredient_dictionary (Phase 3c)
  try { db.$client.exec(`CREATE TABLE IF NOT EXISTS ingredient_dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_name TEXT NOT NULL UNIQUE,
    aliases TEXT
  )`); } catch {}
  // Migration: shopping_list (Phase 3c)
  try { db.$client.exec(`CREATE TABLE IF NOT EXISTS shopping_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER,
    canonical_name TEXT NOT NULL,
    quantity TEXT,
    unit TEXT,
    checked INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )`); } catch {}
  // Migration: meal_plan (Phase 5)
  try { db.$client.exec(`CREATE TABLE IF NOT EXISTS meal_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    week_start INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  )`); } catch {}
  // Migration: fix rows where created_at is NULL or stored as text (e.g. "2026-03-25 13:54:00")
  db.$client.exec(`UPDATE recipes SET created_at = strftime('%s', 'now') WHERE created_at IS NULL OR typeof(created_at) = 'text'`);
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
 * Search recipes by ingredients (OR logic - matches any ingredient)
 */
export function searchRecipesByIngredients(ingredients: string[]): ReturnType<typeof getAllRecipesFromReactDb> {
  const db = getReactDb();
  const allRecipes = db.select().from(recipes).all().map(deserialize);
  
  if (ingredients.length === 0) return allRecipes;
  
  const searchTerms = ingredients.map(i => i.toLowerCase().trim());
  
  return allRecipes.filter(recipe => {
    for (const ingredient of recipe.ingredients) {
      const ingredientLower = ingredient.toLowerCase();
      for (const term of searchTerms) {
        if (ingredientLower.includes(term)) {
          return true;
        }
      }
    }
    return false;
  });
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
  if ((fields as any).rating !== undefined) values.rating = (fields as any).rating;
  if ((fields as any).notes  !== undefined) values.notes  = (fields as any).notes;
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
 * Get recipe count from React database (lightweight COUNT query)
 */
export function getRecipeCount(): number {
  const db = getReactDb();
  const result = db.$client.prepare("SELECT COUNT(*) AS count FROM recipes").get() as { count: number };
  return result.count;
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

// Serializers: map Drizzle camelCase → snake_case for API/frontend compatibility
function serializeDictionaryEntry(row: typeof ingredientDictionary.$inferSelect) {
  return {
    id: row.id,
    canonical_name: row.canonicalName,
    aliases: JSON.parse(row.aliases ?? "[]") as string[],
  };
}

function serializeShoppingItem(row: typeof shoppingList.$inferSelect) {
  return {
    id: row.id,
    recipe_id: row.recipeId,
    canonical_name: row.canonicalName,
    quantity: row.quantity ?? undefined,
    unit: row.unit ?? undefined,
    checked: row.checked ?? false,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function serializeMealPlanEntry(row: typeof mealPlan.$inferSelect) {
  return {
    id: row.id,
    recipe_id: row.recipeId,
    day_of_week: row.dayOfWeek,
    week_start: row.weekStart,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

// ============ Ingredient Dictionary CRUD ============

export function getAllDictionaryEntries() {
  const db = getReactDb();
  return db.select().from(ingredientDictionary).all().map(serializeDictionaryEntry);
}

export function addToDictionary(canonicalName: string, aliases: string[] = []) {
  const db = getReactDb();
  return db.insert(ingredientDictionary).values({
    canonicalName,
    aliases: JSON.stringify(aliases),
  }).returning({ id: ingredientDictionary.id }).get();
}

export function findCanonicalBySimilarity(name: string) {
  const db = getReactDb();
  const entries = db.select().from(ingredientDictionary).all();

  for (const entry of entries) {
    const aliases = JSON.parse(entry.aliases ?? "[]") as string[];
    const allNames = [entry.canonicalName, ...aliases];

    for (const knownName of allNames) {
      if (isSimilar(name, knownName)) {
        return serializeDictionaryEntry(entry);
      }
    }
  }
  return null;
}

// ============ Shopping List CRUD ============

export function getShoppingList() {
  const db = getReactDb();
  return db.select().from(shoppingList).orderBy(shoppingList.createdAt).all().map(serializeShoppingItem);
}

export function addToShoppingList(recipeId: number | null, canonicalName: string, quantity?: string, unit?: string) {
  const db = getReactDb();
  return db.insert(shoppingList).values({
    recipeId,
    canonicalName,
    quantity,
    unit,
  }).returning({ id: shoppingList.id }).get();
}

export function toggleShoppingItem(id: number) {
  const db = getReactDb();
  const item = db.select().from(shoppingList).where(eq(shoppingList.id, id)).get();
  if (!item) return false;
  
  db.update(shoppingList).set({ checked: !item.checked }).where(eq(shoppingList.id, id)).run();
  return true;
}

export function deleteShoppingItem(id: number) {
  const db = getReactDb();
  const result = db.delete(shoppingList).where(eq(shoppingList.id, id)).returning({ id: shoppingList.id }).get();
  return !!result;
}

export function clearCheckedItems() {
  const db = getReactDb();
  db.delete(shoppingList).where(eq(shoppingList.checked, true)).run();
}

export function clearAllShoppingItems() {
  const db = getReactDb();
  db.delete(shoppingList).run();
}

// ============ Meal Plan CRUD ============

export function getMealPlanForWeek(weekStart: number) {
  const db = getReactDb();
  return db.select().from(mealPlan).where(eq(mealPlan.weekStart, weekStart)).all().map(serializeMealPlanEntry);
}

export function addRecipeToMealPlan(recipeId: number, dayOfWeek: number, weekStart: number) {
  const db = getReactDb();
  return db.insert(mealPlan).values({
    recipeId,
    dayOfWeek,
    weekStart,
  }).returning({ id: mealPlan.id }).get();
}

export function removeRecipeFromMealPlan(id: number) {
  const db = getReactDb();
  const result = db.delete(mealPlan).where(eq(mealPlan.id, id)).returning({ id: mealPlan.id }).get();
  return !!result;
}

export function clearMealPlanForWeek(weekStart: number) {
  const db = getReactDb();
  db.delete(mealPlan).where(eq(mealPlan.weekStart, weekStart)).run();
}