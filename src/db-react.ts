import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and, inArray, isNull, or, sql } from "drizzle-orm";
import {
  recipes,
  ingredientDictionary,
  shoppingList,
  mealPlan,
  apiKeys,
  userProfiles,
  households,
  householdMemberships,
} from "./schema.js";
import type { RecipeData } from "./types.js";
import { isSimilar } from "./ingredient-dictionary.js";
import {
  CATEGORY_KEYWORDS,
  detectCategory,
  evaluateIngredientSearch,
} from "./ingredient-category-domain.js";

export { CATEGORY_KEYWORDS, detectCategory };

export type RecipeOwner =
  | { type: "user"; userId: string }
  | { type: "household"; householdId: string };

export interface RecipeAuthContext {
  userId: string;
  memberships: Array<{ householdId: string }>;
}

function recipeOwnerValues(owner: RecipeOwner, createdBy: string) {
  if (owner.type === "user") {
    return {
      ownerType: "user",
      ownerUserId: owner.userId,
      householdId: null,
      createdBy,
    };
  }

  return {
    ownerType: "household",
    ownerUserId: null,
    householdId: owner.householdId,
    createdBy,
  };
}

function householdIdsForAuth(auth: RecipeAuthContext) {
  return auth.memberships.map((membership) => membership.householdId);
}

function recipeVisibilityForAuth(auth: RecipeAuthContext) {
  const householdIds = householdIdsForAuth(auth);
  const privateOwner = and(eq(recipes.ownerType, "user"), eq(recipes.ownerUserId, auth.userId));
  if (householdIds.length === 0) return privateOwner;

  return or(
    privateOwner,
    and(eq(recipes.ownerType, "household"), inArray(recipes.householdId, householdIds)),
  );
}

function canMutateRecipeForAuth(auth: RecipeAuthContext) {
  return recipeVisibilityForAuth(auth);
}

// ── DB connection (lazy singleton) ────────────────────────────────────────────

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function resolvePostgresSsl(connectionString: string) {
  try {
    const hostname = new URL(connectionString).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return false;
    }
  } catch {
    // Fall back to the safer default for malformed or unexpected URLs.
  }

  return 'require' as const;
}

function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL environment variable is required");
    _client = postgres(connectionString, {
      max: 10,
      ssl: resolvePostgresSsl(connectionString),
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 30,
    });
    _db = drizzle(_client, {
      schema: {
        recipes,
        ingredientDictionary,
        shoppingList,
        mealPlan,
        apiKeys,
        userProfiles,
        households,
        householdMemberships,
      },
    });
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
  transcript?: string,
  ownership?: { owner: RecipeOwner; createdBy: string },
): Promise<number> {
  if (!ownership) {
    throw new Error("Recipe ownership is required");
  }

  const db = getDb();
  const flatIngredients = recipe.ingredientGroups?.length
    ? recipe.ingredientGroups.flatMap(g => g.items)
    : recipe.ingredients;

  const rows = await db.insert(recipes).values({
    name:        recipe.name,
    emoji:       recipe.emoji,
    source_url:  sourceUrl,
    image_url:   recipe.imageUrl,
    servings:    recipe.servings,
    duration:    recipe.duration,
    calories:    recipe.calories,
    tags:        JSON.stringify(recipe.tags),
    ingredients: JSON.stringify(flatIngredients),
    steps:       JSON.stringify(recipe.steps),
    equipment:         recipe.equipment        ? JSON.stringify(recipe.equipment)        : null,
    nutrition_info:    recipe.nutritionInfo    ? JSON.stringify(recipe.nutritionInfo)    : null,
    ingredient_groups: recipe.ingredientGroups ? JSON.stringify(recipe.ingredientGroups) : null,
    category:    detectCategory(recipe.tags, recipe.name),
    transcript,
    ...recipeOwnerValues(ownership.owner, ownership.createdBy),
  }).returning({ id: recipes.id });

  return rows[0].id;
}

export async function getAllRecipesFromReactDb(auth: RecipeAuthContext) {
  const db = getDb();
  const rows = await db.select().from(recipes).where(recipeVisibilityForAuth(auth)).orderBy(recipes.created_at);
  return rows.map(deserialize);
}

