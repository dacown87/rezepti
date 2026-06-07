/**
 * React-specific API endpoints
 * These endpoints use the React database (rezepti-react.db)
 */

import { Hono } from "hono";
import { ensureReactSchema } from "./db-react.js";
import authRouter from "./routes/auth.js";
import recipesRouter from "./routes/recipes.js";
import extractionRouter from "./routes/extraction.js";
import keysRouter from "./routes/keys.js";
import plannerRouter from "./routes/planner.js";
import platformsRouter from "./routes/platforms.js";

// Initialize React database schema once at startup
ensureReactSchema();

const app = new Hono();

app.route("/", authRouter);
app.route("/", recipesRouter);
app.route("/", extractionRouter);
app.route("/", keysRouter);
app.route("/", plannerRouter);
app.route("/", platformsRouter);

export default app;
