import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAuthForTests, resetAuthAdaptersForTests } from "../../src/auth.js";
import { jobManager } from "../../src/job-manager.js";

vi.mock("../../src/processors/llm.js", () => ({
  extractRecipeFromImage: vi.fn(),
  extractRecipeFromText: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  saveRecipeToReactDb: vi.fn().mockReturnValue(42),
  loadUserAuthorization: vi.fn(),
  loadRuntimeByokValidationPolicy: vi.fn(async () => ({
    policy: {
      windowMinutes: 60,
      maxRequests: 20,
      source: "default",
      status: "uninitialized",
      updatedAt: null,
      updatedBy: null,
      updatedByUserId: null,
      appliesTo: ["keys_validate", "extract_react", "extract_photo", "extract_text"],
    },
  })),
  consumeImportQuota: vi.fn(),
}));

vi.mock("../../src/db-react.js", () => dbMocks);

vi.mock("../../src/pipeline.js", () => ({
  processURL: vi.fn(),
  toUserFriendlyError: vi.fn(),
  buildQualityWarnings: vi.fn(() => []),
}));

vi.mock("../../src/classifier.js", () => ({
  classifyURL: vi.fn().mockReturnValue({ type: "web" }),
}));

vi.mock("../../src/middleware/facebook-rate-limit.js", () => ({
  checkFacebookRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock("../../src/utils/image-search.js", () => ({
  searchRecipeImages: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/byok-policy.js", () => ({
  ByokValidationFailure: class extends Error {},
  enforceByokValidation: vi.fn().mockResolvedValue({ keyHash: "byok-hash" }),
}));

const { default: extractionRouter } = await import("../../src/routes/extraction.js");

const userId = "00000000-0000-0000-0000-000000000001";

function configureAuth() {
  configureAuthForTests({
    verifyAccessToken: async () => ({ id: userId, email: "user@example.com" }),
    loadAuthorization: async () => ({
      appRole: "user" as const,
      memberships: [{ householdId: "10000000-0000-0000-0000-000000000001", role: "owner" as const }],
      activeHouseholdId: "10000000-0000-0000-0000-000000000001",
    }),
  });
}

function urlRequest(body: unknown) {
  return extractionRouter.request("/api/v1/extract/react", {
    method: "POST",
    headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("import daily quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureAuth();
    dbMocks.consumeImportQuota.mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    resetAuthAdaptersForTests();
    for (const job of jobManager.getActiveJobs()) {
      jobManager.failJob(job.id, "test cleanup");
    }
  });

  it("lets a server-key URL import through when the quota allows it", async () => {
    const res = await urlRequest({ url: "https://example.com/recipe" });
    expect(res.status).toBe(202);
    expect(dbMocks.consumeImportQuota).toHaveBeenCalledWith(userId, {
      perUser: 15,
      global: 300,
    });
  });

  it("rejects a server-key URL import with 429 daily_user when the per-user quota is exhausted", async () => {
    dbMocks.consumeImportQuota.mockResolvedValue({
      allowed: false,
      scope: "daily_user",
      limit: 15,
      resetAt: "2026-10-26T00:00:00.000Z",
    });

    const res = await urlRequest({ url: "https://example.com/recipe" });
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({
      scope: "daily_user",
      limit: 15,
      resetAt: "2026-10-26T00:00:00.000Z",
    });
    expect(jobManager.getActiveJobs()).toHaveLength(0);
  });

  it("rejects with 429 daily_server when the global quota is exhausted", async () => {
    dbMocks.consumeImportQuota.mockResolvedValue({
      allowed: false,
      scope: "daily_server",
      limit: 300,
      resetAt: "2026-10-26T00:00:00.000Z",
    });

    const res = await urlRequest({ url: "https://example.com/recipe" });
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ scope: "daily_server", limit: 300 });
  });

  it("skips the quota for a BYOK URL import", async () => {
    dbMocks.consumeImportQuota.mockResolvedValue({
      allowed: false,
      scope: "daily_user",
      limit: 15,
      resetAt: "2026-10-26T00:00:00.000Z",
    });

    const res = await urlRequest({ url: "https://example.com/recipe", apiKey: "gsk_user_key" });
    expect(res.status).toBe(202);
    expect(dbMocks.consumeImportQuota).not.toHaveBeenCalled();
  });
});
