import { Hono } from "hono";
import { BYOKValidator } from "../byok-validator.js";
import { getUserAuth, requireUserAuth } from "../auth.js";

const app = new Hono();
const BYOK_VALIDATE_WINDOW_MINUTES = 60;
const BYOK_VALIDATE_MAX_REQUESTS = 20;

// Validate a BYOK API key
app.post("/api/v1/keys/validate", requireUserAuth(), async (c) => {
  try {
    const { apiKey } = await c.req.json();

    if (!apiKey) {
      return c.json({ error: "API key is required" }, 400);
    }

    const auth = getUserAuth(c);
    const rateLimit = await BYOKValidator.checkRateLimit(
      BYOKValidator.hashKey(apiKey),
      BYOK_VALIDATE_WINDOW_MINUTES,
      BYOK_VALIDATE_MAX_REQUESTS,
      auth.userId,
    );
    if (!rateLimit.allowed) {
      return c.json({
        error: "BYOK validation rate limit exceeded",
        code: "byok_validation_rate_limited",
        remaining: rateLimit.remaining ?? 0,
        resetTime: rateLimit.resetTime,
      }, 429);
    }

    const result = await BYOKValidator.validateKey(apiKey);

    return c.json({
      valid: result.valid,
      reason: result.reason,
      model: result.model,
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime,
    });

  } catch (error) {
    console.error("Error validating API key:", error);
    return c.json({
      error: "Failed to validate API key",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
