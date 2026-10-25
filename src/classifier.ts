import type { ClassifiedURL, SourceType } from "./types.js";

interface HostMatcher {
  exact: string[];
  suffix: string[];
  path?: RegExp;
}

// Host list derived from the previous substring regexes and
// test/unit/classifier.test.ts, not invented anew. Matching is anchored to the
// URL hostname so `http://10.0.0.5/?u=instagram.com/` classifies as `web` and
// never reaches a platform fetcher (or yt-dlp).
const patterns: [SourceType, HostMatcher][] = [
  ["youtube", { exact: ["youtube.com", "youtu.be"], suffix: [".youtube.com"] }],
  ["instagram", { exact: ["instagram.com"], suffix: [".instagram.com"] }],
  ["tiktok", { exact: ["tiktok.com"], suffix: [".tiktok.com"] }],
  ["cookidoo", { exact: ["cookidoo.de"], suffix: [".cookidoo.de"] }],
  ["chefkoch", { exact: ["chefkoch.de"], suffix: [".chefkoch.de"], path: /^\/rezepte\//i }],
  ["pinterest", { exact: ["pinterest.com", "pinterest.de", "pin.it"], suffix: [".pinterest.com", ".pinterest.de"] }],
  ["facebook", { exact: ["facebook.com", "fb.watch"], suffix: [".facebook.com"] }],
];

export function classifyURL(rawUrl: string): ClassifiedURL {
  const url = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Ungültige URL: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  // Drop a leading `www.`/`m.` so bare and mobile subdomains classify alike.
  const host = hostname.replace(/^(?:www|m)\./, "");

  for (const [type, matcher] of patterns) {
    const matched =
      matcher.exact.includes(host) ||
      matcher.suffix.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
    if (matched && (!matcher.path || matcher.path.test(parsed.pathname))) {
      return { url, type };
    }
  }

  return { url, type: "web" };
}
