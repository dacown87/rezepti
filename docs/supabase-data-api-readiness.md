# Supabase Data API Readiness (2026-05-24)

## Kurzfazit

Das Repo ist fuer den aktuellen Server-only-Betrieb weiterhin unkritisch, aber die naechste Multi-User-Phase braucht eine explizite, reviewbare Data-API-Skizze.

Heute gilt:

- Der produktive Datenzugriff laeuft weiter ueber direkte Postgres-Verbindungen mit `DATABASE_URL` und Drizzle.
- Fuer Multi-User Slice 1 bleibt die Server-API die Datenzugriffsgrenze; Mobile soll Supabase Auth Tokens transportieren, aber nicht parallel direkte Data-API-Schreibpfade einfuehren.
- `public`-Tabellen haben bereits RLS aktiviert und direkte Grants fuer `anon` und `authenticated` wurden entzogen in [db/migrations/2026-05-12-enable-rls.sql](../db/migrations/2026-05-12-enable-rls.sql).
- Die aktuellen Advisor-Hinweise zu fehlenden Policies sind fuer den heutigen Zustand erwartbar, weil die Data API bewusst noch nicht auf diese Tabellen zielen soll.

Fuer den Multi-User-Umbau ist die relevante Frage deshalb nicht "ob RLS", sondern "welche Tabellen werden fuer den Client wirklich exponiert, und mit welchen exakt begrenzten Rechten".

Phase-0.5-DX-Runbook: [docs/auth-runbook-route-privacy.md](auth-runbook-route-privacy.md).

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

## Multi-User Slice-1 Auth-/DX-Abgrenzung

Aktueller Feature-Branch-Stand fuer Multi-User Login First Slice:

- Server nutzt `SUPABASE_URL` und `SUPABASE_ANON_KEY` oder `SUPABASE_PUBLISHABLE_KEY`, um Bearer Tokens gegen Supabase Auth zu verifizieren.
- Mobile nutzt `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` oder `EXPO_PUBLIC_SUPABASE_ANON_KEY`, um User-Sessions aufzubauen und Bearer Tokens an den Server zu senden.
- `DATABASE_URL`, `STAGING_DATABASE_URL`, Audit-DB-URLs und alle Service-/Secret-Keys bleiben server-only bzw. staging-only.
- Admin-/Testuser-Bootstrap ist dokumentiert, aber noch nicht automatisiert. Admin-Rollenquelle ist serverseitig `user_profiles.app_role`, nicht `user_metadata`.
- `shopping_list` und `meal_plan` sind im Feature-Branch household-scoped; `recipes` bleibt aus dem Slice-1-Schreibumbau heraus.
- Der Staging-RLS-Smoke ist noch nicht ausgefuehrt.
- Route-Privacy ist fuer Slice 1 inventarisiert: Shopping und Planner sind Pflichtbereich; Recipes, Import-Jobs, BYOK, Plattform-Credentials und Dictionary bleiben deferred oder backend-only, bis Ownership/Privacy explizit modelliert ist.

API-Fehler fuer Auth/Setup sollen diesen Vertrag nutzen:

```json
{
  "error": {
    "code": "auth_missing",
    "message": "Sign in required.",
    "cause": "No Authorization bearer token was sent.",
    "fix": "Sign in again and retry the request."
  }
}
```

Stabile Codes fuer den ersten Slice: `auth_missing`, `auth_invalid`, `token_expired`, `forbidden`, `not_found`, `setup_required`, `no_household`.

## Schema-Boundaries fuer diese Phase

### Data-API-Tabellen fuer Slice 1

- `public.households` (read fuer Mitglieder)
- `public.household_memberships` (read fuer eigene Memberships)
- `public.user_profiles` (read fuer eigenes Profil/App-Rolle)
- `public.shopping_list` (CRUD fuer aktive Household-Mitglieder)
- `public.meal_plan` (CRUD fuer aktive Household-Mitglieder)

### Backend-only

- `public.api_keys`
- `public.ingredient_dictionary`
- `public.recipes` fuer authenticated CRUD in Slice 1

Warum backend-only:

