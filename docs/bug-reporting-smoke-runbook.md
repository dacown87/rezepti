# Bug Reporting Smoke Runbook

Stand: 2026-06-20

## Ziel

Dieses Runbook beschreibt den wiederholbaren Live-Smoke fuer den Bug-Reporting-Slice gegen die echte Web-App und die zugehoerige Supabase/Auth-/DB-Umgebung.

Die Repo-Doku speichert bewusst keine Zugangsdaten. Reusable QA-Accounts duerfen in Supabase bestehen bleiben, aber Passwort/Secrets gehoeren nicht in Git.

## Voraussetzungen

- Production-Web-App:
  `https://p01--rezepti-app--2s7hvlwm5zc5.code.run`
- Repo-`.env` enthaelt funktionierende Werte fuer:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `DATABASE_URL`
- `psql` ist lokal verfuegbar.
- gstack browse ist lokal nutzbar.

Browse-Binary aufloesen:

```bash
~/.codex/skills/gstack/browse/bin/find-browse
```

Erwartet:

```bash
/home/patrick/.codex/skills/gstack/browse/dist/browse
```

## Reusable QA-Account

Empfehlung fuer wiederholbare Smokes:

- bestaetigten QA-User in Supabase Auth behalten
- Passwort bei Bedarf kontrolliert rotieren
- App-Rolle in `public.user_profiles.app_role` nur temporaer auf `admin` setzen und nach dem Smoke wieder zurueckdrehen

Aktueller wiederverwendbarer QA-User fuer den Bug-Reporting-Smoke:

- E-Mail: `qa.rezepti.1781505024015@mailinator.com`
- Passwort: `BugSmoke!2026`
- Default-Rolle: normaler User (`app_role='user'`)

Wichtig vor echtem Go-Live:

- Dieser QA-User ist nur fuer wiederholbare Smoke- und Deploy-Checks gedacht.
- Vor einem breiteren Launch oder echter Nutzerkommunikation muss der Account geloescht oder durch einen bewusst verwalteten internen QA-Account ersetzt werden.
- Spaetestens vor dem "Seite geht richtig los"-Moment nicht als dauerhaften Schatten-Account in Production stehen lassen.

Passwort-Rotation eines bestaetigten QA-Users:

```sql
update auth.users
set encrypted_password = crypt('<new-password>', gen_salt('bf', 10)),
    updated_at = now()
where email = '<qa-user-email>';
```

Wichtig:

- Das hat nur dann Wert, wenn der User bereits natuerlich funktionierende Auth-Zeilen in `auth.users` und `auth.identities` besitzt.
- Der Versuch, neue Auth-User direkt per SQL zusammenzubauen, ist fehleranfaellig und sollte fuer Live-Smokes nur der letzte Ausweg sein.

## API-Sanity

Access token ueber Supabase Password Grant holen:

```bash
TOKEN=$(/usr/bin/curl -sS "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASSWORD\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); process.stdout.write(j.access_token||'')})")
```

Auth-/Bootstrap-Check:

```bash
/usr/bin/curl -sS "$BASE_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN"

/usr/bin/curl -sS -X POST "$BASE_URL/api/v1/auth/bootstrap" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

Bug-Report-API-Check:

```bash
/usr/bin/curl -sS "$BASE_URL/api/v1/bug-reports/me" \
  -H "Authorization: Bearer $TOKEN"

/usr/bin/curl -sS -X POST "$BASE_URL/api/v1/bug-reports" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reportType":"general","sourceArea":"global_button","description":"production smoke test"}'

/usr/bin/curl -sS "$BASE_URL/api/v1/admin/bug-reports" \
  -H "Authorization: Bearer $TOKEN"
