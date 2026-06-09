import { Hono } from "hono";
import { BYOKValidator } from "../byok-validator.js";
import { requireUserAuth } from "../auth.js";

const app = new Hono();

// Validate a BYOK API key
app.post("/api/v1/keys/validate", requireUserAuth(), async (c) => {
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

export default app;
