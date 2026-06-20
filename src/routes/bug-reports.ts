import { Hono } from "hono";
import type { Context } from "hono";
import { authErrorPayload, getUserAuth, requireUserAuth } from "../auth.js";
import {
  createBugReport,
  getBugReportByIdForAdmin,
  listBugReportsForAdmin,
  listMyBugReports,
  recordBugReportSubmissionAttempt,
  updateBugReportAdminFields,
} from "../db-react.js";
import {
  BUG_REPORT_LIST_DEFAULT_LIMIT,
  BUG_REPORT_RATE_LIMIT_MAX_REQUESTS,
  BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES,
  clampBugReportListLimit,
  clampOffset,
  isBugReportSourceArea,
  isBugReportStatus,
  isBugReportType,
  normalizeAdminNotes,
  normalizeBugReportDescription,
  normalizeBugReportRoute,
  sanitizeBugReportMetadata,
} from "../bug-reports.js";

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

app.post("/api/v1/bug-reports", requireUserAuth(), async (c) => {
  const auth = getUserAuth(c);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({
      error: {
        code: "validation_failed",
        message: "Invalid JSON body",
        cause: "The request body must be a JSON object.",
      },
    }, 400);
  }

  const raw = body as Record<string, unknown>;
  if (!isBugReportType(raw.reportType)) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "reportType is invalid",
        cause: "Allowed values are `general` and `import_failure`.",
      },
    }, 400);
  }

  if (!isBugReportSourceArea(raw.sourceArea)) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "sourceArea is invalid",
        cause: "Allowed values are `global_button` and `import_error`.",
      },
    }, 400);
  }

  const description = normalizeBugReportDescription(raw.description);
  if (!description) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "description is required",
      },
    }, 400);
  }

  const rateLimit = await recordBugReportSubmissionAttempt(
    auth.userId,
    BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES,
    BUG_REPORT_RATE_LIMIT_MAX_REQUESTS,
  );

  if (!rateLimit.allowed) {
    return c.json({
      error: {
        code: "bug_report_rate_limited",
        message: "Too many bug reports in a short period",
        cause: `You can submit at most ${BUG_REPORT_RATE_LIMIT_MAX_REQUESTS} reports per ${BUG_REPORT_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
        fix: "Wait until the reset time before sending another report.",
      },
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime,
    }, 429);
  }

  const report = await createBugReport({
    reportType: raw.reportType,
    sourceArea: raw.sourceArea,
    description,
    userId: auth.userId,
    householdId: auth.activeHouseholdId,
    route: normalizeBugReportRoute(raw.route),
    metadata: sanitizeBugReportMetadata(raw.metadata),
  });

  return c.json({
    id: report.id,
    status: report.status,
    success: true,
  }, 201);
});

app.get("/api/v1/bug-reports/me", requireUserAuth(), async (c) => {
  const auth = getUserAuth(c);
  const limit = clampBugReportListLimit(c.req.query("limit"), BUG_REPORT_LIST_DEFAULT_LIMIT);
  const reports = await listMyBugReports(auth.userId, limit);
  return c.json({ reports });
});

app.get("/api/v1/admin/bug-reports", requireUserAuth(), async (c) => {
  const { response } = requireAdmin(c);
  if (response) return response;

  const rawStatus = c.req.query("status");
  const rawReportType = c.req.query("reportType");
  const rawSourceArea = c.req.query("sourceArea");

  if (rawStatus && !isBugReportStatus(rawStatus)) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "status is invalid",
      },
    }, 400);
  }

  if (rawReportType && !isBugReportType(rawReportType)) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "reportType is invalid",
      },
    }, 400);
  }

  if (rawSourceArea && !isBugReportSourceArea(rawSourceArea)) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "sourceArea is invalid",
      },
    }, 400);
  }

  const reports = await listBugReportsForAdmin({
    status: rawStatus as "new" | "triaging" | "in_progress" | "resolved" | "closed" | undefined,
    reportType: rawReportType as "general" | "import_failure" | undefined,
    sourceArea: rawSourceArea as "global_button" | "import_error" | undefined,
    limit: clampBugReportListLimit(c.req.query("limit"), BUG_REPORT_LIST_DEFAULT_LIMIT),
    offset: clampOffset(c.req.query("offset")),
  });

  return c.json({ reports });
});

app.get("/api/v1/admin/bug-reports/:id", requireUserAuth(), async (c) => {
  const { response } = requireAdmin(c);
  if (response) return response;

  const report = await getBugReportByIdForAdmin(c.req.param("id"));
  if (!report) {
    return c.json({
      error: {
        code: "not_found",
        message: "Bug report not found",
      },
    }, 404);
  }

  return c.json(report);
});

app.patch("/api/v1/admin/bug-reports/:id", requireUserAuth(), async (c) => {
  const { response } = requireAdmin(c);
  if (response) return response;

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({
      error: {
        code: "validation_failed",
        message: "Invalid JSON body",
      },
    }, 400);
  }

  const raw = body as Record<string, unknown>;
  if (!isBugReportStatus(raw.status)) {
    return c.json({
      error: {
        code: "validation_failed",
        message: "status is invalid",
      },
    }, 400);
  }

  const adminNotes = normalizeAdminNotes(raw.adminNotes);
  const updated = await updateBugReportAdminFields(c.req.param("id"), {
    status: raw.status,
    adminNotes,
  });

  if (!updated) {
    return c.json({
      error: {
        code: "not_found",
        message: "Bug report not found",
      },
    }, 404);
  }

  return c.json(updated);
});

export default app;
