import { Hono } from "hono";
import { AuthFlowError, authErrorPayload, authErrorResponse, getUserAuth, requireUserAuth } from "../auth.js";
import { ensureDefaultHouseholdForUser, ensureUserProfile, getAccountBootstrapStatus } from "../db-react.js";

const app = new Hono();

const BOOTSTRAP_DOCS = "docs/auth-runbook-route-privacy.md#auth-onboarding-bootstrap";

app.get("/api/v1/auth/me", requireUserAuth(), async (c) => {
  const auth = getUserAuth(c);
  return c.json({
    userId: auth.userId,
    email: auth.email,
    appRole: auth.appRole,
    activeHouseholdId: auth.activeHouseholdId,
    memberships: auth.memberships,
  });
});

// Log lines carry only a UUID prefix: enough to correlate, not the full id.
const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : null);

app.post("/api/v1/auth/bootstrap", requireUserAuth(), async (c) => {
  const authUserId = () => {
    try {
      return getUserAuth(c).userId;
    } catch {
      return null;
    }
  };

  try {
    const auth = getUserAuth(c);
    console.info("auth.bootstrap.start", { userId: shortId(auth.userId) });

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
      userId: shortId(auth.userId),
      result,
      householdId: shortId(status.workspace.id),
    });

    return c.json({
      ...status,
      result,
    });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      console.error("auth.bootstrap.failure", {
        userId: shortId(authUserId()),
        code: error.code,
        message: error.message,
      });
      return authErrorResponse(c, error);
    }

    console.error("auth.bootstrap.failure", {
      userId: shortId(authUserId()),
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