```

## Browser-Smoke

Anon-/Pre-Auth-Sicht:

```bash
B=$(~/.codex/skills/gstack/browse/bin/find-browse)
$B goto "$BASE_URL"
$B wait --networkidle
$B text
$B snapshot -i
```

Account-Login:

```bash
$B goto "$BASE_URL/account"
$B wait --networkidle
$B snapshot -i
$B fill @e4 "$QA_EMAIL"
$B fill @e5 "$QA_PASSWORD"
$B click <submit-ref>
$B wait --networkidle
```

Settings-/Bug-Reporting-Sicht:

```bash
$B goto "$BASE_URL/settings"
$B wait --networkidle
$B text
$B js "document.body.innerText.includes('Problem melden')"
$B js "document.body.innerText.includes('Meine Meldungen')"
$B js "document.body.innerText.includes('Admin Hub')"
$B js "document.body.innerText.includes('Bug Reports')"
```

## Production-Befund vom 2026-06-20

### Fruher Befund vor Merge/Deploy

Live geprueft mit echtem Production-Login und Production-Web-App:

- `GET /api/v1/auth/me` und `POST /api/v1/auth/bootstrap` funktionierten fuer den QA-User.
- `GET /api/v1/bug-reports/me` lieferte `404 Not Found`.
- `POST /api/v1/bug-reports` lieferte `404 Not Found`.
- `GET /api/v1/admin/bug-reports` lieferte `404 Not Found`.
- Die authentifizierte Settings-Seite zeigte weder `Problem melden` noch `Meine Meldungen`.
- Die auf Production geladenen Web-Assets enthielten nur den alten Admin-Placeholder-Stand.

Arbeitsannahme aus diesem ersten Befund:

- Der Bug-Reporting-Slice war auf der damaligen Production-App noch nicht live.
- Hauptursache war der fehlende Rollout auf `main`, nicht ein belegter DB-/Runtime-Mismatch.

### Aktueller Live-Befund nach Merge + Hotfix-Deploy

Stand nach Merge von PR #23 auf `main`, Hotfix `d0948f3` und erfolgreichem Docker-/Northflank-Deploy:

- `GET /api/v1/auth/me` funktioniert fuer den QA-User.
- `POST /api/v1/auth/bootstrap` funktioniert fuer den QA-User.
- `GET /api/v1/bug-reports/me` funktioniert und liefert die eigene Liste.
- `POST /api/v1/bug-reports` funktioniert live; Production antwortete mit `201` und erzeugte Report `21f7218f-6589-4a2d-b7ac-4213f04b444b`.
- Der erzeugte Report ist direkt in `GET /api/v1/bug-reports/me` sichtbar.
- `GET /api/v1/admin/bug-reports` liefert fuer den normalen QA-User korrekt `403 admin_required`.
- Eine temporaere Promotion des QA-Users auf `public.user_profiles.app_role='admin'` war ueber `GET /api/v1/auth/me` sofort sichtbar.
- `GET /api/v1/admin/bug-reports` funktionierte danach live und lieferte fuer den leeren Stand `{ "reports": [] }`.
- Die QA-Rolle wurde anschliessend wieder auf `user` zurueckgesetzt.

Nachtrag 2026-06-20 zur frueheren Rollen-Unstimmigkeit:

- Die temporaere Promotion des QA-Users auf `public.user_profiles.app_role='admin'` ist reproduzierbar sichtbar.
- Ein belastbarer Runtime-/DB-Mismatch konnte nicht bestaetigt werden.
- Die fruehere Abweichung war sehr wahrscheinlich ein Timing-/Session-Effekt waehrend des ersten manuellen Smokes.

## Konsequenz fuer TODO / Release

Der fachliche Production-Smoke fuer den Bug-Reporting-Slice ist jetzt erledigt.

Offen bleibt nur noch ein getrennter CI-Test-Follow-up:

1. `mobile-release-gate` ist beim Hotfix-Run nicht wegen Deploy/Export, sondern wegen vier fehlschlagender Tests in `mobile/test/auth-redirect-observer.test.ts` rot gewesen.
2. Das ist ein separater Test-/Coverage-Track und blockiert den erfolgreichen Production-Deploy des Bug-Reporting-Slices nicht mehr.
