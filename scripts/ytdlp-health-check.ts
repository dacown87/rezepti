/**
 * yt-dlp Health Check — testet ob yt-dlp für alle Plattformen funktioniert
 * und ob die installierte Version nicht zu alt ist.
 *
 * Hintergrund (2026-08-08): Der Entwicklungsrechner lief zwei Jahre lang auf
 * dem apt-Paket 2024.04.09, waehrend das Dockerfile bei jedem Image-Build mit
 * `pip3 install --upgrade yt-dlp` die jeweils neueste Version zieht. Dadurch
 * war Facebook lokal ueber lange Zeit kaputt ("No video formats found!"),
 * ohne dass es jemandem aufgefallen ist — Production lief die ganze Zeit mit
 * einer neueren Version. Der Versions-Age-Check unten soll genau das kuenftig
 * fruehzeitig sichtbar machen.
 *
 * Dieses Modul hat bewusst KEINE Top-Level-Seiteneffekte — nur Konstanten,
 * reine Helfer und die exportierte async `main()`. Ausfuehrbar gemacht wird
 * es ueber den duennen Runner `scripts/ytdlp-health.ts` (`npm run
 * ytdlp:health`); Unit-Tests importieren direkt aus dieser Datei, ohne dass
 * dabei jemals main() (und damit ein echter yt-dlp-Aufruf) laeuft.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type Tier = "required" | "advisory" | "unsupported";
export type ErrorClass = "extractor" | "environment";
export type OutcomeLevel = "ok" | "warn" | "fail" | "note";

export interface Outcome {
  level: OutcomeLevel;
  label: string;
}

// Known-good Test-URLs (öffentlich zugängliche Videos/Pins).
// Stand 2026-08-08 verifiziert — diese URLs koennen mit der Zeit veralten
// (Video geloescht, Pin entfernt etc.), das ist erwartbar und kein
// Extraktor-Regressions-Signal fuer sich allein.
const TEST_URLS: { platform: string; url: string; tier: Tier }[] = [
  {
    platform: "YouTube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    tier: "required",
  },
  {
    // Kanarienvogel fuer genau die Regressionsklasse, die die 2024er Version
    // lokal hatte: "No video formats found!". Facebook liefert seit
    // yt-dlp 2026.07.04 oeffentliche Videos ohne Cookies zurueck.
    platform: "Facebook",
    url: "https://www.facebook.com/watch/?v=10153231379946729",
    tier: "required",
  },
  {
    // Login-Wall — schlaegt umgebungsabhaengig fehl (eingeloggter Browser vs.
    // anonymer yt-dlp-Request), nicht weil der Extraktor kaputt ist.
    platform: "Instagram",
    url: "https://www.instagram.com/p/CKn7Z3MHiSs/",
    tier: "advisory",
  },
  {
    // IP-Sperren aus Rechenzentrums-Adressbereichen (z.B. CI-Runner) sind
    // haeufig und sagen nichts ueber den Extraktor selbst aus.
    platform: "TikTok",
    url: "https://www.tiktok.com/@charlidamelio/video/6921772702558055686",
    tier: "advisory",
  },
  {
    // Per Design nicht unterstuetzt: Pinterest liefert Pin-Daten nicht mehr
    // anonym aus. Siehe docs/superpowers/plans/2026-08-07-pinterest-facebook-per-user-connectors-plan.md
    platform: "Pinterest",
    url: "https://www.pinterest.com/pin/61713443933/",
    tier: "unsupported",
  },
];

const VERSION_FAIL_AGE_DAYS = 180;
const VERSION_WARN_AGE_DAYS = 90;

const EXTRACTOR_PATTERNS = [
  /Unsupported URL/i,
  /Unable to extract/i,
  /No video formats found/i,
  /Unable to find/i,
  /Failed to parse JSON/i,
];

const ENVIRONMENT_PATTERNS = [
  /IP address is blocked/i,
  /rate.?limit/i,
  /Sign in/i,
  /login/i,
  /empty media response/i,
  /Private/i,
  /Deleted/i,
  /Unavailable/i,
  /HTTP Error 429/i,
  /HTTP Error 403/i,
  /timed out/i,
  /Temporary failure in name resolution/i,
  // Content-rot patterns: the pinned test URLs (a specific Facebook video, a
  // specific pin) WILL eventually get deleted/removed by their platform.
  // Without these, "content gone" on a required platform would fall through
  // the catch-all to "extractor" and turn the nightly red for a reason
  // nobody can fix in code — exactly the cry-wolf outcome the tiering exists
  // to prevent.
  /no longer available/i,
  /has been removed/i,
  /Video unavailable/i,
  /does not exist/i,
  // Also matches Pinterest's current by-design 404 — harmless, since the
  // "unsupported" tier ignores the error class either way. This pattern is
  // about content rot on required/advisory platforms, not about Pinterest.
  /HTTP Error 404/i,
];

/**
 * Parst eine yt-dlp Versionsnummer im Format YYYY.MM.DD in ein Date-Objekt.
 * Gibt null zurück, wenn das Format nicht erkannt wird (z.B. eine
 * abweichende Build-Bezeichnung) — soll niemals werfen.
 */
