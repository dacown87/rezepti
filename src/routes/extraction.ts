import { Hono } from "hono";
import { jobManager } from "../job-manager.js";
import { BYOKValidator } from "../byok-validator.js";
import { processURL, toUserFriendlyError } from "../pipeline.js";
import { extractRecipeFromImage, extractRecipeFromText } from "../processors/llm.js";
import { checkFacebookRateLimit } from "../middleware/facebook-rate-limit.js";
import { classifyURL } from "../classifier.js";
import { saveRecipeToReactDb } from "../db-react.js";
import type { PipelineEvent } from "../types.js";
import { searchRecipeImages } from "../utils/image-search.js";

// In-memory store for base64 photo data, keyed by jobId (cleaned up after processing)
const photoDataStore = new Map<string, string>();
// In-memory store for free text input, keyed by jobId
const textDataStore = new Map<string, string>();

const app = new Hono();

// Start a new recipe extraction job
app.post("/api/v1/extract/react", async (c) => {
  try {
    const { url, apiKey } = await c.req.json();

    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }

    try {
      new URL(url);
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // Facebook rate limit check
    const classified = classifyURL(url);
    if (classified.type === "facebook") {
      const clientIp = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
                        c.req.header("x-real-ip") ||
                        "unknown";
      const { allowed, retryAfterMs } = checkFacebookRateLimit(clientIp);
      if (!allowed) {
        return c.json({
          error: "Rate limit exceeded. Max 1 request per minute for Facebook.",
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
        }, 429);
      }
    }

    if (jobManager.isUrlProcessing(url)) {
      return c.json({
        error: "This URL is already being processed",
        status: "conflict"
      }, 409);
    }

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

    const userAgent = c.req.header("User-Agent");
    const job = jobManager.createJob(url, userAgent, apiKeyHash);

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

    if (since > 0) {
      const event = jobManager.getJobEventsSince(jobId, since);
      if (!event) {
        return c.json({ unchanged: true });
      }
      return c.json(event);
    }

    return c.json(jobManager.jobToEvent(job));

  } catch (error) {
    console.error("Error polling job:", error);
    return c.json({
      error: "Failed to poll job status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Cancel a job
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

// List recent jobs
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

    jobManager.updateJob(jobId, { progress: 75, currentStage: "exporting", message: "Bilder werden gesucht", status: "running" });
    const imageSuggestions = await searchRecipeImages(recipeData.name).catch(() => []);

    // If no Chefkoch images found, fall back to the uploaded photo itself as cover image.
    // Only store if it's a compact data URL (base64 ≤ ~350 KB to avoid bloating the DB).
    if (imageSuggestions.length === 0 && !recipeData.imageUrl && dataUrl.length < 500_000) {
      recipeData.imageUrl = dataUrl;
    }

    jobManager.updateJob(jobId, { progress: 90, currentStage: "exporting", message: "Wird gespeichert", status: "running" });
    const recipeId = await saveRecipeToReactDb(recipeData, "photo://upload");
    jobManager.completeJob(jobId, { success: true, recipeId, recipe: recipeData, imageSuggestions });

  } catch (error) {
    console.error(`Photo job ${jobId} failed:`, error);
    const { message, hint } = toUserFriendlyError(error);
    jobManager.failJob(jobId, message, hint);
  } finally {
    photoDataStore.delete(jobId);
  }
}

// Free text extraction endpoint
app.post("/api/v1/extract/text", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return c.json({ error: "Text ist erforderlich" }, 400);
    }
    if (text.length < 50) {
      return c.json({ error: "Text muss mindestens 50 Zeichen lang sein" }, 400);
    }

    const userAgent = c.req.header("User-Agent");
    const job = jobManager.createJob(`text://manual-${Date.now()}`, userAgent);
    textDataStore.set(job.id, text);

    setTimeout(() => {
      processTextJobInBackground(job.id).catch(console.error);
    }, 0);

    return c.json({
      jobId: job.id,
      status: "pending",
      message: "Text extraction job created",
      pollUrl: `/api/v1/extract/react/${job.id}`,
    }, 202);

  } catch (error) {
    console.error("Error creating text extraction job:", error);
    return c.json({ error: "Failed to create text extraction job" }, 500);
  }
});

async function processTextJobInBackground(jobId: string) {
  const text = textDataStore.get(jobId);
  if (!text) {
    jobManager.failJob(jobId, "Text-Daten nicht gefunden");
    return;
  }
  try {
    jobManager.startJob(jobId);
    jobManager.updateJob(jobId, { progress: 20, currentStage: "extracting", message: "Rezept wird extrahiert", status: "running" });

    const recipeData = await extractRecipeFromText(text);

    jobManager.updateJob(jobId, { progress: 75, currentStage: "exporting", message: "Bilder werden gesucht", status: "running" });
    const imageSuggestions = await searchRecipeImages(recipeData.name).catch(() => []);

    jobManager.updateJob(jobId, { progress: 90, currentStage: "exporting", message: "Wird gespeichert", status: "running" });
    const recipeId = await saveRecipeToReactDb(recipeData, "text://manual");

    const qualityWarnings: string[] = [];
    if (!recipeData.ingredients || recipeData.ingredients.length === 0)
      qualityWarnings.push("Keine Zutaten erkannt — bitte manuell ergänzen.");
    if (!recipeData.steps || recipeData.steps.length === 0)
      qualityWarnings.push("Keine Zubereitungsschritte erkannt — bitte manuell ergänzen.");
    if (!recipeData.name || /^https?:\/\//i.test(recipeData.name))
      qualityWarnings.push("Kein Rezeptname erkannt — bitte manuell eintragen.");

    jobManager.completeJob(jobId, {
      success: true,
      recipeId,
      recipe: recipeData,
      imageSuggestions,
      qualityWarnings: qualityWarnings.length ? qualityWarnings : undefined,
    });

  } catch (error) {
    console.error(`Text job ${jobId} failed:`, error);
    const { message, hint } = toUserFriendlyError(error);
    jobManager.failJob(jobId, message, hint);
  } finally {
    textDataStore.delete(jobId);
  }
}

// Image search endpoint for photo import flow
app.get("/api/v1/images/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ images: [] });
  const limitParam = parseInt(c.req.query("limit") ?? "4", 10);
  const limit = [4, 8, 16].includes(limitParam) ? limitParam : 4;
  const images = await searchRecipeImages(q, limit).catch(() => []);
  return c.json({ images });
});

async function processJobInBackground(jobId: string, userApiKey?: string) {
  try {
    const job = jobManager.getJob(jobId);
    if (!job || job.status !== "pending") {
      return;
    }

    jobManager.startJob(jobId);

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

    const originalApiKey = process.env.GROQ_API_KEY;
    if (userApiKey) {
      process.env.GROQ_API_KEY = userApiKey;
    }

    try {
      const result = await processURL(job.url, onEvent);

      if (result.success) {
        jobManager.completeJob(jobId, result);
      } else {
        jobManager.failJob(jobId, result.error || "Unknown error", result.hint);
      }

    } finally {
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
