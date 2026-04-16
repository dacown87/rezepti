import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc } from "drizzle-orm";
import { recipes, ingredientDictionary, shoppingList, mealPlan, apiKeys } from "./schema.js";
import type { RecipeData } from "./types.js";
import { extractIngredientName, isSimilar } from "./ingredient-dictionary.js";

// ── Category auto-assignment ──────────────────────────────────────────────────
export const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: 'Auflauf',         keywords: ['auflauf', 'gratin', 'lasagne', 'überbacken'] },
  { category: 'Nudelgericht',    keywords: ['pasta', 'nudeln', 'spaghetti', 'penne', 'tagliatelle'] },
  { category: 'Fleischgericht',  keywords: ['fleisch', 'steak', 'schnitzel', 'hackfleisch', 'braten', 'gulasch'] },
  { category: 'Geflügel',        keywords: ['hähnchen', 'hühnchen', 'pute', 'geflügel'] },
  { category: 'Fischgericht',    keywords: ['fisch', 'lachs', 'thunfisch', 'shrimps', 'garnele', 'meeresfrüchte'] },
  { category: 'Suppe',           keywords: ['suppe', 'eintopf', 'brühe', 'cremesuppe', 'minestrone'] },
  { category: 'Salat',           keywords: ['salat'] },
  { category: 'Gebäck & Kuchen', keywords: ['kuchen', 'gebäck', 'muffin', 'torte', 'backen', 'kekse', 'brot'] },
  { category: 'Frühstück',       keywords: ['frühstück', 'pancake', 'pfannkuchen', 'porridge', 'müsli', 'granola'] },
  { category: 'Snack',           keywords: ['snack', 'vorspeise', 'fingerfood', 'dip', 'toast'] },
  { category: 'Vegetarisch',     keywords: ['vegetarisch', 'vegan'] },
  { category: 'Asiatisch',       keywords: ['asiatisch', 'wok', 'curry', 'sushi', 'ramen', 'thai', 'dim sum'] },
];

export function detectCategory(tags: string[], name: string): string | null {
  const text = [...tags, name].join(' ').toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return category;
  }
  return null;
}

// ── DB connection (lazy singleton) ────────────────────────────────────────────

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL environment variable is required");
    _client = postgres(connectionString, { max: 10, ssl: 'require' });
    _db = drizzle(_client, { schema: { recipes, ingredientDictionary, shoppingList, mealPlan, apiKeys } });
  }
  return _db;
}

