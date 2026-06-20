import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAuthForTests, resetAuthAdaptersForTests } from "../../src/auth.js";

const dbMocks = vi.hoisted(() => ({
  createBugReport: vi.fn(),
  listMyBugReports: vi.fn(),
  listBugReportsForAdmin: vi.fn(),
  getBugReportByIdForAdmin: vi.fn(),
  updateBugReportAdminFields: vi.fn(),
  recordBugReportSubmissionAttempt: vi.fn(),
  loadUserAuthorization: vi.fn(),
}));

vi.mock("../../src/db-react.js", () => dbMocks);

const { default: bugReportsRouter } = await import("../../src/routes/bug-reports.js");

function withAuth(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, {
    ...init,
    headers: {
      Authorization: "Bearer valid-token",
      ...(init?.headers ?? {}),
    },
  });
}

describe("bug report routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.recordBugReportSubmissionAttempt.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetTime: 1_717_000_000_000,
    });

    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: "00000000-0000-0000-0000-000000000001",
        email: "user@example.com",
      }),
      loadAuthorization: async () => ({
        appRole: "user",
        memberships: [{ householdId: "10000000-0000-0000-0000-000000000001", role: "owner" }],
        activeHouseholdId: "10000000-0000-0000-0000-000000000001",
      }),
    });
  });

  afterEach(() => {
    resetAuthAdaptersForTests();
  });

  it("POST /api/v1/bug-reports rejects missing description", async () => {
    const response = await bugReportsRouter.request(
      "/api/v1/bug-reports",
      withAuth("/api/v1/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "general",
          sourceArea: "global_button",
          description: "   ",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "validation_failed" },
    });
  });

  it("POST /api/v1/bug-reports sanitizes metadata and creates report", async () => {
    dbMocks.createBugReport.mockResolvedValue({
      id: "report-1",
      status: "new",
    });

    const response = await bugReportsRouter.request(
      "/api/v1/bug-reports",
      withAuth("/api/v1/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "import_failure",
          sourceArea: "import_error",
          description: "Import bricht ab",
          route: "/(tabs)/extract",
          metadata: {
            appVersion: "1.2.3",
            token: "secret",
            qualityWarnings: ["low contrast"],
            lastFailureSnapshot: {
              mode: "url",
              submittedUrl: "https://example.com/recipe",
              errorMessage: "Bad upstream",
              qualityWarnings: ["cropped"],
              sessionToken: "drop-me",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(dbMocks.createBugReport).toHaveBeenCalledWith(expect.objectContaining({
      reportType: "import_failure",
      sourceArea: "import_error",
      description: "Import bricht ab",
      route: "/(tabs)/extract",
      userId: "00000000-0000-0000-0000-000000000001",
      householdId: "10000000-0000-0000-0000-000000000001",
      metadata: {
        appVersion: "1.2.3",
        qualityWarnings: ["low contrast"],
        lastFailureSnapshot: {
          mode: "url",
          submittedUrl: "https://example.com/recipe",
          errorMessage: "Bad upstream",
          qualityWarnings: ["cropped"],
        },
      },
    }));
    await expect(response.json()).resolves.toMatchObject({
      id: "report-1",
      status: "new",
      success: true,
    });
  });

  it("POST /api/v1/bug-reports returns 429 when the per-user rate limit is exhausted", async () => {
    dbMocks.recordBugReportSubmissionAttempt.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: 1_717_000_000_000,
    });

    const response = await bugReportsRouter.request(
      "/api/v1/bug-reports",
      withAuth("/api/v1/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "general",
          sourceArea: "global_button",
          description: "Zu viele Reports",
        }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "bug_report_rate_limited" },
      remaining: 0,
    });
  });

  it("GET /api/v1/bug-reports/me returns only the caller's reports", async () => {
    dbMocks.listMyBugReports.mockResolvedValue([
      {
        id: "report-1",
        reportType: "general",
        status: "new",
        description: "A",
        route: "/settings",
        sourceArea: "global_button",
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      },
    ]);

    const response = await bugReportsRouter.request(
      "/api/v1/bug-reports/me",
      withAuth("/api/v1/bug-reports/me"),
    );

    expect(response.status).toBe(200);
    expect(dbMocks.listMyBugReports).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      20,
    );
  });

  it("GET /api/v1/admin/bug-reports rejects non-admin users", async () => {
    const response = await bugReportsRouter.request(
      "/api/v1/admin/bug-reports",
      withAuth("/api/v1/admin/bug-reports"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "admin_required" },
    });
  });

  it("PATCH /api/v1/admin/bug-reports/:id updates status for admins", async () => {
    configureAuthForTests({
      verifyAccessToken: async () => ({
        id: "00000000-0000-0000-0000-000000000099",
        email: "admin@example.com",
      }),
      loadAuthorization: async () => ({
        appRole: "admin",
        memberships: [],
        activeHouseholdId: null,
      }),
    });

    dbMocks.updateBugReportAdminFields.mockResolvedValue({
      id: "report-1",
      reportType: "general",
      status: "resolved",
      description: "A",
      userId: "user-1",
      householdId: null,
      route: "/settings",
      sourceArea: "global_button",
      metadata: {},
      adminNotes: "Fixed",
      resolvedAt: "2026-06-20T10:00:00.000Z",
      createdAt: "2026-06-20T09:00:00.000Z",
      updatedAt: "2026-06-20T10:00:00.000Z",
    });

    const response = await bugReportsRouter.request(
      "/api/v1/admin/bug-reports/report-1",
      withAuth("/api/v1/admin/bug-reports/report-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          adminNotes: "Fixed",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(dbMocks.updateBugReportAdminFields).toHaveBeenCalledWith("report-1", {
      status: "resolved",
      adminNotes: "Fixed",
    });
    await expect(response.json()).resolves.toMatchObject({
      status: "resolved",
      resolvedAt: "2026-06-20T10:00:00.000Z",
    });
  });
});
