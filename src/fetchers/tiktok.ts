import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ContentBundle } from "../types.js";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

const TIKTOK_REGIONS = ["de", "us", "fr", "uk", "ca", "au"];

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches)] : [];
}

export function prioritizeComments(comments: any[]): string[] {
  const recipeKeywords = ["zutat", "rezept", "zutaten", "schritt", "tipp", "tipps", "ingredient", "recipe", "step", "tip"];
  const prioritized: { text: string; score: number }[] = [];

  for (const comment of comments) {
    const text = comment.text || comment.body || "";
    const likes = comment.like_count || comment.likes || 0;

    const hasRecipeKeyword = recipeKeywords.some(kw => text.toLowerCase().includes(kw));
    const score = hasRecipeKeyword ? likes + 1000 : likes;

    if (text.trim()) {
      prioritized.push({ text, score });
    }
  }

  prioritized.sort((a, b) => b.score - a.score);
  return prioritized.slice(0, 10).map(p => p.text);
}

async function fetchTikTokWithRegion(
  url: string,
  tempDir: string,
  region?: string,
  proxyUrl?: string
): Promise<{ files: string[]; region?: string }> {
  const outTemplate = join(tempDir, "tiktok");
  const args = [
    "--write-info-json",
    "--write-thumbnail",
    "--write-comments",
    "--comments-limit", "50",
    "--restrict-filenames",
    "-o", outTemplate,
  ];

  if (region) {
    args.push("--geo-bypass-country", region);
  }

  if (proxyUrl) {
    args.push("--proxy", proxyUrl);
  }

  args.push(url);

  await execFileAsync("yt-dlp", args, { timeout: 120_000 });

  const files = await readdir(tempDir);
  return { files, region };
}

export async function fetchTikTok(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  let title = "";
  let description = "";
  let imageUrls: string[] = [];
  let audioPath: string | undefined;
  let comments: string[] = [];

  const proxyUrl = config.tiktok.proxyUrl || undefined;

  let lastError: Error | undefined;
  for (const region of TIKTOK_REGIONS) {
    try {
      const { files } = await fetchTikTokWithRegion(url, tempDir, region, proxyUrl);

      const infoFile = files.find((f) => f.endsWith(".info.json"));
      if (infoFile) {
        try {
          const info = JSON.parse(
            await readFile(join(tempDir, infoFile), "utf-8")
          );
          title = info.title || info.fulltitle || "";
          description = info.description || "";

          if (info.thumbnail) {
            imageUrls.push(info.thumbnail);
          }
          if (info.thumbnails) {
            for (const t of info.thumbnails) {
              if (t.url) imageUrls.push(t.url);
            }
          }

          if (info.comments) {
            comments = prioritizeComments(info.comments);
          }
        } catch {
          // ignore parse errors
        }
      }

      break;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      if (
        errorMsg.includes("Private") ||
        errorMsg.includes("Deleted") ||
        errorMsg.includes("HTTP Error 403")
      ) {
        throw new Error("TikTok-Inhalt ist privat, gelöscht oder nicht verfügbar");
      }
      continue;
    }
  }

  if (!title && lastError) {
    try {
      const { files } = await fetchTikTokWithRegion(url, tempDir, undefined, proxyUrl);
      const infoFile = files.find((f) => f.endsWith(".info.json"));
      if (infoFile) {
        const info = JSON.parse(await readFile(join(tempDir, infoFile), "utf-8"));
        title = info.title || info.fulltitle || "";
        description = info.description || "";
        if (info.thumbnail) imageUrls.push(info.thumbnail);
        if (info.thumbnails) {
          for (const t of info.thumbnails) {
            if (t.url) imageUrls.push(t.url);
          }
        }
        if (info.comments) {
          comments = prioritizeComments(info.comments);
        }
      }
    } catch {
      // ignore
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

  let videoOcrText = "";
  if (audioPath && config.tiktok.ocrEnabled) {
    videoOcrText = await extractTextFromVideoFrames(audioPath, tempDir);
  }

  const combinedText = [
    description,
    ...comments,
    videoOcrText,
  ].filter(Boolean).join("\n\n");

  return {
    url,
    type: "tiktok",
    title,
    description: combinedText,
    textContent: combinedText,
    imageUrls: [...new Set(imageUrls)].slice(0, 10),
    audioPath,
    schemaRecipe: null,
  };
}

export async function extractTextFromVideoFrames(
  videoPath: string,
  tempDir: string
): Promise<string> {
  if (!config.tiktok.ocrEnabled) {
    return "";
  }

  try {
    const framePattern = join(tempDir, "tiktok-frame-%04d.jpg");
    await execFileAsync("ffmpeg", [
      "-i", videoPath,
      "-vf", `fps=1,scale=1280:720`,
      "-q:v", "2",
      "-frames:v", String(config.tiktok.maxOcrFrames),
      framePattern,
    ], { timeout: 120_000 });

    const files = await readdir(tempDir);
    const frameFiles = files
      .filter((f) => f.startsWith("tiktok-frame-") && /\.(jpg|jpeg)$/i.test(f))
      .sort();

    if (frameFiles.length === 0) {
      return "";
    }

    const texts: string[] = [];
    for (const frameFile of frameFiles) {
      const framePath = join(tempDir, frameFile);
      const frameData = await readFile(framePath);
      const base64Image = frameData.toString("base64");

      try {
        const { extractRecipeFromImage } = await import("../processors/llm.js");
        const result = await extractRecipeFromImage(
          `data:image/jpeg;base64,${base64Image}`,
          "Extrahiere den gesamten sichtbaren Text aus diesem TikTok-Video-Screenshot. Gib nur die Zutaten und Schritte zurück."
        );
        if (result && result.ingredients) {
          texts.push(...result.ingredients);
          if (result.steps) {
            texts.push(...result.steps);
          }
        }
      } catch {
        // Vision OCR failed for this frame
      }
    }

    return texts.join("\n");
  } catch {
    return "";
  }
}