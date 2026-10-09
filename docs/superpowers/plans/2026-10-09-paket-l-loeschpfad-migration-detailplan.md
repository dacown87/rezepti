# Detailplan: Gemeinsame Löschpfad-Migration (Paket L)

> **Status: Detailplan — wartet auf Freigabe.** Kein Code, bevor der Betreiber die Entscheidungen am Ende bestätigt hat.

Stand: 2026-10-09. Grobplan: [2026-10-07-grob-loeschpfad-migration.md](2026-10-07-grob-loeschpfad-migration.md). Quellpakete: [Vor-Start-Plan](2026-10-07-vor-start-backups-kostenschutz-recht-plan.md) A (Backups) und B (Kostenschutz), [DM-Plan](2026-10-07-paket-dm-datenminimierung-detailplan.md) DM-1. Basis: [20261007120000_account_deletion.sql](../../../supabase/migrations/20261007120000_account_deletion.sql) und [account-deletion-smoke.ts](../../../scripts/supabase/account-deletion-smoke.ts). Rahmen (CLAUDE.md): Production-Migrationen **nur** über den Workflow *Apply Supabase Migrations*, erst Staging; keine schweren lokalen Läufe (`supabase-rls-smoke` läuft in CI).

**Wirkung der Reduzierung vom 2026-10-09:** Bild-Tabelle (`private.recipe_images`) und Zustimmungs-Spalten (`terms_*`) entfallen. Das Bündel enthält damit nur noch **drei** Schemateile (A-Löschprotokoll, B-Quota, DM-1-Anonymisierung). Es ändert sich nichts an der Aussage „eine Neufassung der Löschfunktion“.

---

## 0. Korrektur am Plan A (Fund beim Ausarbeiten)

Der Vor-Start-Plan will das Löschprotokoll in `private.deleted_accounts_log` **in der Datenbank** führen, damit nach einem Restore gelöschte Konten erneut gelöscht werden können (EDPB-CEF-Bericht 2025, Recherche 5). **Das trägt nur, wenn die Produktions-DB beim Restore noch lebt.** Im Ernstfall (DB weg, Restore aus dem Backup) wird die Tabelle **mit** zurückgesetzt, und alle Löschungen seit dem Backup-Zeitpunkt sind aus ihr verschwunden. Der Zweck der Tabelle entfällt genau dann, wenn man sie braucht.

**Lösung (klein, ohne neuen Dienst):** Das Protokoll hat zwei Spuren.
1. **Tabelle `private.deleted_accounts_log`** (bequem für Restores auf Staging und bei lebender Produktions-DB; Frist 35 Tage).
2. **Zusätzliche Logzeile auf `stdout` durch den Server** nach erfolgreicher Löschung: `[account-deleted] hash=<hmac> at=<iso>`. Northflank hält Runtime-Logs außerhalb der DB (Aufbewahrung durch den Betreiber zu prüfen, siehe Entscheidung 3). Diese Spur überlebt den Verlust der DB. Die Hashes enthalten keine Personendaten (HMAC mit Geheimnis, siehe 1.1).

Der Restore-Nachlauf nutzt zuerst die Tabelle der lebenden DB (falls vorhanden), sonst die Logzeilen. Das gehört in das Runbook von Paket A.

---

## 1. Inhalt des Bündel-PRs (nur Schema + Löschpfad + Smoke)

### 1.1 Migration `supabase/migrations/20261010090000_deletion_path_bundle.sql`
(Zeitstempel beim Anlegen nach dem aktuellen letzten Eintrag `20261007120000` prüfen.)

**A — Löschprotokoll**
- `CREATE TABLE private.deleted_accounts_log (user_hash text NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now())`; Index auf `deleted_at`; `REVOKE ALL ... FROM PUBLIC, anon, authenticated`.
- **Hash:** `HMAC-SHA256(user_id, pepper)` als Hex. Der Server berechnet ihn und übergibt ihn der Funktion (die DB kennt das Geheimnis nicht). Das Geheimnis `DELETION_LOG_PEPPER` (32 Byte, base64) ist ein **neues Northflank-Secret** und wird **zusätzlich offline beim Betreiber** abgelegt (neben dem `age`-Schlüssel), weil der Restore-Nachlauf es braucht. Wie `CREDENTIAL_ENCRYPTION_KEY` lazy geprüft, nicht in `src/config.ts` (eigenes kleines Modul `src/deletion-log.ts`).
- Ohne Geheimnis darf die Löschung **nicht** fehlschlagen (Art. 17 geht vor): Dann wird `NULL` übergeben und nur die DB-Zeile mit Hinweis geschrieben; der Server loggt eine Warnung.

