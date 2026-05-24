# Supabase Data API Readiness (2026-05-24)

## Kurzfazit

Das Repo ist fuer den aktuellen Server-only-Betrieb weiterhin unkritisch, aber die naechste Multi-User-Phase braucht eine explizite, reviewbare Data-API-Skizze.

Heute gilt:

- Der produktive Datenzugriff laeuft weiter ueber direkte Postgres-Verbindungen mit `DATABASE_URL` und Drizzle.
- `public`-Tabellen haben bereits RLS aktiviert und direkte Grants fuer `anon` und `authenticated` wurden entzogen in [db/migrations/2026-05-12-enable-rls.sql](../db/migrations/2026-05-12-enable-rls.sql).
- Die aktuellen Advisor-Hinweise zu fehlenden Policies sind fuer den heutigen Zustand erwartbar, weil die Data API bewusst noch nicht auf diese Tabellen zielen soll.

Fuer den Multi-User-Umbau ist die relevante Frage deshalb nicht "ob RLS", sondern "welche Tabellen werden fuer den Client wirklich exponiert, und mit welchen exakt begrenzten Rechten".

## Offizielle Supabase-Regeln, die diese Skizze erzwingen

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing your data](https://supabase.com/docs/guides/database/secure-data/)
- [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys)

Wichtige Regeln daraus:

- RLS muss auf exponierten Tabellen aktiv sein.
- Ein `UPDATE` braucht eine passende `SELECT`-Policy.
- `raw_user_meta_data` / `user_metadata` sind fuer AuthZ ungeeignet; nur `raw_app_meta_data` ist fuer Zugriffskontrolle belastbar.
- `secret`/`service_role`-Keys gehoeren nicht in den Client.
- Views koennen RLS umgehen; falls spaeter Views kommen, dann nur mit `security_invoker = true` oder in einem nicht exponierten Schema.
- `security definer`-Funktionen gehoeren nicht in exponierte Schemas.

## Schema-Boundaries fuer diese Phase

### Data-API-Tabellen

- `public.recipes`
- `public.shopping_list`
- `public.meal_plan`

### Backend-only

- `public.api_keys`
- `public.ingredient_dictionary`

Warum backend-only:

- `api_keys` ist ein Sicherheitsobjekt und sollte nicht in eine breite Client-API wandern.
- `ingredient_dictionary` ist System-/Kanonisierungsdatenbestand und kein sauberes Multi-User-Client-Objekt fuer den ersten Schritt.
- Beide Tabellen bleiben in `public` zwar mit RLS abgesichert, bekommen aber keine Data-API-Grants fuer diese Phase.
- Wenn `ingredient_dictionary` spaeter doch einen Client-Fall bekommt, dann als bewusste, separate Lesefreigabe.

## Vorbedingungen fuer die spaetere Migration

Diese Readiness-Skizze setzt voraus, dass vor dem echten Auth-Umbau geprueft wird, ob `user_id` auf den relevanten Tabellen sauber befuellbar ist:

- `recipes` darf `user_id = null` behalten, weil die Tabelle globale Default-Rezepte enthalten kann.
- `shopping_list` und `meal_plan` sollten fuer echte Multi-User-Nutzung entweder bereits backfilled sein oder vor dem Client-Rollout auf konsistente `user_id`-Werte umgestellt werden.
- Die konkrete Migration kann daraus spaeter `NOT NULL` fuer `shopping_list.user_id` und `meal_plan.user_id` ableiten, wenn der Datenbestand das hergibt.

## Reviewbare RLS-/Grant-Matrix

### `public.recipes`

Ziel:

- `authenticated` darf eigene Rezepte lesen, anlegen, aendern und loeschen.
- `authenticated` darf globale Default-Rezepte lesen, aber nicht bearbeiten.

Konkrete Regeln:

- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipes TO authenticated`
- `GRANT USAGE, SELECT ON SEQUENCE public.recipes_id_seq TO authenticated`
- `SELECT`-Policy: eigene Zeilen plus globale Defaults
- `INSERT`-Policy: nur eigene Zeilen
- `UPDATE`-Policy: nur eigene Zeilen
- `DELETE`-Policy: nur eigene Zeilen

Empfohlene Policy-Logik:

```sql
using (user_id = (select auth.uid()) or user_id is null)
with check (user_id = (select auth.uid()))
```

Hinweis:

- Die `SELECT`-Policy fuer globale Defaults ist gewollt, damit die App Default-Rezepte anzeigen kann.
- Die Global-Read-Regel darf nicht dazu fuehren, dass globale Rows editierbar werden. Deshalb bleiben `UPDATE` und `DELETE` strikt auf die eigene `user_id` begrenzt.

### `public.shopping_list`

Ziel:

- `authenticated` darf nur eigene Zeilen sehen und veraendern.

Konkrete Regeln:

- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_list TO authenticated`
- `GRANT USAGE, SELECT ON SEQUENCE public.shopping_list_id_seq TO authenticated`
- `SELECT`-Policy: nur eigene Zeilen
- `INSERT`-Policy: nur eigene Zeilen
- `UPDATE`-Policy: nur eigene Zeilen
- `DELETE`-Policy: nur eigene Zeilen

Empfohlene Policy-Logik:

```sql
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()))
```

Wichtig:

- `UPDATE` braucht die `SELECT`-Policy mit.
- Wenn der Bestand noch Legacy-Zeilen mit `user_id = null` enthaelt, sind diese fuer echte Nutzer nach der Umstellung absichtlich nicht mehr sichtbar.

### `public.meal_plan`

Ziel:

- `authenticated` darf nur eigene Planzeilen sehen und veraendern.

Konkrete Regeln:

- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meal_plan TO authenticated`
- `GRANT USAGE, SELECT ON SEQUENCE public.meal_plan_id_seq TO authenticated`
- `SELECT`-Policy: nur eigene Zeilen
- `INSERT`-Policy: nur eigene Zeilen
- `UPDATE`-Policy: nur eigene Zeilen
- `DELETE`-Policy: nur eigene Zeilen

Empfohlene Policy-Logik:

```sql
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()))
```

Wichtig:

- Auch hier gilt: `UPDATE` ohne `SELECT`-Policy ist ein Stillstand-Fall, kein Exception-Fall.
- Wenn `meal_plan` spaeter per UI kopiert oder dupliziert wird, muss das weiterhin auf `auth.uid()` schreiben, nicht auf Claims aus `user_metadata`.

### `public.api_keys`

Ziel:

- Backend-only, keine Data-API-Freigabe.

Konkrete Regeln:

- keine `GRANT`s fuer `anon` oder `authenticated`
- keine Data-API-Policies fuer diese Phase
- falls ein Backend spaeter per Supabase-Client darauf zugreifen soll, dann nur mit Secret-Key in serverseitigen Komponenten

### `public.ingredient_dictionary`

Ziel:

- Backend-only fuer diese Phase.

Konkrete Regeln:

- keine `GRANT`s fuer `anon` oder `authenticated`
- keine Data-API-Policies fuer diese Phase
- spaeter nur dann lesen, wenn ein echter Client-Fall mit klarer Begruendung existiert

## Reviewable Migrationsskizze

Fuer den naechsten echten Migrationsblock soll die Reihenfolge so aussehen:

1. Legacy-Daten pruefen und ggf. `user_id` fuer `shopping_list` und `meal_plan` backfillen.
2. RLS auf den drei Data-API-Tabellen aktiv lassen.
3. Exakte Grants fuer `authenticated` setzen.
4. Sequenzen fuer die drei Tabellen freigeben.
5. Policies fuer `SELECT`, `INSERT`, `UPDATE`, `DELETE` anlegen.
6. Backend-only-Tabellen weiterhin ohne Data-API-Grants lassen.
7. Erst danach mit echten `authenticated`-Tokens gegen die Data API verifizieren.

Empfohlene Verifikation fuer die spaetere Umsetzung:

- Lesen einer eigenen Rezeptzeile
- Lesen eines globalen Default-Rezepts
- Insert einer eigenen Shopping-List-Zeile
- Update einer eigenen Meal-Plan-Zeile
- Negative Tests fuer fremde `user_id`-Zeilen

## Reusable Draft

Eine konkrete SQL-Vorlage fuer diese Matrix liegt in [db/templates/public-multi-user-data-api-rls.sql](../db/templates/public-multi-user-data-api-rls.sql).

Die generische Vorlagendatei [db/templates/public-table-data-api-rls.sql](../db/templates/public-table-data-api-rls.sql) bleibt als Basis fuer neue Data-API-Tabellen bestehen, ist aber fuer diesen Multi-User-Fall zu abstrakt.
