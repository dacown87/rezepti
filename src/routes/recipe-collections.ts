import { Hono } from "hono";
import {
  getCollectionsForAuth,
  createCollection,
  renameCollection,
  deleteCollection,
  addRecipeToCollection,
  reorderCollectionItems,
  bulkRemoveRecipesFromCollection,
  bulkCopyCollectionItems,
  removeRecipeFromCollection,
  getCollectionItemsForAuth,
  shareCopyRecipe,
  setFavorite,
  loadRecipeOwnerRow,
  loadCollectionRowById,
  isCollectionVisibleToAuth,
  canMutateCollectionForAuth,
  canManageCollectionForAuth,
  isRecipeVisibleToAuth,
  isShareCopyAllowed,
  isRecipeLegalForCollection,
  type CollectionOwnerType,
} from "../db-react.js";
import { getUserAuth, requireUserAuth } from "../auth.js";

const app = new Hono();

function isMemberOfHousehold(auth: ReturnType<typeof getUserAuth>, householdId: string) {
  return auth.memberships.some((membership) => membership.householdId === householdId);
}

function isOwnerOfHousehold(auth: ReturnType<typeof getUserAuth>, householdId: string) {
  return auth.memberships.some((membership) => membership.householdId === householdId && membership.role === "owner");
}

// ── Sharing ─────────────────────────────────────────────────────────────────
// POST /api/v1/recipes/:id/share — copy a recipe into the caller's household or
// private space. Returns 201 with the NEW recipe read model. Foreign/invisible
// source recipe → 404 (no existence leak). Never returns the original id, never
// mutates the original.
app.post("/api/v1/recipes/:id/share", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const body = await c.req.json().catch(() => null);
    const target = body && typeof body === "object" ? (body as { target?: unknown }).target : undefined;
    if (!target || typeof target !== "object") {
      return c.json({ error: "target is required" }, 400);
    }
    const type = (target as { type?: unknown }).type;
    if (type !== "household" && type !== "user") {
      return c.json({ error: "target.type must be 'household' or 'user'" }, 400);
    }

    // Visibility gate at the route layer so foreign/invisible recipes always 404,
    // distinct from the "no active household" 400 case below.
    const owner = await loadRecipeOwnerRow(id);
    if (!owner || !isRecipeVisibleToAuth(auth, owner)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!isShareCopyAllowed(owner, type)) {
      return c.json({ error: "Recipe cannot be copied to the same scope" }, 400);
    }

    if (type === "household") {
      const targetHouseholdId = (target as { householdId?: unknown }).householdId;
      if (targetHouseholdId !== undefined && typeof targetHouseholdId !== "string") {
        return c.json({ error: "target.householdId must be a string", code: "target_household_invalid" }, 400);
      }
      const householdId = targetHouseholdId ?? auth.activeHouseholdId;
      if (!householdId) {
        return c.json({ error: "No active household" }, 400);
      }
      if (!isMemberOfHousehold(auth, householdId)) {
        return c.json({ error: "Target household not found", code: "target_household_not_found" }, 404);
      }
      const copy = await shareCopyRecipe(auth, id, { type: "household", householdId });
      return c.json({ recipe: copy }, 201);
    }

    const copy = await shareCopyRecipe(auth, id, { type: "user" });
    return c.json({ recipe: copy }, 201);
  } catch (error) {
    console.error("Error sharing recipe:", error);
    return c.json({ error: "Failed to share recipe" }, 500);
  }
});

// ── Favorites ───────────────────────────────────────────────────────────────
// POST /api/v1/recipes/:id/favorite — toggle ON (idempotent), private scope.
app.post("/api/v1/recipes/:id/favorite", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const owner = await loadRecipeOwnerRow(id);
    if (!owner || !isRecipeVisibleToAuth(auth, owner)) {
      return c.json({ error: "Not found" }, 404);
    }

    const result = await setFavorite(auth, id, true, "user");
    return c.json({ success: true, isFavorite: result.isFavorite });
  } catch (error) {
    console.error("Error adding favorite:", error);
    return c.json({ error: "Failed to add favorite" }, 500);
  }
});

// DELETE /api/v1/recipes/:id/favorite — toggle OFF (idempotent), private scope.
app.delete("/api/v1/recipes/:id/favorite", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const owner = await loadRecipeOwnerRow(id);
    if (!owner || !isRecipeVisibleToAuth(auth, owner)) {
      return c.json({ error: "Not found" }, 404);
    }

    const result = await setFavorite(auth, id, false, "user");
    return c.json({ success: true, isFavorite: result.isFavorite });
  } catch (error) {
    console.error("Error removing favorite:", error);
    return c.json({ error: "Failed to remove favorite" }, 500);
  }
});

