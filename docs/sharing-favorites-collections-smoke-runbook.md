# Sharing / Favorites / Collections — Smoke Runbook

Stand: 2026-07-05

## Ziel

Dieses Runbook beschreibt die minimalen manuellen Web-/PWA-Smoke-Pfade fuer den
Sharing/Favorites/Collections-Slice. Die dokumentierte Abnahme wurde vor dem
Merge von PR #28 mit laufendem Server und lokaler DB ausgefuehrt.

Die automatisierten Unit-/Typecheck-Gates (tsc, Vitest root, mobile:typecheck,
test:mobile, rntl-guard) sind auf dem Branch gruen. Die DB-gestuetzten
Integrationstests (`Collections / Favorites / Sharing (DB)` in
`test/unit/collections-sharing.test.ts`) liefen am 2026-07-05 gegen den lokalen
Supabase-Stack vollstaendig gruen (`31/31`). Der finale PR-CI-Lauf
`28754213487` auf Head `09fddb2` war ebenfalls mit allen verpflichtenden Jobs
gruen; PR #28 wurde danach als Merge-Commit `3287de3` nach `main` gemergt.

Die Repo-Doku speichert keine Zugangsdaten. Wiederverwendbare QA-Accounts duerfen
in Supabase bestehen bleiben; Passwort/Secrets gehoeren nicht in Git.

## Voraussetzungen

- Production-Web-App (nach Merge/Deploy):
  `https://p01--rezepti-app--2s7hvlwm5zc5.code.run`
  oder lokaler Server (`npm run dev`) fuer Pre-Merge-Smoke
- Repo-`.env` enthaelt funktionierende Werte fuer `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `DATABASE_URL`
- Zwei Supabase-Auth-Accounts: ein User ohne Household-Mitgliedschaft fuer den
  privaten Scope, und ein User der Mitglied eines gemeinsamen Haushalts ist
  (oder ein einzelner User mit aktivem Household — reicht fuer Basispfade)

## API-Sanity (optional vor Browser-Smoke)

Access-Token ueber Supabase Password Grant holen:

```bash
TOKEN=$(/usr/bin/curl -sS "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASSWORD\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s); process.stdout.write(j.access_token||'')})")
```

Favoriten-Toggle-Check:

```bash
# Favorit setzen
/usr/bin/curl -sS -X POST "$BASE_URL/api/v1/recipes/$RECIPE_ID/favorite" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Favorit entfernen
/usr/bin/curl -sS -X DELETE "$BASE_URL/api/v1/recipes/$RECIPE_ID/favorite" \
  -H "Authorization: Bearer $TOKEN"
```

Collections-Check:

```bash
# Alle Collections abrufen
/usr/bin/curl -sS "$BASE_URL/api/v1/recipe-collections" \
  -H "Authorization: Bearer $TOKEN"

# Neue private Collection anlegen
/usr/bin/curl -sS -X POST "$BASE_URL/api/v1/recipe-collections" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Testsammlung","scope":"private"}'

# Rezepte einer Collection abrufen (Read-back-Loop)
/usr/bin/curl -sS "$BASE_URL/api/v1/recipe-collections/$COLLECTION_ID/items" \
  -H "Authorization: Bearer $TOKEN"

# Rezept aus einer Collection entfernen
/usr/bin/curl -sS -X DELETE \
  "$BASE_URL/api/v1/recipe-collections/$COLLECTION_ID/items/$RECIPE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

Share-Check (privates Rezept in Haushalt kopieren):

```bash
/usr/bin/curl -sS -X POST "$BASE_URL/api/v1/recipes/$RECIPE_ID/share" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetScope":"household"}'
```

Recipe-Invite-/Household-Collection-Staging-Smoke:

```bash
npx tsx scripts/supabase/staging-recipe-invite-smoke.ts
```

Production-Smoke nach Deploy:

```bash
RECIPE_INVITE_SMOKE_TARGET=production \
RECIPE_INVITE_SMOKE_CONFIRM=rezepti-production \
npx tsx scripts/supabase/staging-recipe-invite-smoke.ts
```

Voraussetzungen fuer den Staging-Smoke:

- Repo-`.env` enthaelt `STAGING_SUPABASE_URL`,
  `STAGING_SUPABASE_PUBLISHABLE_KEY`, `STAGING_SUPABASE_SECRET_KEY` und
  `STAGING_DATABASE_URL`.
- Staging ist bis zur aktuellen Migration migriert.
- Das Skript nutzt die lokale API-Implementierung gegen Staging, erzeugt eigene
  temporaere Auth-User/Profile/Rezepte/Collections/Invites und raeumt diese am
  Ende wieder auf.
- Fuer Production liest das Skript bevorzugt `PRODUCTION_*`-Variablen und faellt
  auf `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` bzw.
  `DATABASE_URL` zurueck. Der Production-Lauf trifft standardmaessig die
  deployte API `https://p01--rezepti-app--2s7hvlwm5zc5.code.run`; abweichende
  Ziele koennen per `RECIPE_INVITE_SMOKE_API_BASE_URL` gesetzt werden.