export function parseYtDlpVersionDate(version: string): Date | null {
  const match = version.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date normalisiert ungueltige Tage (z.B. 2026.02.30) automatisch weg —
  // dagegen absichern, statt ein falsches Datum durchzulassen.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Alter der Version in Tagen, gemessen von `now`. null wenn unparsbar. */
export function versionAgeDays(version: string, now: Date): number | null {
  const parsed = parseYtDlpVersionDate(version);
  if (!parsed) return null;
  const diffMs = now.getTime() - parsed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Ordnet eine yt-dlp Fehlermeldung einer von zwei Klassen zu:
 * - "extractor": aktionabel, der Extraktor selbst ist kaputt
 * - "environment": nicht aktionabel (IP-Sperre, Login-Wall, Rate-Limit, ...)
 * Nicht erkannte Meldungen fallen auf "extractor" — lieber laut fehlschlagen
 * als einen echten Regressionsfall stillschweigend durchwinken.
 */
export function classifyYtDlpError(message: string): ErrorClass {
  if (ENVIRONMENT_PATTERNS.some((re) => re.test(message))) {
    return "environment";
  }
  if (EXTRACTOR_PATTERNS.some((re) => re.test(message))) {
    return "extractor";
  }
  return "extractor";
}

export interface EvaluateOutcomeInput {
  tier: Tier;
  ok: boolean;
  errorClass?: ErrorClass;
}

/**
 * Reine Entscheidungsfunktion: aus Tier + Ergebnis + Fehlerklasse wird ein
 * Outcome-Level. Kapselt die gesamte "wann ist Rot gerechtfertigt"-Logik,
 * damit sie ohne Netzwerk getestet werden kann.
 */
export function evaluateOutcome({ tier, ok, errorClass }: EvaluateOutcomeInput): Outcome {
  if (tier === "unsupported") {
    if (ok) {
      return {
        level: "note",
        label: "unerwartet erfolgreich — Connector-Plan pruefen",
      };
    }
    return { level: "note", label: "erwartet fehlgeschlagen (per Design)" };
  }

  if (ok) {
    return { level: "ok", label: "OK" };
  }

  if (tier === "required") {
    if (errorClass === "extractor") {
      return { level: "fail", label: "Extraktor-Regression (aktionabel)" };
    }
    return { level: "warn", label: "Umgebungsbedingt fehlgeschlagen (nicht aktionabel)" };
  }

  // advisory
  return { level: "warn", label: `Fehlgeschlagen (${errorClass ?? "unbekannt"}, nicht gated)` };
}

async function checkYtDlpBinary(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--version"], { timeout: 10_000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function checkUrl(url: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await execFileAsync(
      "yt-dlp",
      ["--dump-json", "--no-download", "--no-playlist", "--socket-timeout", "15", url],
      { timeout: 30_000 },
    );
    return { ok: true };
  } catch (error: any) {
    const message: string = error?.stderr || error?.message || String(error);
    return { ok: false, message };
  }
}

