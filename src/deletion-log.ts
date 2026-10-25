// HMAC hashing for the two-track account-deletion log.
//
// This is the ONLY module in the codebase that reads DELETION_LOG_PEPPER. Like
// CREDENTIAL_ENCRYPTION_KEY, the pepper is deliberately NOT added to
// src/config.ts — a secret on the exported config object is reachable from
// every module that imports config, and reachable values end up in logs.
//
// The DB stores only HMAC-SHA256(user_id, pepper) as hex, never the raw user id,
// so the deletion log carries no personal data. Key handling is LAZY: a missing
// pepper returns null (never throws), so Art. 17 account deletion keeps working
// even when the secret is not configured — the DB row and stdout line are simply
// skipped and the caller logs a warning.

import { createHmac } from "node:crypto";

const ENV_VAR_NAME = "DELETION_LOG_PEPPER";
const KEY_LENGTH_BYTES = 32;

let cachedPepper: Buffer | null = null;

/** Test-only escape hatch: clears the cached pepper so tests can swap the env var. */
export function resetDeletionLogPepperCacheForTests(): void {
  cachedPepper = null;
}

function readPepper(): Buffer {
  if (cachedPepper) return cachedPepper;

  const raw = process.env[ENV_VAR_NAME];
  if (!raw) {
    throw new Error(
      `${ENV_VAR_NAME} ist nicht gesetzt. Zum Hashen von geloeschten Konten wird ein ` +
      `32 Byte langer, Base64-kodierter Wert benoetigt (openssl rand -base64 32).`,
    );
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `${ENV_VAR_NAME} hat nach Base64-Dekodierung ${decoded.length} Byte, erwartet werden ` +
      `genau ${KEY_LENGTH_BYTES} Byte. Neu erzeugen mit: openssl rand -base64 32`,
    );
  }

  cachedPepper = decoded;
  return decoded;
}

/**
 * Returns `HMAC-SHA256(user_id, pepper)` as lowercase hex, or `null` when
 * `DELETION_LOG_PEPPER` is not (validly) configured. Returning null instead of
 * throwing keeps account deletion working without the secret.
 */
export function computeDeletionLogHash(userId: string): string | null {
  try {
    const pepper = readPepper();
    return createHmac("sha256", pepper).update(userId).digest("hex");
  } catch {
    return null;
  }
}
