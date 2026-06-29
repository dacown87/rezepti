import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and, inArray, isNull, or, sql, lt, count } from "drizzle-orm";
import {
  recipes,
  recipeCollections,
  recipeCollectionItems,
  ingredientDictionary,
  shoppingList,
  mealPlan,
  userProfiles,
  households,
  householdMemberships,
  userDefaultHouseholds,
  cookidooCredentials,
  bugReports,
  bugReportSubmissionRateLimits,
  pushSubscriptions,
  byokValidationRateLimits,
  byokValidationPolicies,
} from "./schema.js";
import type { BugReportRow } from "./schema.js";
import type { RecipeData } from "./types.js";
import { isSimilar } from "./ingredient-dictionary.js";
import {
  CATEGORY_KEYWORDS,
  detectCategory,
  evaluateIngredientSearch,
} from "./ingredient-category-domain.js";
import {
  BUG_REPORT_LIST_DEFAULT_LIMIT,
  BUG_REPORT_RATE_LIMIT_MAX_REQUESTS,
  BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  deriveResolvedAt,
  type BugReportAdminPatchInput,
  type BugReportFilters,
  type BugReportStatus,
  type BugReportType,
} from "./bug-reports.js";

export { CATEGORY_KEYWORDS, detectCategory };

export const BYOK_POLICY_APPLIES_TO = [
  "keys_validate",
  "extract_react",
  "extract_photo",
  "extract_text",
] as const;

export const DEFAULT_BYOK_VALIDATION_POLICY = {
  windowMinutes: 60,
  maxRequests: 20,
} as const;

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
        recipeCollections,
        recipeCollectionItems,
        ingredientDictionary,
        shoppingList,
        mealPlan,
        userProfiles,
        households,
        householdMemberships,
        userDefaultHouseholds,
        cookidooCredentials,
        bugReports,
        bugReportSubmissionRateLimits,
        pushSubscriptions,
        byokValidationRateLimits,
        byokValidationPolicies,
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

// ── Collections / Favorites / Sharing ──────────────────────────────────────────

export type CollectionOwnerType = "user" | "household";
export type CollectionKind = "favorites" | "custom";
export type FavoritesScope = "user" | { householdId: string };

export interface CollectionSummary {
  id: string;
  kind: CollectionKind;
  name: string;
  owner_type: CollectionOwnerType;
  item_count: number;
  is_system: boolean;
}

export interface RecipeShareReadModel {
  scope: "private" | "household";
  isFavorite: boolean;
  canShareToHousehold: boolean;
  canCopyToPrivate: boolean;
}

const FAVORITES_COLLECTION_NAME = "Favoriten";

/**
 * Minimal owner shape of a recipe, used by the shared legal-reference predicate.
 * Kept narrow so the same rule drives list/detail/share/collection checks.
 */
export interface RecipeOwnerRow {
  id: number;
  ownerType: string;
  ownerUserId: string | null;
  householdId: string | null;
}

/**
 * SINGLE source of truth: is the recipe owned by / visible to this auth context?
 * Mirrors the SQL predicate `recipeVisibilityForAuth` but operates on an already
 * loaded owner row so it can be reused for collection/share/read-model decisions.
 */
export function isRecipeVisibleToAuth(auth: RecipeAuthContext, owner: RecipeOwnerRow): boolean {
  if (owner.ownerType === "user") {
    return owner.ownerUserId === auth.userId;
  }
  if (owner.ownerType === "household") {
    return householdIdsForAuth(auth).includes(owner.householdId ?? "");
  }
  return false;
}

/**
 * SINGLE source of truth for whether `owner` is a legal reference target for a
 * collection of `collectionOwnerType` (binding rules from the brief):
 *  - private collection (user): caller's own private recipes AND household recipes
 *    visible to the caller.
 *  - household collection: ONLY recipes owned by that same household.
 */
export function isRecipeLegalForCollection(
  auth: RecipeAuthContext,
  owner: RecipeOwnerRow,
  collection: { ownerType: CollectionOwnerType; householdId: string | null },
): boolean {
  if (collection.ownerType === "user") {
    return isRecipeVisibleToAuth(auth, owner);
  }
  // household collection — only recipes owned by that same household
  return owner.ownerType === "household" && owner.householdId === collection.householdId;
}

async function loadRecipeOwnerRow(recipeId: number): Promise<RecipeOwnerRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: recipes.id,
      ownerType: recipes.ownerType,
      ownerUserId: recipes.ownerUserId,
      householdId: recipes.householdId,
    })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);
  return row ?? null;
}

function collectionVisibilityForAuth(auth: RecipeAuthContext) {
  const householdIds = householdIdsForAuth(auth);
  const privateOwner = and(
    eq(recipeCollections.ownerType, "user"),
    eq(recipeCollections.ownerUserId, auth.userId),
  );
  if (householdIds.length === 0) return privateOwner;
  return or(
    privateOwner,
    and(eq(recipeCollections.ownerType, "household"), inArray(recipeCollections.householdId, householdIds)),
  );
}

/** True if the caller may mutate (rename/delete/add to) the given collection row. */
function canMutateCollection(
  auth: RecipeAuthContext,
  collection: { ownerType: string; ownerUserId: string | null; householdId: string | null },
): boolean {
  if (collection.ownerType === "user") {
    return collection.ownerUserId === auth.userId;
  }
  if (collection.ownerType === "household") {
    return householdIdsForAuth(auth).includes(collection.householdId ?? "");
  }
  return false;
}