interface ResultRow {
  platform: string;
  tier: Tier;
  ok: boolean;
  errorClass?: ErrorClass;
  message?: string;
  outcome: Outcome;
}

export async function main(): Promise<number> {
  console.log("=== yt-dlp Health Check ===\n");

  const version = await checkYtDlpBinary();
  if (!version) {
    console.error("❌ yt-dlp nicht gefunden. Installieren mit: pip3 install --upgrade yt-dlp");
    return 1;
  }
  console.log(`✅ yt-dlp Version: ${version}`);

  let versionExitCode = 0;
  const now = new Date();
  const ageDays = versionAgeDays(version, now);
  if (ageDays === null) {
    console.warn(`⚠️  Versionsnummer "${version}" konnte nicht als Datum geparst werden — Age-Check übersprungen.`);
  } else if (ageDays > VERSION_FAIL_AGE_DAYS) {
    console.error(
      `❌ yt-dlp ist ${ageDays} Tage alt (Grenze: ${VERSION_FAIL_AGE_DAYS}). Upgrade noetig: pip3 install --upgrade yt-dlp`,
    );
    versionExitCode = 1;
  } else if (ageDays > VERSION_WARN_AGE_DAYS) {
    console.warn(`⚠️  yt-dlp ist ${ageDays} Tage alt (Warnschwelle: ${VERSION_WARN_AGE_DAYS}). Upgrade bald einplanen.`);
  } else {
    console.log(`✅ yt-dlp Alter: ${ageDays} Tage (unter der Warnschwelle von ${VERSION_WARN_AGE_DAYS} Tagen)`);
  }

  console.log("\nPlattform-Tests:");
  const rows: ResultRow[] = [];
  for (const { platform, url, tier } of TEST_URLS) {
    const result = await checkUrl(url);
    if (result.ok) {
      const outcome = evaluateOutcome({ tier, ok: true });
      rows.push({ platform, tier, ok: true, outcome });
      const marker = outcome.level === "note" ? "ℹ️ " : "✅";
      console.log(`  ${marker} ${platform} [${tier}]: ${outcome.label}`);
    } else {
      const errorClass = classifyYtDlpError(result.message);
      const outcome = evaluateOutcome({ tier, ok: false, errorClass });
      rows.push({ platform, tier, ok: false, errorClass, message: result.message, outcome });
      const marker = outcome.level === "fail" ? "❌" : outcome.level === "warn" ? "⚠️ " : "ℹ️ ";
      console.log(
        `  ${marker} ${platform} [${tier}]: ${outcome.label} — ${result.message.slice(0, 140).replace(/\s+/g, " ")}`,
      );
    }
  }

  console.log("\n=== Zusammenfassung ===");
  console.log(`yt-dlp: ${version} (${ageDays === null ? "Alter unbekannt" : `${ageDays} Tage alt`})`);
  for (const row of rows) {
    const status =
      row.outcome.level === "ok"
        ? "OK"
        : row.outcome.level === "note"
          ? "NOTE"
          : row.outcome.level === "warn"
            ? "WARN"
            : "FAIL";
    console.log(`  [${status.padEnd(4)}] ${row.platform.padEnd(10)} (${row.tier.padEnd(11)}) ${row.outcome.label}`);
  }

  const requiredExtractorFailure = rows.some(
    (row) => row.tier === "required" && !row.ok && row.errorClass === "extractor",
  );

  const exitCode = versionExitCode === 1 || requiredExtractorFailure ? 1 : 0;
  console.log(`\n${exitCode === 0 ? "✅ Health Check bestanden (siehe Zusammenfassung fuer Warnungen)" : "❌ Health Check fehlgeschlagen — aktionabler Fehler gefunden"}`);
  return exitCode;
}