**B — Importkontingent**
- `CREATE TABLE public.import_quota_usage (user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, day date NOT NULL, count integer NOT NULL DEFAULT 0 CHECK (count >= 0), PRIMARY KEY (user_id, day))`; RLS an, **keine** Policies (Backend-only, wie `bug_report_submission_rate_limits`).
- **Globaler Zähler: eigene Tabelle** `public.import_quota_global (day date PRIMARY KEY, count integer NOT NULL DEFAULT 0 CHECK (count >= 0))`, RLS an, keine Policies. Das löst die offene Frage aus dem Grobplan: **keine Sentinel-`user_id`**, die den Smoke verwirren und gegen den FK verstoßen würde.
- In `delete_user_account`: explizites `DELETE FROM public.import_quota_usage WHERE user_id = p_user_id` zusätzlich zum Cascade (liefert die Anzahl im Rückgabe-JSON und macht die Löschung unabhängig vom FK sichtbar).

**DM-1 — Fehlerberichte**
- `ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS anonymised_at timestamptz NULL;`
- `private.anonymise_bug_report_metadata(jsonb)` (`IMMUTABLE`, `SET search_path = pg_catalog, pg_temp`, Whitelist wie im DM-Plan DM-1 Schritt 1; `REVOKE` wie bei der Löschfunktion).
- Bug-Report-Block der Löschfunktion: `SET user_id = NULL, household_id = NULL, route = NULL, metadata_json = private.anonymise_bug_report_metadata(metadata_json), anonymised_at = now(), updated_at = now()`.
- Einmalige Nachbereinigung bereits anonymisierter Berichte (`WHERE user_id IS NULL AND anonymised_at IS NULL`).

**Die Löschfunktion — einmal komplett neu**
- Weil sich die Signatur ändert (`p_user_hash text` kommt dazu): `DROP FUNCTION private.delete_user_account(uuid);` dann `CREATE FUNCTION private.delete_user_account(p_user_id uuid, p_user_hash text DEFAULT NULL)`. **Nicht** per `CREATE OR REPLACE` überladen, sonst bleibt die alte Variante ausführbar. `SECURITY DEFINER`, `SET search_path = public, pg_temp` **zwingend** (Lehre aus `20260927140000`), `REVOKE ALL ... FROM PUBLIC, anon, authenticated` direkt danach, `RAISE`-Codes `RD404`/`RD409` unverändert.
- Rumpf = Rumpf aus `20261007120000` plus: Bug-Report-Block (neu), Quota-Delete, Protokollzeile (`INSERT INTO private.deleted_accounts_log` vor dem Löschen von `auth.users`, nur wenn `p_user_hash` nicht leer).
- **Review-Regel:** Der Diff gegen `20261007120000` darf ausschließlich diese vier Stellen zeigen; alles andere muss textgleich sein.
- Aufrufer in `src/db-react.ts` (Funktion, die `private.delete_user_account` aufruft) anpassen: Hash berechnen und mitgeben; danach `console.log("[account-deleted] hash=… at=…")`.

### 1.2 `src/schema.ts`
`anonymisedAt` an `bugReports`; Tabellen `importQuotaUsage` und `importQuotaGlobal`. Optional Typ-Spiegel `mobile/db/schema.ts` (nur Typen).

### 1.3 Smoke `scripts/supabase/account-deletion-smoke.ts`
- `import_quota_usage.user_id` in `COVERED_USER_COLUMNS` (alphabetisch einsortieren).
- Seed: eine Quota-Zeile für A und B; Bericht mit vollem `metadata_json` (inkl. `lastFailureSnapshot.submittedUrl`) und `route`.
- Prüfungen: Quota von A weg, von B unverändert; Bericht nur mit Whitelist-Schlüsseln, `route IS NULL`, `anonymised_at IS NOT NULL`, `description` unverändert; **genau eine** Zeile im Löschprotokoll für A mit dem übergebenen Hash und **keine Klartext-UUID** in der Tabelle (Stichprobe: `user_hash <> a.id::text`); ohne Hash (Parameter `NULL`) wird trotzdem gelöscht, ohne Protokollzeile.
- Alte Aufrufe `select private.delete_user_account(${id}::uuid)` bleiben gültig (Default-Parameter).
- `snapshot()` um die neuen Tabellen für B erweitern.

### 1.4 RLS-Klassifizierung
[docs/SupaBase/rls-no-policy-classification-2026-05-31.md](../../SupaBase/rls-no-policy-classification-2026-05-31.md): `import_quota_usage`, `import_quota_global` als „Backend-only, RLS ohne Policies“ eintragen (`private.deleted_accounts_log` liegt im Schema `private` und ist nicht über die Data API erreichbar).