export async function getCollectionsForAuth(auth: RecipeAuthContext): Promise<CollectionSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: recipeCollections.id,
      kind: recipeCollections.kind,
      name: recipeCollections.name,
      ownerType: recipeCollections.ownerType,
      itemCount: count(recipeCollectionItems.id),
    })
    .from(recipeCollections)
    .leftJoin(recipeCollectionItems, eq(recipeCollectionItems.collectionId, recipeCollections.id))
    .where(collectionVisibilityForAuth(auth))
    .groupBy(
      recipeCollections.id,
      recipeCollections.kind,
      recipeCollections.name,
      recipeCollections.ownerType,
      recipeCollections.createdAt,
    )
    .orderBy(desc(recipeCollections.createdAt));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as CollectionKind,
    name: row.name,
    owner_type: row.ownerType as CollectionOwnerType,
    item_count: Number(row.itemCount ?? 0),
    is_system: row.kind === "favorites",
  }));
}

export async function createCollection(
  auth: RecipeAuthContext,
  input: { name: string; ownerType: CollectionOwnerType; householdId?: string },
): Promise<CollectionSummary> {
  const name = input.name.trim();
  if (!name) throw new Error("Collection name is required");

  let ownerValues: { ownerType: CollectionOwnerType; ownerUserId: string | null; householdId: string | null };
  if (input.ownerType === "user") {
    ownerValues = { ownerType: "user", ownerUserId: auth.userId, householdId: null };
  } else {
    const householdId = input.householdId;
    if (!householdId || !householdIdsForAuth(auth).includes(householdId)) {
      throw new Error("Not a member of the target household");
    }
    ownerValues = { ownerType: "household", ownerUserId: null, householdId };
  }

  const db = getDb();
  const [row] = await db
    .insert(recipeCollections)
    .values({
      ...ownerValues,
      kind: "custom",
      name,
      createdBy: auth.userId,
    })
    .returning({
      id: recipeCollections.id,
      kind: recipeCollections.kind,
      name: recipeCollections.name,
      ownerType: recipeCollections.ownerType,
    });

  return {
    id: row.id,
    kind: row.kind as CollectionKind,
    name: row.name,
    owner_type: row.ownerType as CollectionOwnerType,
    item_count: 0,
    is_system: false,
  };
}

export async function renameCollection(auth: RecipeAuthContext, id: string, name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Collection name is required");

  const db = getDb();
  const [collection] = await db
    .select({
      ownerType: recipeCollections.ownerType,
      ownerUserId: recipeCollections.ownerUserId,
      householdId: recipeCollections.householdId,
      kind: recipeCollections.kind,
    })
    .from(recipeCollections)
    .where(eq(recipeCollections.id, id))
    .limit(1);

  if (!collection || collection.kind !== "custom" || !canMutateCollection(auth, collection)) {
    return false;
  }

  const rows = await db
    .update(recipeCollections)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(recipeCollections.id, id))
    .returning({ id: recipeCollections.id });
  return rows.length > 0;
}

export async function deleteCollection(auth: RecipeAuthContext, id: string): Promise<boolean> {
  const db = getDb();
  const [collection] = await db
    .select({
      ownerType: recipeCollections.ownerType,
      ownerUserId: recipeCollections.ownerUserId,
      householdId: recipeCollections.householdId,
      kind: recipeCollections.kind,
    })
    .from(recipeCollections)
    .where(eq(recipeCollections.id, id))
    .limit(1);

  if (!collection || collection.kind !== "custom" || !canMutateCollection(auth, collection)) {
    return false;
  }

  const rows = await db
    .delete(recipeCollections)
    .where(eq(recipeCollections.id, id))
    .returning({ id: recipeCollections.id });
  return rows.length > 0;
}

async function loadCollectionForMutation(auth: RecipeAuthContext, collectionId: string) {
  const db = getDb();
  const [collection] = await db
    .select({
      id: recipeCollections.id,
      ownerType: recipeCollections.ownerType,
      ownerUserId: recipeCollections.ownerUserId,
      householdId: recipeCollections.householdId,
    })
    .from(recipeCollections)
    .where(eq(recipeCollections.id, collectionId))
    .limit(1);

  if (!collection || !canMutateCollection(auth, collection)) return null;
  return collection;
}

/**
 * Adds a recipe to a collection. Rejects (throws) if the recipe is not a legal
 * reference for the collection's owner type. Idempotent at the DB level via the
 * unique (collection_id, recipe_id) index.
 */
export async function addRecipeToCollection(
  auth: RecipeAuthContext,
  collectionId: string,
  recipeId: number,
): Promise<{ added: boolean }> {
  const collection = await loadCollectionForMutation(auth, collectionId);
  if (!collection) throw new Error("Collection not found or not writable");

  const owner = await loadRecipeOwnerRow(recipeId);
  if (!owner) throw new Error("Recipe not found");

  if (!isRecipeLegalForCollection(auth, owner, {
    ownerType: collection.ownerType as CollectionOwnerType,
    householdId: collection.householdId,
  })) {
    throw new Error("Recipe is not a legal reference for this collection");
  }

  const db = getDb();
  const rows = await db
    .insert(recipeCollectionItems)
    .values({ collectionId, recipeId, createdBy: auth.userId })
    .onConflictDoNothing({ target: [recipeCollectionItems.collectionId, recipeCollectionItems.recipeId] })
    .returning({ id: recipeCollectionItems.id });

  return { added: rows.length > 0 };
}