- Production laeuft nur mit explizitem
  `RECIPE_INVITE_SMOKE_CONFIRM=rezepti-production`.

Gepruefte Feature-Vertraege:

- Privates Rezept wird beim Hinzufuegen zu einer Haushalts-Collection als
  Haushaltskopie angelegt.
- Email-gebundener Invite ist als Preview abrufbar.
- Falscher eingeloggter Account kann den Invite nicht annehmen.
- Empfaenger akzeptiert den Invite als private Rezeptkopie.
- Wiederholtes Accept ist idempotent.

## Manuelle Browser-Smoke-Pfade

Die folgenden sechs Pfade muessen manuell in der Web-App oder PWA abgenommen werden.

### Pfad 1 — Favorit an/aus (Liste und Detail spiegeln ohne Reload)

1. Login als QA-User.
2. Ein privates Rezept in der Rezeptliste aufrufen.
3. Im Detail-Screen auf den Favorit-Toggle tippen → Herz-Icon faerbt sich.
4. Zur Rezeptliste zuruecknavigieren → das Rezept zeigt das Favorit-Badge ohne
   App-Neustart.
5. Erneut in das Detail navigieren → Favorit-Toggle zeigt weiterhin den aktiven
   Zustand.
6. Favorit deaktivieren → Badge in Liste verschwindet ohne Reload.

Erwartetes Ergebnis: Toggle reagiert sofort; Liste und Detail sind konsistent ohne
expliziten Reload.

### Pfad 2 — Collection anlegen, Rezept hinzufuegen, oeffnen und entfernen

1. Zum Collections-Screen navigieren (Tab oder Navigation).
2. Neue private Collection mit einem Testnamen anlegen.
3. Ein privates Rezept aufrufen und ueber den `Zur Collection hinzufuegen`-CTA
   in die neue Collection eintragen. (Hinweis: die System-Collection `Favoriten`
   erscheint NICHT in der Auswahl — Favoriten werden ueber das Herz verwaltet.)
4. Im Collections-Screen die Collection-Zeile **antippen** → die
   Collection-Inhaltsansicht oeffnet sich und das Rezept ist aufgelistet.
5. Im aufgelisteten Rezept auf die Zeile tippen → das Rezept-Detail oeffnet sich.
6. Zurueck zur Collection-Inhaltsansicht, beim Rezept auf `Entfernen` tippen und
   im Bestaetigungsdialog bestaetigen → das Rezept verschwindet sofort aus der
   Liste (ohne Reload), und der `item_count` im Collections-Screen sinkt.

Erwartetes Ergebnis: Collection wird angelegt, das Rezept erscheint nach dem
Hinzufuegen in der Inhaltsansicht, ist von dort aus aufrufbar und kann direkt aus
der App wieder entfernt werden.

### Pfad 3 — Privates Rezept in Haushalt kopieren

Voraussetzung: QA-User hat ein aktives Household.

1. Ein privates Rezept aufrufen (Scope-Badge zeigt `Privat`).
2. Den `In Haushalt kopieren`-CTA ausloesen.
3. Im Haushaltskontext (gleicher oder anderer Haushaltsmember) das Rezept in der
   Rezeptliste suchen → es ist sichtbar mit Scope-Badge `Haushalt`.
4. Die Kopie hat eine eigene ID; das Original bleibt privat erhalten.

Erwartetes Ergebnis: Haushaltsrezept ist neu angelegt mit `source_recipe_id` auf
das Original; das Original ist unveraendert.

### Pfad 4 — Haushaltsrezept als private Kopie sichern

Voraussetzung: QA-User ist Mitglied eines Haushalts mit mindestens einem
Haushaltsrezept.

1. Ein Haushaltsrezept aufrufen (Scope-Badge zeigt `Haushalt`).
2. Den `Private Kopie erstellen`-CTA ausloesen.
3. Zur Rezeptliste des Callers zurueck → das neue private Rezept ist sichtbar mit
   Scope-Badge `Privat`.

Erwartetes Ergebnis: Private Kopie ist angelegt; das Haushaltsrezept bleibt
unveraendert.

### Pfad 5 — Favoritenfilter spiegelt den Toggle ohne App-Neustart

1. Favorit-Toggle an Rezept A aktivieren (Pfad 1).
2. In der Rezeptliste den Favoritenfilter aktivieren.
3. Nur Rezept A (und ggf. weitere fruehier als Favorit markierte Rezepte) ist
   sichtbar.
4. Favoritenfilter wieder deaktivieren → volle Liste ist sichtbar.
5. Favorit an Rezept A deaktivieren → Favoritenfilter zeigt Rezept A nicht mehr.

Erwartetes Ergebnis: Filter und Liste reflektieren den Toggle-Status ohne
App-Neustart.

### Pfad 6 — PWA Cache-Verhalten nach Share/Favorite (kurze Pruefung)

