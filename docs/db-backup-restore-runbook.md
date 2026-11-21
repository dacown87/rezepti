# DB-Backup- und Restore-Runbook

Stand: 2026-10-25. Bezug: `.github/workflows/db-backup.yml`, Paket A (Vor-Start-Plan).

Taeglich um ~03:30 UTC wird ein `age`-verschluesseltes logisches Backup der
Production-DB (Schemas `public`, `private`, `auth`) nach Cloudflare R2 gelegt.
Der Private Key liegt **nur offline** beim Betreiber — ein Dump mit
personenbezogenen Daten verlaesst den GitHub-Runner ausschliesslich
verschluesselt.

## Secrets (GitHub)

| Secret | Inhalt |
|---|---|
| `BACKUP_DATABASE_URL` | Session-Pooler-URL (IPv4) der Production-DB, idealerweise mit eigener read-only Rolle statt `postgres` |
| `AGE_RECIPIENT` | `age`-Public-Key (Empfaenger) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2-API-Token, nur fuer den Backup-Bucket |
| `R2_ENDPOINT` | z. B. `https://<account>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Bucket-Name (EU-Jurisdiktion) |

## R2-Bucket und Rotation

- Objekte unter `daily/` nach **14 Tagen** loeschen (Lifecycle-Regel).
- Objekte unter `weekly/` und `deletion-log/` nach **35 Tagen** loeschen
  (Hoechstfrist 35 Tage, so auch in der Datenschutzerklaerung).
- Am Sonntag wird zusaetzlich eine Kopie nach `weekly/` gelegt (14 taegliche +
  4 woechentliche).

## `age`-Schluesselpaar erzeugen (offline)

```bash
age-keygen -o key.txt
# Public Key: age1...
```

Public Key als `AGE_RECIPIENT` ablegen; `key.txt` offline sichern (neben
`DELETION_LOG_PEPPER`). Ohne den Private Key ist kein Restore moeglich.

## Restore auf Staging (nie direkt Production)

1. Dump aus R2 laden:
   ```bash
   aws s3 cp "s3://<bucket>/daily/rezepti-<datum>.dump.age" . --endpoint-url "$R2_ENDPOINT"
   ```
2. Entschluesseln:
   ```bash
   age -d -i key.txt -o rezepti-<datum>.dump rezepti-<datum>.dump.age
   ```
3. Zurueckspielen in **drei Schritten** (ein einzelner `pg_restore` scheitert, siehe
   unten). Alle Schritte mit `--single-transaction --exit-on-error`: bei einem Fehler
   wird zurueckgerollt und Staging bleibt unveraendert.

   a) **`auth` nur Daten**, in Abhaengigkeitsreihenfolge (Tabellen im Schema `auth`
      gehoeren `supabase_auth_admin`, `--clean` scheitert dort mit `must be owner`).
      `schema_migrations` nicht zurueckspielen:
   ```bash
   : > auth.list
   for t in users identities sessions refresh_tokens mfa_amr_claims; do
     pg_restore -l rezepti-<datum>.dump | grep -E "TABLE DATA auth $t " >> auth.list
   done
   pg_restore -L auth.list --data-only --single-transaction --exit-on-error \
     -d "$STAGING_DATABASE_URL" rezepti-<datum>.dump
   ```
   b) **`public` und `private`** mit Rechten, aber ohne `DEFAULT ACL`-Eintraege (die
      gehoeren `supabase_admin`, `postgres` darf sie nicht setzen; sie sind
      Supabase-Standard):
   ```bash
   pg_restore -l rezepti-<datum>.dump | grep -v "DEFAULT ACL" > full.list
   pg_restore -L full.list --clean --if-exists --no-owner --single-transaction \
     --exit-on-error -n public -n private -d "$STAGING_DATABASE_URL" rezepti-<datum>.dump
   ```
   c) **Rechte exakt wie in Production herstellen.** Der Dump enthaelt nur vergebene
      Rechte, nicht entzogene; neu angelegte Tabellen bekommen die Supabase-Standardrechte
      (`ALL` fuer `anon`/`authenticated`) zurueck, die die Migrationen in Production
      entzogen haben. Deshalb erst alles entziehen, dann die Rechte aus dem Dump einspielen:
   ```bash
   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
   begin;
   revoke all on all tables    in schema public, private from anon, authenticated;
   revoke all on all sequences in schema public, private from anon, authenticated;
   revoke all on all functions in schema public, private from anon, authenticated;
   commit;
   SQL
   pg_restore -l rezepti-<datum>.dump | grep -E " ACL (public|private) " \
     | grep -v "DEFAULT ACL" > acl.list
   pg_restore -L acl.list --single-transaction --exit-on-error \
     -d "$STAGING_DATABASE_URL" rezepti-<datum>.dump
   ```
   Achtung: Zwischen dem `revoke` und dem Ende von `acl.list` hat `anon`/`authenticated`
   keine Rechte (bei Staging egal, bei einem echten Notfall-Restore die App erst danach
   freigeben).
4. Pruefen: Zeilenzahlen (`auth.users`, `recipes`, `households`) gegen Production
   vergleichen, `has_function_privilege('anon','private.delete_user_account(uuid,text)','EXECUTE')`
   muss `false` sein, Tabellen-Grants fuer `anon`/`authenticated`/`service_role` per
   `information_schema.role_table_grants` gegen Production diffen. Danach
   `/api/v1/health`, Login mit Testkonto.
5. **Danach die zurueckgespielten Nutzer in Staging loeschen** (der Dump enthaelt echte
   Production-Daten).

Ohne `aws`-CLI geht der Download auch mit `curl` (signiert selbst):
`curl -f --aws-sigv4 "aws:amz:auto:s3" --user "$KEY_ID:$SECRET" -o rezepti.dump.age "$R2_ENDPOINT/<bucket>/daily/rezepti-<datum>.dump.age"`.

## Loesch-Nachlauf nach Restore (Pflicht)

Das Restore setzt auch `private.deleted_accounts_log` auf den Backup-Stand
zurueck. Konten, die **nach** dem Backup-Zeitpunkt geloescht wurden, muessen
erneut geloescht werden. Dafuer die `deletion-log-<datum>.csv.age` aus R2
entschluesseln und alle Eintraege ab dem Backup-Zeitpunkt abarbeiten:

```bash
age -d -i key.txt -o deletion-log.csv deletion-log-<datum>.csv.age
# Spalten: user_hash, deleted_at
```

Fuer jeden Eintrag: Hash pruefen (HMAC-SHA256(user_id, `DELETION_LOG_PEPPER`),
hex) und die zugehoerige User-ID loeschen. Der Hash ist absichtlich
pseudonym — die Zuordnung erfolgt ueber den HMAC des zu loeschenden Kontos,
nicht ueber eine Klartext-ID.

## Restore-Test-Protokoll

- [x] Realer Restore gegen `rezepti-staging` durchgefuehrt am: **2026-11-21** (Dump
      `daily/rezepti-2026-11-21.dump.age`, mit dem Schluessel aus der Offline-Sicherung
      entschluesselt, Schluessel passte zu `AGE_RECIPIENT`)
- [x] Zeilenzahlen gleich wie Production: Nutzer 4, Rezepte 6, Haushalte 4,
      Mitgliedschaften 4, Sammlungen 1, Bug-Reports 2; Policies 16, RLS-Tabellen 66;
      Tabellen-Grants fuer `anon`/`authenticated`/`service_role` identisch (179/179 Zeilen);
      `delete_user_account` fuer `anon`/`authenticated` gesperrt
- [x] `auth`-Restore: funktioniert nur als getrennter Daten-Restore (Schritt 3a), nicht
      per `--clean`
- [ ] `/api/v1/health` und Login mit Testkonto gegen Staging (Staging wurde nicht als App
      gestartet; nachholen oder beim Browser-Loeschtest mit abdecken)

**Befunde aus dem Restore-Test 2026-11-21:**
1. `--no-privileges` im Backup verlor alle `REVOKE` der Migrationen (nach Restore konnte
   `anon` `private.delete_user_account` ausfuehren, 462 statt 392 Tabellen-Grants). Der
   Backup-Workflow dumpt jetzt mit Rechten; der Restore braucht trotzdem Schritt 3c.
2. Ein einzelner `pg_restore` ueber alle drei Schemas scheitert an `auth`
   (`must be owner of table`) und an `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`.
