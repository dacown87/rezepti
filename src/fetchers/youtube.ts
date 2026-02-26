import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ContentBundle } from "../types.js";

const execFileAsync = promisify(execFile);

/**
 * Fetch YouTube content using yt-dlp.
 * Tries to get subtitles first, falls back to audio download for whisper.
 */
export async function fetchYouTube(
  url: string,
  tempDir: string
): Promise<ContentBundle> {
  // Step 1: Get metadata + thumbnail + subtitles
  const { stdout: infoJson } = await execFileAsync("yt-dlp", [
    "--dump-json",
    "--no-download",
    url,
  ], { timeout: 30_000 });

  const info = JSON.parse(infoJson);
  const title = info.title || "";
  const description = info.description || "";
  const thumbnail = info.thumbnail || "";

  // Step 2: Try to download subtitles
  let subtitles: string | undefined;
  try {
    await execFileAsync("yt-dlp", [
      "--write-subs",
      "--write-auto-subs",
      "--sub-lang", "de,en",
      "--sub-format", "vtt",
      "--skip-download",
      "-o", join(tempDir, "subs"),
      url,
    ], { timeout: 30_000 });

    // Find downloaded subtitle file
    const files = await readdir(tempDir);
    const subFile = files.find((f) => f.endsWith(".vtt"));
    if (subFile) {
      const vttContent = await readFile(join(tempDir, subFile), "utf-8");
      subtitles = cleanVTT(vttContent);
    }
  } catch {
    // Subtitles not available - that's okay
  }

  // Step 3: If no subtitles, download audio for whisper
  let audioPath: string | undefined;
  if (!subtitles) {
    try {
      const outPath = join(tempDir, "audio.m4a");
      await execFileAsync("yt-dlp", [
        "-x",
        "--audio-format", "m4a",
        "-o", outPath,
        url,
      ], { timeout: 120_000 });

      if (existsSync(outPath)) {
        audioPath = outPath;
      }
    } catch {
      // Audio download failed
    }
  }

  return {
    url,
    type: "youtube",
    title,
    description,
    subtitles,
    imageUrls: thumbnail ? [thumbnail] : [],
    audioPath,
    schemaRecipe: null,
  };
}

/**
 * Clean VTT subtitle content to plain text.
 */
function cleanVTT(vtt: string): string {
  return vtt
    .split("\n")
    .filter((line) => {
      // Remove timestamps, WEBVTT header, and empty lines
      if (line.startsWith("WEBVTT")) return false;
      if (line.startsWith("Kind:")) return false;
      if (line.startsWith("Language:")) return false;
      if (/^\d{2}:\d{2}/.test(line)) return false;
      if (/^NOTE/.test(line)) return false;
      if (line.trim() === "") return false;
      return true;
    })
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    // Dedupe consecutive identical lines
    .filter((line, i, arr) => i === 0 || line !== arr[i - 1])
    .join(" ");
}
