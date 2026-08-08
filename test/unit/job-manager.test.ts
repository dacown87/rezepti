import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobManager, startJobCleanupTimer } from "../../src/job-manager.js";

function createTestManager() {
  let currentTime = 1_000_000_000_000;
  const randomValues = [
    0.123456789,
    0.234567891,
    0.345678912,
    0.456789123,
    0.567891234,
    0.678912345,
  ];

  const now = vi.fn(() => currentTime);
  const random = vi.fn(() => randomValues.shift() ?? 0.999999999);
  const manager = JobManager.createTestInstance({ now, random });

  return {
    manager,
    setTime: (value: number) => {
      currentTime = value;
    },
    now,
    random,
  };
}

describe("JobManager", () => {
  let manager: JobManager;
  let setTime: (value: number) => void;

  beforeEach(() => {
    ({ manager, setTime } = createTestManager());
  });

  it("creates jobs with stable runtime state", () => {
    setTime(1_000);

    const job = manager.createJob("https://example.com/recipe", "TestAgent/1.0", "hash_abc");

    expect(job.id).toMatch(/^job_1000_[a-z0-9]+$/);
    expect(job.url).toBe("https://example.com/recipe");
    expect(job.status).toBe("pending");
    expect(job.progress).toBe(0);
    expect(job.createdAt).toBe(1_000);
    expect(job.updatedAt).toBe(1_000);
    expect(job.userAgent).toBe("TestAgent/1.0");
    expect(job.apiKeyHash).toBe("hash_abc");
    expect(manager.getJob(job.id)).toBe(job);
  });

  it("starts jobs and marks them as running", () => {
    setTime(1_000);
    const job = manager.createJob("https://example.com/recipe");

    setTime(1_500);
    expect(manager.startJob(job.id)).toBe(true);

    expect(job.status).toBe("running");
    expect(job.progress).toBe(10);
    expect(job.startedAt).toBe(1_500);
    expect(job.updatedAt).toBe(1_500);
  });

  it("returns false when starting an unknown job", () => {
    expect(manager.startJob("job_missing")).toBe(false);
  });

  it("updates jobs in place and refreshes the timestamp", () => {
    setTime(1_000);
    const job = manager.createJob("https://example.com/recipe");

    setTime(1_250);
    expect(
      manager.updateJob(job.id, {
        progress: 45,
        currentStage: "extracting",
        message: "Parsing recipe data",
        status: "running",
      }),
    ).toBe(true);

    expect(job.progress).toBe(45);
    expect(job.currentStage).toBe("extracting");
    expect(job.message).toBe("Parsing recipe data");
    expect(job.status).toBe("running");
    expect(job.updatedAt).toBe(1_250);
  });

  it("completes jobs with result data", () => {
    setTime(1_000);
    const job = manager.createJob("https://example.com/recipe");

    const result = {
      success: true,
      recipeId: 42,
      recipe: {
        name: "Test Recipe",
        duration: "mittel" as const,
        tags: ["test"],
        emoji: "🍲",
        ingredients: ["1x ingredient"],
        steps: ["Do the thing"],
      },
      imageSuggestions: ["https://cdn.example.com/a.jpg"],
    };

    setTime(1_800);
    expect(manager.completeJob(job.id, result)).toBe(true);

    expect(job.status).toBe("completed");
    expect(job.progress).toBe(100);
    expect(job.result).toEqual(result);
    expect(job.completedAt).toBe(1_800);
    expect(job.updatedAt).toBe(1_800);
  });

  it("fails jobs with error and hint information", () => {
    setTime(1_000);
    const job = manager.createJob("https://example.com/recipe");

    setTime(2_000);
    expect(manager.failJob(job.id, "Network timeout", "Retry later")).toBe(true);

    expect(job.status).toBe("failed");
    expect(job.progress).toBe(100);
    expect(job.error).toBe("Network timeout");
    expect(job.hint).toBe("Retry later");
    expect(job.completedAt).toBe(2_000);
    expect(job.updatedAt).toBe(2_000);
  });

  it("returns recent jobs sorted by creation time and applies the limit", () => {
    setTime(1_000);
    const oldest = manager.createJob("https://example.com/old");

    setTime(2_000);
    const middle = manager.createJob("https://example.com/middle");

    setTime(3_000);
    const newest = manager.createJob("https://example.com/new");

    expect(manager.getRecentJobs()).toEqual([newest, middle, oldest]);
    expect(manager.getRecentJobs(2)).toEqual([newest, middle]);
  });

  it("returns active jobs sorted by creation time and excludes finished jobs", () => {
    setTime(1_000);
    const pending = manager.createJob("https://example.com/pending");

    setTime(2_000);
    const running = manager.createJob("https://example.com/running");
    manager.startJob(running.id);

    setTime(3_000);
    const completed = manager.createJob("https://example.com/completed");
    manager.completeJob(completed.id, { success: true });

    setTime(4_000);
    const failed = manager.createJob("https://example.com/failed");
    manager.failJob(failed.id, "boom");

    expect(manager.getActiveJobs()).toEqual([pending, running]);
  });

  it("returns active jobs unfiltered when no staleness window is given", () => {
    setTime(1_000);
    const pending = manager.createJob("https://example.com/pending");

    setTime(2_000);
    const running = manager.createJob("https://example.com/running");
    manager.startJob(running.id);

    // Advance time far beyond any reasonable staleness window; without an
    // explicit staleAfterMs argument, behaviour must stay identical to today.
    setTime(1_000_000_000);

    expect(manager.getActiveJobs()).toEqual([pending, running]);
  });

  it("excludes stale active jobs when a staleness window is given, keeps fresh ones", () => {
    setTime(1_000);
    const stalled = manager.createJob("https://example.com/stalled");
    manager.startJob(stalled.id);

    setTime(2_000);
    const fresh = manager.createJob("https://example.com/fresh");
    manager.startJob(fresh.id);

    // 30 minute window; advance time so `stalled` (last touched at 1_000)
    // falls outside it, then refresh `fresh` so it stays inside it.
    const staleAfterMs = 30 * 60 * 1000;
    setTime(2_000 + staleAfterMs + 1);
    manager.updateJob(fresh.id, { message: "still alive" });

    expect(manager.getActiveJobs(staleAfterMs)).toEqual([fresh]);
  });

  it("detects urls that are currently being processed", () => {
    setTime(1_000);
    const pending = manager.createJob("https://example.com/pending");

    setTime(2_000);
    const running = manager.createJob("https://example.com/running");
    manager.startJob(running.id);

    setTime(3_000);
    const completed = manager.createJob("https://example.com/completed");
    manager.completeJob(completed.id, { success: true });

    setTime(4_000);
    const failed = manager.createJob("https://example.com/failed");
    manager.failJob(failed.id, "boom");

    expect(manager.isUrlProcessing(pending.url)).toBe(true);
    expect(manager.isUrlProcessing(running.url)).toBe(true);
    expect(manager.isUrlProcessing(completed.url)).toBe(false);
    expect(manager.isUrlProcessing(failed.url)).toBe(false);
    expect(manager.isUrlProcessing("https://example.com/missing")).toBe(false);
  });

  it("returns the latest job event only when the job changed after the cursor", () => {
    setTime(1_000);
    const job = manager.createJob("https://example.com/recipe");

    expect(manager.getJobEventsSince(job.id, 1_000)).toBeNull();

    setTime(1_250);
    manager.updateJob(job.id, {
      progress: 20,
      currentStage: "extracting",
      message: "Working",
      status: "running",
    });

    expect(manager.getJobEventsSince(job.id, 1_200)).toEqual({
      id: job.id,
      status: "running",
      progress: 20,
      currentStage: "extracting",
      message: "Working",
      result: undefined,
      error: undefined,
      hint: undefined,
      updatedAt: 1_250,
    });
    expect(manager.getJobEventsSince(job.id, 1_250)).toBeNull();
    expect(manager.getJobEventsSince("job_missing", 0)).toBeNull();
  });

  it("removes jobs older than the retention window", () => {
    const day = 24 * 60 * 60 * 1000;

    setTime(day);
    const oldJob = manager.createJob("https://example.com/old");

    setTime(5 * day);
    const recentJob = manager.createJob("https://example.com/recent");

    setTime(10 * day);
    expect(manager.cleanupOldJobs(7)).toBe(1);
    expect(manager.getJob(oldJob.id)).toBeNull();
    expect(manager.getJob(recentJob.id)).toBe(recentJob);
  });
});

