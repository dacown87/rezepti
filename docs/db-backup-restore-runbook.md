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
3. Staging-DB leeren und zurueckspielen:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges -d "$STAGING_DATABASE_URL" rezepti-<datum>.dump
   ```
4. Smoke: `/api/v1/health`, Login mit Testkonto, Rezeptanzahl pruefen.

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

- [ ] Realer Restore gegen `rezepti-staging` durchgefuehrt am: `______`
- [ ] Smoke gruen (`/api/v1/health`, Login, Rezeptanzahl)
- [ ] `auth.users`-Restore funktioniert (Supabase-Rollen/Grants beachten; falls
      das scheitert, `auth.users` getrennt per `COPY` sichern)
