# Credential Hotfix Rollout Checklist

Datum: 2026-06-15
Status: Erledigt
Bezug: PR #7 ist auf `main` gemerged; offen sind nur noch Production-Rollout und Verifikation.

## Ziel

Den bereits gemergten Credential-Auth-Hotfix in Production vollstaendig abschliessen und danach die `TODO.md` auf erledigt ziehen.

## Aktueller technischer Stand

- Merge bereits erfolgt: `69d9905` (`Merge pull request #7 ... credential auth hotfix`)
- Repo-Migration vorhanden: [supabase/migrations/20260609143000_drop_api_keys_table.sql](/home/patrick/Projekte/rezepti/supabase/migrations/20260609143000_drop_api_keys_table.sql)
- Lokale Doku/Testlage nachgezogen; kein weiterer Hotfix-Code offen

## Checkliste

### 1. Prod-Migration anwenden

Im Supabase Dashboard im SQL Editor ausfuehren:

```sql
DROP TABLE IF EXISTS api_keys;
```

Erwartung:
- Statement laeuft erfolgreich durch
- `api_keys` existiert danach in Production nicht mehr

Nachweis:
- SQL-Editor-Ausfuehrung dokumentieren
- Optional Screenshot oder kurzer Notiz-Eintrag in `TODO.md` / Betriebsdoku

### 2. Prod-Smoke fahren

Minimaler Pflicht-Smoke:

1. `GET /api/v1/cookidoo/status` ohne Bearer-Token -> `401`
2. Eingeloggt im Web: Reload -> Session bleibt erhalten
3. Neuer Tab gleicher Browser -> Session bleibt erhalten
4. Neue Private-/InPrivate-Session -> kein uebernommener Login

Optionaler Zusatzcheck:

1. `POST /api/v1/keys/validate` ohne Bearer-Token -> `401`
2. `POST /api/v1/cookidoo/credentials` ohne Bearer-Token -> `401`

## Abschlussbedingung

Der Punkt ist erst erledigt, wenn beides dokumentiert ist:

- Prod-Migration ausgefuehrt
- Prod-Smoke bestanden

Danach:

- `TODO.md` Punkt `0` auf erledigt bzw. in den Nachweisblock verschieben
- Watchlist-Eintrag `Credential-Hotfix-Rest vor/nach Merge` entfernen

## Nachweisprotokoll

### Production-Migration

- Datum: 2026-06-15
- Ausgefuehrt von: Patrick
- Umgebung: Supabase Production
- SQL:

```sql
DROP TABLE IF EXISTS api_keys;
```

- Ergebnis: PASS — `Success. No rows returned`
- Zusatznotiz: `api_keys`-Drop im Production-SQL-Editor erfolgreich ausgefuehrt.

### Production-Smoke

- Datum: 2026-06-15
- Ausgefuehrt von: Patrick + Codex
- Umgebung: Production Web (`https://p01--rezepti-app--2s7hvlwm5zc5.code.run`)

| Check | Erwartung | Ergebnis | Notiz |
|---|---|---|---|
| `GET /api/v1/cookidoo/status` ohne Bearer | `401` | PASS | `curl -i` gegen Production; Response `401 auth_missing` |
| Web-Reload im eingeloggten Zustand | Session bleibt aktiv | PASS | vom Nutzer im normalen Browser bestaetigt |
| Neuer Tab gleicher Browser | Session bleibt aktiv | PASS | vom Nutzer im normalen Browser bestaetigt |
| Neue Private-/InPrivate-Session | keine uebernommene Session | PASS | vom Nutzer im privaten Browserfenster bestaetigt |
| `POST /api/v1/keys/validate` ohne Bearer | `401` | PASS | `curl -i -X POST` gegen Production; Response `401 auth_missing` |
| `POST /api/v1/cookidoo/credentials` ohne Bearer | `401` | PASS | `curl -i -X POST` gegen Production; Response `401 auth_missing` |

### Abschlussentscheidung

- Gesamtstatus: PASS
- `TODO.md` aktualisiert: ja
- Offene Restpunkte: keine fuer den Credential-Hotfix-Rollout
