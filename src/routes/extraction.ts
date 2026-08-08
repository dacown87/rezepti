import { Hono } from "hono";
import type { Context } from "hono";
import { jobManager } from "../job-manager.js";
import { config } from "../config.js";
import { processURL, toUserFriendlyError, buildQualityWarnings } from "../pipeline.js";
import { extractRecipeFromImage, extractRecipeFromText } from "../processors/llm.js";
import { checkFacebookRateLimit } from "../middleware/facebook-rate-limit.js";
import { classifyURL } from "../classifier.js";
import { saveRecipeToReactDb } from "../db-react.js";
import type { PipelineEvent } from "../types.js";
import { searchRecipeImages } from "../utils/image-search.js";
import { AuthFlowError, authErrorResponse, getUserAuth, requireUserAuth, resolveUserAuthContext } from "../auth.js";
import type { ExtractionJob } from "../job-manager.js";
import { ByokValidationFailure, enforceByokValidation } from "../byok-policy.js";

// In-memory store for base64 photo data, keyed by jobId (cleaned up after processing)
const photoDataStore = new Map<string, string>();
// In-memory store for free text input, keyed by jobId
const textDataStore = new Map<string, string>();

const app = new Hono();

function getApiKeyFromRequest(c: { req: { header: (name: string) => string | undefined } }, body?: Record<string, unknown>): string | undefined {
  const headerKey = c.req.header("x-groq-key")?.trim();
  if (headerKey) return headerKey;
  const bodyKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  return bodyKey || undefined;
}

async function validateOptionalApiKey(apiKey: string | undefined, userId: string): Promise<string | undefined> {
  if (!apiKey) return undefined;
  const enforcement = await enforceByokValidation(apiKey, userId);
  return enforcement.keyHash;
}

function byokValidationFailureResponse(c: Context, error: unknown) {
  if (!(error instanceof ByokValidationFailure)) {
    return null;
  }
  return c.json(error.payload, error.status);
}

function concurrencyLimitResponse(c: Context, userId: string) {
  const active = jobManager.getActiveJobs(config.jobs.stalledAfterMs);

  if (active.length >= config.jobs.maxConcurrent) {
    return c.json({
      error: "Zu viele Importe laufen gerade gleichzeitig. Bitte in einer Minute erneut versuchen.",
      status: "busy",
      scope: "server",
      activeJobs: active.length,
      maxConcurrent: config.jobs.maxConcurrent,
    }, 429);
  }

  const own = active.filter((job) => job.userId === userId).length;
  if (own >= config.jobs.maxConcurrentPerUser) {
    return c.json({
      error: `Du hast bereits ${own} Importe laufen. Bitte warte, bis einer davon fertig ist.`,
      status: "busy",
      scope: "user",
      activeJobs: own,
      maxConcurrent: config.jobs.maxConcurrentPerUser,
    }, 429);
  }

  return null;
}

async function authorizeJobAccess(c: { req: { header: (name: string) => string | undefined } }, job: ExtractionJob): Promise<void> {
  if (!job.userId) return;
  const auth = await resolveUserAuthContext(c.req.header("Authorization"));
  if (auth.userId !== job.userId) {
    throw new AuthFlowError(
      "not_found",
      "Job not found",
      404,
      "The job does not exist or is not visible to this user.",
    );
  }
}

