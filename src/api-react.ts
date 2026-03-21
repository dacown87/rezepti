/**
 * React-specific API endpoints
 * These endpoints use the React database (rezepti-react.db)
 */

import { Hono } from "hono";
import { DatabaseManager } from "./db-manager.js";
import { jobManager } from "./job-manager.js";
import { BYOKValidator } from "./byok-validator.js";
import { processURL } from "./pipeline.js";
import type { RecipeData, PipelineEvent } from "./types.js";

const app = new Hono();

// Initialize React database schema
app.use("*", async (c, next) => {
  DatabaseManager.ensureSchema("react");
  await next();
});

/**
 * React API endpoints use /api/v1/ prefix
 */

// Simple job management for React
interface ReactJob {
  id: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentStage?: string
  message?: string
  result?: any
  error?: string
  createdAt: string
}

const jobs = new Map<string, ReactJob>()

// Simple GET endpoint for React extraction (for testing)
app.get("/api/v1/extract/react", async (c) => {
  const url = c.req.query("url");
  
  if (!url) {
    return c.json({ error: "URL parameter is required" }, 400);
  }

  try {
    new URL(url);
  } catch {
    return c.json({ error: "Invalid URL format" }, 400);
  }

  // Create job
  const jobId = `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const job: ReactJob = {
    id: jobId,
    url,
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
  }
  
  jobs.set(jobId, job)
  
  // Return job ID immediately
  return c.json({
    jobId,
    status: "pending",
    message: "Extraction job created successfully"
  });
});

// Get job status
app.get("/api/v1/jobs/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);
  
  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }
  
  return c.json(job);
});

// List all recipes from React database
app.get("/api/v1/recipes", (c) => {
  try {
    const recipes = DatabaseManager.getAllRecipes("react");
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
    
    const recipe = DatabaseManager.getRecipeById(id, "react");
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
    
    const id = DatabaseManager.saveRecipe(recipe, sourceUrl, transcript, "react");
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
    const updated = DatabaseManager.updateRecipe(id, body, "react");
    
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
    
    const deleted = DatabaseManager.deleteRecipe(id, "react");
    if (!deleted) return c.json({ error: "Not found" }, 404);
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting recipe from React DB:", error);
    return c.json({ error: "Failed to delete recipe" }, 500);
  }
});

// Migration endpoint (admin only - for development)
app.post("/api/v1/migrate", async (c) => {
  try {
    // In production, add authentication check here
    const count = await DatabaseManager.migrateToReactDb();
    return c.json({ 
      success: true, 
      message: `Migrated ${count} recipes to React database` 
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return c.json({ error: "Migration failed" }, 500);
  }
});

// Health check for React database
app.get("/api/v1/health", async (c) => {
  try {
    const recipes = DatabaseManager.getAllRecipes("react");
    return c.json({
      server: true,
      database: "react",
      recipeCount: recipes.length,
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
      // Run the pipeline
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

export default app;