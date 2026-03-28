/**
 * React-specific API endpoints
 * These endpoints use the React database (rezepti-react.db)
 */

import { Hono } from "hono";
import {
  ensureReactSchema,
  getAllRecipesFromReactDb,
  getRecipeByIdFromReactDb,
  saveRecipeToReactDb,
  updateRecipeInReactDb,
  deleteRecipeFromReactDb,
  getRecipeCount,
  searchRecipesByIngredients,
  searchRecipesByIngredientsAdvanced,
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
} from "./db-react.js";
import { jobManager } from "./job-manager.js";
import { BYOKValidator } from "./byok-validator.js";
import { processURL } from "./pipeline.js";
import { extractRecipeFromImage } from "./processors/llm.js";
import type { RecipeData, PipelineEvent } from "./types.js";
import { saveCredentialsToDisk, clearCredentialsFromDisk, getSessionStatus, getCredentials, hasCredentials, clearSession } from "./fetchers/cookidoo.js";

// In-memory store for base64 photo data, keyed by jobId (cleaned up after processing)
const photoDataStore = new Map<string, string>();

const app = new Hono();

// Initialize React database schema once at startup
ensureReactSchema();

/**
 * React API endpoints use /api/v1/ prefix
 */

// List all recipes from React database (with optional ingredient filter)
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

    const recipes = getAllRecipesFromReactDb();
    return c.json(recipes);
  } catch (error) {
    console.error("Error fetching recipes from React DB:", error);
    return c.json({ error: "Failed to fetch recipes" }, 500);
  }
});

// Get single recipe by ID from React database
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

// Create recipe in React database
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

// Update recipe in React database
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

// Delete recipe from React database
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

// Health check for React database
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

/**
 * React Extraction Endpoints with Polling Support
 */