- `api_keys` ist ein Sicherheitsobjekt und sollte nicht in eine breite Client-API wandern.
- `ingredient_dictionary` ist System-/Kanonisierungsdatenbestand und kein sauberes Multi-User-Client-Objekt fuer den ersten Schritt.
- `recipes` hat globale Default-Semantik und braucht eine eigene Ownership-/Template-Matrix.
- Diese Tabellen bleiben in `public` zwar mit RLS abgesichert, bekommen aber keine neuen Data-API-Grants fuer diese Phase.
- Wenn `ingredient_dictionary` spaeter doch einen Client-Fall bekommt, dann als bewusste, separate Lesefreigabe.

## Vorbedingungen fuer die Migration

Diese Readiness-Skizze setzt voraus, dass vor dem Anwenden auf Staging/Production geprueft wird, ob der Datenbestand fuer Household-Scoping sauber ist:

- `recipes` darf `user_id = null` behalten, weil die Tabelle globale Default-Rezepte enthalten kann.
- `shopping_list` und `meal_plan` brauchen fuer Slice 1 `household_id`.
- Bestehende Shopping-/Planner-Testdaten muessen vor der Migration geloescht oder bewusst auf Testhaushalte backfilled werden.
- `user_id` bleibt auf Shopping/Planner als Creator-/Audit-Kontext erhalten; Zugriffskontrolle laeuft fuer Slice 1 ueber `household_id` plus `household_memberships`.

## Reviewbare RLS-/Grant-Matrix

### `public.recipes`

Ziel fuer Slice 1:

- Keine neue authenticated-CRUD-Freigabe.
- Server-Routen koennen bestehende Recipe-Pfade weiter bedienen.
- Das spaetere Recipe-Modell entscheidet separat zwischen globalen Templates, User-Kopien und Household-Rezepten.

### `public.shopping_list`

Ziel:

- `authenticated` darf nur Zeilen eines Haushalts sehen und veraendern, in dem der User Mitglied ist.

Konkrete Regeln:

- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shopping_list TO authenticated`
- `GRANT USAGE, SELECT ON SEQUENCE public.shopping_list_id_seq TO authenticated`
- `SELECT`-Policy: nur Household-Memberships
- `INSERT`-Policy: `user_id = auth.uid()` und Household-Membership
- `UPDATE`-Policy: nur Household-Memberships
- `DELETE`-Policy: nur Household-Memberships

Empfohlene Policy-Logik:

```sql
using (
  exists (
    select 1
    from public.household_memberships hm
    where hm.household_id = shopping_list.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.household_memberships hm
    where hm.household_id = shopping_list.household_id
      and hm.user_id = (select auth.uid())
  )
)
```

Wichtig:

- `UPDATE` braucht die `SELECT`-Policy mit.
- Wenn der Bestand noch Legacy-Zeilen mit `household_id = null` enthaelt, muessen diese vor der Migration geloescht oder backfilled werden.

### `public.meal_plan`

Ziel:

- `authenticated` darf nur Planzeilen eines Haushalts sehen und veraendern, in dem der User Mitglied ist.

Konkrete Regeln:

- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meal_plan TO authenticated`
- `GRANT USAGE, SELECT ON SEQUENCE public.meal_plan_id_seq TO authenticated`
- `SELECT`-Policy: nur Household-Memberships
- `INSERT`-Policy: `user_id = auth.uid()` und Household-Membership
- `UPDATE`-Policy: nur Household-Memberships
- `DELETE`-Policy: nur Household-Memberships

Empfohlene Policy-Logik:

```sql
using (
  exists (
    select 1
    from public.household_memberships hm
    where hm.household_id = meal_plan.household_id
      and hm.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.household_memberships hm
    where hm.household_id = meal_plan.household_id
      and hm.user_id = (select auth.uid())
  )
)
```

Wichtig:

- Auch hier gilt: `UPDATE` ohne `SELECT`-Policy ist ein Stillstand-Fall, kein Exception-Fall.
- Wenn `meal_plan` spaeter per UI kopiert oder dupliziert wird, muss das weiterhin auf aktive Household-Membership pruefen und `user_id` nur als Creator-/Audit-Kontext setzen.

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
