import { Hono } from "hono";
import { BYOKValidator } from "../byok-validator.js";
import { storeApiKey, removeApiKey } from "../db-react.js";

const app = new Hono();

// Validate a BYOK API key
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

// Store a BYOK API key (hashed)
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
    storeApiKey(keyHash, validation.model);

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

// Remove a BYOK API key
app.delete("/api/v1/keys/:keyHash", (c) => {
  try {
    const keyHash = c.req.param("keyHash");
    removeApiKey(keyHash);
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

export default app;