// ── No-op: schema is managed via Supabase dashboard / migrations ──────────────
export function ensureReactSchema() {
  // PostgreSQL schema is managed externally (Supabase dashboard / drizzle-kit push).
  // This function is kept for API compatibility but does nothing.
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export async function saveRecipeToReactDb(
  recipe: RecipeData,
  sourceUrl: string,
  transcript?: string
): Promise<number> {
  const db = getDb();
  const rows = await db.insert(recipes).values({
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
    equipment:      recipe.equipment     ? JSON.stringify(recipe.equipment)     : null,
    nutrition_info: recipe.nutritionInfo ? JSON.stringify(recipe.nutritionInfo) : null,
    category:    detectCategory(recipe.tags, recipe.name),
    transcript,
  }).returning({ id: recipes.id });

  return rows[0].id;
}

export async function getAllRecipesFromReactDb() {
  const db = getDb();
  const rows = await db.select().from(recipes).orderBy(recipes.created_at);
  return rows.map(deserialize);
}

export async function getRecipeListFromReactDb() {
  const db = getDb();
  const rows = await db
    .select({
      id:         recipes.id,
      name:       recipes.name,
      emoji:      recipes.emoji,
      image_url:  recipes.image_url,
      tags:       recipes.tags,
      duration:   recipes.duration,
      calories:   recipes.calories,
      rating:     recipes.rating,
      tried:      recipes.tried,
      created_at: recipes.created_at,
    })
    .from(recipes)
    .orderBy(desc(recipes.created_at));
  return rows.map(deserializeListItem);
}

function deserializeListItem(row: {
  id: number;
  name: string;
  emoji: string | null;
  image_url: string | null;
  tags: string | null;
  duration: string | null;
  calories: number | null;
  rating: number | null;
  tried: boolean | null;
  created_at: Date | null;
}) {
  const imageUrl = row.image_url?.startsWith("data:")
    ? `/api/v1/recipes/${row.id}/image`
    : (row.image_url ?? undefined);
  return {
    ...row,
    image_url: imageUrl,
    imageUrl,
    tags: JSON.parse(row.tags ?? "[]") as string[],
  };
}

export type MatchMode = "and" | "or";

export interface RecipeSearchResult {
  recipe: Awaited<ReturnType<typeof getAllRecipesFromReactDb>>[number];
  matchScore: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

export interface SearchRecipesOptions {
  ingredients: string[];
  match?: MatchMode;
  threshold?: number;
}

export async function searchRecipesByIngredientsAdvanced(
  options: SearchRecipesOptions
): Promise<RecipeSearchResult[]> {
  const db = getDb();
  const allRows = await db.select().from(recipes);
  const allRecipes = allRows.map(deserialize);

  const { ingredients, match = "or", threshold = 0 } = options;

  if (ingredients.length === 0) {
    return allRecipes.map(recipe => ({
      recipe,
      matchScore: 0,
      matchedIngredients: [],
      missingIngredients: [],
    }));
  }

  const searchTerms = ingredients.map(i => i.toLowerCase().trim());
  const results: RecipeSearchResult[] = [];

  for (const recipe of allRecipes) {
    const matchedIngredients: string[] = [];
    const missingIngredients: string[] = [...searchTerms];

    for (const ingredient of recipe.ingredients) {
      const ingredientName = extractIngredientName(ingredient).toLowerCase();
      const ingredientLower = ingredient.toLowerCase();
      for (const term of searchTerms) {
        if (matchedIngredients.includes(term)) continue;
        const substringMatch = ingredientLower.includes(term);
        const fuzzyMatch = isSimilar(ingredientName, term) ||
                           ingredientName.includes(term) ||
                           term.includes(ingredientName);
        if (substringMatch || fuzzyMatch) {
          matchedIngredients.push(term);
          missingIngredients.splice(missingIngredients.indexOf(term), 1);
        }
      }
    }

    const matchScore = searchTerms.length > 0
      ? Math.round((matchedIngredients.length / searchTerms.length) * 100)
      : 0;

    const matches =
      match === "and"
        ? missingIngredients.length === 0
        : matchedIngredients.length > 0;

    if (matches && matchScore >= threshold) {
      results.push({ recipe, matchScore, matchedIngredients, missingIngredients });
    }
  }

  if (match === "or") {
    results.sort((a, b) => b.matchScore - a.matchScore);
  } else {
    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.missingIngredients.length - b.missingIngredients.length;
    });
  }

  return results;
}

/** @deprecated Use searchRecipesByIngredientsAdvanced */
export async function searchRecipesByIngredients(ingredients: string[]) {
  const db = getDb();
  const allRows = await db.select().from(recipes);
  const allRecipes = allRows.map(deserialize);

  if (ingredients.length === 0) return allRecipes;

  const searchTerms = ingredients.map(i => i.toLowerCase().trim());
  return allRecipes.filter(recipe => {
    for (const ingredient of recipe.ingredients) {
      const ingredientLower = ingredient.toLowerCase();
      for (const term of searchTerms) {
        if (ingredientLower.includes(term)) return true;
      }
    }
    return false;
  });
}

export async function getRecipeByIdFromReactDb(id: number) {
  const db = getDb();
  const rows = await db.select().from(recipes).where(eq(recipes.id, id));
  return rows[0] ? deserialize(rows[0]) : null;
}

export async function updateRecipeInReactDb(id: number, fields: Partial<RecipeData>): Promise<boolean> {
  const db = getDb();
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
  if ((fields as any).rating      !== undefined) values.rating      = (fields as any).rating;
  if ((fields as any).notes       !== undefined) values.notes       = (fields as any).notes;
  if ((fields as any).category    !== undefined) values.category    = (fields as any).category;
  if ((fields as any).pdf_created !== undefined) values.pdf_created = (fields as any).pdf_created;
  if (Object.keys(values).length === 0) return false;
  const rows = await db.update(recipes).set(values).where(eq(recipes.id, id)).returning({ id: recipes.id });
  return rows.length > 0;
}

export async function deleteRecipeFromReactDb(id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(recipes).where(eq(recipes.id, id)).returning({ id: recipes.id });
  return rows.length > 0;
}

export async function getRecipeCount(): Promise<number> {
  const db = getDb();
  const rows = await db.select({ id: recipes.id }).from(recipes);
  return rows.length;
}

