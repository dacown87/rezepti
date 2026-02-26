import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ContentBundle } from "../types.js";

const execFileAsync = promisify(execFile);

/**
 * Fetch TikTok content using yt-dlp.
 */
export async function fetchTikTok(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  const outTemplate = join(tempDir, "tiktok");

  try {
    await execFileAsync("yt-dlp", [
      "--write-info-json",
      "--write-thumbnail",
      "-o", outTemplate,
      url,
    ], { timeout: 60_000 });
  } catch {
    // yt-dlp may partially succeed
  }

  const files = await readdir(tempDir);

  let title = "";
  let description = "";
  let imageUrls: string[] = [];
  let audioPath: string | undefined;

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
    } catch {
      // ignore
    }
  }

  // Find downloaded video for audio extraction
  const mediaFile = files.find((f) =>
    /\.(mp4|m4a|webm|mp3)$/i.test(f)
  );
  if (mediaFile) {
    audioPath = join(tempDir, mediaFile);
  }

  return {
    url,
    type: "tiktok",
    title,
    description,
    textContent: description,
    imageUrls: [...new Set(imageUrls)],
    audioPath,
    schemaRecipe: null,
  };
}
