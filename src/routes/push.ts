import { Hono } from "hono";
import { getAuth, requireUserAuth } from "../auth.js";
import { addPushSubscription, deletePushSubscriptionByEndpoint } from "../db-react.js";

const app = new Hono();

app.post("/api/v1/push/subscribe", requireUserAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const body = await c.req.json().catch(() => null);
    const endpoint = body?.endpoint;
    const keys = body?.keys;
    if (typeof endpoint !== "string" || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
      return c.json({ error: "endpoint and keys.{p256dh,auth} are required" }, 400);
    }
    await addPushSubscription(auth.userId, endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth }));
    return c.json({ success: true }, 201);
  } catch (error) {
    console.error("Error subscribing to push:", error);
    return c.json({ error: "Failed to subscribe" }, 500);
  }
});

app.delete("/api/v1/push/subscribe", requireUserAuth(), async (c) => {
  try {
    const auth = getAuth(c);
    const body = await c.req.json().catch(() => null);
    const endpoint = body?.endpoint;
    if (typeof endpoint !== "string") return c.json({ error: "endpoint is required" }, 400);
    await deletePushSubscriptionByEndpoint(auth.userId, endpoint);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error unsubscribing from push:", error);
    return c.json({ error: "Failed to unsubscribe" }, 500);
  }
});

export default app;
