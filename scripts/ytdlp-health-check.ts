#!/usr/bin/env npx tsx
/**
 * yt-dlp Health Check — testet ob yt-dlp für alle Plattformen funktioniert.
 * Ausführen: npx tsx scripts/ytdlp-health-check.ts
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Known-good Test-URLs (öffentlich zugängliche Videos)
const TEST_URLS: { platform: string; url: string }[] = [
  { platform: "YouTube",   url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { platform: "Instagram", url: "https://www.instagram.com/p/CKn7Z3MHiSs/" },
  { platform: "TikTok",    url: "https://www.tiktok.com/@charlidamelio/video/6921772702558055686" },
];

async function checkYtDlpBinary(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--version"], { timeout: 10_000 });
    console.log(`✅ yt-dlp Version: ${stdout.trim()}`);
    return true;
  } catch {
    console.error("❌ yt-dlp nicht gefunden. Installieren mit: pip install yt-dlp");
    return false;
  }
}

async function checkUrl(platform: string, url: string): Promise<boolean> {
  try {
    await execFileAsync("yt-dlp", [
      "--dump-json",
      "--no-download",
      "--no-playlist",
      "--socket-timeout", "15",
      url,
    ], { timeout: 30_000 });
    console.log(`  ✅ ${platform}: OK`);
    return true;
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("Unsupported URL") || msg.includes("Unable to extract")) {
      console.error(`  ❌ ${platform}: Extraktion fehlgeschlagen — ${msg.slice(0, 100)}`);
    } else if (msg.includes("Private") || msg.includes("Deleted")) {
      console.warn(`  ⚠️  ${platform}: Video privat/gelöscht (yt-dlp funktioniert)`);
      return true;
    } else {
      console.error(`  ❌ ${platform}: Fehler — ${msg.slice(0, 100)}`);
    }
    return false;
  }
}

async function main() {
  console.log("=== yt-dlp Health Check ===\n");

  const binaryOk = await checkYtDlpBinary();
  if (!binaryOk) process.exit(1);

  console.log("\nPlattform-Tests:");
  let failures = 0;
  for (const { platform, url } of TEST_URLS) {
    const ok = await checkUrl(platform, url);
    if (!ok) failures++;
  }

  console.log(`\n${failures === 0 ? "✅ Alle Tests bestanden" : `❌ ${failures} Test(s) fehlgeschlagen`}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(console.error);
