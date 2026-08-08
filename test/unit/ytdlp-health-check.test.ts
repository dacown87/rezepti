import { describe, it, expect } from "vitest";
import {
  parseYtDlpVersionDate,
  versionAgeDays,
  classifyYtDlpError,
  evaluateOutcome,
} from "../../scripts/ytdlp-health-check.js";

describe("parseYtDlpVersionDate", () => {
  it("parses a well-formed version string", () => {
    const date = parseYtDlpVersionDate("2026.07.04");
    expect(date).not.toBeNull();
    expect(date!.toISOString().slice(0, 10)).toBe("2026-07-04");
  });

  it("parses the old apt-package version string", () => {
    const date = parseYtDlpVersionDate("2024.04.09");
    expect(date).not.toBeNull();
    expect(date!.toISOString().slice(0, 10)).toBe("2024-04-09");
  });

  it("returns null for an unparsable version string", () => {
    expect(parseYtDlpVersionDate("garbage")).toBeNull();
    expect(parseYtDlpVersionDate("")).toBeNull();
    expect(parseYtDlpVersionDate("2026.13.40")).toBeNull();
  });
});

describe("versionAgeDays", () => {
  const now = new Date("2026-08-08T00:00:00Z");

  it("flags the 2024.04.09 version as far past the fail threshold", () => {
    const age = versionAgeDays("2024.04.09", now);
    expect(age).not.toBeNull();
    expect(age!).toBeGreaterThan(180);
  });

  it("treats a 30-day-old version as ok", () => {
    const age = versionAgeDays("2026.07.09", now);
    expect(age).toBe(30);
  });

  it("treats a 100-day-old version as within the warn band", () => {
    const age = versionAgeDays("2026.04.30", now);
    expect(age).toBeGreaterThan(90);
    expect(age).toBeLessThan(180);
  });

  it("returns null when the version cannot be parsed", () => {
    expect(versionAgeDays("not-a-version", now)).toBeNull();
  });
});

describe("classifyYtDlpError", () => {
  it("classifies 'No video formats found!' as extractor", () => {
    expect(classifyYtDlpError("No video formats found!")).toBe("extractor");
  });

  it("classifies 'Unsupported URL' as extractor", () => {
    expect(classifyYtDlpError("Unsupported URL: https://example.com")).toBe("extractor");
  });

  it("classifies an IP block as environment", () => {
    expect(classifyYtDlpError("Your IP address is blocked from accessing this post")).toBe(
      "environment",
    );
  });

  it("classifies an empty media response as environment", () => {
    expect(
      classifyYtDlpError(
        "Instagram sent an empty media response. Check if this post is accessible in your browser without being logged-in.",
      ),
    ).toBe("environment");
  });

  it("classifies a rotted/deleted test video as environment, not extractor", () => {
    expect(classifyYtDlpError("This video is no longer available")).toBe("environment");
  });

  it("classifies a 404 on JSON metadata as environment (content rot, not an extractor break)", () => {
    expect(classifyYtDlpError("Unable to download JSON metadata: HTTP Error 404: Not Found")).toBe(
      "environment",
    );
  });

  it("falls back to extractor for an unrecognised message", () => {
    expect(classifyYtDlpError("some completely novel failure mode")).toBe("extractor");
  });
});

describe("evaluateOutcome", () => {
  it("fails a required platform on an extractor-class error", () => {
    const outcome = evaluateOutcome({ tier: "required", ok: false, errorClass: "extractor" });
    expect(outcome.level).toBe("fail");
  });

  it("warns (does not fail) a required platform on an environment-class error", () => {
    const outcome = evaluateOutcome({ tier: "required", ok: false, errorClass: "environment" });
    expect(outcome.level).toBe("warn");
  });

  it("warns on any advisory-platform failure regardless of error class", () => {
    expect(evaluateOutcome({ tier: "advisory", ok: false, errorClass: "extractor" }).level).toBe(
      "warn",
    );
    expect(evaluateOutcome({ tier: "advisory", ok: false, errorClass: "environment" }).level).toBe(
      "warn",
    );
  });

  it("notes an unsupported-platform failure as expected", () => {
    const outcome = evaluateOutcome({ tier: "unsupported", ok: false, errorClass: "extractor" });
    expect(outcome.level).toBe("note");
  });

  it("notes an unsupported-platform success as noteworthy, not a hard pass", () => {
    const outcome = evaluateOutcome({ tier: "unsupported", ok: true });
    expect(outcome.level).toBe("note");
  });

  it("marks a successful required/advisory check as ok", () => {
    expect(evaluateOutcome({ tier: "required", ok: true }).level).toBe("ok");
    expect(evaluateOutcome({ tier: "advisory", ok: true }).level).toBe("ok");
  });
});
