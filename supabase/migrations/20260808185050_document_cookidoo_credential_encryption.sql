-- Documentation only: no DDL needed, the columns are already `text`.
--
-- As of this migration, `password` and `session_cookies` are encrypted at rest with AES-256-GCM
-- by src/credential-crypto.ts before every write in src/db-react.ts. The encryption key lives
-- only in the `CREDENTIAL_ENCRYPTION_KEY` runtime environment variable (Northflank secret store)
-- and is never written to the database. Legacy plaintext rows (written before this feature
-- shipped) are tolerated on read until scripts/encrypt-cookidoo-credentials.ts has been run
-- against every environment; that tolerance is time-boxed and documented in
-- src/credential-crypto.ts.

COMMENT ON COLUMN public.cookidoo_credentials.password IS
  'AES-256-GCM encrypted at rest, format v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>. '
  'Key lives in the CREDENTIAL_ENCRYPTION_KEY env var, never in the database. '
  'Legacy plaintext rows (no "v1:" prefix) are tolerated on read until the backfill '
  '(scripts/encrypt-cookidoo-credentials.ts) has run everywhere. See src/credential-crypto.ts.';

COMMENT ON COLUMN public.cookidoo_credentials.session_cookies IS
  'AES-256-GCM encrypted at rest, format v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>. '
  'A live Cookidoo session cookie is itself a credential (logs in without the password), so it '
  'is encrypted exactly like the password. Key lives in the CREDENTIAL_ENCRYPTION_KEY env var, '
  'never in the database. Legacy plaintext rows are tolerated on read until the backfill '
  '(scripts/encrypt-cookidoo-credentials.ts) has run everywhere. See src/credential-crypto.ts.';
