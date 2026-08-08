# Cookidoo Credential Encryption Runbook

Stand: 2026-08-08

## Zweck

`cookidoo_credentials.password` und `.session_cookies` werden seit dieser Aenderung mit
AES-256-GCM verschluesselt in der DB gespeichert (Format `v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>`).
Ohne das ist ein DB-Dump — Backup, Fehlkonfiguration, kompromittierter Pooler — gleichbedeutend
mit einer Uebergabe der Vorwerk-Zugangsdaten aller Nutzer:innen im Klartext.

Implementierung:

- `src/credential-crypto.ts` — die **einzige** Stelle im Code, die `CREDENTIAL_ENCRYPTION_KEY` liest. `encryptCredential` / `decryptCredential` / `isEncrypted`.
- `src/db-react.ts` — verschluesselt beim Schreiben (`saveUserCookidooCredentials`, `shareCookidooCredentialsToHousehold`, `updateCookidooScopedSession`) und entschluesselt beim Lesen (`getCookidooPrivateCredentials`, `resolveCookidooCredentials`). `src/fetchers/cookidoo.ts` und `src/routes/platforms.ts` sehen weiterhin Klartext im Speicher — Verschluesselung ist ausschliesslich eine "at rest"-Eigenschaft der DB-Schicht.
- `scripts/encrypt-cookidoo-credentials.ts` — Backfill fuer bereits vorhandene Klartext-Zeilen (siehe unten).
- `supabase/migrations/20260808185050_document_cookidoo_credential_encryption.sql` — reine `COMMENT ON COLUMN`-Dokumentation, kein DDL.

## Schluessel erzeugen und ablegen

```bash
openssl rand -base64 32
```

- Ergebnis ist ein 32-Byte-Schluessel, Base64-kodiert, als `CREDENTIAL_ENCRYPTION_KEY` setzen.
- Gehoert in denselben Secret-Store wie `BREVO_API_KEY` — Northflank Runtime Secret, **nicht** ins Repo, nicht in `.env` committen.
- Lokal in `.env` eintragen (siehe `.env.example`), niemals in `.env.example` selbst mit echtem Wert.

**WICHTIG — Schluesselverlust:** Geht `CREDENTIAL_ENCRYPTION_KEY` verloren, sind alle gespeicherten
Cookidoo-Zugangsdaten (Passwort + Session) unbrauchbar. Es gibt keine Wiederherstellung ohne den
Schluessel. Jede:r betroffene Nutzer:in muss die Cookidoo-Zugangsdaten in den App-Einstellungen neu
eingeben. Rotation auf einen neuen Schluessel ist nur ueber Re-Encrypt aller Zeilen moeglich (aktuell
nicht automatisiert — bei Bedarf analog zum Backfill-Script realisieren: alte Zeilen mit dem alten
Schluessel entschluesseln, mit dem neuen Schluessel neu verschluesseln).

## Legacy-Klartext-Toleranz

`decryptCredential()` gibt einen Wert ohne `v1:`-Praefix unveraendert zurueck (mit einmaligem
`console.warn` pro Prozess) statt zu werfen. Das ist absichtlich zeitlich begrenzt: Es verhindert,
dass ein Deploy des verschluesselnden Codes *vor* dem Backfill jemanden aus der Cookidoo-Anbindung
aussperrt. Diese Toleranz kann entfernt werden, sobald der Backfill in jeder Umgebung gelaufen ist.

## Backfill: bestehende Klartext-Zeilen verschluesseln

Das Script ist **sicher per Default**: ohne `--apply` liest es nur und meldet, was es aendern
wuerde. Schreiben erfordert zusaetzlich `CREDENTIAL_BACKFILL_CONFIRM`, gesetzt auf exakt den Host
aus `DATABASE_URL` — ein kopiertes Kommando ohne angepassten Confirm-Wert bricht ab, statt still
gegen die falsche Datenbank zu schreiben (gleiches Muster wie
`scripts/supabase/staging-recipe-invite-smoke.ts` und `scripts/supabase/rls-smoke.ts`).

### 1. Dry-Run (Default, keine Schreibvorgaenge)

```bash
npm run credentials:encrypt-backfill
```

Ausgabe zeigt Ziel-Host/-DB, `MODUS: DRY-RUN`, und pro betroffener Zeile, was geaendert wuerde,
gefolgt von einer Zusammenfassung (rows scanned / passwords encrypted / session cookies encrypted /
rows already encrypted / rows skipped).

### 2. Apply (schreibt tatsaechlich)

```bash
CREDENTIAL_BACKFILL_CONFIRM=<host-aus-DATABASE_URL> npm run credentials:encrypt-backfill -- --apply
```

`<host-aus-DATABASE_URL>` ist exakt der Hostname, den das Script im Dry-Run unter
"Ziel-Datenbank: host=..." ausgegeben hat. Ohne passenden Confirm-Wert bricht der Lauf mit einer
deutschsprachigen Fehlermeldung ab, bevor irgendetwas geschrieben wird.

Das Script ist idempotent: bereits verschluesselte Zeilen (`v1:`-Praefix) werden uebersprungen,
ein zweiter Lauf ist ein No-Op. Updates laufen einzeln pro Zeile (Primary Key), nicht in einer
grossen Transaktion — die Tabelle ist klein genug, dass das keinen Vorteil braechte, aber ein langer
Lock waere unnoetig riskant.

## Betriebs-Notiz (2026-08-08)

Waehrend der Implementierung wurde das Script versehentlich einmal lesend (`SELECT`, kein
`--apply`) gegen die echte `DATABASE_URL` ausgefuehrt. Ergebnis: `cookidoo_credentials` hatte 0
Zeilen, es wurde nichts geschrieben. Der Vorfall war der Anlass fuer die Sicherheitsmechanismen in
diesem Runbook (Dry-Run als Default, Host-gebundener Confirm-Wert). Der produktive Backfill-Lauf
selbst ist noch nicht durchgefuehrt worden.
