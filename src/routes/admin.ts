import { Hono } from "hono";
import type { Context } from "hono";
import { authErrorPayload, getUserAuth, requireUserAuth } from "../auth.js";
import { getByokValidationPolicy, upsertByokValidationPolicy } from "../db-react.js";

const app = new Hono();

function requireAdmin(c: Context) {
  const auth = getUserAuth(c);
  if (auth.appRole !== "admin") {
    return {
      auth,
      response: c.json(
        authErrorPayload(
          "admin_required",
          "Admin access is required",
          "The authenticated user is not an admin.",
          "Sign in with an admin account before opening this control plane.",
        ),
        403,
      ),
    };
  }

  return { auth, response: null };
}

function parsePositiveInt(value: unknown, name: string, min: number, max: number) {
  if (!Number.isInteger(value)) {
    return `${name} must be an integer`;
  }
  if ((value as number) < min || (value as number) > max) {
    return `${name} must be between ${min} and ${max}`;
  }
  return null;
}

app.get("/api/v1/admin/byok-validation-policy", requireUserAuth(), async (c) => {
  const { response } = requireAdmin(c);
  if (response) return response;

  try {
    const policy = await getByokValidationPolicy();
    return c.json(policy);
  } catch (error) {
    console.error("admin.byok-policy.read.failed", error);
    return c.json({
      error: {
        code: "byok_policy_unavailable",
        message: "BYOK policy could not be loaded",
        cause: error instanceof Error ? error.message : "Unknown error",
        fix: "Retry the request or inspect the BYOK policy store.",
        docs: "docs/superpowers/plans/2026-06-16-byok-rate-limit-admin-plan.md",
      },
    }, 500);
  }
});

app.put("/api/v1/admin/byok-validation-policy", requireUserAuth(), async (c) => {
  const { auth, response } = requireAdmin(c);
  if (response) return response;

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({
      error: {
        code: "validation_failed",
        message: "Invalid JSON body",
        cause: "The request body must be a JSON object with windowMinutes and maxRequests.",
      },
    }, 400);
  }

  const windowMinutes = (body as Record<string, unknown>).windowMinutes;
  const maxRequests = (body as Record<string, unknown>).maxRequests;
  const windowError = parsePositiveInt(windowMinutes, "windowMinutes", 1, 1440);
  const requestError = parsePositiveInt(maxRequests, "maxRequests", 1, 1000);

  if (windowError || requestError) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "BYOK policy values are invalid",
        cause: [windowError, requestError].filter(Boolean).join("; "),
      },
    }, 400);
  }

  try {
    const policy = await upsertByokValidationPolicy({
      windowMinutes: windowMinutes as number,
      maxRequests: maxRequests as number,
      updatedByUserId: auth.userId,
    });
    return c.json(policy);
  } catch (error) {
    console.error("admin.byok-policy.write.failed", error);
    return c.json({
      error: {
        code: "byok_policy_unavailable",
        message: "BYOK policy could not be saved",
        cause: error instanceof Error ? error.message : "Unknown error",
        fix: "Retry the save or inspect the BYOK policy store.",
      },
    }, 500);
  }
});

export default app;
