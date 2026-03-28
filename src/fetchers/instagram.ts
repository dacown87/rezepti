import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ContentBundle } from "../types.js";

const execFileAsync = promisify(execFile);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface InstagramMetadata {
  title: string;
  description: string;
  uploader?: string;
  timestamp?: number;
  like_count?: number;
  comment_count?: number;
  hashtags: string[];
  location?: string;
  is_carousel: boolean;
  carousel_count: number;
  media_type?: string;
}

async function waitWithExponentialBackoff(
  retryCount: number,
  baseDelay: number = BASE_DELAY_MS
): Promise<void> {
  const delay = baseDelay * Math.pow(2, retryCount);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches)] : [];
}

function detectCarousel(info: any): boolean {
  return (
    (info.media_count && info.media_count > 1) ||
    info.media_type === "CAROUSEL_ALBUM" ||
    (info.children?.length && info.children.length > 0)
  );
}

function parseInfoJson(info: any, files: string[]): {
  metadata: InstagramMetadata;
  imageUrls: string[];
  audioPath: string | undefined;
} {
  const hashtags = extractHashtags(info.description || info.title || "");

  const metadata: InstagramMetadata = {
    title: info.title || info.fulltitle || "",
    description: info.description || "",
    uploader: info.uploader || info.creator || info.owner || undefined,
    timestamp: info.timestamp || info.upload_timestamp || undefined,
    like_count: info.like_count || info.likes || undefined,
    comment_count: info.comment_count || info.comments || undefined,
    hashtags,
    location: info.location || undefined,
    is_carousel: detectCarousel(info),
    carousel_count: info.media_count || info.children?.length || 1,
    media_type: info.media_type || undefined,
  };

  const imageUrls: string[] = [];
  let audioPath: string | undefined;

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

  const imageFiles = files.filter((f) =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );
  for (const img of imageFiles) {
    const imgPath = join(
      info._filename
        ? info._filename.replace(/\.[^.]+$/, "")
        : tempDirFromFilename(files[0] || ""),
      img
    );
    if (existsSync(imgPath)) {
      imageUrls.push(imgPath);
    } else {
      imageUrls.push(join(tempDirFromFilename(files[0] || ""), img));
    }
  }

  const mediaFile = files.find((f) =>
    /\.(mp4|m4a|webm|mp3)$/i.test(f)
  );
  if (mediaFile) {
    audioPath = join(tempDirFromFilename(files[0] || ""), mediaFile);
  }

  return { metadata, imageUrls, audioPath };
}

function tempDirFromFilename(filename: string): string {
  const match = filename.match(/^(.+?)(?:\.[^.]+)?$/);
  return match ? match[1] : ".";
}

/**
 * Fetch Instagram content using yt-dlp with robust error handling,
 * rate-limit management, and carousel support.
 */
export async function fetchInstagram(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  const outTemplate = join(tempDir, "insta");
  let lastError: Error | undefined;

  for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
    try {
      await execFileAsync("yt-dlp", [
        "--write-info-json",
        "--write-thumbnail",
        "--write-description",
        "--no-playlist",
        "--restrict-filenames",
        "-o", outTemplate,
        url,
      ], { timeout: 120_000 });

      break;
    } catch (error: any) {
      lastError = error;

      const errorMsg = error.message || "";
      if (
        errorMsg.includes("Private") ||
        errorMsg.includes("Deleted") ||
        errorMsg.includes("login_required") ||
        errorMsg.includes("HTTP Error 403")
      ) {
        throw new Error(
          "Instagram-Inhalt ist privat, gelöscht oder nicht verfügbar"
        );
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

  if (lastError && !existsSync(join(tempDir, "insta.info.json"))) {
    const allFiles = await readdir(tempDir).catch(() => []);
    const infoFile = allFiles.find((f) => f.endsWith(".info.json"));
    if (!infoFile) {
      throw lastError;
    }
  }

  const files = await readdir(tempDir);

  let title = "";
  let description = "";
  let uploader: string | undefined;
  let hashtags: string[] = [];
  let is_carousel = false;
  let carousel_count = 1;
  let imageUrls: string[] = [];
  let audioPath: string | undefined;

  const infoFile = files.find((f) => f.endsWith(".info.json"));
  if (infoFile) {
    try {
      const info = JSON.parse(
        await readFile(join(tempDir, infoFile), "utf-8")
      );
      title = info.title || info.fulltitle || "";
      description = info.description || info.title || "";

      uploader = info.uploader || info.creator || info.owner;
      hashtags = extractHashtags(description);

      is_carousel = detectCarousel(info);
      carousel_count = info.media_count || info.children?.length || 1;

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

  const imageFiles = files.filter((f) =>
    /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.includes(".info.json")
  );
  for (const img of imageFiles) {
    imageUrls.push(join(tempDir, img));
  }

  const mediaFile = files.find((f) =>
    /\.(mp4|m4a|webm|mp3)$/i.test(f)
  );
  if (mediaFile) {
    audioPath = join(tempDir, mediaFile);
  }

  return {
    url,
    type: "instagram",
    title,
    description,
    textContent: description,
    imageUrls: [...new Set(imageUrls)].slice(0, is_carousel ? carousel_count : 5),
    audioPath,
    schemaRecipe: null,
  };
}