// ── Deserialize ───────────────────────────────────────────────────────────────

function deserialize(row: typeof recipes.$inferSelect) {
  return {
    ...row,
    imageUrl:    row.image_url ?? undefined,
    tags:        JSON.parse(row.tags ?? "[]") as string[],
    ingredients: JSON.parse(row.ingredients) as string[],
    steps:       JSON.parse(row.steps) as string[],
    equipment:    row.equipment     ? JSON.parse(row.equipment)     as string[]                               : undefined,
    nutritionInfo: (row as any).nutrition_info ? JSON.parse((row as any).nutrition_info) as { carbs?: string; fat?: string; protein?: string } : undefined,
  };
}

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

// ── Ingredient Dictionary ─────────────────────────────────────────────────────

export async function getAllDictionaryEntries() {
  const db = getDb();
  const rows = await db.select().from(ingredientDictionary);
  return rows.map(serializeDictionaryEntry);
}

export async function addToDictionary(canonicalName: string, aliases: string[] = []) {
  const db = getDb();
  const rows = await db.insert(ingredientDictionary).values({
    canonicalName,
    aliases: JSON.stringify(aliases),
  }).returning({ id: ingredientDictionary.id });
  return rows[0];
}

export async function findCanonicalBySimilarity(name: string) {
  const db = getDb();
  const entries = await db.select().from(ingredientDictionary);

  for (const entry of entries) {
    const aliases = JSON.parse(entry.aliases ?? "[]") as string[];
    const allNames = [entry.canonicalName, ...aliases];
    for (const knownName of allNames) {
      if (isSimilar(name, knownName)) return serializeDictionaryEntry(entry);
    }
  }
  return null;
}

// ── Shopping List ─────────────────────────────────────────────────────────────

export async function getShoppingList() {
  const db = getDb();
  const rows = await db.select().from(shoppingList).orderBy(shoppingList.createdAt);
  return rows.map(serializeShoppingItem);
}

export async function addToShoppingList(recipeId: number | null, canonicalName: string, quantity?: string, unit?: string) {
  const db = getDb();
  const rows = await db.insert(shoppingList).values({
    recipeId,
    canonicalName,
    quantity,
    unit,
  }).returning({ id: shoppingList.id });
  return rows[0];
}

export async function toggleShoppingItem(id: number): Promise<boolean> {
  const db = getDb();
  const items = await db.select().from(shoppingList).where(eq(shoppingList.id, id));
  if (!items[0]) return false;
  await db.update(shoppingList).set({ checked: !items[0].checked }).where(eq(shoppingList.id, id));
  return true;
}

export async function deleteShoppingItem(id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(shoppingList).where(eq(shoppingList.id, id)).returning({ id: shoppingList.id });
  return rows.length > 0;
}

export async function clearCheckedItems() {
  const db = getDb();
  await db.delete(shoppingList).where(eq(shoppingList.checked, true));
}

export async function clearAllShoppingItems() {
  const db = getDb();
  await db.delete(shoppingList);
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────

export async function getMealPlanForWeek(weekStart: number) {
  const db = getDb();
  const rows = await db.select().from(mealPlan).where(eq(mealPlan.weekStart, weekStart));
  return rows.map(serializeMealPlanEntry);
}

export async function addRecipeToMealPlan(recipeId: number, dayOfWeek: number, weekStart: number) {
  const db = getDb();
  const rows = await db.insert(mealPlan).values({ recipeId, dayOfWeek, weekStart }).returning({ id: mealPlan.id });
  return rows[0];
}

export async function removeRecipeFromMealPlan(id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(mealPlan).where(eq(mealPlan.id, id)).returning({ id: mealPlan.id });
  return rows.length > 0;
}

export async function clearMealPlanForWeek(weekStart: number) {
  const db = getDb();
  await db.delete(mealPlan).where(eq(mealPlan.weekStart, weekStart));
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function storeApiKey(keyHash: string, model?: string) {
  const db = getDb();
  await db.insert(apiKeys)
    .values({ keyHash, model })
    .onConflictDoUpdate({ target: apiKeys.keyHash, set: { model } });
}

export async function removeApiKey(keyHash: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(apiKeys).where(eq(apiKeys.keyHash, keyHash)).returning({ id: apiKeys.id });
  return rows.length > 0;
}

export async function getApiKeyByHash(keyHash: string) {
  const db = getDb();
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
  return rows[0] ?? null;
}
