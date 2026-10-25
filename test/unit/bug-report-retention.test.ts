import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  purgeExpiredBugReports: vi.fn(),
  purgeExpiredInvites: vi.fn(),
  purgeExpiredDeletionLog: vi.fn(),
  purgeExpiredImportQuota: vi.fn(),
}));

vi.mock("../../src/db-react.js", () => dbMocks);

vi.mock("../../src/config.js", () => ({
  config: {
    retention: { bugReportMonths: 12, inviteDays: 30, deletionLogDays: 35, importQuotaDays: 2 },
  },
}));

const { runRetentionSteps, startRetentionTimer } = await import("../../src/retention.js");

describe("retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs every step with the configured retention windows and logs removals", async () => {
    dbMocks.purgeExpiredBugReports.mockResolvedValue(3);
    dbMocks.purgeExpiredInvites.mockResolvedValue(5);
    dbMocks.purgeExpiredDeletionLog.mockResolvedValue(1);
    dbMocks.purgeExpiredImportQuota.mockResolvedValue(2);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runRetentionSteps();

    expect(dbMocks.purgeExpiredBugReports).toHaveBeenCalledWith(12);
    expect(dbMocks.purgeExpiredInvites).toHaveBeenCalledWith(30);
    expect(dbMocks.purgeExpiredDeletionLog).toHaveBeenCalledWith(35);
    expect(dbMocks.purgeExpiredImportQuota).toHaveBeenCalledWith(2);
    expect(logSpy).toHaveBeenCalledWith("[retention] bug_reports removed 3");
    expect(logSpy).toHaveBeenCalledWith("[retention] invites removed 5");
    expect(logSpy).toHaveBeenCalledWith("[retention] deleted_accounts_log removed 1");
    expect(logSpy).toHaveBeenCalledWith("[retention] import_quota removed 2");
  });

  it("logs a step failure instead of throwing and still runs later steps", async () => {
    dbMocks.purgeExpiredBugReports.mockRejectedValue(new Error("boom"));
    dbMocks.purgeExpiredInvites.mockResolvedValue(1);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runRetentionSteps()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[retention] bug_reports failed:", expect.any(Error));
    expect(dbMocks.purgeExpiredInvites).toHaveBeenCalled();
  });

  it("schedules a recurring run on the interval", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(undefined);

    const timer = startRetentionTimer(60_000, run);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });

  it("unrefs the timer so it never keeps the process alive", () => {
    const fakeTimer = { unref: vi.fn() };
    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockReturnValue(fakeTimer as unknown as ReturnType<typeof setInterval>);

    const timer = startRetentionTimer(60_000);
    expect(timer).toBe(fakeTimer);
    expect(fakeTimer.unref).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