export async function removeRecipeFromCollection(
  auth: RecipeAuthContext,
  collectionId: string,
  recipeId: number,
): Promise<boolean> {
  const collection = await loadCollectionForMutation(auth, collectionId);
  if (!collection) return false;

  const db = getDb();
  const rows = await db
    .delete(recipeCollectionItems)
    .where(and(
      eq(recipeCollectionItems.collectionId, collectionId),
      eq(recipeCollectionItems.recipeId, recipeId),
    ))
    .returning({ id: recipeCollectionItems.id });
  return rows.length > 0;
}

/**
 * Returns the favorites collection id for the given scope, creating it on demand.
 * Idempotent: relies on the unique partial indexes; concurrent creates resolve to
 * the same row via onConflictDoNothing + re-select.
 */
export async function resolveFavoritesCollection(
  auth: RecipeAuthContext,
  scope: FavoritesScope,
): Promise<string> {
  const db = getDb();

  let where;
  let insertValues;
  if (scope === "user") {
    where = and(
      eq(recipeCollections.kind, "favorites"),
      eq(recipeCollections.ownerType, "user"),
      eq(recipeCollections.ownerUserId, auth.userId),
    );
    insertValues = {
      ownerType: "user" as const,
      ownerUserId: auth.userId,
      householdId: null,
      kind: "favorites" as const,
      name: FAVORITES_COLLECTION_NAME,
      createdBy: auth.userId,
    };
  } else {
    const householdId = scope.householdId;
    if (!householdIdsForAuth(auth).includes(householdId)) {
      throw new Error("Not a member of the target household");
    }
    where = and(
      eq(recipeCollections.kind, "favorites"),
      eq(recipeCollections.ownerType, "household"),
      eq(recipeCollections.householdId, householdId),
    );
    insertValues = {
      ownerType: "household" as const,
      ownerUserId: null,
      householdId,
      kind: "favorites" as const,
      name: FAVORITES_COLLECTION_NAME,
      createdBy: auth.userId,
    };
  }

  const [existing] = await db
    .select({ id: recipeCollections.id })
    .from(recipeCollections)
    .where(where)
    .limit(1);
  if (existing) return existing.id;

  const inserted = await db
    .insert(recipeCollections)
    .values(insertValues)
    .onConflictDoNothing()
    .returning({ id: recipeCollections.id });
  if (inserted[0]) return inserted[0].id;

  // Lost the create race — re-select the row the winner created.
  const [row] = await db
    .select({ id: recipeCollections.id })
    .from(recipeCollections)
    .where(where)
    .limit(1);
  if (!row) throw new Error("Favorites collection could not be resolved");
  return row.id;
}

export async function setFavorite(
  auth: RecipeAuthContext,
  recipeId: number,
  on: boolean,
  scope: FavoritesScope = "user",
): Promise<{ isFavorite: boolean }> {
  const collectionId = await resolveFavoritesCollection(auth, scope);
  if (on) {
    await addRecipeToCollection(auth, collectionId, recipeId);
  } else {
    await removeRecipeFromCollection(auth, collectionId, recipeId);
  }
  return { isFavorite: on };
}

export async function toggleFavorite(
  auth: RecipeAuthContext,
  recipeId: number,
  scope: FavoritesScope = "user",
): Promise<{ isFavorite: boolean }> {
  const db = getDb();
  const collectionId = await resolveFavoritesCollection(auth, scope);
  const [existing] = await db
    .select({ id: recipeCollectionItems.id })
    .from(recipeCollectionItems)
    .where(and(
      eq(recipeCollectionItems.collectionId, collectionId),
      eq(recipeCollectionItems.recipeId, recipeId),
    ))
    .limit(1);

  return setFavorite(auth, recipeId, !existing, scope);
}

/**
 * Sharing = copy. Creates a NEW recipe row (new id) copying content + media refs
 * with the new owner and `source_recipe_id` set to the original. NEVER mutates the
 * original.
 *  - target.type === 'household': copy to the caller's active household (membership
 *    required); only allowed if the source recipe is visible to the caller.
 *  - target.type === 'user': copy to the calling user; only allowed if the source
 *    recipe is visible to the caller.
 */
export async function shareCopyRecipe(
  auth: RecipeAuthContext,
  recipeId: number,
  target: { type: "household"; householdId?: string } | { type: "user" },
) {
  const db = getDb();
  const [original] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!original) throw new Error("Recipe not found");

  if (!isRecipeVisibleToAuth(auth, {
    id: original.id,
    ownerType: original.ownerType,
    ownerUserId: original.ownerUserId,
    householdId: original.householdId,
  })) {
    throw new Error("Recipe is not visible to the caller");
  }

  let ownerValues: ReturnType<typeof recipeOwnerValues>;
  if (target.type === "household") {
    const householdIds = householdIdsForAuth(auth);
    const householdId = target.householdId ?? householdIds[0];
    if (!householdId || !householdIds.includes(householdId)) {
      throw new Error("Not a member of the target household");
    }
    ownerValues = recipeOwnerValues({ type: "household", householdId }, auth.userId);
  } else {
    ownerValues = recipeOwnerValues({ type: "user", userId: auth.userId }, auth.userId);
  }

  const [copy] = await db
    .insert(recipes)
    .values({
      name:        original.name,
      emoji:       original.emoji,
      source_url:  original.source_url,
      image_url:   original.image_url,
      servings:    original.servings,
      duration:    original.duration,
      calories:    original.calories,
      tags:        original.tags,
      category:    original.category,
      ingredients: original.ingredients,
      steps:       original.steps,
      transcript:  original.transcript,
      equipment:          original.equipment,
      nutrition_info:     original.nutrition_info,
      ingredient_groups:  original.ingredient_groups,
      source_recipe_id:   original.id,
      ...ownerValues,
    })
    .returning();

  return deserialize(copy);
}

