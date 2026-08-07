import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import * as cheerio from "cheerio";
import type { ContentBundle } from "../types.js";
import { fetchWeb } from "./web.js";

const execFileAsync = promisify(execFile);

/*
 * Pinterest fetch strategy
 * ─────────────────────────────────────────────────────────────────────────
 * A pin almost never carries the recipe itself — it links to a recipe page
 * the generic web fetcher already handles. So the whole job here is: find
 * that outbound link and hand off to fetchWeb().
 *
 *   pin URL
 *     │
 *     ├─1─► DOM selectors        (carousel link, rel=noopener, og:see_also)
 *     ├─2─► __PWS_DATA__ JSON    (assignment form AND <script type=json> form)
 *     ├─3─► "link":"…" regex     over raw HTML
 *     │        │
 *     │        └─ every candidate must pass isUsableExternalUrl()
 *     │
 *     ├─ found ──► fetchWeb(originalUrl)          ← the good path
 *     └─ none  ──► yt-dlp / og: metadata          ← thin, often empty
 *                     └─ nothing usable ──► throw (see below)
 *
 * As of 2026-08-07 an anonymous request returns a ~1 MB app shell with no
 * og: tags and a __PWS_DATA__ payload holding no pin data at all, so the
 * "none" branch is the common case. Throwing there is deliberate: returning
 * an empty bundle used to send whatever text was lying around — including
 * minified CDN JavaScript — straight into the LLM.
 */

/*
 * Candidate filter. The old check was `!url.includes("pinterest.")`, which
 * let s.pinimg.com through — the Pinterest asset CDN. Live pins resolved to
 * accessibility-<hash>.mjs and the pipeline imported 6000 characters of
 * minified JavaScript as recipe text.
 */
const BLOCKED_LINK_HOSTS = [
  /(^|\.)pinterest\.[a-z.]+$/i,
  /(^|\.)pinimg\.com$/i,
];

const ASSET_PATH = /\.(mjs|c?js|css|json|map|woff2?|ttf|eot|ico|svg|txt|xml)$/i;