export async function getRecipeListFromReactDb(auth: RecipeAuthContext) {
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
    .where(recipeVisibilityForAuth(auth))
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
  options: SearchRecipesOptions,
  auth: RecipeAuthContext,
): Promise<RecipeSearchResult[]> {
  const db = getDb();
  const allRows = await db.select().from(recipes).where(recipeVisibilityForAuth(auth));
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
    const {
      matchedIngredients,
      missingIngredients,
      matchScore,
    } = evaluateIngredientSearch(recipe.ingredients, searchTerms);

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
export async function searchRecipesByIngredients(ingredients: string[], auth: RecipeAuthContext) {
  const db = getDb();
  const allRows = await db.select().from(recipes).where(recipeVisibilityForAuth(auth));
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

export async function getRecipeByIdFromReactDb(id: number, auth: RecipeAuthContext) {
  const db = getDb();
  const rows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), recipeVisibilityForAuth(auth)));
  return rows[0] ? deserialize(rows[0]) : null;
}

export async function updateRecipeInReactDb(id: number, auth: RecipeAuthContext, fields: Partial<RecipeData>): Promise<boolean> {
  const db = getDb();
  const values: Record<string, unknown> = {};
  if (fields.name        !== undefined) values.name        = fields.name;
  if (fields.emoji       !== undefined) values.emoji       = fields.emoji;
  if (fields.servings    !== undefined) values.servings    = fields.servings;
  if (fields.duration    !== undefined) values.duration    = fields.duration;
  if (fields.calories    !== undefined) values.calories    = fields.calories;
  if (fields.imageUrl    !== undefined) values.image_url   = fields.imageUrl;
  if (fields.tags        !== undefined) values.tags        = JSON.stringify(fields.tags);
  if (fields.ingredientGroups !== undefined) {
    const groups = fields.ingredientGroups;
    values.ingredient_groups = groups.length > 0 ? JSON.stringify(groups) : null;
    values.ingredients = JSON.stringify(groups.flatMap(g => g.items));
  } else if (fields.ingredients !== undefined) {
    values.ingredients = JSON.stringify(fields.ingredients);
    values.ingredient_groups = null;
  }
  if (fields.steps !== undefined) values.steps = JSON.stringify(fields.steps);
  if ((fields as any).rating      !== undefined) values.rating      = (fields as any).rating;
  if ((fields as any).notes       !== undefined) values.notes       = (fields as any).notes;
  if ((fields as any).category    !== undefined) values.category    = (fields as any).category;
  if ((fields as any).pdf_created !== undefined) values.pdf_created = (fields as any).pdf_created;
  if (Object.keys(values).length === 0) return false;
  values.updated_at = sql`now()`;
  const rows = await db
    .update(recipes)
    .set(values)
    .where(and(eq(recipes.id, id), canMutateRecipeForAuth(auth)))
    .returning({ id: recipes.id });
  return rows.length > 0;
}

export async function deleteRecipeFromReactDb(id: number, auth: RecipeAuthContext): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), canMutateRecipeForAuth(auth)))
    .returning({ id: recipes.id });
  return rows.length > 0;
}

export async function recipeBelongsToHousehold(recipeId: number, householdId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(
      eq(recipes.id, recipeId),
      eq(recipes.ownerType, "household"),
      eq(recipes.householdId, householdId),
    ))
    .limit(1);
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
    equipment:         row.equipment         ? JSON.parse(row.equipment)         as string[]                               : undefined,
    nutritionInfo:     row.nutrition_info    ? JSON.parse(row.nutrition_info)    as { carbs?: string; fat?: string; protein?: string; fiber?: string } : undefined,
    ingredientGroups:  row.ingredient_groups ? JSON.parse(row.ingredient_groups) as { heading: string; items: string[] }[] : undefined,
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

export async function deleteDictionaryEntry(id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(ingredientDictionary).where(eq(ingredientDictionary.id, id)).returning({ id: ingredientDictionary.id });
  return rows.length > 0;
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

// ── AuthZ Context ─────────────────────────────────────────────────────────────

export type AppRole = "user" | "admin";
export type HouseholdRole = "owner" | "member";

export interface UserAuthorization {
  appRole: AppRole;
  memberships: Array<{ householdId: string; role: HouseholdRole }>;
  activeHouseholdId: string | null;
}

function normalizeAppRole(role: string | null | undefined): AppRole {
  return role === "admin" ? "admin" : "user";
}

function normalizeHouseholdRole(role: string | null | undefined): HouseholdRole {
  return role === "owner" ? "owner" : "member";
}

function compareHouseholdMemberships(
  a: { householdId: string; role: HouseholdRole },
  b: { householdId: string; role: HouseholdRole },
) {
  if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
  return a.householdId.localeCompare(b.householdId);
}

export function chooseActiveHouseholdId(
  memberships: Array<{ householdId: string; role: HouseholdRole }>,
): string | null {
  return [...memberships].sort(compareHouseholdMemberships)[0]?.householdId ?? null;
}

export async function loadUserAuthorization(userId: string, email?: string | null): Promise<UserAuthorization> {
  const db = getDb();
  const [profile] = await db
    .select({ appRole: userProfiles.appRole })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    await db
      .insert(userProfiles)
      .values({ userId, email: email ?? null, appRole: "user" })
      .onConflictDoNothing({ target: userProfiles.userId });
  }

  const memberships = await db
    .select({
      householdId: householdMemberships.householdId,
      role: householdMemberships.role,
    })
    .from(householdMemberships)
    .where(eq(householdMemberships.userId, userId));

  const normalizedMemberships = memberships.map((membership) => ({
    householdId: membership.householdId,
    role: normalizeHouseholdRole(membership.role),
  })).sort(compareHouseholdMemberships);

  const activeHouseholdId = chooseActiveHouseholdId(normalizedMemberships);

  return {
    appRole: normalizeAppRole(profile?.appRole),
    memberships: normalizedMemberships,
    activeHouseholdId,
  };
}

