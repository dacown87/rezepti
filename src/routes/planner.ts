import { Hono } from "hono";
import { authErrorPayload, getAuth, requireAuth } from "../auth.js";
import {
  getShoppingList,
  addToShoppingList,
  toggleShoppingItem,
  deleteShoppingItem,
  clearCheckedItems,
  clearAllShoppingItems,
  getAllDictionaryEntries,
  addToDictionary,
  findCanonicalBySimilarity,
  getMealPlanForWeek,
  addRecipeToMealPlan,
  removeRecipeFromMealPlan,
  clearMealPlanForWeek,
  getRecipeByIdFromReactDb,
} from "../db-react.js";

const app = new Hono();

// Shopping List
app.get("/api/v1/shopping", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const items = await getShoppingList(auth.activeHouseholdId);
    return c.json({ items });
  } catch (error) {
    console.error("Error fetching shopping list:", error);
    return c.json({ error: "Failed to fetch shopping list" }, 500);
  }
});

app.post("/api/v1/shopping", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { recipeId, canonicalName, quantity, unit } = body as {
      recipeId?: number | null;
      canonicalName?: string;
      quantity?: string;
      unit?: string;
    };

    if (recipeId !== undefined && recipeId !== null && !Number.isInteger(recipeId)) {
      return c.json({ error: "recipeId must be an integer or null" }, 400);
    }

    if (!canonicalName) {
      return c.json({ error: "canonicalName is required" }, 400);
    }

    if (canonicalName.length > 500) {
      return c.json({ error: "canonicalName too long (max 500 chars)" }, 400);
    }

    if (recipeId !== undefined && recipeId !== null) {
      const recipe = await getRecipeByIdFromReactDb(recipeId, auth.userId);
      if (!recipe) return c.json({ error: "Recipe not found" }, 404);
    }

    const result = await addToShoppingList(auth.activeHouseholdId, auth.userId, recipeId ?? null, canonicalName, quantity, unit);
    return c.json({ success: true, id: result.id }, 201);
  } catch (error) {
    console.error("Error adding to shopping list:", error);
    return c.json({ error: "Failed to add to shopping list" }, 500);
  }
});

app.patch("/api/v1/shopping/:id", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const toggled = await toggleShoppingItem(auth.activeHouseholdId, id);
    if (!toggled) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling shopping item:", error);
    return c.json({ error: "Failed to toggle item" }, 500);
  }
});

// Specific routes before wildcard to avoid shadowing
app.delete("/api/v1/shopping/checked", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    await clearCheckedItems(auth.activeHouseholdId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing checked items:", error);
    return c.json({ error: "Failed to clear items" }, 500);
  }
});

app.delete("/api/v1/shopping/all", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    await clearAllShoppingItems(auth.activeHouseholdId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing shopping list:", error);
    return c.json({ error: "Failed to clear list" }, 500);
  }
});

app.delete("/api/v1/shopping/:id", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const deleted = await deleteShoppingItem(auth.activeHouseholdId, id);
    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting shopping item:", error);
    return c.json({ error: "Failed to delete item" }, 500);
  }
});

// Ingredient Dictionary
app.get("/api/v1/dictionary", async (c) => {
  try {
    const entries = await getAllDictionaryEntries();
    return c.json({ entries });
  } catch (error) {
    console.error("Error fetching dictionary:", error);
    return c.json({ error: "Failed to fetch dictionary" }, 500);
  }
});

app.post("/api/v1/dictionary", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    if (auth.appRole !== "admin") {
      return c.json(
        authErrorPayload(
          "admin_required",
          "Dictionary writes require admin access",
          "The authenticated user is not an admin.",
          "Sign in with an admin account before editing the dictionary.",
        ),
        403,
      );
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { canonicalName, aliases } = body as {
      canonicalName?: string;
      aliases?: string[];
    };

    if (!canonicalName) {
      return c.json({ error: "canonicalName is required" }, 400);
    }

    if (aliases !== undefined && (!Array.isArray(aliases) || aliases.some(alias => typeof alias !== "string"))) {
      return c.json({ error: "aliases must be an array of strings" }, 400);
    }

    const result = await addToDictionary(canonicalName, aliases ?? []);
    return c.json({ success: true, id: result.id }, 201);
  } catch (error) {
    console.error("Error adding to dictionary:", error);
    return c.json({ error: "Failed to add to dictionary" }, 500);
  }
});

app.get("/api/v1/dictionary/match", async (c) => {
  try {
    const name = c.req.query("name")?.trim();
    if (!name) return c.json({ error: "name query param required" }, 400);
    if (name.length > 200) return c.json({ error: "name query param too long" }, 400);

    const match = await findCanonicalBySimilarity(name);
    return c.json({ match });
  } catch (error) {
    console.error("Error matching dictionary:", error);
    return c.json({ error: "Failed to match" }, 500);
  }
});

// Meal Plan
app.get("/api/v1/planner", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const queryWeek = c.req.query("week");
    let weekStart: number;

    if (queryWeek) {
      weekStart = parseInt(queryWeek);
    } else {
      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      weekStart = Math.floor(monday.getTime() / 1000);
    }

    const entries = await getMealPlanForWeek(auth.activeHouseholdId, weekStart);
    return c.json({ entries, weekStart });
  } catch (error) {
    console.error("Error fetching meal plan:", error);
    return c.json({ error: "Failed to fetch meal plan" }, 500);
  }
});

app.post("/api/v1/planner", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const { recipeId, dayOfWeek, weekStart } = await c.req.json();

    if (!Number.isInteger(recipeId) || dayOfWeek === undefined || !weekStart) {
      return c.json({ error: "recipeId, dayOfWeek, and weekStart are required" }, 400);
    }

    const recipe = await getRecipeByIdFromReactDb(recipeId, auth.userId);
    if (!recipe) return c.json({ error: "Recipe not found" }, 404);

    const result = await addRecipeToMealPlan(auth.activeHouseholdId, auth.userId, recipeId, dayOfWeek, weekStart);
    return c.json({ success: true, id: result.id }, 201);
  } catch (error) {
    console.error("Error adding to meal plan:", error);
    return c.json({ error: "Failed to add to meal plan" }, 500);
  }
});

app.delete("/api/v1/planner/week/:weekStart", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const weekStart = parseInt(c.req.param("weekStart"), 10);
    if (isNaN(weekStart)) return c.json({ error: "Invalid weekStart" }, 400);

    await clearMealPlanForWeek(auth.activeHouseholdId, weekStart);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing meal plan:", error);
    return c.json({ error: "Failed to clear" }, 500);
  }
});

app.delete("/api/v1/planner/:id", requireAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const removed = await removeRecipeFromMealPlan(auth.activeHouseholdId, id);
    if (!removed) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error removing from meal plan:", error);
    return c.json({ error: "Failed to remove" }, 500);
  }
});

export default app;
