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
app.get("/api/v1/recipes", async (c) => {
  try {
    const ingredientsParam = c.req.query("ingredients");
    const matchParam = c.req.query("match") as "and" | "or" | undefined;
    const thresholdParam = c.req.query("threshold");
    const limitParam = c.req.query("limit");

    if (ingredientsParam && ingredientsParam.length > 500) {
      return c.json({ error: "ingredients param too long" }, 400);
    }

    const hasIngredientFilter = ingredientsParam !== undefined;
    const ingredients = hasIngredientFilter
      ? ingredientsParam.split(",").map(i => i.trim()).filter(i => i).slice(0, 20)
      : [];

    if (hasIngredientFilter && ingredients.length === 0) {
      return c.json({ error: "ingredients query param required" }, 400);
    }

    if (matchParam && matchParam !== "and" && matchParam !== "or") {
      return c.json({ error: "match must be 'and' or 'or'" }, 400);
    }

    if (ingredients.length > 0) {
      const match = matchParam === "and" ? "and" : "or";
      const threshold = thresholdParam === undefined ? 0 : Number(thresholdParam);
      if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
        return c.json({ error: "threshold must be an integer between 0 and 100" }, 400);
      }

      const limit = limitParam === undefined ? 50 : Number(limitParam);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return c.json({ error: "limit must be an integer between 1 and 100" }, 400);
      }

      const results = await searchRecipesByIngredientsAdvanced({ ingredients, match, threshold });
      const limitedResults = results.slice(0, limit);

      return c.json({
        recipes: limitedResults.map(r => r.recipe),
        match_scores: limitedResults.map(r => r.matchScore),
        missing_ingredients: limitedResults.map(r => r.missingIngredients),
        match_mode: match,
        threshold,
        limit,
      });
    }

    const recipes = await getRecipeListFromReactDb();
    return c.json(recipes);
  } catch (error) {
    console.error("Error fetching recipes from React DB:", error);
    return c.json({ error: "Failed to fetch recipes" }, 500);
  }
});

// Serve base64 image stored in image_url as actual image bytes
app.get("/api/v1/recipes/:id/image", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const recipe = await getRecipeByIdFromReactDb(id);
  if (!recipe?.image_url?.startsWith("data:")) return c.notFound();

  const [meta, b64] = recipe.image_url.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const buffer = Buffer.from(b64, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// Get single recipe by ID
app.get("/api/v1/recipes/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const recipe = await getRecipeByIdFromReactDb(id);
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

    const id = await saveRecipeToReactDb(recipe, sourceUrl, transcript);
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
    const updated = await updateRecipeInReactDb(id, body);

    if (!updated) return c.json({ error: "Not found" }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating recipe in React DB:", error);
    return c.json({ error: "Failed to update recipe" }, 500);
  }
});

// Delete recipe
app.delete("/api/v1/recipes/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const deleted = await deleteRecipeFromReactDb(id);
    if (!deleted) return c.json({ error: "Not found" }, 404);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting recipe from React DB:", error);
    return c.json({ error: "Failed to delete recipe" }, 500);
  }
});

// Health check
app.get("/api/v1/health", async (c) => {
  try {
    const recipeCount = await getRecipeCount();
    return c.json({
      server: true,
      database: "supabase",
      recipeCount,
      status: "healthy"
    });
  } catch (error) {
    console.error("Database health check failed:", error);
    return c.json({
      server: true,
      database: "supabase",
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
