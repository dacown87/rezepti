import type { ClassifiedURL, SourceType } from "./types.js";

const patterns: [SourceType, RegExp][] = [
  ["youtube", /(?:youtube\.com|youtu\.be)\//i],
  ["instagram", /instagram\.com\//i],
  ["tiktok", /tiktok\.com\//i],
];

export function classifyURL(rawUrl: string): ClassifiedURL {
  const url = rawUrl.trim();

  try {
    new URL(url);
  } catch {
    throw new Error(`Ungültige URL: ${url}`);
  }

  for (const [type, pattern] of patterns) {
    if (pattern.test(url)) {
      return { url, type };
    }
  }

  return { url, type: "web" };
}
