import { Hono } from "hono";
import {
  getRecipeListFromReactDb,
  getRecipeByIdFromReactDb,
  saveRecipeToReactDb,
  updateRecipeInReactDb,
  deleteRecipeFromReactDb,
  getRecipeCount,
  searchRecipesByIngredientsAdvanced,
} from "../db-react.js";

const app = new Hono();

// List all recipes (with optional ingredient filter)
app.get("/api/v1/recipes", (c) => {
  try {
    const ingredientsParam = c.req.query("ingredients");
    const matchParam = c.req.query("match") as "and" | "or" | undefined;
    const thresholdParam = c.req.query("threshold");

    if (ingredientsParam && ingredientsParam.length > 500) {
      return c.json({ error: "ingredients param too long" }, 400);
    }

    const ingredients = ingredientsParam
      ? ingredientsParam.split(",").map(i => i.trim()).filter(i => i).slice(0, 20)
      : [];

    if (ingredients.length > 0) {
      const match = matchParam === "and" ? "and" : "or";
      const threshold = thresholdParam ? Math.max(0, Math.min(100, parseInt(thresholdParam, 10))) : 0;

      const results = searchRecipesByIngredientsAdvanced({ ingredients, match, threshold });

      return c.json({
        recipes: results.map(r => r.recipe),
        match_scores: results.map(r => r.matchScore),
        missing_ingredients: results.map(r => r.missingIngredients),
        match_mode: match,
        threshold,
      });
    }

    const recipes = getRecipeListFromReactDb();
    return c.json(recipes);
  } catch (error) {
    console.error("Error fetching recipes from React DB:", error);
    return c.json({ error: "Failed to fetch recipes" }, 500);
  }
});

// Get single recipe by ID
app.get("/api/v1/recipes/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const recipe = getRecipeByIdFromReactDb(id);
    if (!recipe) return c.json({ error: "Not found" }, 404);

    return c.json(recipe);
  } catch (error) {
    console.error("Error fetching recipe from React DB:", error);
    return c.json({ error: "Failed to fetch recipe" }, 500);
  }
});

// Create recipe
app.post("/api/v1/recipes", async (c) => {
  try {
    const body = await c.req.json();
    const { recipe, sourceUrl, transcript } = body;

    if (!recipe || !sourceUrl) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const id = saveRecipeToReactDb(recipe, sourceUrl, transcript);
    return c.json({ id, success: true }, 201);
  } catch (error) {
    console.error("Error saving recipe to React DB:", error);
    return c.json({ error: "Failed to save recipe" }, 500);
  }
});

// Update recipe
app.patch("/api/v1/recipes/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const body = await c.req.json();
    const updated = updateRecipeInReactDb(id, body);

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating recipe in React DB:", error);
    return c.json({ error: "Failed to update recipe" }, 500);
  }
});

// Delete recipe
app.delete("/api/v1/recipes/:id", (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const deleted = deleteRecipeFromReactDb(id);
    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting recipe from React DB:", error);
    return c.json({ error: "Failed to delete recipe" }, 500);
  }
});

// Health check
app.get("/api/v1/health", (c) => {
  try {
    const recipeCount = getRecipeCount();
    return c.json({
      server: true,
      database: "react",
      recipeCount,
      status: "healthy"
    });
  } catch (error) {
    console.error("React database health check failed:", error);
    return c.json({
      server: true,
      database: "react",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