// ── Collections ─────────────────────────────────────────────────────────────
// GET /api/v1/recipe-collections — caller's visible collections.
app.get("/api/v1/recipe-collections", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const ownerType = c.req.query("ownerType");
    const householdId = c.req.query("householdId");
    if (ownerType !== undefined && ownerType !== "user" && ownerType !== "household") {
      return c.json({ error: "ownerType must be 'user' or 'household'" }, 400);
    }
    if (householdId && !isMemberOfHousehold(auth, householdId)) {
      return c.json({ error: "Target household not found", code: "target_household_not_found" }, 404);
    }

    const allCollections = await getCollectionsForAuth(auth);
    const collections = allCollections.filter((collection) => {
      if (ownerType && collection.owner_type !== ownerType) return false;
      if (householdId && collection.household_id !== householdId) return false;
      return true;
    });
    return c.json({ collections });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return c.json({ error: "Failed to fetch collections" }, 500);
  }
});

// POST /api/v1/recipe-collections — create a custom collection.
app.post("/api/v1/recipe-collections", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const { name, ownerType, householdId } = body as {
      name?: unknown;
      ownerType?: unknown;
      householdId?: unknown;
    };

    if (typeof name !== "string" || !name.trim()) {
      return c.json({ error: "name is required" }, 400);
    }
    if (ownerType !== undefined && ownerType !== "user" && ownerType !== "household") {
      return c.json({ error: "ownerType must be 'user' or 'household'" }, 400);
    }
    const resolvedOwnerType: CollectionOwnerType = ownerType === "household" ? "household" : "user";

    if (resolvedOwnerType === "household") {
      if (typeof householdId !== "string" || !isOwnerOfHousehold(auth, householdId)) {
        // Not a member of the target household → treat as not found (no leak).
        return c.json({ error: "Household not found" }, 404);
      }
    }

    const collection = await createCollection(auth, {
      name: name.trim(),
      ownerType: resolvedOwnerType,
      householdId: resolvedOwnerType === "household" ? (householdId as string) : undefined,
    });
    return c.json({ collection }, 201);
  } catch (error) {
    console.error("Error creating collection:", error);
    return c.json({ error: "Failed to create collection" }, 500);
  }
});

// PATCH /api/v1/recipe-collections/:id — rename a custom collection.
app.patch("/api/v1/recipe-collections/:id", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const name = body && typeof body === "object" ? (body as { name?: unknown }).name : undefined;
    if (typeof name !== "string" || !name.trim()) {
      return c.json({ error: "name is required" }, 400);
    }

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (collection.kind === "favorites") {
      return c.json({ error: "Favorites collection cannot be renamed" }, 400);
    }
    if (!canManageCollectionForAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }

    const renamed = await renameCollection(auth, id, name.trim());
    if (!renamed) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error renaming collection:", error);
    return c.json({ error: "Failed to rename collection" }, 500);
  }
});

// DELETE /api/v1/recipe-collections/:id — delete a custom collection (list only).
app.delete("/api/v1/recipe-collections/:id", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (collection.kind === "favorites") {
      return c.json({ error: "Favorites collection cannot be deleted" }, 400);
    }
    if (!canManageCollectionForAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }

    const deleted = await deleteCollection(auth, id);
    if (!deleted) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting collection:", error);
    return c.json({ error: "Failed to delete collection" }, 500);
  }
});

// GET /api/v1/recipe-collections/:id/items — recipes in the collection, each with
// the same read-model the list endpoint carries. Invisible/foreign/malformed
// collection → 404 (no existence leak), identical boundary to the other routes.
app.get("/api/v1/recipe-collections/:id/items", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }

    const recipes = await getCollectionItemsForAuth(auth, id);
    return c.json({ recipes });
  } catch (error) {
    console.error("Error fetching collection items:", error);
    return c.json({ error: "Failed to fetch collection items" }, 500);
  }
});

// POST /api/v1/recipe-collections/:id/items — add a recipe (legality-checked).
app.post("/api/v1/recipe-collections/:id/items", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const recipeId = body && typeof body === "object" ? (body as { recipeId?: unknown }).recipeId : undefined;
    if (!Number.isInteger(recipeId)) {
      return c.json({ error: "recipeId must be an integer" }, 400);
    }

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }
    const targetHouseholdId = body && typeof body === "object"
      ? (body as { targetHouseholdId?: unknown }).targetHouseholdId
      : undefined;
    if (targetHouseholdId !== undefined) {
      if (typeof targetHouseholdId !== "string") {
        return c.json({ error: "targetHouseholdId must be a string", code: "target_household_invalid" }, 400);
      }
      if (!isMemberOfHousehold(auth, targetHouseholdId)) {
        return c.json({ error: "Target household not found", code: "target_household_not_found" }, 404);
      }
      if (collection.ownerType !== "household" || collection.householdId !== targetHouseholdId) {
        return c.json({ error: "Target household does not match collection", code: "target_household_mismatch" }, 400);
      }
    }

    const owner = await loadRecipeOwnerRow(recipeId as number);
    // Invisible recipe → 404 (no existence leak).
    if (!owner || !isRecipeVisibleToAuth(auth, owner)) {
      return c.json({ error: "Not found" }, 404);
    }
    const shouldCopyPrivateRecipeIntoHouseholdCollection =
      collection.ownerType === "household" && owner.ownerType === "user";
    // Visible but illegal for this collection → 400. Private recipe into a
    // household collection is the explicit product exception: the DB helper
    // creates a household copy and inserts that copy.
    if (!shouldCopyPrivateRecipeIntoHouseholdCollection && !isRecipeLegalForCollection(auth, owner, {
      ownerType: collection.ownerType,
      householdId: collection.householdId,
    })) {
      return c.json({ error: "Recipe is not a legal reference for this collection" }, 400);
    }

    const result = await addRecipeToCollection(auth, id, recipeId as number);
    return c.json({
      success: true,
      added: result.added,
      recipeId: result.recipeId,
      copied: result.copied,
    });
  } catch (error) {
    console.error("Error adding recipe to collection:", error);
    return c.json({ error: "Failed to add recipe to collection" }, 500);
  }
});

function parseRecipeIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((recipeId) => Number.isInteger(recipeId))) return null;
  return value;
}

app.patch("/api/v1/recipe-collections/:id/items/reorder", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const recipeIds = parseRecipeIds(body && typeof body === "object" ? (body as { recipeIds?: unknown }).recipeIds : undefined);
    if (!recipeIds) return c.json({ error: "recipeIds must be an array of integers" }, 400);

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!canMutateCollectionForAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }

    const result = await reorderCollectionItems(auth, id, recipeIds);
    if (result.missing.length > 0) {
      return c.json({
        succeeded: [],
        failed: result.missing.map((recipeId) => ({ recipeId, code: "not_in_collection" })),
      }, 400);
    }
    return c.json({
      succeeded: result.updated.map((recipeId) => ({ recipeId })),
      failed: [],
    });
  } catch (error) {
    console.error("Error reordering collection items:", error);
    return c.json({ error: "Failed to reorder collection items" }, 500);
  }
});

app.post("/api/v1/recipe-collections/:id/items/bulk-remove", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    const recipeIds = parseRecipeIds(body && typeof body === "object" ? (body as { recipeIds?: unknown }).recipeIds : undefined);
    if (!recipeIds) return c.json({ error: "recipeIds must be an array of integers" }, 400);

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!canMutateCollectionForAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }

    const result = await bulkRemoveRecipesFromCollection(auth, id, recipeIds);
    return c.json({
      succeeded: result.removed.map((recipeId) => ({ recipeId })),
      failed: result.missing.map((recipeId) => ({ recipeId, code: "not_in_collection" })),
    });
  } catch (error) {
    console.error("Error bulk-removing collection items:", error);
    return c.json({ error: "Failed to bulk-remove collection items" }, 500);
  }
});

app.post("/api/v1/recipe-collections/:id/items/bulk-copy", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ error: "Invalid JSON body" }, 400);
    const recipeIds = parseRecipeIds((body as { recipeIds?: unknown }).recipeIds);
    const targetCollectionId = (body as { targetCollectionId?: unknown }).targetCollectionId;
    if (!recipeIds) return c.json({ error: "recipeIds must be an array of integers" }, 400);
    if (typeof targetCollectionId !== "string") return c.json({ error: "targetCollectionId is required" }, 400);

    const sourceCollection = await loadCollectionRowById(id);
    if (!sourceCollection || !isCollectionVisibleToAuth(auth, sourceCollection)) {
      return c.json({ error: "Not found" }, 404);
    }
    const targetCollection = await loadCollectionRowById(targetCollectionId);
    if (!targetCollection || !isCollectionVisibleToAuth(auth, targetCollection) || !canMutateCollectionForAuth(auth, targetCollection)) {
      return c.json({ error: "Target collection not found", code: "target_collection_not_found" }, 404);
    }

    const result = await bulkCopyCollectionItems(auth, id, targetCollectionId, recipeIds);
    return c.json({
      succeeded: result.succeeded,
      failed: result.failed,
    });
  } catch (error) {
    console.error("Error bulk-copying collection items:", error);
    return c.json({ error: "Failed to bulk-copy collection items" }, 500);
  }
});

// DELETE /api/v1/recipe-collections/:id/items/:recipeId — remove a membership.
app.delete("/api/v1/recipe-collections/:id/items/:recipeId", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = c.req.param("id");
    const recipeId = parseInt(c.req.param("recipeId"), 10);
    if (isNaN(recipeId)) return c.json({ error: "Invalid recipe ID" }, 400);

    const collection = await loadCollectionRowById(id);
    if (!collection || !isCollectionVisibleToAuth(auth, collection)) {
      return c.json({ error: "Not found" }, 404);
    }

    await removeRecipeFromCollection(auth, id, recipeId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error removing recipe from collection:", error);
    return c.json({ error: "Failed to remove recipe from collection" }, 500);
  }
});

export default app;
