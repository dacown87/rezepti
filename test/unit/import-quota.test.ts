import { describe, expect, it } from "vitest";
import { nextUtcMidnight, utcDay } from "../../src/db-react.js";

describe("import quota day helpers", () => {
  it("utcDay buckets by the UTC calendar day", () => {
    expect(utcDay(new Date("2026-10-25T12:34:56.000Z"))).toBe("2026-10-25");
    expect(utcDay(new Date("2026-10-25T23:59:59.999Z"))).toBe("2026-10-25");
    expect(utcDay(new Date("2026-10-26T00:00:00.000Z"))).toBe("2026-10-26");
  });

  it("nextUtcMidnight returns the following UTC midnight", () => {
    expect(nextUtcMidnight(new Date("2026-10-25T12:00:00.000Z"))).toBe("2026-10-26T00:00:00.000Z");
    expect(nextUtcMidnight(new Date("2026-12-31T23:00:00.000Z"))).toBe("2027-01-01T00:00:00.000Z");
  });
});
