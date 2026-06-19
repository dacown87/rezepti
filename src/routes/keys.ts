import { Hono } from "hono";
import { getUserAuth, requireUserAuth } from "../auth.js";
import { ByokValidationFailure, enforceByokValidation } from "../byok-policy.js";

const app = new Hono();

// Validate a BYOK API key
app.post("/api/v1/keys/validate", requireUserAuth(), async (c) => {
  try {
    const { apiKey } = await c.req.json();

    if (!apiKey) {
      return c.json({ error: "API key is required" }, 400);
    }

    const auth = getUserAuth(c);
    const result = await enforceByokValidation(apiKey, auth.userId);

    return c.json({
      valid: true,
      model: result.model,
      remaining: result.remaining,
      resetTime: result.resetTime,
      policy: {
        windowMinutes: result.policy.windowMinutes,
        maxRequests: result.policy.maxRequests,
        source: result.policy.source,
        status: result.policy.status,
      },
    });
  } catch (error) {
    if (error instanceof ByokValidationFailure) {
      if (error.status === 400 && error.payload.code === "byok_key_invalid") {
        return c.json({
          valid: false,
          reason: error.payload.details,
          model: error.result?.model,
          remaining: error.result?.remaining,
          resetTime: error.result?.resetTime,
          policy: error.result?.policy ? {
            windowMinutes: error.result.policy.windowMinutes,
            maxRequests: error.result.policy.maxRequests,
            source: error.result.policy.source,
            status: error.result.policy.status,
          } : undefined,
        });
      }
      return c.json(error.payload, error.status);
    }
    console.error("Error validating API key:", error);
    return c.json({
      error: "Failed to validate API key",
      details: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default app;