// Start a new recipe extraction job
app.post("/api/v1/extract/react", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const body = await c.req.json() as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url : "";
    const apiKey = getApiKeyFromRequest(c, body);

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

    const busy = concurrencyLimitResponse(c, auth.userId);
    if (busy) return busy;

    let apiKeyHash: string | undefined;
    try {
      apiKeyHash = await validateOptionalApiKey(apiKey, auth.userId);
    } catch (error) {
      const failure = byokValidationFailureResponse(c, error);
      if (failure) return failure;
      throw error;
    }

    const userAgent = c.req.header("User-Agent");
    const job = jobManager.createJob(url, userAgent, apiKeyHash, auth.userId, auth.activeHouseholdId);

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
    if (error instanceof AuthFlowError) {
      return authErrorResponse(c, error);
    }
    console.error("Error creating extraction job:", error);
    return c.json({
      error: "Failed to create extraction job",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Poll job status
app.get("/api/v1/extract/react/:jobId", async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const since = parseInt(c.req.query("since") || "0");

    const job = jobManager.getJob(jobId);
    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    await authorizeJobAccess(c, job);

    if (since > 0) {
      const event = jobManager.getJobEventsSince(jobId, since);
      if (!event) {
        return c.json({ unchanged: true });
      }
      return c.json(event);
    }

    return c.json(jobManager.jobToEvent(job));

  } catch (error) {
    if (error instanceof AuthFlowError) {
      return authErrorResponse(c, error);
    }
    console.error("Error polling job:", error);
    return c.json({
      error: "Failed to poll job status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Cancel a job
app.delete("/api/v1/extract/react/:jobId", async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const job = jobManager.getJob(jobId);

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }
    await authorizeJobAccess(c, job);

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
    if (error instanceof AuthFlowError) {
      return authErrorResponse(c, error);
    }
    console.error("Error cancelling job:", error);
    return c.json({
      error: "Failed to cancel job",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// List recent jobs
app.get("/api/v1/extract/jobs", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const limit = parseInt(c.req.query("limit") || "50");
    const jobs = jobManager
      .getRecentJobs(limit)
      .filter((job) => job.userId === auth.userId);

    return c.json({
      jobs,
      total: jobs.length
    });

  } catch (error) {
    if (error instanceof AuthFlowError) {
      return authErrorResponse(c, error);
    }
    console.error("Error listing jobs:", error);
    return c.json({
      error: "Failed to list jobs",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// Photo extraction endpoint
app.post("/api/v1/extract/photo", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const apiKey = getApiKeyFromRequest(c);

    if (!file) return c.json({ error: "Keine Datei angegeben" }, 400);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Ungültiges Format. Erlaubt: JPEG, PNG, WebP" }, 400);
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return c.json({ error: "Datei zu groß. Maximum: 10 MB" }, 400);
    }

    const busy = concurrencyLimitResponse(c, auth.userId);
    if (busy) return busy;

    let apiKeyHash: string | undefined;
    try {
      apiKeyHash = await validateOptionalApiKey(apiKey, auth.userId);
    } catch (error) {
      const failure = byokValidationFailureResponse(c, error);
      if (failure) return failure;
      throw error;
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const userAgent = c.req.header("User-Agent");
    const job = apiKeyHash
      ? jobManager.createJob(`photo://${file.name || "upload"}`, userAgent, apiKeyHash, auth.userId, auth.activeHouseholdId)
      : jobManager.createJob(`photo://${file.name || "upload"}`, userAgent, undefined, auth.userId, auth.activeHouseholdId);
    photoDataStore.set(job.id, dataUrl);

    setTimeout(() => {
      processPhotoJobInBackground(job.id, apiKey).catch(console.error);
    }, 0);

    return c.json({
      jobId: job.id,
      status: "pending",
      message: "Photo extraction job created",
      pollUrl: `/api/v1/extract/react/${job.id}`,
    }, 202);

  } catch (error) {
    if (error instanceof AuthFlowError) {
      return authErrorResponse(c, error);
    }
    console.error("Error creating photo extraction job:", error);
    return c.json({ error: "Failed to create photo extraction job" }, 500);
  }
});

async function processPhotoJobInBackground(jobId: string, apiKey?: string) {
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

    const recipeData = await extractRecipeFromImage(dataUrl, undefined, { apiKey });

    jobManager.updateJob(jobId, { progress: 75, currentStage: "exporting", message: "Bilder werden gesucht", status: "running" });
    const imageSuggestions = await searchRecipeImages(recipeData.name).catch(() => []);

    // If no Chefkoch images found, fall back to the uploaded photo itself as cover image.
    // Only store if it's a compact data URL (base64 ≤ ~350 KB to avoid bloating the DB).
    if (imageSuggestions.length === 0 && !recipeData.imageUrl && dataUrl.length < 500_000) {
      recipeData.imageUrl = dataUrl;
    }

    jobManager.updateJob(jobId, { progress: 90, currentStage: "exporting", message: "Wird gespeichert", status: "running" });
    const userId = jobManager.getJob(jobId)?.userId;
    if (!userId) throw new Error("Authenticated job owner is required to save a recipe");
    const recipeId = await saveRecipeToReactDb(recipeData, "photo://upload", undefined, {
      owner: { type: "user", userId },
      createdBy: userId,
    });
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
app.post("/api/v1/extract/text", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const apiKey = getApiKeyFromRequest(c, body);

    if (!text) {
      return c.json({ error: "Text ist erforderlich" }, 400);
    }
    if (text.length < 50) {
      return c.json({ error: "Text muss mindestens 50 Zeichen lang sein" }, 400);
    }
    if (text.length > 50_000) {
      return c.json({ error: "Text darf maximal 50.000 Zeichen lang sein" }, 400);
    }

    const busy = concurrencyLimitResponse(c, auth.userId);
    if (busy) return busy;

    let apiKeyHash: string | undefined;
    try {
      apiKeyHash = await validateOptionalApiKey(apiKey, auth.userId);
    } catch (error) {
      const failure = byokValidationFailureResponse(c, error);
      if (failure) return failure;
      throw error;
    }

    const userAgent = c.req.header("User-Agent");
    const job = jobManager.createJob(`text://manual-${Date.now()}`, userAgent, apiKeyHash, auth.userId, auth.activeHouseholdId);
    textDataStore.set(job.id, text);

    setTimeout(() => {
      processTextJobInBackground(job.id, apiKey).catch(console.error);
    }, 0);

    return c.json({
      jobId: job.id,
      status: "pending",
      message: "Text extraction job created",
      pollUrl: `/api/v1/extract/react/${job.id}`,
    }, 202);

  } catch (error) {
    if (error instanceof AuthFlowError) {
      return authErrorResponse(c, error);
    }
    console.error("Error creating text extraction job:", error);
    return c.json({ error: "Failed to create text extraction job" }, 500);
  }
});

async function processTextJobInBackground(jobId: string, apiKey?: string) {
  const text = textDataStore.get(jobId);
  if (!text) {
    jobManager.failJob(jobId, "Text-Daten nicht gefunden");
    return;
  }
  try {
    jobManager.startJob(jobId);
    jobManager.updateJob(jobId, { progress: 20, currentStage: "extracting", message: "Rezept wird extrahiert", status: "running" });

    const recipeData = await extractRecipeFromText(text, undefined, { apiKey });

    jobManager.updateJob(jobId, { progress: 75, currentStage: "exporting", message: "Bilder werden gesucht", status: "running" });
    const imageSuggestions = await searchRecipeImages(recipeData.name).catch(() => []);

    jobManager.updateJob(jobId, { progress: 90, currentStage: "exporting", message: "Wird gespeichert", status: "running" });
    const userId = jobManager.getJob(jobId)?.userId;
    if (!userId) throw new Error("Authenticated job owner is required to save a recipe");
    const recipeId = await saveRecipeToReactDb(recipeData, "text://manual", undefined, {
      owner: { type: "user", userId },
      createdBy: userId,
    });

    const qualityWarnings = buildQualityWarnings(recipeData, "text://manual");

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
app.get("/api/v1/images/search", requireUserAuth(), async (c) => {
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

    try {
      if (!job.userId) {
        throw new Error("Authenticated job owner is required to process an extraction job");
      }

      const result = await processURL(job.url, onEvent, {
        apiKey: userApiKey,
        userId: job.userId,
        activeHouseholdId: job.activeHouseholdId ?? null,
      });

      if (result.success) {
        jobManager.completeJob(jobId, result);
      } else {
        jobManager.failJob(jobId, result.error || "Unknown error", result.hint);
      }

    } finally {
      // Per-job API keys are passed explicitly into LLM clients; server env remains unchanged.
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
