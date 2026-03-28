import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
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

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches)] : [];
}

export function detectCarousel(info: any): boolean {
  return (
    (info.media_count && info.media_count > 1) ||
    info.media_type === "CAROUSEL_ALBUM" ||
    (info.children?.length && info.children.length > 0)
  );
}

export function tempDirFromFilename(filename: string): string {
  const match = filename.match(/^(.+?)(?:\.[^.]+)?$/);
  return match ? match[1] : ".";
}

async function downloadWithYtDlp(
  url: string,
  tempDir: string,
  outTemplate: string,
  options: string[]
): Promise<string[]> {
  await execFileAsync("yt-dlp", [
    "--write-info-json",
    "--write-thumbnail",
    "--write-description",
    "--restrict-filenames",
    "-o", outTemplate,
    ...options,
    url,
  ], { timeout: 120_000 });

  return readdir(tempDir);
}

async function detectCarouselAndDownload(
  url: string,
  tempDir: string,
  outTemplate: string
): Promise<{ files: string[]; isCarousel: boolean; carouselCount: number }> {
  let lastError: Error | undefined;
  let isCarousel = false;
  let carouselCount = 1;

  for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
    try {
      const files = await downloadWithYtDlp(url, tempDir, outTemplate, ["--no-playlist"]);

      const infoFile = files.find((f) => f.endsWith(".info.json"));
      if (infoFile) {
        try {
          const info = JSON.parse(await readFile(join(tempDir, infoFile), "utf-8"));
          isCarousel = detectCarousel(info);
          carouselCount = info.media_count || info.children?.length || 1;

          if (isCarousel && carouselCount > 1) {
            console.log(`Detected carousel with ${carouselCount} items, re-downloading with --yes-playlist...`);
            const carouselFiles = await downloadWithYtDlp(url, tempDir, outTemplate, ["--yes-playlist"]);
            return { files: carouselFiles, isCarousel, carouselCount };
          }
        } catch {
          // ignore parse errors
        }
      }

      return { files, isCarousel, carouselCount };
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";

      if (
        errorMsg.includes("Private") ||
        errorMsg.includes("Deleted") ||
        errorMsg.includes("login_required") ||
        errorMsg.includes("HTTP Error 403")
      ) {
        throw new Error("Instagram-Inhalt ist privat, gelöscht oder nicht verfügbar");
      }

      if (errorMsg.includes("Rate limit") || errorMsg.includes("429")) {
        if (retryCount < MAX_RETRIES - 1) {
          console.log(`Rate limit hit, retrying in ${BASE_DELAY_MS * Math.pow(2, retryCount)}ms...`);
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

  throw lastError || new Error("Download failed after retries");
}

async function fetchInstagramWebScraping(url: string): Promise<ContentBundle> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Instagram page fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr("content") || "";
  const description = $('meta[property="og:description"]').attr("content") || "";
  const imageUrl = $('meta[property="og:image"]').attr("content") || "";

  return {
    url,
    type: "instagram",
    title,
    description,
    textContent: description,
    imageUrls: imageUrl ? [imageUrl] : [],
    schemaRecipe: null,
    isCarousel: false,
    carouselCount: 1,
  };
}

/**
 * Fetch Instagram content using yt-dlp with robust error handling,
 * rate-limit management, and carousel support.
 */
export async function fetchInstagram(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  let isCarousel = false;
  let carouselCount = 1;
  let imageUrls: string[] = [];
  let audioPath: string | undefined;
  let title = "";
  let description = "";

  try {
    const outTemplate = join(tempDir, "insta");
    const { files, isCarousel: detectedCarousel, carouselCount: detectedCarouselCount } = await detectCarouselAndDownload(url, tempDir, outTemplate);
    isCarousel = detectedCarousel;
    carouselCount = detectedCarouselCount;

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

        if (info.children) {
          for (const child of info.children) {
            if (child.image) {
              imageUrls.push(child.image);
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    const downloadedFiles = await readdir(tempDir);
    const imageFiles = downloadedFiles.filter((f) =>
      /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes(".info.json")
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
  } catch (error) {
    console.log(`yt-dlp failed, trying web scraping fallback: ${error}`);
    const fallback = await fetchInstagramWebScraping(url);
    return fallback;
  }

  const maxImages = isCarousel ? carouselCount : 5;

  return {
    url,
    type: "instagram",
    title,
    description,
    textContent: description,
    imageUrls: [...new Set(imageUrls)].slice(0, maxImages),
    audioPath,
    schemaRecipe: null,
    isCarousel,
    carouselCount,
  };
}
