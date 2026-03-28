import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as cheerio from "cheerio";
import type { ContentBundle } from "../types.js";

const execFileAsync = promisify(execFile);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function waitWithExponentialBackoff(
  retryCount: number,
  baseDelay: number = BASE_DELAY_MS
): Promise<void> {
  const delay = baseDelay * Math.pow(2, retryCount);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export function isFacebookVideoUrl(url: string): boolean {
  const videoPatterns = [
    /facebook\.com\/.*\/videos\//i,
    /facebook\.com\/video\.php/i,
    /facebook\.com\/watch\/?\?/i,
    /fb\.watch\//i,
    /facebook\.com\/reel\//i,
    /facebook\.com\/stories\//i,
  ];
  return videoPatterns.some((pattern) => pattern.test(url));
}

export function detectReel(url: string): boolean {
  return /facebook\.com\/reels?\//i.test(url);
}

export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[a-zA-Z0-9_À-ÿ]+/g;
  const matches = text.match(hashtagRegex) || [];
  return [...new Set(matches)];
}

export interface OpenGraphMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  video: string | null;
  videoSecureUrl: string | null;
  videoType: string | null;
}

export function extractOpenGraphMetadata(html: string): OpenGraphMetadata {
  const $ = cheerio.load(html);
  
  return {
    title: $('meta[property="og:title"]').first().attr("content") || null,
    description: $('meta[property="og:description"]').first().attr("content") || null,
    image: $('meta[property="og:image"]').first().attr("content") || null,
    video: $('meta[property="og:video"]').first().attr("content") || null,
    videoSecureUrl: $('meta[property="og:video:secure_url"]').first().attr("content") || null,
    videoType: $('meta[property="og:video:type"]').first().attr("content") || null,
  };
}

async function downloadWithYtDlp(
  url: string,
  tempDir: string,
  outTemplate: string
): Promise<string[]> {
  await execFileAsync(
    "yt-dlp",
    [
      "--write-info-json",
      "--write-thumbnail",
      "--write-description",
      "--restrict-filenames",
      "-o", outTemplate,
      url,
    ],
    { timeout: 120_000 }
  );

  return readdir(tempDir);
}

async function fetchFacebookVideo(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  const outTemplate = join(tempDir, "fb");
  let lastError: Error | undefined;
  let imageUrls: string[] = [];
  let audioPath: string | undefined;
  let title = "";
  let description = "";

  for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
    try {
      const files = await downloadWithYtDlp(url, tempDir, outTemplate);

      const infoFile = files.find((f) => f.endsWith(".info.json"));
      if (infoFile) {
        try {
          const info = JSON.parse(
            await readFile(join(tempDir, infoFile), "utf-8")
          );
          title = info.title || info.fulltitle || "";
          description = info.description || info.title || "";

          if (info.thumbnail) {
            imageUrls.push(info.thumbnail);
          }
          if (info.thumbnails) {
            for (const t of info.thumbnails) {
              if (t.url) imageUrls.push(t.url);
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      const downloadedFiles = await readdir(tempDir);
      const imageFiles = downloadedFiles.filter(
        (f) => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes(".info.json")
      );
      for (const img of imageFiles) {
        imageUrls.push(join(tempDir, img));
      }

      const mediaFile = downloadedFiles.find((f) =>
        /\.(mp4|m4a|webm|mp3)$/i.test(f)
      );
      if (mediaFile) {
        audioPath = join(tempDir, mediaFile);
      }

      break;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";

      if (
        errorMsg.includes("Private") ||
        errorMsg.includes("Deleted") ||
        errorMsg.includes("login_required") ||
        errorMsg.includes("HTTP Error 403") ||
        errorMsg.includes("Login required")
      ) {
        throw new Error(
          "Facebook-Video ist privat, gelöscht oder nicht verfügbar"
        );
      }

      if (errorMsg.includes("Rate limit") || errorMsg.includes("429")) {
        if (retryCount < MAX_RETRIES - 1) {
          console.log(
            `Rate limit hit, retrying in ${BASE_DELAY_MS * Math.pow(2, retryCount)}ms...`
          );
          await waitWithExponentialBackoff(retryCount);
          continue;
        }
      }

      if (retryCount < MAX_RETRIES - 1) {
        await waitWithExponentialBackoff(retryCount);
        continue;
      }
    }
  }

  if (lastError && !title && !description) {
    throw lastError;
  }

  return {
    url,
    type: "facebook",
    title,
    description,
    textContent: description,
    imageUrls: [...new Set(imageUrls)].slice(0, 5),
    audioPath,
    schemaRecipe: null,
  };
}

async function fetchFacebookOGFallback(url: string): Promise<ContentBundle> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Facebook-Seite konnte nicht geladen werden: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    "";
  const description =
    $('meta[property="og:description"]').attr("content") || "";
  const imageUrl = $('meta[property="og:image"]').attr("content") || "";

  return {
    url,
    type: "facebook",
    title,
    description,
    textContent: description,
    imageUrls: imageUrl ? [imageUrl] : [],
    audioPath: undefined,
    schemaRecipe: null,
  };
}

/**
 * Fetch Facebook content — video download via yt-dlp, or OG metadata fallback.
 */
export async function fetchFacebook(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  console.log("⚠️ Facebook ToS: Automatisiertes Scraping ist verboten. Video-Download nur für öffentliche Inhalte.");

  if (!isFacebookVideoUrl(url)) {
    return fetchFacebookOGFallback(url);
  }

  try {
    return await fetchFacebookVideo(url, tempDir);
  } catch (error) {
    console.log(`Facebook video download failed, trying OG fallback: ${error}`);
    try {
      return await fetchFacebookOGFallback(url);
    } catch {
      throw new Error(
        "Facebook-Video ist privat, gelöscht oder nicht verfügbar"
      );
    }
  }
}