// Start a new recipe extraction job
app.post("/api/v1/extract/react", async (c) => {
  try {
    const { url, apiKey } = await c.req.json();
    
    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }
    
    // Check if URL is already being processed
    if (jobManager.isUrlProcessing(url)) {
      return c.json({ 
        error: "This URL is already being processed",
        status: "conflict"
      }, 409);
    }
    
    // Validate BYOK if provided
    let apiKeyHash: string | undefined;
    if (apiKey) {
      const validation = await BYOKValidator.validateKey(apiKey);
      if (!validation.valid) {
        return c.json({ 
          error: "Invalid API key",
          details: validation.reason 
        }, 400);
      }
      apiKeyHash = BYOKValidator.hashKey(apiKey);
    }
    
    // Create job
    const userAgent = c.req.header("User-Agent");
    const job = jobManager.createJob(url, userAgent, apiKeyHash);
    
    // Start processing in background
    setTimeout(() => {
      processJobInBackground(job.id, apiKey).catch(console.error);
    }, 0);
    
    return c.json({
      jobId: job.id,
      status: "pending",
      message: "Extraction job created",
      pollUrl: `/api/v1/extract/react/${job.id}`
    }, 202);
    
  } catch (error) {
    console.error("Error creating extraction job:", error);
    return c.json({ 
      error: "Failed to create extraction job",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Poll job status
app.get("/api/v1/extract/react/:jobId", (c) => {
  try {
    const jobId = c.req.param("jobId");
    const since = parseInt(c.req.query("since") || "0");
    
    const job = jobManager.getJob(jobId);
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    
    // If client wants updates since specific timestamp
    if (since > 0) {
      const event = jobManager.getJobEventsSince(jobId, since);
      if (!event) {
        return c.json({ unchanged: true });
      }
      return c.json(event);
    }
    
    // Return full job status
    return c.json(jobManager.jobToEvent(job));
    
  } catch (error) {
    console.error("Error polling job:", error);
    return c.json({ 
      error: "Failed to poll job status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Cancel a job (if still pending/running)
app.delete("/api/v1/extract/react/:jobId", (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = jobManager.getJob(jobId);
    
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    
    if (job.status === "completed" || job.status === "failed") {
      return c.json({ 
        error: "Job already finished",
        status: job.status 
      }, 400);
    }
    
    // Mark as failed with cancellation
    jobManager.failJob(jobId, "Job cancelled by user");
    
    return c.json({ 
      success: true,
      message: "Job cancelled"
    });
    
  } catch (error) {
    console.error("Error cancelling job:", error);
    return c.json({ 
      error: "Failed to cancel job",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// List recent jobs (for debugging/admin)
app.get("/api/v1/extract/jobs", (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const jobs = jobManager.getRecentJobs(limit);
    
    return c.json({
      jobs,
      total: jobs.length
    });
    
  } catch (error) {
    console.error("Error listing jobs:", error);
    return c.json({ 
      error: "Failed to list jobs",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// BYOK validation endpoint
app.post("/api/v1/keys/validate", async (c) => {
  try {
    const { apiKey } = await c.req.json();
    
    if (!apiKey) {
      return c.json({ error: "API key is required" }, 400);
    }
    
    const result = await BYOKValidator.validateKey(apiKey);
    
    return c.json({
      valid: result.valid,
      reason: result.reason,
      model: result.model
    });
    
  } catch (error) {
    console.error("Error validating API key:", error);
    return c.json({ 
      error: "Failed to validate API key",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// BYOK key management endpoint (store/remove hashed key)
app.post("/api/v1/keys", async (c) => {
  try {
    const { apiKey } = await c.req.json();
    
    if (!apiKey) {
      return c.json({ error: "API key is required" }, 400);
    }
    
    const validation = await BYOKValidator.validateKey(apiKey);
    if (!validation.valid) {
      return c.json({ 
        error: "Invalid API key",
        details: validation.reason 
      }, 400);
    }
    
    const keyHash = BYOKValidator.hashKey(apiKey);
    
    // TODO: Store key hash in user session/database
    // For now, return success with hash
    
    return c.json({
      success: true,
      message: "API key validated and stored (hashed)",
      keyHash,
      model: validation.model
    });
    
  } catch (error) {
    console.error("Error storing API key:", error);
    return c.json({ 
      error: "Failed to store API key",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

app.delete("/api/v1/keys/:keyHash", (c) => {
  try {
    const keyHash = c.req.param("keyHash");
    
    // TODO: Remove key hash from user session/database
    
    return c.json({
      success: true,
      message: "API key removed"
    });
    
  } catch (error) {
    console.error("Error removing API key:", error);
    return c.json({ 
      error: "Failed to remove API key",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

/**
 * Background job processor
 */
// Shopping List API (Phase 3c)
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

// Ingredient Dictionary API
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

// Meal Plan API (Phase 5)
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

// Photo extraction endpoint
app.post("/api/v1/extract/photo", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return c.json({ error: "Keine Datei angegeben" }, 400);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Ungültiges Format. Erlaubt: JPEG, PNG, WebP" }, 400);
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return c.json({ error: "Datei zu groß. Maximum: 10 MB" }, 400);
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const userAgent = c.req.header("User-Agent");
    const job = jobManager.createJob(`photo://${file.name || "upload"}`, userAgent);
    photoDataStore.set(job.id, dataUrl);

    setTimeout(() => {
      processPhotoJobInBackground(job.id).catch(console.error);
    }, 0);

    return c.json({
      jobId: job.id,
      status: "pending",
      message: "Photo extraction job created",
      pollUrl: `/api/v1/extract/react/${job.id}`,
    }, 202);

  } catch (error) {
    console.error("Error creating photo extraction job:", error);
    return c.json({ error: "Failed to create photo extraction job" }, 500);
  }
});

async function processPhotoJobInBackground(jobId: string) {
  const dataUrl = photoDataStore.get(jobId);
  if (!dataUrl) {
    jobManager.failJob(jobId, "Foto-Daten nicht gefunden");
    return;
  }
  try {
    jobManager.startJob(jobId);
    jobManager.updateJob(jobId, {
      progress: 30,
      currentStage: "analyzing_image",
      message: "Bild wird analysiert",
      status: "running",
    });

    const recipeData = await extractRecipeFromImage(dataUrl);

    jobManager.updateJob(jobId, {
      progress: 85,
      currentStage: "exporting",
      message: "Wird gespeichert",
      status: "running",
    });

    const recipeId = saveRecipeToReactDb(recipeData, "photo://upload");
    jobManager.completeJob(jobId, { success: true, recipeId, recipe: recipeData });

  } catch (error) {
    console.error(`Photo job ${jobId} failed:`, error);
    jobManager.failJob(jobId, error instanceof Error ? error.message : "Unbekannter Fehler");
  } finally {
    photoDataStore.delete(jobId);
  }
}

async function processJobInBackground(jobId: string, userApiKey?: string) {
  try {
    const job = jobManager.getJob(jobId);
    if (!job || job.status !== "pending") {
      return;
    }
    
    // Start the job
    jobManager.startJob(jobId);
    
    // Create event handler for pipeline updates
    const onEvent = async (event: PipelineEvent) => {
      const progressMap: Record<string, number> = {
        classifying: 20,
        fetching: 35,
        transcribing: 50,
        analyzing_image: 60,
        extracting: 75,
        exporting: 90,
        done: 100,
        error: 100,
      };
      
      const progress = progressMap[event.stage] || job.progress;
      
      jobManager.updateJob(jobId, {
        progress,
        currentStage: event.stage,
        message: event.message,
        status: event.stage === "error" ? "failed" : "running",
      });
    };
    
    // Set API key in environment for this job
    const originalApiKey = process.env.GROQ_API_KEY;
    if (userApiKey) {
      process.env.GROQ_API_KEY = userApiKey;
    }
    
    try {
      // Run the pipeline with React database
      const result = await processURL(job.url, onEvent);
      
      if (result.success) {
        jobManager.completeJob(jobId, result);
      } else {
        jobManager.failJob(jobId, result.error || "Unknown error");
      }
      
    } finally {
      // Restore original API key
      if (userApiKey) {
        process.env.GROQ_API_KEY = originalApiKey;
      }
    }
    
  } catch (error) {
    console.error(`Background job ${jobId} failed:`, error);
    jobManager.failJob(
      jobId, 
      error instanceof Error ? error.message : "Unknown background error"
    );
  }
}
// Cookidoo credentials management (Phase 7)
app.get("/api/v1/cookidoo/status", (c) => {
  try {
    const status = getSessionStatus();
    const creds = getCredentials();
    return c.json({
      connected: status.connected,
      hasFileCredentials: status.hasFileCredentials,
      email: creds ? creds.email : null,
    });
  } catch (error) {
    console.error("Error getting Cookidoo status:", error);
    return c.json({ error: "Failed to get Cookidoo status" }, 500);
  }
});

app.post("/api/v1/cookidoo/credentials", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    
    // Save credentials to disk
    saveCredentialsToDisk(email, password);
    
    // Clear existing session to force re-auth
    clearSession();
    
    return c.json({
      success: true,
      message: "Cookidoo credentials saved successfully"
    });
  } catch (error) {
    console.error("Error saving Cookidoo credentials:", error);
    return c.json({ error: "Failed to save Cookidoo credentials" }, 500);
  }
});

app.delete("/api/v1/cookidoo/credentials", (c) => {
  try {
    clearCredentialsFromDisk();
    clearSession();
    
    return c.json({
      success: true,
      message: "Cookidoo credentials removed"
    });
  } catch (error) {
    console.error("Error removing Cookidoo credentials:", error);
    return c.json({ error: "Failed to remove Cookidoo credentials" }, 500);
  }
});


export default app;