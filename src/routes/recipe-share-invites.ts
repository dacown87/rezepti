import { Hono } from "hono";
import {
  acceptRecipeShareInvite,
  createRecipeShareInvite,
  getRecipeShareInvitePreview,
} from "../db-react.js";
import { getUserAuth, requireUserAuth } from "../auth.js";

const app = new Hono();

app.post("/api/v1/recipes/:id/share-invites", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const body = await c.req.json().catch(() => null);
    const email = body && typeof body === "object" ? (body as { email?: unknown }).email : undefined;
    if (typeof email !== "string") {
      return c.json({ error: "email is required", code: "invalid_email" }, 400);
    }

    const invite = await createRecipeShareInvite(auth, id, email);
    return c.json({ invite }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_email") {
      return c.json({ error: "Invalid email", code: "invalid_email" }, 400);
    }
    if (error instanceof Error && error.message === "not_found") {
      return c.json({ error: "Not found" }, 404);
    }
    console.error("Error creating recipe share invite:", error);
    return c.json({ error: "Failed to create recipe share invite" }, 500);
  }
});

app.get("/api/v1/share-invites/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const preview = await getRecipeShareInvitePreview(token);
    if (!preview) return c.json({ error: "Not found" }, 404);
    return c.json({ invite: preview });
  } catch (error) {
    console.error("Error fetching recipe share invite:", error);
    return c.json({ error: "Failed to fetch recipe share invite" }, 500);
  }
});

app.post("/api/v1/share-invites/:token/accept", requireUserAuth(), async (c) => {
  try {
    const auth = getUserAuth(c);
    const token = c.req.param("token");
    const result = await acceptRecipeShareInvite(auth, token);

    if (result === "not_found") return c.json({ error: "Not found" }, 404);
    if (result === "email_mismatch") {
      return c.json({ error: "Invite is for a different email address", code: "email_mismatch" }, 403);
    }
    if (result === "expired") {
      return c.json({ error: "Invite has expired", code: "invite_expired" }, 410);
    }
    if (result === "revoked") {
      return c.json({ error: "Invite has been revoked", code: "invite_revoked" }, 410);
    }

    return c.json({
      status: result.status,
      recipe: result.recipe,
      alreadyAccepted: result.alreadyAccepted,
    });
  } catch (error) {
    console.error("Error accepting recipe share invite:", error);
    return c.json({ error: "Failed to accept recipe share invite" }, 500);
  }
});

export default app;
