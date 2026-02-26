import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ContentBundle } from "../types.js";

const execFileAsync = promisify(execFile);

/**
 * Fetch Instagram content using yt-dlp.
 */
export async function fetchInstagram(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  // Download post with metadata
  const outTemplate = join(tempDir, "insta");

  try {
    await execFileAsync("yt-dlp", [
      "--write-info-json",
      "--write-thumbnail",
      "-o", outTemplate,
      url,
    ], { timeout: 60_000 });
  } catch {
    // Sometimes yt-dlp fails for Instagram but still writes info.json
  }

  const files = await readdir(tempDir);

  // Read info.json for metadata
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

      // Collect thumbnail URLs
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

  // Check for downloaded images
  const imageFiles = files.filter((f) =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );
  for (const img of imageFiles) {
    imageUrls.push(join(tempDir, img));
  }

  // Check for downloaded video/audio
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
    imageUrls: [...new Set(imageUrls)].slice(0, 5),
    audioPath,
    schemaRecipe: null,
  };
}
