import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  computeDeletionLogHash,
  resetDeletionLogPepperCacheForTests,
} from "../../src/deletion-log.js";

const ORIGINAL_PEPPER = process.env.DELETION_LOG_PEPPER;

describe("computeDeletionLogHash", () => {
  beforeEach(() => {
    resetDeletionLogPepperCacheForTests();
  });

  afterEach(() => {
    resetDeletionLogPepperCacheForTests();
    if (ORIGINAL_PEPPER === undefined) delete process.env.DELETION_LOG_PEPPER;
    else process.env.DELETION_LOG_PEPPER = ORIGINAL_PEPPER;
  });

  it("returns null when DELETION_LOG_PEPPER is missing", () => {
    delete process.env.DELETION_LOG_PEPPER;
    expect(computeDeletionLogHash("user-1")).toBeNull();
  });

  it("returns null when DELETION_LOG_PEPPER has the wrong length", () => {
    process.env.DELETION_LOG_PEPPER = Buffer.alloc(16, 1).toString("base64");
    expect(computeDeletionLogHash("user-1")).toBeNull();
  });

  it("returns a deterministic 64-hex HMAC when the pepper is set", () => {
    process.env.DELETION_LOG_PEPPER = Buffer.alloc(32, 7).toString("base64");
    const first = computeDeletionLogHash("user-1");
    const second = computeDeletionLogHash("user-1");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(computeDeletionLogHash("user-2")).not.toBe(first);
  });

  it("never returns the raw user id", () => {
    process.env.DELETION_LOG_PEPPER = Buffer.alloc(32, 7).toString("base64");
    const hash = computeDeletionLogHash("00000000-0000-0000-0000-000000000001");
    expect(hash).not.toBe("00000000-0000-0000-0000-000000000001");
  });
});