/**
 * Pure read-model mapper: given a recipe owner row + auth + flags, derives the
 * share/scope read model. `isFavorite` and `hasActiveHousehold` are resolved by
 * the caller (Phase 2) and passed in so this stays pure and unit-testable.
 */
export function deriveRecipeShareReadModel(
  auth: RecipeAuthContext,
  owner: RecipeOwnerRow,
  opts: { isFavorite: boolean; hasActiveHousehold: boolean },
): RecipeShareReadModel {
  const scope: "private" | "household" = owner.ownerType === "household" ? "household" : "private";
  return {
    scope,
    isFavorite: opts.isFavorite,
    canShareToHousehold: scope === "private" && opts.hasActiveHousehold,
    canCopyToPrivate: scope === "household",
  };
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

export type CookidooScopeType = "user" | "household";

export interface CookidooScopeRef {
  scopeType: CookidooScopeType;
  userId: string | null;
  householdId: string | null;
}

export interface CookidooAuthContext {
  userId: string;
  memberships: Array<{ householdId: string; role: HouseholdRole }>;
  activeHouseholdId: string | null;
}

export interface CookidooResolvedCredential extends CookidooScopeRef {
  email: string;
  password: string;
  sessionCookies: string | null;
  sessionUserAgent: string | null;
  sessionExpiresAt: Date | null;
}

export interface CookidooStatus {
  scope: CookidooScopeType | "none";
  connected: boolean;
  sharedByCurrentHousehold: boolean;
  canManageHouseholdShare: boolean;
}

export interface AccountBootstrapStatus {
  status: "ready";
  profile: {
    ready: true;
    userId: string;
    email: string | null;
    appRole: AppRole;
  };
  workspace: {
    ready: true;
    id: string;
    name: string;
    isDefault: boolean;
  };
  membership: {
    ready: true;
    householdId: string;
    role: HouseholdRole;
  };
  warnings: string[];
}

export interface ByokValidationPolicy {
  windowMinutes: number;
  maxRequests: number;
  source: "default" | "database";
  status: "uninitialized" | "active";
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByUserId: string | null;
  appliesTo: string[];
}

export interface RuntimeByokValidationPolicyLoad {
  policy: ByokValidationPolicy;
  fallbackReason?: "missing_table" | "read_failed";
}

export interface BugReportListItem {
  id: string;
  reportType: BugReportType;
  status: BugReportStatus;
  description: string;
  route: string | null;
  sourceArea: string;
  createdAt: string;
  updatedAt: string;
}

export interface BugReportDetail extends BugReportListItem {
  userId: string;
  householdId: string | null;
  metadata: Record<string, unknown>;
  adminNotes: string | null;
  resolvedAt: string | null;
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

function isHouseholdOwner(
  memberships: Array<{ householdId: string; role: HouseholdRole }>,
  householdId: string,
) {
  return memberships.some((membership) => membership.householdId === householdId && membership.role === "owner");
}

function serializeByokValidationPolicyRow(row?: {
  windowMinutes: number;
  maxRequests: number;
  updatedAt: Date | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
} | null): ByokValidationPolicy {
  if (!row) {
    return {
      windowMinutes: DEFAULT_BYOK_VALIDATION_POLICY.windowMinutes,
      maxRequests: DEFAULT_BYOK_VALIDATION_POLICY.maxRequests,
      source: "default",
      status: "uninitialized",
      updatedAt: null,
      updatedBy: null,
      updatedByUserId: null,
      appliesTo: [...BYOK_POLICY_APPLIES_TO],
    };
  }

  return {
    windowMinutes: row.windowMinutes,
    maxRequests: row.maxRequests,
    source: "database",
    status: "active",
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    updatedBy: row.updatedByEmail ?? null,
    updatedByUserId: row.updatedByUserId ?? null,
    appliesTo: [...BYOK_POLICY_APPLIES_TO],
  };
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  return code === "42P01" || /relation .*byok_validation_policies.* does not exist/i.test(message);
}

function serializeBugReportListItem(row: {
  id: string;
  reportType: string;
  status: string;
  description: string;
  route: string | null;
  sourceArea: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}): BugReportListItem {
  return {
    id: row.id,
    reportType: row.reportType as BugReportType,
    status: row.status as BugReportStatus,
    description: row.description,
    route: row.route ?? null,
    sourceArea: row.sourceArea,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

function serializeBugReportDetail(row: BugReportRow): BugReportDetail {
  return {
    id: row.id,
    reportType: row.reportType as BugReportType,
    status: row.status as BugReportStatus,
    description: row.description,
    userId: row.userId,
    householdId: row.householdId ?? null,
    route: row.route ?? null,
    sourceArea: row.sourceArea,
    metadata: (row.metadataJson ?? {}) as Record<string, unknown>,
    adminNotes: row.adminNotes ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

export async function saveUserCookidooCredentials(
  userId: string,
  email: string,
  password: string,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(cookidooCredentials)
    .values({
      scopeType: "user",
      userId,
      householdId: null,
      email,
      password,
      createdBy: userId,
      sessionCookies: null,
      sessionUserAgent: null,
      sessionExpiresAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: cookidooCredentials.userId,
      targetWhere: sql`${cookidooCredentials.scopeType} = 'user'`,
      set: {
        email,
        password,
        createdBy: userId,
        sessionCookies: null,
        sessionUserAgent: null,
        sessionExpiresAt: null,
        updatedAt: now,
      },
    });
}

export async function deleteUserCookidooCredentials(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .delete(cookidooCredentials)
    .where(and(eq(cookidooCredentials.scopeType, "user"), eq(cookidooCredentials.userId, userId)))
    .returning({ id: cookidooCredentials.id });
  return rows.length > 0;
}

export async function getCookidooPrivateCredentials(userId: string): Promise<Pick<CookidooResolvedCredential, "email" | "password"> | null> {
  const db = getDb();
  const [row] = await db
    .select({
      email: cookidooCredentials.email,
      password: cookidooCredentials.password,
    })
    .from(cookidooCredentials)
    .where(and(eq(cookidooCredentials.scopeType, "user"), eq(cookidooCredentials.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function shareCookidooCredentialsToHousehold(auth: CookidooAuthContext): Promise<boolean> {
  const householdId = auth.activeHouseholdId;
  if (!householdId || !isHouseholdOwner(auth.memberships, householdId)) {
    return false;
  }

  const privateCreds = await getCookidooPrivateCredentials(auth.userId);
  if (!privateCreds) {
    throw new Error("Private Cookidoo credentials are required before sharing");
  }

  const db = getDb();
  const now = new Date();
  await db
    .insert(cookidooCredentials)
    .values({
      scopeType: "household",
      userId: null,
      householdId,
      email: privateCreds.email,
      password: privateCreds.password,
      createdBy: auth.userId,
      sessionCookies: null,
      sessionUserAgent: null,
      sessionExpiresAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: cookidooCredentials.householdId,
      targetWhere: sql`${cookidooCredentials.scopeType} = 'household'`,
      set: {
        email: privateCreds.email,
        password: privateCreds.password,
        createdBy: auth.userId,
        sessionCookies: null,
        sessionUserAgent: null,
        sessionExpiresAt: null,
        updatedAt: now,
      },
    });

  return true;
}

export async function deleteHouseholdCookidooShare(auth: CookidooAuthContext): Promise<boolean> {
  const householdId = auth.activeHouseholdId;
  if (!householdId || !isHouseholdOwner(auth.memberships, householdId)) {
    return false;
  }

  const db = getDb();
  const rows = await db
    .delete(cookidooCredentials)
    .where(and(eq(cookidooCredentials.scopeType, "household"), eq(cookidooCredentials.householdId, householdId)))
    .returning({ id: cookidooCredentials.id });
  return rows.length > 0;
}

export async function resolveCookidooCredentials(auth: CookidooAuthContext): Promise<CookidooResolvedCredential | null> {
  const db = getDb();

  const [userRow] = await db
    .select({
      scopeType: cookidooCredentials.scopeType,
      userId: cookidooCredentials.userId,
      householdId: cookidooCredentials.householdId,
      email: cookidooCredentials.email,
      password: cookidooCredentials.password,
      sessionCookies: cookidooCredentials.sessionCookies,
      sessionUserAgent: cookidooCredentials.sessionUserAgent,
      sessionExpiresAt: cookidooCredentials.sessionExpiresAt,
    })
    .from(cookidooCredentials)
    .where(and(eq(cookidooCredentials.scopeType, "user"), eq(cookidooCredentials.userId, auth.userId)))
    .limit(1);

  if (userRow) {
    return {
      scopeType: "user",
      userId: userRow.userId,
      householdId: userRow.householdId,
      email: userRow.email,
      password: userRow.password,
      sessionCookies: userRow.sessionCookies,
      sessionUserAgent: userRow.sessionUserAgent,
      sessionExpiresAt: userRow.sessionExpiresAt,
    };
  }

  if (!auth.activeHouseholdId) {
    return null;
  }

  const [householdRow] = await db
    .select({
      scopeType: cookidooCredentials.scopeType,
      userId: cookidooCredentials.userId,
      householdId: cookidooCredentials.householdId,
      email: cookidooCredentials.email,
      password: cookidooCredentials.password,
      sessionCookies: cookidooCredentials.sessionCookies,
      sessionUserAgent: cookidooCredentials.sessionUserAgent,
      sessionExpiresAt: cookidooCredentials.sessionExpiresAt,
    })
    .from(cookidooCredentials)
    .where(and(eq(cookidooCredentials.scopeType, "household"), eq(cookidooCredentials.householdId, auth.activeHouseholdId)))
    .limit(1);

  if (!householdRow) {
    return null;
  }

  return {
    scopeType: "household",
    userId: householdRow.userId,
    householdId: householdRow.householdId,
    email: householdRow.email,
    password: householdRow.password,
    sessionCookies: householdRow.sessionCookies,
    sessionUserAgent: householdRow.sessionUserAgent,
    sessionExpiresAt: householdRow.sessionExpiresAt,
  };
}

export async function getCookidooStatus(auth: CookidooAuthContext): Promise<CookidooStatus> {
  const resolved = await resolveCookidooCredentials(auth);
  const db = getDb();
  const canManageHouseholdShare = !!auth.activeHouseholdId && isHouseholdOwner(auth.memberships, auth.activeHouseholdId);
  const [sharedRow] = auth.activeHouseholdId
    ? await db
        .select({ id: cookidooCredentials.id })
        .from(cookidooCredentials)
        .where(and(eq(cookidooCredentials.scopeType, "household"), eq(cookidooCredentials.householdId, auth.activeHouseholdId)))
        .limit(1)
    : [];

  return {
    scope: resolved?.scopeType ?? "none",
    connected: resolved !== null,
    sharedByCurrentHousehold: !!sharedRow,
    canManageHouseholdShare,
  };
}

export async function updateCookidooScopedSession(
  scope: CookidooScopeRef,
  session: {
    sessionCookies: string;
    sessionUserAgent: string;
    sessionExpiresAt: Date;
  },
): Promise<void> {
  const db = getDb();
  const where = scope.scopeType === "user"
    ? and(eq(cookidooCredentials.scopeType, "user"), eq(cookidooCredentials.userId, scope.userId!))
    : and(eq(cookidooCredentials.scopeType, "household"), eq(cookidooCredentials.householdId, scope.householdId!));

  await db
    .update(cookidooCredentials)
    .set({
      sessionCookies: session.sessionCookies,
      sessionUserAgent: session.sessionUserAgent,
      sessionExpiresAt: session.sessionExpiresAt,
      updatedAt: new Date(),
    })
    .where(where);
}

export async function clearCookidooScopedSession(scope: CookidooScopeRef): Promise<void> {
  const db = getDb();
  const where = scope.scopeType === "user"
    ? and(eq(cookidooCredentials.scopeType, "user"), eq(cookidooCredentials.userId, scope.userId!))
    : and(eq(cookidooCredentials.scopeType, "household"), eq(cookidooCredentials.householdId, scope.householdId!));

  await db
    .update(cookidooCredentials)
    .set({
      sessionCookies: null,
      sessionUserAgent: null,
      sessionExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(where);
}

export async function recordBugReportSubmissionAttempt(
  userId: string,
  windowMinutes = BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  maxRequests = BUG_REPORT_RATE_LIMIT_MAX_REQUESTS,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const db = getDb();
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const resetTime = windowStart.getTime() + windowMs;
  const cleanupBefore = new Date(now.getTime() - (windowMs * 24));

  await db
    .delete(bugReportSubmissionRateLimits)
    .where(lt(bugReportSubmissionRateLimits.windowStart, cleanupBefore));

  const [row] = await db
    .insert(bugReportSubmissionRateLimits)
    .values({
      userId,
      windowStart,
      requestCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        bugReportSubmissionRateLimits.userId,
        bugReportSubmissionRateLimits.windowStart,
      ],
      set: {
        requestCount: sql`${bugReportSubmissionRateLimits.requestCount} + 1`,
        updatedAt: now,
      },
    })
    .returning({
      requestCount: bugReportSubmissionRateLimits.requestCount,
    });

  const requestCount = row?.requestCount ?? 1;

  return {
    allowed: requestCount <= maxRequests,
    remaining: Math.max(0, maxRequests - requestCount),
    resetTime,
  };
}

export async function createBugReport(input: {
  reportType: BugReportType;
  sourceArea: string;
  description: string;
  userId: string;
  householdId?: string | null;
  route?: string | null;
  metadata: Record<string, unknown>;
}): Promise<BugReportDetail> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .insert(bugReports)
    .values({
      id: randomUUID(),
      reportType: input.reportType,
      status: "new",
      description: input.description,
      userId: input.userId,
      householdId: input.householdId ?? null,
      route: input.route ?? null,
      sourceArea: input.sourceArea,
      metadataJson: input.metadata,
      adminNotes: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return serializeBugReportDetail(row);
}

export async function listMyBugReports(
  userId: string,
  limit = BUG_REPORT_LIST_DEFAULT_LIMIT,
): Promise<BugReportListItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: bugReports.id,
      reportType: bugReports.reportType,
      status: bugReports.status,
      description: bugReports.description,
      route: bugReports.route,
      sourceArea: bugReports.sourceArea,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
    })
    .from(bugReports)
    .where(eq(bugReports.userId, userId))
    .orderBy(desc(bugReports.createdAt), desc(bugReports.id))
    .limit(limit);

  return rows.map(serializeBugReportListItem);
}

export async function listBugReportsForAdmin(filters: BugReportFilters = {}): Promise<BugReportListItem[]> {
  const db = getDb();
  const conditions = [
    filters.status ? eq(bugReports.status, filters.status) : undefined,
    filters.reportType ? eq(bugReports.reportType, filters.reportType) : undefined,
    filters.sourceArea ? eq(bugReports.sourceArea, filters.sourceArea) : undefined,
  ].filter((value): value is Exclude<typeof value, undefined> => Boolean(value));

  const rows = await db
    .select({
      id: bugReports.id,
      reportType: bugReports.reportType,
      status: bugReports.status,
      description: bugReports.description,
      route: bugReports.route,
      sourceArea: bugReports.sourceArea,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
    })
    .from(bugReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bugReports.createdAt), desc(bugReports.id))
    .limit(filters.limit ?? BUG_REPORT_LIST_DEFAULT_LIMIT)
    .offset(filters.offset ?? 0);

  return rows.map(serializeBugReportListItem);
}

export async function getBugReportByIdForAdmin(id: string): Promise<BugReportDetail | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bugReports)
    .where(eq(bugReports.id, id))
    .limit(1);

  return row ? serializeBugReportDetail(row) : null;
}

export async function updateBugReportAdminFields(
  id: string,
  patch: { status: BugReportStatus; adminNotes: string | null },
): Promise<BugReportDetail | null> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .update(bugReports)
    .set({
      status: patch.status,
      adminNotes: patch.adminNotes,
      resolvedAt: deriveResolvedAt(patch.status, now),
      updatedAt: now,
    })
    .where(eq(bugReports.id, id))
    .returning();

  return row ? serializeBugReportDetail(row) : null;
}

export async function ensureUserProfile(userId: string, email?: string | null): Promise<{ created: boolean }> {
  const db = getDb();
  const rows = await db
    .insert(userProfiles)
    .values({ userId, email: email ?? null, appRole: "user" })
    .onConflictDoNothing({ target: userProfiles.userId })
    .returning({ userId: userProfiles.userId });

  return { created: rows.length > 0 };
}

function defaultWorkspaceName() {
  return "Mein Workspace";
}

export async function ensureDefaultHouseholdForUser(userId: string): Promise<{ created: boolean; householdId: string }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [defaultRow] = await tx
      .select({
        householdId: userDefaultHouseholds.householdId,
      })
      .from(userDefaultHouseholds)
      .where(eq(userDefaultHouseholds.userId, userId))
      .limit(1);

    const memberships = await tx
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

    if (defaultRow) {
      const mappedMembership = normalizedMemberships.find((membership) => membership.householdId === defaultRow.householdId);
      if (mappedMembership) {
        return { created: false, householdId: defaultRow.householdId };
      }

      const activeMembershipId = chooseActiveHouseholdId(normalizedMemberships);
      if (activeMembershipId) {
        await tx
          .update(userDefaultHouseholds)
          .set({ householdId: activeMembershipId })
          .where(eq(userDefaultHouseholds.userId, userId));
        return { created: true, householdId: activeMembershipId };
      }

      await tx
        .insert(householdMemberships)
        .values({
          householdId: defaultRow.householdId,
          userId,
          role: "owner",
        })
        .onConflictDoNothing({ target: [householdMemberships.householdId, householdMemberships.userId] });

      return { created: true, householdId: defaultRow.householdId };
    }

    const activeMembershipId = chooseActiveHouseholdId(normalizedMemberships);
    if (activeMembershipId) {
      await tx
        .insert(userDefaultHouseholds)
        .values({
          userId,
          householdId: activeMembershipId,
        })
        .onConflictDoNothing({ target: userDefaultHouseholds.userId });

      const [existingDefault] = await tx
        .select({
          householdId: userDefaultHouseholds.householdId,
        })
        .from(userDefaultHouseholds)
        .where(eq(userDefaultHouseholds.userId, userId))
        .limit(1);

      return { created: true, householdId: existingDefault?.householdId ?? activeMembershipId };
    }

    const householdId = randomUUID();

    await tx.insert(households).values({
      id: householdId,
      name: defaultWorkspaceName(),
      createdBy: userId,
    });

    await tx
      .insert(householdMemberships)
      .values({
        householdId,
        userId,
        role: "owner",
      })
      .onConflictDoNothing({ target: [householdMemberships.householdId, householdMemberships.userId] });

    await tx.insert(userDefaultHouseholds).values({
      userId,
      householdId,
    });

    return { created: true, householdId };
  });
}

export async function getByokValidationPolicy(): Promise<ByokValidationPolicy> {
  const db = getDb();
  try {
    const [row] = await db
      .select({
        windowMinutes: byokValidationPolicies.windowMinutes,
        maxRequests: byokValidationPolicies.maxRequests,
        updatedAt: byokValidationPolicies.updatedAt,
        updatedByUserId: byokValidationPolicies.updatedByUserId,
        updatedByEmail: userProfiles.email,
      })
      .from(byokValidationPolicies)
      .leftJoin(userProfiles, eq(userProfiles.userId, byokValidationPolicies.updatedByUserId))
      .where(eq(byokValidationPolicies.singletonKey, "global"))
      .limit(1);

    return serializeByokValidationPolicyRow(row);
  } catch (error) {
    if (isMissingTableError(error)) {
      return serializeByokValidationPolicyRow(null);
    }
    throw error;
  }
}

export async function loadRuntimeByokValidationPolicy(): Promise<RuntimeByokValidationPolicyLoad> {
  try {
    const policy = await getByokValidationPolicy();
    return { policy };
  } catch (error) {
    if (isMissingTableError(error)) {
      return {
        policy: serializeByokValidationPolicyRow(null),
        fallbackReason: "missing_table",
      };
    }

    return {
      policy: serializeByokValidationPolicyRow(null),
      fallbackReason: "read_failed",
    };
  }
}

export async function upsertByokValidationPolicy(input: {
  windowMinutes: number;
  maxRequests: number;
  updatedByUserId: string;
}): Promise<ByokValidationPolicy> {
  const db = getDb();
  const now = new Date();

  await db
    .insert(byokValidationPolicies)
    .values({
      singletonKey: "global",
      windowMinutes: input.windowMinutes,
      maxRequests: input.maxRequests,
      updatedAt: now,
      updatedByUserId: input.updatedByUserId,
    })
    .onConflictDoUpdate({
      target: byokValidationPolicies.singletonKey,
      set: {
        windowMinutes: input.windowMinutes,
        maxRequests: input.maxRequests,
        updatedAt: now,
        updatedByUserId: input.updatedByUserId,
      },
    });

  return getByokValidationPolicy();
}

export async function recordByokValidationAttempt(
  userId: string,
  keyHash: string,
  windowMinutes = 60,
  maxRequests = 20,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const db = getDb();
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const resetTime = windowStart.getTime() + windowMs;
  const cleanupBefore = new Date(now.getTime() - (windowMs * 24));

  await db
    .delete(byokValidationRateLimits)
    .where(lt(byokValidationRateLimits.windowStart, cleanupBefore));

  const [row] = await db
    .insert(byokValidationRateLimits)
    .values({
      userId,
      keyHash,
      windowStart,
      requestCount: 1,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        byokValidationRateLimits.userId,
        byokValidationRateLimits.keyHash,
        byokValidationRateLimits.windowStart,
      ],
      set: {
        requestCount: sql`${byokValidationRateLimits.requestCount} + 1`,
        updatedAt: now,
      },
    })
    .returning({
      requestCount: byokValidationRateLimits.requestCount,
    });

  const requestCount = row?.requestCount ?? 1;

  return {
    allowed: requestCount <= maxRequests,
    remaining: Math.max(0, maxRequests - requestCount),
    resetTime,
  };
}

export async function getAccountBootstrapStatus(userId: string): Promise<AccountBootstrapStatus | null> {
  const db = getDb();

  const [profile] = await db
    .select({
      userId: userProfiles.userId,
      email: userProfiles.email,
      appRole: userProfiles.appRole,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const memberships = await db
    .select({
      householdId: householdMemberships.householdId,
      role: householdMemberships.role,
      householdName: households.name,
    })
    .from(householdMemberships)
    .innerJoin(households, eq(households.id, householdMemberships.householdId))
    .where(eq(householdMemberships.userId, userId));

  const normalizedMemberships = memberships.map((membership) => ({
    householdId: membership.householdId,
    role: normalizeHouseholdRole(membership.role),
    householdName: membership.householdName,
  })).sort((a, b) => compareHouseholdMemberships(a, b));

  const activeHouseholdId = chooseActiveHouseholdId(normalizedMemberships);
  if (!profile || !activeHouseholdId) {
    return null;
  }

  const activeMembership = normalizedMemberships.find((membership) => membership.householdId === activeHouseholdId);
  if (!activeMembership) {
    return null;
  }

  const [defaultRow] = await db
    .select({
      householdId: userDefaultHouseholds.householdId,
    })
    .from(userDefaultHouseholds)
    .where(eq(userDefaultHouseholds.userId, userId))
    .limit(1);

  return {
    status: "ready",
    profile: {
      ready: true,
      userId: profile.userId,
      email: profile.email ?? null,
      appRole: normalizeAppRole(profile.appRole),
    },
    workspace: {
      ready: true,
      id: activeMembership.householdId,
      name: activeMembership.householdName,
      isDefault: defaultRow?.householdId === activeMembership.householdId,
    },
    membership: {
      ready: true,
      householdId: activeMembership.householdId,
      role: activeMembership.role,
    },
    warnings: [],
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

export async function addRecipeToMealPlan(
  householdId: string,
  userId: string,
  recipeId: number,
  dayOfWeek: number,
  weekStart: number,
  clientOpId?: string | null,
) {
  const db = getDb();
  const rows = await db
    .insert(mealPlan)
    .values({ householdId, userId, recipeId, dayOfWeek, weekStart, clientOpId: clientOpId ?? null })
    .onConflictDoNothing({
      target: [mealPlan.householdId, mealPlan.clientOpId],
      where: sql`${mealPlan.clientOpId} is not null`,
    })
    .returning({ id: mealPlan.id });
  if (rows.length > 0) return rows[0];
  // Conflict (duplicate op id) — return the existing row's id.
  const existing = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(and(eq(mealPlan.householdId, householdId), eq(mealPlan.clientOpId, clientOpId!)))
    .limit(1);
  return existing[0];
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

// ── Push Subscriptions ────────────────────────────────────────────────────────

export async function getPushSubscriptionsForUser(userId: string) {
  const db = getDb();
  return db.select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, keys: pushSubscriptions.keys })
    .from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function addPushSubscription(userId: string, endpoint: string, keys: string): Promise<void> {
  const db = getDb();
  await db.insert(pushSubscriptions).values({ userId, endpoint, keys })
    .onConflictDoNothing({ target: [pushSubscriptions.userId, pushSubscriptions.endpoint] });
}

export async function deletePushSubscriptionByEndpoint(userId: string, endpoint: string): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function deletePushSubscriptionById(id: number): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
}