### 1.5 Nicht im Bündel (bleibt in den Quellpaketen)
- **A:** Backup-Job, R2, Runbook, Restore-Test, Pepper-Ablage, Aufräumen alter Protokollzeilen.
- **B:** `consumeImportQuota`, Config-Knobs, `429`-Pfad, Mobile-Meldung.
- **DM-1:** Retention-Timer, Admin-`DELETE`, Entfernen von `activeHouseholdId` im Client, DM-1b.
- **Entfallen** (Reduzierung 2026-10-09): Bild-Tabelle, Terms-Spalten.

---

## 2. Gemeinsamer Aufräum-Timer (`src/retention.ts`)
Ein täglicher Lauf (Muster `startJobCleanupTimer`, `unref`, try/catch je Schritt, Log `[retention] <schritt> removed N`), gestartet in `src/index.ts` neben dem Job-Cleanup. **Der erste Folge-PR nach L legt ihn an (DM-1)**, die anderen hängen nur einen Schritt an:

| Schritt | Paket | Regel |
|---|---|---|
| `bug_reports` | DM-1 | älter als `BUG_REPORT_RETENTION_MONTHS` (Default 12) löschen |
| `invites` | DM-1b | abgelaufene bzw. angenommene Einladungen 30 Tage nach Ablauf/Annahme löschen |
| `deleted_accounts_log` | A | älter als 35 Tage löschen |
| `import_quota_usage`/`_global` | B | Tage älter als 2 Tage löschen |

Mehrere Instanzen sind unkritisch (alle Schritte sind idempotente DELETEs).

---

## 3. Reihenfolge, Verifikation, Rollout
1. **PR L** (nur Migration, Schema, Aufrufer-Anpassung, Smoke, Doku). Lokal: `npx tsc` und gezielte Unit-Tests; **der Smoke läuft in CI** (`supabase-rls-smoke`).
2. Vor Production: **Migration zuerst auf Staging** anwenden (Workflow *Apply Supabase Migrations* mit Staging-Ziel), dort einmal ein Testkonto löschen und die Log-Zeile prüfen.
3. Production nach Merge über den Workflow; danach read-only prüfen: `pg_proc.proconfig` der Funktion enthält `search_path`, Funktion nur für `postgres` ausführbar (Muster der Verifikation vom 2026-10-07), Spalte/Tabellen vorhanden, Pruef-SQL aus DM-1 (`user_id is null and (metadata_json ? 'userAgent' or route is not null)` = 0).
4. Danach A, B und DM-1 parallel möglich.

## 4. Akzeptanzkriterien
- Eine Migration, eine Funktionsfassung, Diff gegen `20261007120000` zeigt nur die vier genannten Stellen.
- `supabase-rls-smoke` grün inklusive der neuen Prüfungen; `COVERED_USER_COLUMNS` enthält `import_quota_usage.user_id`.
- Eine Löschung erzeugt Tabellenzeile **und** `stdout`-Zeile mit identischem Hash, ohne Klartext-ID.
- Alte Funktionssignatur existiert nicht mehr (`\df private.delete_user_account` zeigt genau eine Variante).

## 5. Risiken
- **Kopierfehler im Funktionsrumpf** → Review-Regel und Smoke.
- **Signaturwechsel:** `DROP FUNCTION` und `CREATE` laufen in einer Migration (eine Transaktion); der Server-Aufrufer muss mit der Migration zusammen deployt werden. Weil Migration und Image getrennt ausgerollt werden, ist die Default-Parameter-Variante rückwärtskompatibel (alter Server ruft `(uuid)` auf und funktioniert weiter).
- **Pepper verloren:** Hashes sind dann für den Restore-Nachlauf nutzlos → Pepper offline sichern (Entscheidung 2).
- **Log-Retention bei Northflank unbekannt** → Entscheidung 3.

## 6. Entscheidungen für den Betreiber
| # | Frage | Empfehlung |
|---|---|---|
| 1 | Zwei-Spuren-Protokoll (Tabelle + `stdout`) statt nur Tabelle | **ja** (Korrektur 0) |
| 2 | Pepper `DELETION_LOG_PEPPER` als Northflank-Secret **und** offline neben dem `age`-Schlüssel ablegen | **ja** |
| 3 | Aufbewahrung der Northflank-Runtime-Logs ≥ 35 Tage prüfen (Dashboard) | Betreiber prüft; bei weniger → Logzeilen zusätzlich in R2 ablegen (Paket A) |
| 4 | Globaler Zähler als eigene Tabelle statt Sentinel | **ja** |
| 5 | Löschung ohne Pepper trotzdem zulassen | **ja** (Art. 17 geht vor) |
| 6 | DM-Entscheidungen 1 und 2 (Frist 12 Monate, Whitelist) | wie im DM-Plan empfohlen, vor L bestätigen, sonst L ohne DM-Teil (DM-1 fasst die Funktion dann ein zweites Mal an) |

**Aufwand:** M.
