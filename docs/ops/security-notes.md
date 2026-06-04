# Security Notes

Stand: 2026-06-04

## Supabase Postgres Password Exposure

`scripts/get-db-urls.ts` enthielt bis zur Remediation eine hardcodierte Supabase-Postgres-URL mit Passwort. Der Wert wurde in Commit `997e231` eingefuehrt und muss als exponiert behandelt werden, falls der Commit jemals gepusht, geteilt oder in Backups kopiert wurde.

Repo-seitig erledigt:

- `scripts/get-db-urls.ts` liest nur noch `RECIPE_SOURCE_AUDIT_DATABASE_URL` oder `DATABASE_URL`.
- `.env.example` dokumentiert die optionale Script-Variable nur mit Platzhalterwerten.
- `scripts/security/secret-scan.mjs` blockiert hardcodierte Postgres-URLs und typische API-Key-Formate.
- `scripts/hooks/pre-commit` fuehrt den Secret-Scan vor dem bestehenden Phantom-Submodule-Check aus.

Noch manuell erforderlich:

1. Supabase-Datenbankpasswort fuer das betroffene Projekt rotieren.
2. Alle Umgebungen aktualisieren, die das alte Passwort nutzen: lokale `.env`, Northflank/Deploy-Secrets, CI-Secrets und Staging-/Ops-Konfiguration.
3. Supabase/Postgres-Logs fuer den Zeitraum seit Commit `997e231` auf unbekannte Clients oder ungewoehnliche Aktivitaet pruefen.
4. Wenn die Historie geteilt wurde, Git-Historie mit `git filter-repo` oder BFG bereinigen und den Force-Push mit allen Worktrees/Clones koordinieren.

Wichtig: Das Entfernen aus `HEAD` rotiert den Credential nicht. Bis zur Rotation bleibt der alte Wert als kompromittiert zu betrachten.
