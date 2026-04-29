import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

interface CobaltPickerItem {
  type: "photo" | "video" | "gif";
  url: string;
  thumb?: string;
}

interface CobaltResponse {
  status: "redirect" | "tunnel" | "local-processing" | "picker" | "error";
  url?: string;
  filename?: string;
  picker?: CobaltPickerItem[];
  error?: {
    code: string;
    context?: Record<string, unknown>;
  };
}

export interface CobaltMediaResult {
  mediaUrls: string[];
  imageUrls: string[];
  filename?: string;
}

/**
 * Call the Cobalt API to resolve a social media URL into downloadable media.
 * Returns null on any error (auth, network, unsupported URL) — always a graceful fallback.
 */
export async function fetchWithCobalt(
  url: string,
  downloadMode: "auto" | "audio" | "mute" = "auto"
): Promise<CobaltMediaResult | null> {
  const { apiUrl, apiKey } = config.cobalt;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Api-Key ${apiKey}`;
  }

  let data: CobaltResponse;
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ url, downloadMode }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // 401/403 = auth required on public instance — expected without API key
      if (response.status !== 401 && response.status !== 403) {
        console.warn(`[cobalt] HTTP ${response.status}: ${text.slice(0, 120)}`);
      }
      return null;
    }

    data = (await response.json()) as CobaltResponse;
  } catch {
    return null;
  }

  if (data.status === "error") {
    const code = data.error?.code ?? "unknown";
    if (!code.startsWith("api.auth")) {
      console.warn(`[cobalt] API error: ${code}`);
    }
    return null;
  }

  if (data.status === "picker" && data.picker) {
    const mediaUrls = data.picker
      .filter((i) => i.type === "video" || i.type === "gif")
      .map((i) => i.url);
    const photoUrls = data.picker
      .filter((i) => i.type === "photo")
      .map((i) => i.url);
    const thumbUrls = data.picker.flatMap((i) => (i.thumb ? [i.thumb] : []));
    return {
      mediaUrls,
      imageUrls: [...photoUrls, ...thumbUrls],
      filename: data.filename,
    };
  }

  if (
    (data.status === "redirect" || data.status === "tunnel") &&
    data.url
  ) {
    return { mediaUrls: [data.url], imageUrls: [], filename: data.filename };
  }

  // "local-processing" requires client-side ffmpeg — skip
  return null;
}

/**
 * Download a media file from a Cobalt-provided URL into tempDir.
 * Returns the local file path, or null on failure.
 */
export async function downloadCobaltMedia(
  mediaUrl: string,
  tempDir: string,
  filename: string
): Promise<string | null> {
  try {
    const response = await fetch(mediaUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const filePath = join(tempDir, filename);
    await writeFile(filePath, Buffer.from(buffer));
    return filePath;
  } catch {
    return null;
  }
}

function cobaltFileExt(filename?: string): string {
  return filename?.match(/\.(mp4|m4a|webm|mp3|mov)$/i)?.[1] ?? "mp4";
}

/**
 * Download the first available media from a CobaltMediaResult.
 * Returns the local file path, or undefined if nothing to download.
 */
export async function downloadFirstCobaltMedia(
  result: CobaltMediaResult,
  tempDir: string,
  prefix: string
): Promise<string | undefined> {
  if (result.mediaUrls.length === 0) return undefined;
  const ext = cobaltFileExt(result.filename);
  return (await downloadCobaltMedia(result.mediaUrls[0], tempDir, `${prefix}.${ext}`)) ?? undefined;
}
