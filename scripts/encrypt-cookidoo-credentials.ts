// One-off backfill: encrypt any plaintext cookidoo_credentials.password / .session_cookies rows
// in place. Idempotent — rows already in the "v1:" ciphertext format are left untouched, so
// running this twice (or against an environment that has nothing to do) is a safe no-op.
//
// SAFE BY DEFAULT: this script only reads and reports unless --apply is passed. Writing also
// requires CREDENTIAL_BACKFILL_CONFIRM to equal the target DATABASE_URL host, mirroring the
// production confirm-gate pattern in scripts/supabase/staging-recipe-invite-smoke.ts /
// scripts/supabase/rls-smoke.ts — a copy-pasted invocation without the matching confirm value
// aborts instead of silently writing to whatever DATABASE_URL happens to be set.
//
// Usage:
//   npm run credentials:encrypt-backfill                                          # dry run (default, no writes)
//   CREDENTIAL_BACKFILL_CONFIRM=<db-host> npm run credentials:encrypt-backfill -- --apply   # writes changes
import "dotenv/config";
import {
  listCookidooCredentialSecretsForBackfill,
  updateCookidooCredentialSecretsById,
} from "../src/db-react.js";
import { encryptCredential, isEncrypted } from "../src/credential-crypto.js";

const apply = process.argv.includes("--apply");

function readTargetDatabase(): { host: string; database: string } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch (error) {
    throw new Error("DATABASE_URL could not be parsed as a URL.", { cause: error });
  }

  return {
    host: parsed.hostname,
    database: parsed.pathname.replace(/^\//, ""),
  };
}

function assertApplyIsConfirmed(host: string): void {
  const confirm = process.env.CREDENTIAL_BACKFILL_CONFIRM?.trim();
  if (confirm !== host) {
    throw new Error(
      `--apply erfordert CREDENTIAL_BACKFILL_CONFIRM=${host} (muss exakt dem Host aus DATABASE_URL ` +
      `entsprechen). Gesetzt war: ${confirm ? `"${confirm}"` : "(nicht gesetzt)"}. Abbruch ohne Schreibvorgang.`,
    );
  }
}

async function main() {
  const target = readTargetDatabase();
  console.log(`[encrypt-cookidoo-credentials] Ziel-Datenbank: host=${target.host} db=${target.database}`);

  if (apply) {
    assertApplyIsConfirmed(target.host);
    console.log("[encrypt-cookidoo-credentials] MODUS: APPLY (schreibt in die Datenbank)");
  } else {
    console.log("[encrypt-cookidoo-credentials] MODUS: DRY-RUN (keine Schreibvorgaenge)");
  }

  const rows = await listCookidooCredentialSecretsForBackfill();

  let scanned = 0;
  let passwordsEncrypted = 0;
  let sessionCookiesEncrypted = 0;
  let alreadyEncryptedRows = 0;
  let skippedRows = 0;

  for (const row of rows) {
    scanned += 1;

    const passwordNeedsEncryption = !isEncrypted(row.password);
    const sessionCookiesNeedEncryption = row.sessionCookies !== null && !isEncrypted(row.sessionCookies);

    if (!passwordNeedsEncryption && !sessionCookiesNeedEncryption) {
      alreadyEncryptedRows += 1;
      continue;
    }

    const update: { password?: string; sessionCookies?: string } = {};

    if (passwordNeedsEncryption) {
      update.password = encryptCredential(row.password);
      passwordsEncrypted += 1;
    }

    if (sessionCookiesNeedEncryption && row.sessionCookies !== null) {
      update.sessionCookies = encryptCredential(row.sessionCookies);
      sessionCookiesEncrypted += 1;
    }

    if (Object.keys(update).length === 0) {
      skippedRows += 1;
      continue;
    }

    if (!apply) {
      console.log(`[encrypt-cookidoo-credentials] wuerde Zeile id=${row.id} aktualisieren: ${Object.keys(update).join(", ")}`);
      continue;
    }

    // Per-row update by primary key, not one giant transaction — this table is small and holding
    // a single long-lived transaction/lock across every row buys nothing here.
    await updateCookidooCredentialSecretsById(row.id, update);
  }

  console.log("[encrypt-cookidoo-credentials] Zusammenfassung:");
  console.log(`  rows scanned:               ${scanned}`);
  console.log(`  passwords encrypted:        ${passwordsEncrypted}${apply ? "" : " (dry run — nicht geschrieben)"}`);
  console.log(`  session cookies encrypted:  ${sessionCookiesEncrypted}${apply ? "" : " (dry run — nicht geschrieben)"}`);
  console.log(`  rows already encrypted:     ${alreadyEncryptedRows}`);
  console.log(`  rows skipped (no change):   ${skippedRows}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("[encrypt-cookidoo-credentials] Failed:", error);
  process.exit(1);
});
