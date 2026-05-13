# Supabase Data API Readiness (2026-05-13)

## Kurzfazit

Dieses Repo ist **aktuell kaum betroffen** von der Supabase-Aenderung zu expliziten `GRANT`s fuer neue `public`-Tabellen.

Warum:

- Der produktive Datenzugriff laeuft heute ueber direkte Postgres-Verbindungen mit `DATABASE_URL` und Drizzle, nicht ueber `supabase-js`, `/rest/v1/` oder `/graphql/v1/`.
- Die `public`-Tabellen haben bereits RLS aktiviert und die direkten Grants fuer `anon` und `authenticated` wurden entzogen in [db/migrations/2026-05-12-enable-rls.sql](/home/patrick/Projekte/rezepti/db/migrations/2026-05-12-enable-rls.sql).
- Die aktuellen Supabase Advisor-Hinweise `rls_enabled_no_policy` sind daher fuer das heutige Setup erwartbar: RLS ist an, aber die Data API soll gerade **nicht** an diese Tabellen kommen.

Die Aenderung wird relevant, sobald dieses Projekt eine der folgenden Richtungen nimmt:

- neue Tabellen in `public`, die ueber die Data API erreichbar sein sollen
- Umstieg auf `supabase-js` / PostgREST / GraphQL fuer echte Client-Zugriffe
- Multi-User-Login mit `authenticated`-Client-Zugriff auf `recipes`, `shopping_list`, `meal_plan`

## Offizielle Quellen

- Supabase Changelog: <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>
- Supabase Discussion `#45329`: <https://github.com/orgs/supabase/discussions/45329>
- Supabase Data API docs: <https://supabase.com/docs/guides/database/data-api>
- Supabase API security docs: <https://supabase.com/docs/guides/api/securing-your-api>
- Supabase RLS docs: <https://supabase.com/docs/guides/database/postgres/row-level-security>

## Was sich fuer dieses Repo praktisch aendert

### Heute

- Bestehende Tabellen behalten ihre aktuellen Grants.
- Der Server kann weiter direkt per `DATABASE_URL` arbeiten.
- Neue `public`-Tabellen brechen **nicht** den aktuellen Serverpfad.

### Spaeter

Sobald neue `public`-Tabellen ueber die Data API lesbar oder schreibbar sein sollen, muss die Migration immer drei Dinge explizit enthalten:

1. `GRANT`s pro Rolle
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. passende Policies

Faustregel fuer dieses Repo:

- **Server-only Tabelle**: kein Data-API-Grants, am besten gleich in ein privates Schema statt `public`
- **Client-/Data-API-Tabelle**: immer `GRANT + RLS + Policies` im selben Migrationsschritt

## Arbeitsregeln fuer neue Tabellen

### Fall A: Tabelle ist nur fuer den Server da

Empfehlung:

- nicht in `public`, sondern in einem privaten Schema anlegen
- wenn `public` unvermeidbar ist: **keine** `anon`-/`authenticated`-Grants setzen

Beispiele in diesem Repo:

- `api_keys`
- wahrscheinlich auch `ingredient_dictionary`, solange nur der Backend-Server darauf zugreift

### Fall B: Tabelle soll ueber die Data API erreichbar sein

Dann gilt:

- Tabelle in `public` nur mit expliziten Grants
- `authenticated` nur die minimal noetigen Rechte geben
- `anon` nur wenn wirklich oeffentliche Lesezugriffe gewollt sind
- `service_role` nur wenn ein realer Service-Key-Workflow existiert
- bei `serial` / `identity` IDs die Sequence-Grants nicht vergessen, wenn Inserts ueber die Data API laufen sollen

## Reusable SQL template

Siehe die wiederverwendbare Vorlage in [db/templates/public-table-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-table-data-api-rls.sql).

## Policy-Matrix fuer die spaetere Multi-User-Phase

### `public.recipes`

Empfehlung:

- `SELECT` fuer `authenticated` auf eigene Rezepte plus globale Default-Rezepte
- `INSERT` nur fuer eigene Rezepte
- `UPDATE` / `DELETE` nur fuer eigene Rezepte

RLS-Idee:

```sql
using (user_id = auth.uid() or user_id is null)
with check (user_id = auth.uid())
```

Hinweis:

- Falls globale Rezepte spaeter verschwinden sollen, `OR user_id IS NULL` wieder entfernen.
- Wenn globale Rezepte editierbar sein sollen, braucht es einen gesonderten Admin-/Service-Flow, nicht eine lockere User-Policy.

### `public.shopping_list`

Empfehlung:

- nur eigene Zeilen fuer `authenticated`
- kein `anon`

RLS-Idee:

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

### `public.meal_plan`

Empfehlung:

- nur eigene Zeilen fuer `authenticated`
- kein `anon`

RLS-Idee:

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

### `public.api_keys`

Empfehlung:

- **nicht direkt ueber die Data API exponieren**
- keine `anon`- oder `authenticated`-Grants auf die Tabelle
- stattdessen serverseitige Route / RPC / Edge-Function, falls spaeter noetig

Grund:

- Auch wenn heute nur `key_hash` gespeichert wird, ist das ein Sicherheitsobjekt und kein guter Kandidat fuer breite Client-Tabellenrechte.

### `public.ingredient_dictionary`

Empfehlung:

- vorerst ebenfalls **nicht direkt ueber die Data API exponieren**
- wenn spaeter Client-Lesezugriff noetig wird: `SELECT` fuer `authenticated`, aber keine Schreibrechte fuer normale User

Grund:

- Das ist eher System-/Kanonisierungsdatenbestand als Nutzerinhalt.
- Schreibrechte wuerden die Datenqualitaet schnell angreifen.

## Bewertung der aktuellen Advisor-Meldungen

Die `rls_enabled_no_policy`-Infos fuer

- `public.api_keys`
- `public.ingredient_dictionary`
- `public.meal_plan`
- `public.recipes`
- `public.shopping_list`

sind im heutigen Zustand **nicht akut problematisch**, weil:

- RLS aktiv ist
- `anon` und `authenticated` keine Tabellenrechte mehr haben
- der App-Zugriff ueber direkte DB-Verbindung laeuft

Sobald die Multi-User-Phase startet und die App auf `authenticated`-Clientzugriff umstellt, werden diese Info-Meldungen aber zu echter Folgearbeit:

- Grants setzen
- Policies schreiben
- mit echten Auth-Tokens verifizieren

## Empfohlene naechste Schritte

1. Fuer neue serverinterne Tabellen standardmaessig ein privates Schema bevorzugen.
2. Fuer neue Data-API-Tabellen die SQL-Vorlage aus `db/templates/` benutzen.
3. Vor Multi-User-Login eine dedizierte RLS-/Grants-Migration fuer
   - `recipes`
   - `shopping_list`
   - `meal_plan`
   planen.
4. `api_keys` und wahrscheinlich `ingredient_dictionary` bewusst backend-only lassen, solange kein zwingender Client-Fall existiert.
