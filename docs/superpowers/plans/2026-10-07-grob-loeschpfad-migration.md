# Grobplan: Gemeinsame Loeschpfad-Migration (Paket L — Buendel aus A, B, DM-1)

> **Status: GROBPLAN — muss vor der Umsetzung ausgearbeitet werden** (genaue Migration, Smoke-Erweiterung, Reihenfolge der Folge-PRs). Kein Code, bevor die Entscheidungen der Quellpakete feststehen und dieser Plan freigegeben ist.

Stand: 2026-10-07. Bezug: [TODO.md](../../../TODO.md) → „Vor dem oeffentlichen Start"; Quellpakete: [Vor-Start-Plan](2026-10-07-vor-start-backups-kostenschutz-recht-plan.md) Abschnitt **A** Schritt 3 (Loesch-Protokoll) und Abschnitt **B** Schritt 1 (`import_quota_usage`), [Detailplan DM](2026-10-07-paket-dm-datenminimierung-detailplan.md) **DM-1** Schritt 1 (Fehlerberichte anonymisieren).

## Warum buendeln
Drei Pakete aendern dieselbe Stelle: `private.delete_user_account` (Migration `20261007120000`) und den Account-Deletion-Smoke (`scripts/supabase/account-deletion-smoke.ts`, `COVERED_USER_COLUMNS`). Jede Aenderung muss die **gesamte** Funktion per `CREATE OR REPLACE` neu schreiben (inkl. `SECURITY DEFINER` und `SET search_path`, Lehre aus `20260927140000`). Drei PRs hintereinander hiessen drei Neufassungen derselben Funktion, drei Smoke-Erweiterungen und drei Gelegenheiten fuer Kopierfehler. Ein PR = eine Neufassung, ein Review-Diff gegen `20261007120000`.

## Inhalt des Buendel-PRs (nur Schema + Loeschpfad + Smoke)
1. **Eine Migration** (Name z. B. `<ts>_deletion_path_bundle.sql`):
   - **aus A:** Tabelle `private.deleted_accounts_log(user_hash text, deleted_at timestamptz)` (gehashte ID, keine Klartext-UUID; Frist 35 Tage wie die Backups). `delete_user_account` schreibt eine Zeile.
   - **aus B:** Tabelle `import_quota_usage(user_id uuid, day date, count int, PK(user_id, day))`, RLS an ohne Policies; Zeilen des Nutzers in `delete_user_account` loeschen (oder FK `ON DELETE CASCADE` auf `auth.users`).
   - **aus DM-1:** Spalte `bug_reports.anonymised_at`, Funktion `private.anonymise_bug_report_metadata(jsonb)`, Bug-Report-Block der Loeschfunktion mit Whitelist-Anonymisierung; einmalige Nachbereinigung bereits anonymisierter Berichte.
   - `delete_user_account` **einmal** neu, mit allen drei Aenderungen.
2. **`src/schema.ts`** fuer die neuen Tabellen/Spalten.
3. **Smoke:** `user_id` aus `import_quota_usage` in `COVERED_USER_COLUMNS`; Seed fuer Quota-Zeile, Bericht mit vollem `metadata_json`, Pruefung Log-Eintrag (Hash, kein Klartext), Whitelist-Metadaten, `anonymised_at`.
4. RLS-no-policy-Klassifizierung um die neuen Tabellen ergaenzen.

## Was ausdruecklich **nicht** in den Buendel-PR gehoert (bleibt in den Quellpaketen)
- **A:** Backup-Job auf Northflank, R2, Runbook, Restore-Test, Loeschung alter Log-Zeilen (>35 Tage, im Cleanup-Timer).
- **B:** `consumeImportQuota`, Config-Knobs, `429`-Pfad in `extraction.ts`, Mobile-Meldung.
- **DM-1:** Retention-Timer, Admin-`DELETE`, Entfernen von `activeHouseholdId` im Client, DM-1b (abgelaufene Einladungen).

Die Folge-PRs setzen nur noch Code auf das fertige Schema; keiner fasst die Loeschfunktion erneut an.

## Gemeinsamer Aufraeum-Timer (zweite Buendelung, 2026-10-07)
Vier Pakete brauchen eine taegliche Loeschung alter Zeilen: Loesch-Protokoll aelter als 35 Tage (A), alte Quota-Tage (B), Fehlerberichte nach Frist (DM-1), abgelaufene Einladungen (DM-1b). Statt vier Timern **ein** Modul `src/retention.ts` mit einem taeglichen Lauf und einer Liste von Aufraeum-Schritten (Muster `startJobCleanupTimer`). Der erste Folge-PR nach L (voraussichtlich DM-1) legt es an; A und B haengen nur ihren Schritt an.

## Reihenfolge
Paket L → danach A, B und DM-1 in beliebiger Reihenfolge (parallel moeglich). DM-2/DM-3 (Bilder) haengen nicht an L: `private.recipe_images` kaskadiert ueber `recipes`, die Loeschfunktion bleibt unberuehrt.

## Vorbedingungen (Entscheidungen)
- A: Hash-Verfahren fuer das Loesch-Protokoll (z. B. SHA-256 mit Pepper aus einem Secret, damit der Hash nicht per Wortliste umkehrbar ist) — im Detailplan festlegen.
- B: Entscheidungen bereits getroffen (15/Tag pro Nutzer, 300/Tag global).
- DM-1: **DM-Entscheidungen 1 und 2** (Loeschfrist, Whitelist vs. ganz loeschen) muessen feststehen.

## Risiken
- Groesserer Review-Diff in einer Migration → Review gezielt gegen `20261007120000` diffen, Smoke deckt alle Tabellen ab.
- Blockiert, solange eine der drei Entscheidungen offen ist → falls DM-Entscheidungen lange offen bleiben, kann L ohne den DM-Teil starten; DM-1 bringt die Loeschfunktion dann ein zweites Mal (bewusst in Kauf genommen).

## Offene Fragen (fuer den Detailplan)
- Pepper/Hash fuer das Loesch-Protokoll und wie der Restore-Nachlauf die Hashes gegen die wiederhergestellten Nutzer abgleicht.
- Globaler Import-Zaehler: Sentinel-Zeile in `import_quota_usage` oder eigene Tabelle (Sentinel waere eine Pseudo-`user_id` — mit dem Smoke abstimmen).