/** True when `raw` is an off-Pinterest page we could plausibly extract a recipe from. */
export function isUsableExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (BLOCKED_LINK_HOSTS.some((re) => re.test(url.hostname))) return false;
  if (ASSET_PATH.test(url.pathname)) return false;
  return true;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchHTMLWithUserAgent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} beim Abrufen von ${url}`);
  }

  return response.text();
}

export function findOriginalUrl($: cheerio.CheerioAPI, html?: string): string | null {
  // 1. DOM-Selektoren
  const selectors = [
    'a[data-test-id="pin-carousel-original-link"]',
    'a[href*="://"][rel~="noopener"]',
    'a[href^="http"]:not([href*="pinterest."])',
    'meta[property="og:see_also"]',
    'meta[name="og:see_also"]',
  ];

  for (const selector of selectors) {
    let url: string | undefined | null;
    if (selector.startsWith("meta")) {
      url = $(selector).attr("content");
    } else {
      url = $(selector).first().attr("href");
    }
    if (url && isUsableExternalUrl(url)) {
      return url;
    }
  }

  // 2. Pinterest-Embedded-JSON: Pin-Daten stecken in Script-Tags
  if (html) {
    const scriptPatterns = [
      // Script-Tag-Form — das ist die Form, die Pinterest heute ausliefert
      /<script[^>]+id=["']__PWS_(?:DATA|INITIAL_PROPS)__["'][^>]*>([\s\S]*?)<\/script>/,
      // Ältere Zuweisungsform
      /__PWS_(?:DATA|INITIAL_PROPS)__\s*=\s*(\{.+?\})(?:\s*;|\s*<)/s,
      // initial-data Script-Tag
      /<script[^>]+id=["']initial-data["'][^>]*>(\{.+?\})<\/script>/s,
      // P.start("ResourcesController", ...) Format
      /P\.start\("ResourcesController",\s*(\{.+?\})\s*\)/s,
    ];

    for (const pattern of scriptPatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const link = extractLinkFromJson(data, 0);
          if (link) return link;
        } catch { /* JSON ungültig, weiter */ }
      }
    }

    // 3. Regex-Fallback auf "link":"https://..." im rohen HTML
    const linkMatch = html.match(/"link"\s*:\s*"(https?:\/\/[^"]+)"/);
    if (linkMatch && isUsableExternalUrl(linkMatch[1])) {
      return linkMatch[1];
    }
  }

  /*
   * Es gab hier eine vierte Strategie: alle URLs aus dem Body-Text greifen und
   * die erste nicht-Pinterest nehmen. Sie ist entfernt. Der Body-Text einer
   * Pinterest-Seite besteht heute im Wesentlichen aus Bundle-Quellcode, und
   * die Strategie konnte per Konstruktion keinen verlässlichen Treffer liefern.
   */
  return null;
}

function extractLinkFromJson(obj: unknown, depth: number): string | null {
  if (depth > 5 || !obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = extractLinkFromJson(item, depth + 1);
      if (result) return result;
    }
    return null;
  }
  const record = obj as Record<string, unknown>;
  if (typeof record.link === "string" && isUsableExternalUrl(record.link)) {
    return record.link;
  }
  for (const value of Object.values(record)) {
    const result = extractLinkFromJson(value, depth + 1);
    if (result) return result;
  }
  return null;
}

export function extractPinMetadata(
  $: cheerio.CheerioAPI,
  html: string
): { title: string; description: string; imageUrl: string | null } {
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text().trim() ||
    "";

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  let imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  if (!imageUrl) {
    const twitterCardImg = $('meta[name="twitter:image:src"]').attr("content");
    if (twitterCardImg) imageUrl = twitterCardImg;
  }

  return { title, description, imageUrl };
}

const RECIPE_KEYWORDS = [
  "Zutaten",
  "Zubereitung",
  "Rezept",
  "Kochzeit",
  "Backzeit",
  "Portionen",
  "Schritte",
  "Instructions",
  "Ingredients",
  "Prep time",
  "Cook time",
  "Servings",
];

export function hasRecipeKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return RECIPE_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export function extractRecipeKeywords(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const keyword of RECIPE_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      found.push(keyword);
    }
  }
  return found;
}

/*
 * Bilder sind der eine Fall, in dem pinimg.com erwünscht ist — das ist
 * Pinterests Bild-CDN. Gefiltert wird hier nur, was kein Bild sein kann.
 */
export function extractImagesFromHtml(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string[] {
  const images: string[] = [];

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-pin-img");
    if (!src) return;
    try {
      const absolute = new URL(src, baseUrl);
      if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return;
      if (ASSET_PATH.test(absolute.pathname) && !/\.(jpe?g|png|webp|gif|avif)$/i.test(absolute.pathname)) return;
      images.push(absolute.href);
    } catch {
      // skip invalid URLs
    }
  });

  return [...new Set(images)].slice(0, 10);
}

async function downloadWithYtDlp(
  url: string,
  tempDir: string
): Promise<{
  images: string[];
  description: string;
  metadata: Record<string, unknown> | null;
}> {
  try {
    await execFileAsync("yt-dlp", [
      "--write-info-json",
      "--write-thumbnail",
      "--write-description",
      "--skip-download",
      "-o",
      join(tempDir, "pinterest_%(id)s.%(ext)s"),
      url,
    ]);

    const files = await readdir(tempDir);

    // yt-dlp writes pinterest_<id>.info.json — not pinterest_info.json
    const infoFile = files.find((f) => f.endsWith(".info.json"));
    const descFile = files.find((f) => f.endsWith(".description"));

    let metadata: Record<string, unknown> | null = null;
    if (infoFile) {
      try {
        const content = await readFile(join(tempDir, infoFile), "utf-8");
        metadata = JSON.parse(content);
      } catch {
        // ignore parse errors
      }
    }

    let description = "";
    if (descFile) {
      try {
        description = await readFile(join(tempDir, descFile), "utf-8");
      } catch {
        // ignore read errors
      }
    }

    const images: string[] = [];
    if (metadata) {
      const thumb = (metadata as any).thumbnail;
      if (thumb) images.push(thumb);
      const thumbs = (metadata as any).thumbnails;
      if (Array.isArray(thumbs)) {
        for (const t of thumbs) {
          if (t.url) images.push(t.url);
        }
      }
    }

    return { images: [...new Set(images)], description, metadata };
  } catch {
    return { images: [], description: "", metadata: null };
  }
}

export const PINTEREST_NO_DATA_ERROR =
  "Pinterest liefert ohne Anmeldung keine Pin-Daten mehr.";

export async function fetchPinterest(
  url: string,
  tempDir?: string
): Promise<ContentBundle> {
  const html = await fetchHTMLWithUserAgent(url);
  const $ = cheerio.load(html);

  const { title, description, imageUrl } = extractPinMetadata($, html);

  // Der eigentliche Nutzen: den verlinkten Artikel finden und dorthin abgeben.
  const originalUrl = findOriginalUrl($, html);
  if (originalUrl) {
    try {
      return await fetchWeb(originalUrl);
    } catch {
      // Fall through — der Pin selbst ist immer noch einen Versuch wert.
    }
  }

  let allImages: string[] = [];
  let enhancedDescription = description;

  if (tempDir && existsSync(tempDir)) {
    const ytdlpResult = await downloadWithYtDlp(url, tempDir);
    if (ytdlpResult.images.length > 0) {
      allImages = ytdlpResult.images;
    }
    if (ytdlpResult.description && ytdlpResult.description.trim()) {
      enhancedDescription = ytdlpResult.description.trim();
    }
  }

  if (allImages.length === 0 && imageUrl) {
    allImages = [imageUrl];
  }

  if (allImages.length === 0) {
    allImages = extractImagesFromHtml($, url);
  }

  const textContent = hasRecipeKeywords(enhancedDescription)
    ? enhancedDescription
    : description;

  /*
   * Ohne Originallink, ohne Text und ohne Bild gibt es nichts zu extrahieren.
   * Früher kam hier ein leeres Bundle zurück und die Pipeline hat aus dem
   * erstbesten Seitentext ein "Rezept" gebaut. Ein ehrlicher Fehler ist besser.
   */
  if (!textContent.trim() && allImages.length === 0) {
    throw new Error(PINTEREST_NO_DATA_ERROR);
  }

  return {
    url,
    type: "pinterest",
    title: title.replace(/[_-] Pinterest$/i, "").trim() || "Pinterest Pin",
    description,
    textContent,
    imageUrls: allImages,
    audioPath: undefined,
    schemaRecipe: null,
    isCarousel: false,
  };
}