1. App als PWA installiert oder Browser-Tab geoeffnet.
2. Favorit-Toggle und/oder Share ausfuehren (Pfad 1 oder 3).
3. Browserfenster oder PWA kurz schliessen und wieder oeffnen.
4. Den betroffenen Rezept-Detail-Screen aufrufen → Scope-Badge und Favorit-Status
   sind korrekt (Cache-Invalidierung hat funktioniert).
5. In der Rezeptliste den Favoritenfilter aktivieren → korrekte Resultate.

Erwartetes Ergebnis: Nach Share/Favorite-Operationen zeigt auch der naechste
PWA-Start die aktuellen Daten; kein veralteter Cache-Zustand bleibt sichtbar.

## CI-/Merge-Nachweis

- Der finale Branch-Lauf `28754213487` schloss `test`, `e2e`,
  `supabase-rls-smoke`, `mobile-release-gate` und `performance-audit` gruen ab.
- PR #28 wurde am 2026-07-05 nach `main` gemergt (`3287de3`).
- Der nachgelagerte Production-Migrationsworkflow bleibt separat zu wiederholen,
  weil das Supabase-Projekt beim ersten Post-Merge-Lauf pausiert war.

## Befunde und Nachweise

Nach Durchfuehren der obigen Pfade hier eintragen (Datum, Umgebung, Ergebnis,
Abweichungen):

| Datum | Pfad | Umgebung | Ergebnis | Anmerkungen |
|-------|------|----------|----------|-------------|
| 2026-07-05 | 1 | Lokal, Web/PWA, lokaler Supabase-Stack | Bestanden | Toggle im Detail, Liste und erneuter Detailaufruf konsistent; Entfernen ohne Reload verifiziert. |
| 2026-07-05 | 2 | Lokal, Web/PWA, lokaler Supabase-Stack | Bestanden | Private Collection erstellt, Rezept hinzugefuegt, Inhalt geoeffnet und nach Bestaetigung entfernt; DB-Read-back `0` Items. |
| 2026-07-05 | 3 | Lokal, Web/PWA, lokaler Supabase-Stack | Bestanden | Private Quelle `37` als Haushaltskopie `39` angelegt; Original blieb privat. |
| 2026-07-05 | 4 | Lokal, Web/PWA, lokaler Supabase-Stack | Bestanden | Haushaltskopie `39` als neue private Kopie angelegt; Liste stieg auf vier sichtbare Rezepte. |
| 2026-07-05 | 5 | Lokal, Web/PWA, lokaler Supabase-Stack | Bestanden | Filter zeigte nur den Favoriten; nach Entfernen blieb der aktive Filter bedienbar und zeigte keinen stale Eintrag. |
| 2026-07-05 | 6 | Lokal, kontrollierter Service Worker, lokaler Supabase-Stack | Bestanden | `sw.js` kontrollierte den Client, `rd-user-<sha256>` wurde genutzt; Status blieb nach Mutation, Cache-Aktualisierung und Reload korrekt. |
| 2026-07-07 | API-Sanity | Production Web + Supabase Production | Bestanden | Nach Reaktivierung von Supabase lief `Apply Supabase Migrations` Run `28863540200` gruen; angewendet wurden `20260623100000_recipe_collections.sql`, `20260623100100_recipe_collection_items.sql` und `20260623100200_recipes_source_recipe_id.sql`. API-Smoke mit QA-User: `auth/me`, `auth/bootstrap`, `GET /api/v1/recipes`, Collection Create/Add/Read/Remove/Delete fuer Rezept `5`, plus Favorite Set/Read/Delete/Read fuer Rezept `5` bestanden. |
| 2026-07-08 | Recipe-Invite-/Household-Collection-Smoke | Staging Supabase + lokale API-Implementierung | Bestanden | Staging-Migrationen bis `20260707141913_recipe_share_invites.sql` angewendet und Local/Remote synchron; `supabase:rls-smoke:staging` gruen; Security Advisors ohne Findings; `scripts/supabase/staging-recipe-invite-smoke.ts` gruen fuer Haushaltskopie beim Collection-Add, email-gebundene Invite-Preview, falscher Account `403`, Empfaenger-Private-Copy und idempotentes Re-Accept. |
| 2026-07-08 | Recipe-Invite-/Household-Collection-Smoke | Production Web + Supabase Production | Bestanden | Migration `20260707141913_recipe_share_invites.sql` ueber Run `28913601218` angewendet; korrigierter CI-Run `28913803470` gruen; Docker-/Northflank-Runs `28913803496` und `28913812673` gruen inklusive Health-Poll; Production-Smoke mit `RECIPE_INVITE_SMOKE_TARGET=production` bestaetigte Haushaltskopie beim Collection-Add, email-gebundene Invite-Preview, falscher Account `403`, Empfaenger-Private-Copy und idempotentes Re-Accept. Cleanup: `profiles=0`, `recipes=0`, `invites=0`. |

Hinweis: Der Pre-Merge-Smoke war bewusst vollstaendig lokal isoliert. Der
dokumentierte Production-QA-Account und Production-Daten wurden nicht veraendert.
