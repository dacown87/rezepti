import { Hono } from "hono";
import { AuthFlowError, authErrorPayload, authErrorResponse, getUserAuth, requireUserAuth } from "../auth.js";
import { ensureDefaultHouseholdForUser, ensureUserProfile, getAccountBootstrapStatus } from "../db-react.js";

const app = new Hono();

const BOOTSTRAP_DOCS = "docs/auth-runbook-route-privacy.md#auth-onboarding-bootstrap";

app.post("/api/v1/auth/bootstrap", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    console.info("auth.bootstrap.start", { userId: auth.userId });

    const profile = await ensureUserProfile(auth.userId, auth.email);
    const workspace = await ensureDefaultHouseholdForUser(auth.userId);
    const status = await getAccountBootstrapStatus(auth.userId);

    if (!status) {
      throw new AuthFlowError(
        "bootstrap_failed",
        "Workspace is not ready.",
        500,
        "Bootstrap completed without a readable profile and active workspace state.",
        "Retry account bootstrap.",
        BOOTSTRAP_DOCS,
      );
    }

    const result = profile.created || workspace.created ? "created" : "existing";

    console.info("auth.bootstrap.success", {
      userId: auth.userId,
      result,
      householdId: status.workspace.id,
    });

    return c.json({
      ...status,
      result,
    });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      console.error("auth.bootstrap.failure", {
        userId: c.get("auth")?.userId ?? null,
        code: error.code,
        message: error.message,
      });
      return authErrorResponse(c, error);
    }

    console.error("auth.bootstrap.failure", {
      userId: c.get("auth")?.userId ?? null,
      error,
    });

    return c.json(
      authErrorPayload(
        "bootstrap_failed",
        "Workspace is not ready.",
        error instanceof Error ? error.message : "Unknown bootstrap failure",
        "Retry account bootstrap.",
        BOOTSTRAP_DOCS,
      ),
      500,
    );
  }
});

export default app;