describe("startJobCleanupTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("removes old jobs on each tick and keeps young ones, logging only when something was removed", () => {
    const day = 24 * 60 * 60 * 1000;
    const { manager, setTime } = createTestManager();

    setTime(day);
    const oldJob = manager.createJob("https://example.com/old");

    setTime(5 * day);
    const recentJob = manager.createJob("https://example.com/recent");

    setTime(10 * day);
    vi.useFakeTimers();
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const timer = startJobCleanupTimer(manager, 7, 1000);
    vi.advanceTimersByTime(1000);

    expect(manager.getJob(oldJob.id)).toBeNull();
    expect(manager.getJob(recentJob.id)).toBe(recentJob);
    expect(consoleLogSpy).toHaveBeenCalledWith("[jobs] cleanup removed 1 alte Jobs");

    // A second tick with nothing left to remove must not log again.
    consoleLogSpy.mockClear();
    vi.advanceTimersByTime(1000);
    expect(consoleLogSpy).not.toHaveBeenCalled();

    clearInterval(timer);
  });

  it("unrefs the returned timer so it never keeps the Node process alive", () => {
    const fakeTimer = { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>;
    const setIntervalSpy = vi.spyOn(global, "setInterval").mockReturnValue(fakeTimer);
    const { manager } = createTestManager();

    const timer = startJobCleanupTimer(manager, 7, 1000);

    expect(timer).toBe(fakeTimer);
    expect(fakeTimer.unref).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });

  it("swallows a throwing cleanupOldJobs so it can never kill the process", () => {
    const { manager } = createTestManager();
    vi.spyOn(manager, "cleanupOldJobs").mockImplementation(() => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.useFakeTimers();
    const timer = startJobCleanupTimer(manager, 7, 1000);

    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();

    clearInterval(timer);
  });
});
