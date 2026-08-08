// AES-256-GCM encryption for credentials stored at rest (Cookidoo password + session cookies).
//
// This is the ONLY module in the codebase that reads CREDENTIAL_ENCRYPTION_KEY. Do not add the
// key to src/config.ts — a secret living on the exported config object is reachable from every
// module that imports config, and a value that reachable ends up in a log line eventually.
//
// Storage format: "v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>"
// The "v1:" prefix is a version marker so a future key-rotation scheme (e.g. "v2:") can be
// introduced without an ambiguous migration window.
//
// Key handling is DELIBERATELY LAZY — validated only at point of use, never at process boot,
// and src/index.ts is not touched for this feature. Every other secret in this codebase already
// works this way (DATABASE_URL throws lazily inside getDb(), GROQ_API_KEY surfaces only deep in
// byok-validator.ts). Cookidoo credential encryption is an optional connector feature: throwing
// at boot for a forgotten Northflank variable would turn a missed env var into a total app outage
// (no recipes, no shopping list, nothing works) instead of a scoped failure of the Cookidoo
// connector alone. Failing closed at the credential read/write path still gives the guarantee
// that actually matters here — plaintext is never silently written to the database — with a much
// smaller blast radius than a boot-time crash.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENV_VAR_NAME = "CREDENTIAL_ENCRYPTION_KEY";
const VERSION_PREFIX = "v1";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // GCM-recommended IV length
const AUTH_TAG_LENGTH_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

let cachedKey: Buffer | null = null;

/** Test-only escape hatch: clears the cached key so tests can swap CREDENTIAL_ENCRYPTION_KEY. */
export function resetCredentialKeyCacheForTests(): void {
  cachedKey = null;
}

function readEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[ENV_VAR_NAME];
  if (!raw) {
    throw new Error(
      `${ENV_VAR_NAME} ist nicht gesetzt. Zum Verschluesseln/Entschluesseln von Zugangsdaten wird ein ` +
      `32 Byte langer, Base64-kodierter Schluessel benoetigt. Erzeugen mit: openssl rand -base64 32`,
    );
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, "base64");
  } catch (error) {
    throw new Error(
      `${ENV_VAR_NAME} konnte nicht als Base64 dekodiert werden. Erzeugen mit: openssl rand -base64 32`,
      { cause: error },
    );
  }

  if (decoded.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `${ENV_VAR_NAME} hat nach Base64-Dekodierung ${decoded.length} Byte, erwartet werden genau ` +
      `${KEY_LENGTH_BYTES} Byte. Neu erzeugen mit: openssl rand -base64 32`,
    );
  }

  cachedKey = decoded;
  return decoded;
}

/** True iff the stored value is in our own "v1:" ciphertext format. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${VERSION_PREFIX}:`);
}

/** Encrypts a plaintext credential. Always encrypts — there is no legacy passthrough on write. */
export function encryptCredential(plaintext: string): string {
  const key = readEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

// Time-boxed legacy tolerance: rows written before this feature shipped have plaintext
// password/session_cookies values with no "v1:" prefix. Deploying the encrypting code before the
// backfill (scripts/encrypt-cookidoo-credentials.ts) has run against every environment must not
// lock anyone out of their Cookidoo connector, so a value without our prefix is returned
// unchanged instead of failing. Remove this branch once the backfill has run everywhere.
let warnedLegacyPlaintext = false;

/**
 * Decrypts a stored credential. Values without the "v1:" prefix are assumed to be pre-encryption
 * plaintext and returned as-is (see legacy tolerance note above) — this branch is checked BEFORE
 * touching the encryption key, so a legacy plaintext value can be read even on a deployment that
 * has not set CREDENTIAL_ENCRYPTION_KEY yet.
 */
export function decryptCredential(stored: string): string {
  if (!isEncrypted(stored)) {
    if (!warnedLegacyPlaintext) {
      warnedLegacyPlaintext = true;
      console.warn(
        `[credential-crypto] Gelesener Wert hat kein "${VERSION_PREFIX}:"-Praefix und wird als ` +
        "Legacy-Klartext behandelt. Backfill (npm run credentials:encrypt-backfill) ausfuehren, " +
        "um diese Toleranz ueberfluessig zu machen.",
      );
    }
    return stored;
  }

  const key = readEncryptionKey();
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error(`Ungueltiges Ciphertext-Format fuer verschluesselte Zugangsdaten (Praefix "${VERSION_PREFIX}:" erwartet).`);
  }

  const [, ivPart, authTagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch (error) {
    // Do not leak ciphertext or key material in the wrapping error message.
    throw new Error("Entschluesselung der Zugangsdaten fehlgeschlagen (moeglicherweise manipuliert oder falscher Schluessel).", { cause: error });
  }
}
