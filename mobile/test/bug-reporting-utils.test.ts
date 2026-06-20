import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.fn();
const assertApiOkMock = vi.fn(async () => undefined);
const readApiErrorMock = vi.fn(async () => new Error("api failed"));

vi.mock("@/utils/api", () => ({
  apiFetch: apiFetchMock,
  assertApiOk: assertApiOkMock,
  readApiError: readApiErrorMock,
}));

describe("bug reporting utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("opens bug report intents through the shared controller", async () => {
    const { openBugReportModal, registerBugReportModalController } = await import("@/utils/bug-reporting");
    const listener = vi.fn();
    const unregister = registerBugReportModalController(listener);

    openBugReportModal({
      reportType: "general",
      sourceArea: "global_button",
      route: "/(tabs)/settings",
    });

    expect(listener).toHaveBeenCalledWith({
      reportType: "general",
      sourceArea: "global_button",
      route: "/(tabs)/settings",
    });

    unregister();
    openBugReportModal({
      reportType: "general",
      sourceArea: "global_button",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fetches my bug reports through the shared API helper", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      reports: [{ id: "r1", description: "broken" }],
    }), { status: 200 }));

    const { fetchMyBugReports } = await import("@/utils/bug-reporting");
    await expect(fetchMyBugReports(10)).resolves.toEqual([{ id: "r1", description: "broken" }]);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/bug-reports/me?limit=10");
  });

  it("updates admin bug reports via PATCH", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      id: "r1",
      status: "resolved",
    }), { status: 200 }));

    const { updateAdminBugReport } = await import("@/utils/bug-reporting");
    await expect(updateAdminBugReport({
      id: "r1",
      status: "resolved",
      adminNotes: "done",
    })).resolves.toMatchObject({ id: "r1", status: "resolved" });

    expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/admin/bug-reports/r1", expect.objectContaining({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", adminNotes: "done" }),
    }));
  });
});
