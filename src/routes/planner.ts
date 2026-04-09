import { Hono } from "hono";
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
} from "../db-react.js";

const app = new Hono();

// Shopping List
app.get("/api/v1/shopping", (c) => {
  try {
    const items = getShoppingList();
    return c.json({ items });
  } catch (error) {
    console.error("Error fetching shopping list:", error);
    return c.json({ error: "Failed to fetch shopping list" }, 500);
  }
});

app.post("/api/v1/shopping", async (c) => {
  try {
    const { recipeId, canonicalName, quantity, unit } = await c.req.json();

    if (!canonicalName) {
      return c.json({ error: "canonicalName is required" }, 400);
    }

    const result = addToShoppingList(recipeId ?? null, canonicalName, quantity, unit);
    return c.json({ success: true, id: result.id }, 201);
  } catch (error) {
    console.error("Error adding to shopping list:", error);
    return c.json({ error: "Failed to add to shopping list" }, 500);
  }
});

app.patch("/api/v1/shopping/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const toggled = toggleShoppingItem(id);
    if (!toggled) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error toggling shopping item:", error);
    return c.json({ error: "Failed to toggle item" }, 500);
  }
});

// Specific routes before wildcard to avoid shadowing
app.delete("/api/v1/shopping/checked", (c) => {
  try {
    clearCheckedItems();
    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing checked items:", error);
    return c.json({ error: "Failed to clear items" }, 500);
  }
});

app.delete("/api/v1/shopping/all", (c) => {
  try {
    clearAllShoppingItems();
    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing shopping list:", error);
    return c.json({ error: "Failed to clear list" }, 500);
  }
});

app.delete("/api/v1/shopping/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const deleted = deleteShoppingItem(id);
    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting shopping item:", error);
    return c.json({ error: "Failed to delete item" }, 500);
  }
});

// Ingredient Dictionary
app.get("/api/v1/dictionary", (c) => {
  try {
    const entries = getAllDictionaryEntries();
    return c.json({ entries });
  } catch (error) {
    console.error("Error fetching dictionary:", error);
    return c.json({ error: "Failed to fetch dictionary" }, 500);
  }
});

app.post("/api/v1/dictionary", async (c) => {
  try {
    const { canonicalName, aliases } = await c.req.json();

    if (!canonicalName) {
      return c.json({ error: "canonicalName is required" }, 400);
    }

    const result = addToDictionary(canonicalName, aliases ?? []);
    return c.json({ success: true, id: result.id }, 201);
  } catch (error) {
    console.error("Error adding to dictionary:", error);
    return c.json({ error: "Failed to add to dictionary" }, 500);
  }
});

app.get("/api/v1/dictionary/match", (c) => {
  try {
    const name = c.req.query("name");
    if (!name) return c.json({ error: "name query param required" }, 400);

    const match = findCanonicalBySimilarity(name);
    return c.json({ match });
  } catch (error) {
    console.error("Error matching dictionary:", error);
    return c.json({ error: "Failed to match" }, 500);
  }
});

// Meal Plan
app.get("/api/v1/planner", (c) => {
  try {
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

    const entries = getMealPlanForWeek(weekStart);
    return c.json({ entries, weekStart });
  } catch (error) {
    console.error("Error fetching meal plan:", error);
    return c.json({ error: "Failed to fetch meal plan" }, 500);
  }
});

app.post("/api/v1/planner", async (c) => {
  try {
    const { recipeId, dayOfWeek, weekStart } = await c.req.json();

    if (!recipeId || dayOfWeek === undefined || !weekStart) {
      return c.json({ error: "recipeId, dayOfWeek, and weekStart are required" }, 400);
    }

    const result = addRecipeToMealPlan(recipeId, dayOfWeek, weekStart);
    return c.json({ success: true, id: result.id }, 201);
  } catch (error) {
    console.error("Error adding to meal plan:", error);
    return c.json({ error: "Failed to add to meal plan" }, 500);
  }
});

app.delete("/api/v1/planner/week/:weekStart", (c) => {
  try {
    const weekStart = parseInt(c.req.param("weekStart"), 10);
    if (isNaN(weekStart)) return c.json({ error: "Invalid weekStart" }, 400);

    clearMealPlanForWeek(weekStart);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error clearing meal plan:", error);
    return c.json({ error: "Failed to clear" }, 500);
  }
});

app.delete("/api/v1/planner/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const removed = removeRecipeFromMealPlan(id);
    if (!removed) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error removing from meal plan:", error);
    return c.json({ error: "Failed to remove" }, 500);
  }
});

export default app;
