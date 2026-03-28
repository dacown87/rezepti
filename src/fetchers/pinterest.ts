import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import * as cheerio from "cheerio";
import type { ContentBundle } from "../types.js";
import { fetchWeb } from "./web.js";

const execFileAsync = promisify(execFile);

const CREDENTIALS_FILE = join(
  process.cwd(),
  "data",
  "pinterest-credentials.json"
);

export interface PinterestCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

let cachedCredentials: PinterestCredentials | null = null;

function loadCredentialsFromDisk(): PinterestCredentials | null {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  try {
    const content = readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(content) as PinterestCredentials;
  } catch {
    return null;
  }
}

export function savePinterestCredentialsToDisk(
  credentials: PinterestCredentials
): void {
  mkdirSync(dirname(CREDENTIALS_FILE), { recursive: true });
  writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify(credentials, null, 2),
    "utf-8"
  );
  cachedCredentials = credentials;
}

export function clearPinterestCredentialsFromDisk(): void {
  cachedCredentials = null;
  if (existsSync(CREDENTIALS_FILE)) {
    try {
      unlinkSync(CREDENTIALS_FILE);
    } catch {
      // best effort
    }
  }
}

export function getPinterestCredentials(): PinterestCredentials | null {
  if (cachedCredentials) return cachedCredentials;
  cachedCredentials = loadCredentialsFromDisk();
  return cachedCredentials;
}

export function hasPinterestCredentials(): boolean {
  return getPinterestCredentials() !== null;
}

export function getPinterestStatus(): {
  connected: boolean;
  hasFileCredentials: boolean;
} {
  const creds = getPinterestCredentials();
  const hasFileCreds = existsSync(CREDENTIALS_FILE);
  return {
    connected: creds !== null,
    hasFileCredentials: hasFileCreds,
  };
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

export function findOriginalUrl($: cheerio.CheerioAPI): string | null {
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
    if (url && !url.includes("pinterest.") && url.startsWith("http")) {
      return url;
    }
  }

  const bodyText = $("body").text();
  const urlPattern = /https?:\/\/[^\s<>"']+(?:\/[^\s<>"']*)?/gi;
  const matches = bodyText.match(urlPattern) || [];
  for (const match of matches) {
    if (!match.includes("pinterest.") && match.includes("://")) {
      return match;
    }
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

export function extractImagesFromHtml(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string[] {
  const images: string[] = [];

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-pin-img");
    if (src) {
      try {
        const absoluteUrl = new URL(src, baseUrl).href;
        if (
          absoluteUrl.includes("pinimg") ||
          absoluteUrl.includes("pinterest") ||
          !absoluteUrl.includes("pinterest.")
        ) {
          images.push(absoluteUrl);
        }
      } catch {
        // skip invalid URLs
      }
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
      "--skip-download",
      "-o",
      join(tempDir, "pinterest_%(id)s.%(ext)s"),
      url,
    ]);

    const infoJsonPath = join(tempDir, "pinterest_info.json");
    const descPath = join(tempDir, "pinterest_description.txt");

    let metadata: Record<string, unknown> | null = null;
    if (existsSync(infoJsonPath)) {
      try {
        const content = await readFile(infoJsonPath, "utf-8");
        metadata = JSON.parse(content);
      } catch {
        // ignore parse errors
      }
    }

    let description = "";
    if (existsSync(descPath)) {
      try {
        description = await readFile(descPath, "utf-8");
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

async function fetchFromPinterestApi(
  pinId: string
): Promise<ContentBundle | null> {
  const creds = getPinterestCredentials();
  if (!creds || !creds.accessToken) return null;

  try {
    const response = await fetch(
      `https://api.pinterest.com/v5/pins/${pinId}`,
      {
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(
        `Pinterest API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as {
      id: string;
      title?: string;
      description?: string;
      link?: string;
      media?: { images?: { "600x"?: { url?: string } } };
    };

    const imageUrl = data.media?.images?.["600x"]?.url || null;
    const originalUrl = data.link || null;

    if (originalUrl) {
      try {
        return await fetchWeb(originalUrl);
      } catch {
        // Fall through to limited content
      }
    }

    return {
      url: `https://pinterest.com/pin/${data.id}/`,
      type: "pinterest",
      title: data.title || "Pinterest Pin",
      description: data.description || "",
      textContent: data.description || "",
      imageUrls: imageUrl ? [imageUrl] : [],
      audioPath: undefined,
      schemaRecipe: null,
    };
  } catch (error) {
    console.error("Pinterest API fetch error:", error);
    return null;
  }
}

function extractPinIdFromUrl(url: string): string | null {
  const match = url.match(/\/pin\/(\d+)/);
  return match ? match[1] : null;
}

export async function fetchPinterest(
  url: string,
  tempDir?: string
): Promise<ContentBundle> {
  const pinId = extractPinIdFromUrl(url);
  if (pinId) {
    const apiResult = await fetchFromPinterestApi(pinId);
    if (apiResult) return apiResult;
  }

  const html = await fetchHTMLWithUserAgent(url);
  const $ = cheerio.load(html);

  const { title, description, imageUrl } = extractPinMetadata($, html);

  const originalUrl = findOriginalUrl($);

  if (originalUrl) {
    try {
      return await fetchWeb(originalUrl);
    } catch {
      // Fall through to limited content if web fetch fails
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

  return {
    url,
    type: "pinterest",
    title: title.replace(/[_-] Pinterest$/i, "").trim() || "Pinterest Pin",
    description,
    textContent,
    imageUrls: allImages.length > 0 ? allImages : [],
    audioPath: undefined,
    schemaRecipe: null,
    isCarousel: false,
  };
}