// ── Shopping List ─────────────────────────────────────────────────────────────

export async function getShoppingList(householdId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(shoppingList)
    .where(eq(shoppingList.householdId, householdId))
    .orderBy(shoppingList.createdAt);
  return rows.map(serializeShoppingItem);
}

export async function addToShoppingList(
  householdId: string,
  userId: string,
  recipeId: number | null,
  canonicalName: string,
  quantity?: string,
  unit?: string,
): Promise<{ id: number }> {
  const db = getDb();

  // Insert with conflict guard: the unique index on (household_id, recipe_id, canonical_name)
  // with NULLS NOT DISTINCT blocks duplicate entries at DB level.
  // When a conflict is detected Postgres skips the insert and returns an empty rows array.
  const rows = await db
    .insert(shoppingList)
    .values({ householdId, userId, recipeId, canonicalName, quantity, unit })
    .onConflictDoNothing({
      target: [shoppingList.householdId, shoppingList.recipeId, shoppingList.canonicalName],
    })
    .returning({ id: shoppingList.id });

  if (rows.length > 0) {
    return rows[0];
  }

  // Conflict occurred — look up the existing row so the caller gets a stable id.
  const recipeCondition = recipeId === null
    ? isNull(shoppingList.recipeId)
    : eq(shoppingList.recipeId, recipeId);

  const existing = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(and(eq(shoppingList.householdId, householdId), recipeCondition, eq(shoppingList.canonicalName, canonicalName)))
    .limit(1);

  if (!existing[0]) {
    throw new Error("Shopping list conflict detected but existing row could not be loaded");
  }

  return existing[0];
}

export async function toggleShoppingItem(householdId: string, id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(shoppingList)
    .set({ checked: sql`NOT ${shoppingList.checked}` })
    .where(and(eq(shoppingList.householdId, householdId), eq(shoppingList.id, id)))
    .returning({ id: shoppingList.id });
  return rows.length > 0;
}

export async function deleteShoppingItem(householdId: string, id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(shoppingList)
    .where(and(eq(shoppingList.householdId, householdId), eq(shoppingList.id, id)))
    .returning({ id: shoppingList.id });
  return rows.length > 0;
}

export async function clearCheckedItems(householdId: string) {
  const db = getDb();
  await db.delete(shoppingList).where(and(eq(shoppingList.householdId, householdId), eq(shoppingList.checked, true)));
}

export async function clearAllShoppingItems(householdId: string) {
  const db = getDb();
  await db.delete(shoppingList).where(eq(shoppingList.householdId, householdId));
}

// ── Meal Plan ─────────────────────────────────────────────────────────────────

export async function getMealPlanForWeek(householdId: string, weekStart: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(mealPlan)
    .where(and(eq(mealPlan.householdId, householdId), eq(mealPlan.weekStart, weekStart)));
  return rows.map(serializeMealPlanEntry);
}

export async function addRecipeToMealPlan(householdId: string, userId: string, recipeId: number, dayOfWeek: number, weekStart: number) {
  const db = getDb();
  const rows = await db
    .insert(mealPlan)
    .values({ householdId, userId, recipeId, dayOfWeek, weekStart })
    .returning({ id: mealPlan.id });
  return rows[0];
}

export async function removeRecipeFromMealPlan(householdId: string, id: number): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(mealPlan)
    .where(and(eq(mealPlan.householdId, householdId), eq(mealPlan.id, id)))
    .returning({ id: mealPlan.id });
  return rows.length > 0;
}

export async function clearMealPlanForWeek(householdId: string, weekStart: number) {
  const db = getDb();
  await db.delete(mealPlan).where(and(eq(mealPlan.householdId, householdId), eq(mealPlan.weekStart, weekStart)));
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
