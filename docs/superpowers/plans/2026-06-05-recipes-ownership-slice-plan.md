# Recipes Ownership Slice Plan

Datum: 2026-06-05
Branch: `recipes-ownership-slice`
Status: Implementiert, lokal verifiziert und committed am 2026-06-06 (`e67c3b2`); vor Release bleibt nur optionaler Staging-Smoke
Verbindliche Spec: [Recipes Household Ownership Design](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-06-05-recipes-household-ownership-design.md)

## Kurzentscheidung

Der bisherige Recipes-Privacy-Slice schuetzt zwar erste Server-Routen, codiert
aber noch die alte Zwischenannahme `user_id is null = globale Defaults`. Diese
Annahme ist nach der Ownership-Entscheidung falsch.

Der aktuelle Recipe-Code-Diff soll deshalb **nicht unveraendert als finales
Privacy-Modell geshippt** werden. Er wird entweder:

1. als sehr kurzer Sicherheits-Zwischenschritt bewusst markiert und direkt vom
   Ownership-Slice abgeloest, oder
2. bevorzugt jetzt auf das neue Owner-Modell umgebaut.

Empfehlung: Option 2. Da `user_id is null` Daten geloescht/resetet werden
duerfen, gibt es keinen guten Grund, noch globale Default-Reads als Zielzustand
einzubauen.

## Kontext

Der gelandete Multi-User Login First Slice schuetzt Shopping und Planner ueber
Supabase Auth, serverseitigen AuthContext, Household-Memberships und
Supabase-RLS-Smokes. Recipes wurden bewusst ausgeklammert.

Der aktuelle Arbeitsbaum enthaelt bereits einen begonnenen Recipes-Privacy-Diff:

- Recipe-Mutationen werden auth-pflichtig.
- neue Rezepte bekommen `user_id = auth.userId`.
- Reads nutzen optional Auth und behandeln `user_id is null` als globale
  Default-Rezepte.
- Extract-Jobs bekommen erste User-Ownership.
- Planner-/Shopping-Referenzen werden teilweise gegen Recipe-Sichtbarkeit
  validiert.

Dieser Diff war sinnvoll, solange globale Defaults offen waren. Die neue
Produktentscheidung lautet aber:

- Es gibt langfristig keine globalen Rezepte oder Templates.
- Rezepte gehoeren immer privat einem User oder einem Haushalt.
- neue/importierte Rezepte sind standardmaessig privat.
- Teilen erzeugt Kopien.
- bestehende `user_id is null` Rezepte sind Test-/Legacy-Daten und duerfen
  resetet oder geloescht werden.

## Ziel

Der naechste Recipes-Slice stellt die Server-API auf ein explizites
Ownership-Modell um, ohne schon direkte Supabase Data-API-Grants fuer `recipes`
zu oeffnen.

Nach Abschluss soll gelten:

- Es gibt keine sichtbaren Null-Owner-Rezepte mehr.
- Neue/importierte Rezepte sind standardmaessig privat.
- Ein Rezept ist entweder privat oder haushaltsbezogen.
- Private Rezepte sieht und bearbeitet nur der Owner.
- Haushaltsrezepte sehen und bearbeiten alle Mitglieder des Haushalts.
- Fremde Rezepte liefern bei Detail-/Mutation-Zugriff `404`.
- Private Rezepte koennen nicht direkt in Haushalts-Planner oder
  Haushalts-Shopping referenziert werden.
- Sharing/Kopieren wird als separater API-/UI-Slice vorbereitet, aber nicht
  zwingend im ersten Ownership-Slice voll gebaut.

## Nicht-Ziele

- Keine globalen Templates.
- Kein Public-Rezeptkatalog.
- Kein Admin-Recipe-Editor.
- Kein Legacy-Claim-Flow fuer `user_id is null`.
- Keine pro-Rezept-Rollen.
- Keine direkte Supabase Data-API-Freigabe fuer `recipes`.
- Kein Einladungs-/Sharing-UX-Slice; Kopierlogik kann serverseitig vorbereitet
  werden, die volle UX folgt spaeter.
- Keine Favoriten-/Collections-Implementierung in diesem Slice.

## Datenmodell

### Empfohlene Recipe-Felder

`recipes` soll eine explizite Ownership-Schicht bekommen:

- `owner_type text not null` mit `CHECK (owner_type IN ('user', 'household'))`
- `owner_user_id uuid`
- `household_id uuid`
- `created_by uuid`
- optional `updated_at timestamptz not null default now()` falls der Slice
  ohnehin Recipe-Mutationen beruehrt

Die bestehende `user_id`-Spalte wird in der Ownership-Migration entfernt. Falls
vor dem harten Reset noch `user_id is not null` Daten behalten werden, werden
sie vorher nach `owner_user_id` und `created_by` ueberfuehrt. Danach sind
`owner_user_id` und `created_by` die einzigen User-Bezuege auf `recipes`; neue
Route-Logik darf nicht weiter auf `user_id` oder `user_id is null` fuer
Sichtbarkeit setzen.

### Constraints

Pflicht:

```sql
CHECK (
  (owner_type = 'user' AND owner_user_id IS NOT NULL AND household_id IS NULL)
  OR
  (owner_type = 'household' AND owner_user_id IS NULL AND household_id IS NOT NULL)
)
```

Foreign Keys:

- `owner_user_id -> auth.users(id) ON DELETE CASCADE`
- `created_by -> auth.users(id) ON DELETE SET NULL`
- `household_id -> public.households(id) ON DELETE CASCADE`
- `meal_plan.recipe_id -> recipes(id)` pruefen/einfuehren, nachdem Altlasten
  bereinigt sind
- `shopping_list.recipe_id -> recipes(id)` nullable pruefen/einfuehren, weil
  Standalone-Items weiter erlaubt bleiben

Indexes:

- `recipes_owner_user_idx` auf `(owner_user_id, created_at desc, id)` fuer
  private Reads, idealerweise partial `where owner_type = 'user'`.
- `recipes_household_idx` auf `(household_id, created_at desc, id)` fuer
  Haushaltsreads, idealerweise partial `where owner_type = 'household'`.
- optional `recipes_created_by_idx` auf `(created_by)` fuer Audit/Admin-Ops.
- optional `meal_plan_recipe_idx` und `shopping_list_recipe_idx`, falls
  Recipe-Loeschung oder Referenzvalidierung haeufig ueber `recipe_id` laufen.

## Migration / Reset

Die Migration ist bewusst hart:

1. Ziel-DB bestaetigen.
2. Vor Production-Anwendung explizit pruefen, ob `recipes.user_id is null`
   erhaltenswerte Daten enthaelt.
3. In Dev/Staging/aktueller Ziel-DB Null-Owner-Rezepte loeschen oder DB reseten.
4. Neue Owner-Spalten hinzufuegen.
5. Bestehende `user_id is not null` Rezepte als private Rezepte uebernehmen:
   `owner_type = 'user'`, `owner_user_id = user_id`, `created_by = user_id`.
6. `recipes.user_id` aus DB, Drizzle-Schema, Code und Tests entfernen.
7. Strenge Constraints setzen.
8. Servercode auf neue Owner-Helper umstellen.

Kein Serverpfad behaelt Legacy-Null-Kompatibilitaet.

### Migration-Smoke

Die harte Migration bekommt einen automatisierten lokalen Smoke, nicht nur eine
manuelle Checkliste. Mindest-Gate:

```bash
npx supabase db reset --local --yes
npm run supabase:rls-smoke
```

Zusaetzliche SQL-/Script-Assertions:

- `public.recipes` enthaelt keine `user_id` Spalte mehr.
- `owner_type`, `owner_user_id`, `household_id` und `created_by` existieren.
- Es gibt keine Recipe-Zeile ohne gueltigen Owner.
- Der Owner-Check-Constraint lehnt doppelte oder fehlende Owner ab.
- `meal_plan.recipe_id` und nicht-null `shopping_list.recipe_id` zeigen nur auf
  existierende Recipes.
- Planner-/Shopping-RLS-Smoke lehnt private oder fremde Household-Recipe-IDs ab.

Wenn Staging vor Release genutzt wird, muss derselbe Smoke gegen
`rezepti-staging` laufen oder die Ziel-DB-Abweichung explizit dokumentiert
werden.

## Server-Design

### Sichtbarkeitsregeln

Recipe-Reads sind auth-pflichtig. Ohne globale Rezepte gibt es keinen
fachlichen Public-Fallback mehr; eine leere anonyme Liste wuerde wie Datenverlust
aussehen.

- `GET /api/v1/recipes`, Ingredient-Search, Detail und Bildroute verlangen
  Bearer Auth.
- Ohne Auth liefern diese Routen den stabilen `auth_missing` Fehler.
- Mit Auth sieht der User private eigene Rezepte plus Haushaltsrezepte der
  eigenen Memberships.
- App/Web-Smokes und Mobile-Empty-States muessen auf Login/Auth-Fehler
  umgestellt werden, statt globale oder leere Daten zu erwarten.
- Ingredient-Search bleibt fuer diesen Slice owner-gefiltert und in-memory,
  bekommt aber ein hartes API-Limit von maximal 100 Rueckgaben. Wenn sichtbare
  Rezeptmengen spaeter groesser werden, wird DB-backed Search ein eigener
  Performance-Slice.

### Mutationsregeln

- `POST /api/v1/recipes`: auth-pflichtig, erstellt standardmaessig privat.
- Optionaler `owner`/`householdId` Payload darf nur einen Haushalt setzen, in dem
  der User Mitglied ist.
- `PATCH /api/v1/recipes/:id`: private Owner oder Household-Mitglied.
- `DELETE /api/v1/recipes/:id`: private Owner oder Household-Mitglied.
- Fremde oder nicht sichtbare Rezepte liefern `404`.

### Helper-Richtung

Neue oder geaenderte Helper:

```ts
type RecipeOwner =
  | { type: "user"; userId: string }
  | { type: "household"; householdId: string };

recipeVisibilityForAuth(auth);
canMutateRecipeForAuth(auth);
isHouseholdRecipeFor(householdId);

saveRecipeToReactDb(recipe, sourceUrl, transcript, {
  owner,
  createdBy,
});

getRecipeListFromReactDb(authContext);
getRecipeByIdFromReactDb(id, authContext);
updateRecipeInReactDb(id, authContext, fields);
deleteRecipeFromReactDb(id, authContext);
copyRecipeToOwner(id, authContext, targetOwner);
```

Die Route-Schicht soll keinen rohen `userId` mehr als einzige
Sichtbarkeitsgrenze weiterreichen.

Die Owner-Praedikate muessen zentrale Helper sein, nicht pro Route neu
zusammengesetzt. `visibleRecipesFor(userId)` aus dem aktuellen Diff wird durch
Owner-Helper ersetzt, die dieselbe Regel fuer Liste, Detail, Bild,
Ingredient-Search, Update/Delete und Planner-/Shopping-Referenzvalidierung
verwenden.

## Planner und Shopping

Haushalts-Planner und Haushalts-Shopping duerfen private Rezepte nicht direkt
referenzieren.

Regeln:

- `POST /api/v1/planner` validiert `recipe_id` gegen den aktiven Haushalt.
- Shopping-Ableitungen aus Rezepten duerfen nur Haushaltsrezepte desselben
  Haushalts verwenden.
- Wenn ein privates Rezept verwendet werden soll, muss vorher eine
  Haushaltskopie entstehen.
- Fehlende oder fremde `recipe_id` liefert `404`.
- Foreign Keys schuetzen nur Existenz. Die eigentliche Scope-Regel
  `recipe.owner_type = 'household' AND recipe.household_id = activeHouseholdId`
  muss im Server erzwungen werden.

Der aktuelle Diff, der Planner gegen eine allgemeine Recipe-Sichtbarkeit
validiert, muss hier enger werden: "sichtbar fuer User" reicht nicht; fuer
Haushalts-Planner muss das Rezept dem aktiven Haushalt gehoeren.

## Extract-Jobs und Imports

Imports speichern neue Rezepte standardmaessig privat:

- Auth-pflichtige Imports setzen `owner_type = 'user'`,
  `owner_user_id = auth.userId`, `created_by = auth.userId`.
- Unauthenticated Imports duerfen kein persistentes Rezept speichern. Sie
  muessen entweder mit `auth_missing` abbrechen oder nur ein nicht-persistentes
  Preview liefern.
- Extract-Jobs, die einem User gehoeren, bleiben nur fuer diesen User
  poll-/cancelbar.

Die bereits begonnene Job-Ownership-Arbeit passt zur neuen Richtung, muss aber
gegen den finalen Auth-Vertrag getestet werden.

## Mobile-Verhalten

Neue/importierte Rezepte sind privat. UI-Folgen:

- Create-/Import-Flows muessen auth-failures sichtbar behandeln.
- Optionaler Haushaltsschalter ist nicht Default.
- "Im Haushalt verwenden" oder "In Haushalt kopieren" wird ein spaeterer
  expliziter Flow.
- Planner darf bei privaten Rezepten nicht stillschweigend planen, sondern muss
  zur Haushaltskopie fuehren.

## RLS / Supabase Data API

`recipes` bleibt in diesem Slice fuer `anon` und `authenticated` ueber die
Supabase Data API geschlossen. Die Server-API ist die autoritative Grenze.

Wenn spaeter Data-API-Grants fuer `recipes` kommen, brauchen sie separate
Policies:

- private Select/Update/Delete nur fuer `owner_user_id = (select auth.uid())`
- household Select/Update/Delete ueber Membership-Existenz
- Insert-Policies fuer private Owner und Haushaltsmitglieder
- keine Policies fuer globale Templates, weil es keine globalen Templates gibt

Solange `meal_plan` und `shopping_list` ueber die Data API fuer
`authenticated` offen sind, muessen deren Policies bei Inserts/Updates mit
`recipe_id` ebenfalls sicherstellen, dass die referenzierte Recipe-Zeile ein
Haushaltsrezept desselben Haushalts ist. Andernfalls koennte ein User eine
fremde, nur nach ID bekannte Recipe in eigene Haushaltsdaten referenzieren.

Da `recipes` in diesem Slice fuer `authenticated` geschlossen bleibt, duerfen
Shopping-/Planner-Policies diese Tabelle nicht einfach direkt per Subquery als
normaler User lesen. Stattdessen bekommt die Migration einen kleinen privaten
RLS-Helper:

```sql
create or replace function private.recipe_belongs_to_household(
  target_recipe_id integer,
  target_household_id uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.recipes r
    where r.id = target_recipe_id
      and r.owner_type = 'household'
      and r.household_id = target_household_id
  );
$$;
```

Helper-Regeln:

- Funktion liegt in `private`, nicht in einem exponierten Schema.
- `EXECUTE` wird von `public` und `anon` revoked; `authenticated` bekommt
  `EXECUTE`, damit die Funktion in RLS-Policies ausgewertet werden kann.
- Sie wird nur in RLS-Policies genutzt, nicht als PostgREST-RPC freigegeben.
- `supabase db advisors` oder der Advisor-Fallback muss nach der Migration
  laufen, mit besonderem Blick auf Security-Definer- und Search-Path-Warnungen.
- RLS-Smoke prueft, dass fremde oder private `recipe_id`s in `meal_plan` und
  `shopping_list` abgelehnt werden.

Supabase-Sicherheitsregeln:

- RLS bleibt auf `recipes` aktiviert.
- Keine `service_role`-/Secret-Keys im Client.
- Keine Authorization ueber `user_metadata`.
- UPDATE braucht passende SELECT-Policy, falls Data API geoeffnet wird.

## Testmatrix

### Unit / DB

- Insert erstellt standardmaessig privates Rezept mit Owner.
- Insert in Haushalt nur fuer Mitglied.
- Private Reads zeigen eigene Rezepte.
- Private Reads zeigen fremde User-Rezepte nicht.
- Haushaltsreads zeigen Rezepte eigener Haushalte.
- Nicht-Mitglieder sehen Haushaltsrezepte nicht.
- Update/Delete fuer private Owner funktioniert.
- Update/Delete fuer Haushaltsmitglied funktioniert.
- Update/Delete fuer Nicht-Owner/Nicht-Mitglied liefert false/404.
- Null-Owner-Rezepte sind nach Migration nicht sichtbar oder existieren nicht.

### Routes

- `POST /api/v1/recipes` ohne Token liefert `auth_missing`.
- `POST /api/v1/recipes` mit Token erstellt privates Rezept.
- optionaler Haushalt beim Create verlangt Membership.
- `GET /api/v1/recipes`, Detail, Bildroute und Ingredient-Search ohne Token
  liefern `auth_missing`.
- Detail fremder Rezepte liefert `404`.
- Bildroute fremder Rezepte liefert `404`.
- Ingredient-Search nutzt dieselbe Owner-Sicht wie Recipe-Liste.
- Ingredient-Search respektiert `limit <= 100` und liefert keine Daten
  ausserhalb der Owner-Sicht.

### Mobile

- Recipe-Liste zeigt bei `auth_missing` einen Login-/Session-Zustand, keine
  leere Rezeptliste.
- Recipe-Detail zeigt bei `auth_missing` einen klaren Login-/Retry-Zustand.
- Import-/Create-Speichern behandelt `auth_missing` sichtbar und verschluckt den
  Fehler nicht.
- Planner-Flow fuer private Rezepte fuehrt zur Haushaltskopie oder zu einem
  klaren Blocker, nicht zu stillem Planner-Insert.
- API-Wrapper-Tests bestaetigen, dass `auth_missing`, `no_household` und `404`
  als stabile Codes erhalten bleiben.

### Planner / Shopping

- Privates Rezept kann nicht direkt in Haushalts-Planner.
- Haushaltsrezept desselben Haushalts kann geplant werden.
- Haushaltsrezept eines fremden Haushalts liefert `404`.
- Shopping-Ableitung akzeptiert nur Haushaltsrezepte des aktiven Haushalts.

### Integration / Smoke

- User A private Rezeptdaten bleiben fuer User B unsichtbar.
- User A/User B im selben Haushalt sehen und bearbeiten Haushaltsrezepte.
- User C ausserhalb des Haushalts sieht sie nicht.
- RLS-Smoke bestaetigt weiterhin: Data API fuer `recipes` geschlossen.

## Umgang mit aktuellem Arbeitsbaum

Stand 2026-06-06: Der Arbeitsbaum wurde auf das explizite Owner-Modell
umgebaut. Die alte `user_id is null`-Sichtbarkeit ist aus Schema, Servercode
und Tests entfernt. Neue/importierte Rezepte werden privat einem User zugeordnet,
Haushaltsreferenzen in Planner/Shopping akzeptieren nur Haushaltsrezepte des
aktiven Haushalts, und `recipes` bleibt fuer `anon`/`authenticated` ueber die
Supabase Data API geschlossen.

Wichtig fuer den Commit-Zuschnitt: Das untracked lokale Verzeichnis `.codex/`
enthaelt Agent-Konfigurationen und gehoert nicht zu diesem Slice.

Der aktuelle uncommitted Diff enthaelt brauchbare Bausteine:

- Auth-Pflicht fuer Mutationen.
- Owner-scoped Recipe-Helper als erste Form.
- User-bound Extract-Jobs.
- Mobile-Routen ueber `apiFetch`.
- Tests fuer Route-/DB-Auth.

Er muss aber vor Shipping umgebaut werden:

- `visibleRecipesFor(userId)` mit `user_id is null OR user_id = userId`
  entfernen.
- Public globale Default-Reads aus Tests und Routen entfernen.
- `saveRecipeToReactDb(..., userId)` durch Owner-Objekt ersetzen.
- Planner-/Shopping-Recipe-Validierung auf aktiven Haushalt verengen.
- Migration/Schema fuer explizite Owner-Spalten planen, bevor die neue Route-
  Semantik als abgeschlossen gilt.

## Phasen

### Phase 1: Schema, Migration, RLS — abgeschlossen 2026-06-06

Ziel: `recipes` bekommt explizite Ownership, die alte `user_id`-Semantik geht
weg, und die DB kann private vs. household Recipes eindeutig unterscheiden.

- [x] Recipe-Owner-Spalten definieren.
- [x] `recipes.user_id` aus DB, Schema und Tests entfernen.
- [x] Harte Migration mit Reset/Backfill fuer Null-Owner-Daten umsetzen.
- [x] Privaten RLS-Helper fuer Rezept-zu-Haushalt-Referenzen einbauen.
- [x] Migration-Smoke gegen lokale DB laufen lassen.
- [ ] Staging-Smoke bei Bedarf vor Release laufen lassen.

### Phase 2: Server Ownership Layer — abgeschlossen 2026-06-06

Ziel: Recipe-Liste, Detail, Bild, Search, Create, Update und Delete verwenden
zentralisierte Owner-Predicate-Helper statt der alten `visibleRecipesFor`
Logik.

- [x] `RecipeOwner`-Helper und Auth-bewusste Sichtbarkeitsfunktionen bauen.
- [x] Recipe-Reads auth-pflichtig machen.
- [x] Create standardmaessig privat machen.
- [x] Household-Create nur fuer Membership erlauben.
- [x] Ingredient-Search auf Owner-Sicht plus Limit begrenzen.
- [x] User-private Rezepte/Imports ohne aktiven Haushalt erlauben; Planner und
  Shopping bleiben haushaltsstreng.

### Phase 3: Planner und Shopping Guardrails — abgeschlossen 2026-06-06

Ziel: Haushaltsdaten duerfen nur Haushaltsrezepte desselben Haushalts
referenzieren.

- [x] `POST /api/v1/planner` auf Haushaltsrezepte begrenzen.
- [x] `POST /api/v1/shopping` auf Haushaltsrezepte begrenzen, wenn `recipe_id`
  gesetzt ist.
- [x] Private Rezepte direkt blockieren; Copy-Flow bleibt Folge-Slice.
- [x] RLS-Smoke um fremde/private `recipe_id`-Faelle erweitern.

### Phase 4: Mobile Auth UX — API-Vertrag abgesichert 2026-06-06

Ziel: Auth-Fehler werden sichtbar und nutzbar behandelt, statt als leere
Rezepte oder stilles Versagen aufzutauchen.

- [x] API-Wrapper bewahrt `auth_missing` fuer login-pflichtige Recipe-Reads.
- [x] Mobile-Unit-Suite bestaetigt bestehende Recipe-List/Detail-Fallbacks.
- [x] Planner/Shopping-API blockiert private Recipe-IDs serverseitig.
- [ ] Voller Copy-or-Blocker-UX fuer private Rezepte bleibt Folge-Slice mit
  Copy-/Share-Flow.

### Phase 5: Verification und Ship-Gate — lokal gruen 2026-06-06

Ziel: Ein kompletter Ownership-Slice wird mit harten Gates verifiziert, bevor
er als erledigt gilt.

- [x] `npx tsc --noEmit`
- [x] `npm run test:unit`
- [x] `npm run test:auth`
- [x] `npm --prefix mobile run test:unit`
- [x] `npm run test:mobile:rntl-guard`
- [x] `npx supabase db reset --local --yes`
- [x] `npm run supabase:rls-smoke`
- [x] `npx supabase db lint --local`
- [x] `npm run security:secrets`

## Implementierungsreihenfolge

1. Phase 1 mit Schema, Migration und RLS abschliessen.
2. Phase 2 auf den neuen Ownership-Helper umstellen.
3. Phase 3 fuer Planner und Shopping absichern.
4. Phase 4 fuer Mobile-Auth-UX und Fehlerzustand bauen.
5. Phase 5 als gemeinsames Ship-Gate laufen lassen.

## Offene Folge-Slices

- Copy-/Share-Flow: privat zu Haushalt, Haushalt zu privat, Haushalt zu
  Haushalt.
- Private und Haushalts-Favoriten/Collections.
- UX fuer "privates Rezept im Haushalt verwenden".
- Optional spaetere Data-API-RLS-Oeffnung fuer `recipes`.
- BYOK/API-Key-Ownership und Plattform-Credentials.
- DB-backed Recipe-/Ingredient-Search, sobald reale sichtbare Rezeptmengen oder
  Performance-Messungen das noetig machen.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | not run | Ownership decisions were made directly with user input before this review |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | not run | Outside voice skipped for this plan review |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues resolved | 7 issues found, 0 critical gaps after plan updates |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | UI behavior noted for mobile auth states; no visual review run |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | No DX review run |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — ready to implement Ownership Core.

### Eng Review Summary

- Step 0: Scope Challenge — scope accepted as Ownership Core, not Interim.
- Architecture Review: 3 issues found and resolved.
- Code Quality Review: 1 issue found and resolved.
- Test Review: coverage diagram produced; 2 gaps identified and resolved in plan.
- Performance Review: 1 issue found and resolved.
- NOT in scope: global templates, public recipe catalog, admin recipe editor,
  legacy claim flow, pro-recipe roles, direct Recipes Data API, share UX,
  favorites/collections, BYOK/platform credential ownership, DB-backed search.
- What already exists: Supabase AuthContext, household memberships,
  shopping/planner RLS smoke, mobile `apiFetch`, route auth tests, DB helper
  tests. Plan reuses these and replaces only the old `user_id is null`
  visibility rule.
- TODOS.md updates: no new TODO proposals; existing TODO already points to this
  Ownership Slice and follow-up sharing/favorites slices.
- Failure modes: 0 silent critical gaps after adding auth-required reads,
  private RLS helper, migration smoke, mobile auth-error UX tests, and search
  cap.
- Outside voice: skipped.
- Parallelization: 3 lanes possible. Lane A schema/DB/RLS, Lane B server routes
  and helper predicates after schema shape is fixed, Lane C mobile UX tests after
  auth error contract is fixed. Merge A before final B/C verification.
- Lake Score: 7/7 recommendations chose complete option.

### Coverage Diagram

```text
CODE PATHS                                              USER FLOWS
[+] supabase/migrations recipes ownership               [+] First app open after login
  ├── [GAP->PLAN] add owner columns/constraints             ├── [GAP->PLAN] recipe list requires auth
  ├── [GAP->PLAN] drop recipes.user_id                      ├── [GAP->PLAN] auth_missing shows login state
  ├── [GAP->PLAN] reject missing/double owner               └── [GAP->PLAN] no global empty-list confusion
  └── [GAP->PLAN] private RLS helper for refs

[+] src/db-react.ts recipe helpers                       [+] Recipe ownership
  ├── [GAP->PLAN] private owner visibility                  ├── [GAP->PLAN] create private by default
  ├── [GAP->PLAN] household member visibility               ├── [GAP->PLAN] household create needs membership
  ├── [GAP->PLAN] mutate private owner only                 ├── [GAP->PLAN] household member edits recipe
  ├── [GAP->PLAN] mutate household member only              └── [GAP->PLAN] foreign recipe returns 404
  └── [GAP->PLAN] ingredient search owner + limit

[+] src/routes/planner.ts / shopping                    [+] Planner/shopping
  ├── [GAP->PLAN] reject private recipe_id                  ├── [GAP->PLAN] private recipe needs copy first
  ├── [GAP->PLAN] reject foreign household recipe_id        └── [GAP->PLAN] household recipe can be planned
  └── [GAP->PLAN] accept active-household recipe_id

COVERAGE TARGET: all listed paths need tests before ship.
QUALITY TARGET: root unit + migration smoke + RLS smoke + mobile auth UX tests.
```

### Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [x] **T1 (P1, human: ~1h / CC: ~10min)** — recipes — Make recipe reads auth-required in the plan and implementation.
  - Surfaced by: Architecture Issue 1 — anonymous recipe reads were ambiguous after global templates were removed.
  - Files: `src/routes/recipes.ts`, `mobile/app/(tabs)/index.tsx`, `mobile/app/recipe/[id].tsx`
  - Verify: `npm run test:auth`, `npm --prefix mobile run test:unit`
- [x] **T2 (P1, human: ~2h / CC: ~20min)** — rls — Use a private RLS helper for planner/shopping recipe ownership checks.
  - Surfaced by: Architecture Issue 2 — shopping/planner Data API policies cannot directly rely on closed recipes table access.
  - Files: `supabase/migrations`, `scripts/supabase/rls-smoke.ts`
  - Verify: `npx supabase db reset --local --yes`, `npm run supabase:rls-smoke`
- [x] **T3 (P2, human: ~1h / CC: ~10min)** — recipes — Centralize recipe ownership predicates.
  - Surfaced by: Architecture Issue 3 — helper signatures did not guarantee one source of truth for private and household visibility.
  - Files: `src/db-react.ts`, `src/routes/recipes.ts`, `src/routes/planner.ts`
  - Verify: `npm run test:unit -- --run test/unit/db-react.test.ts test/unit/recipes-routes.test.ts test/unit/planner-routes.test.ts`
- [x] **T4 (P2, human: ~45min / CC: ~10min)** — schema — Drop `recipes.user_id` during ownership migration.
  - Surfaced by: Code Quality Issue 4 — keeping `user_id` around preserves stale global/unauthenticated semantics.
  - Files: `src/schema.ts`, `supabase/migrations`, `test/unit/db-react.test.ts`
  - Verify: `npx tsc --noEmit`, migration smoke
- [x] **T5 (P1, human: ~2h / CC: ~20min)** — migration — Add automated ownership migration smoke.
  - Surfaced by: Test Issue 5 — hard reset/drop-user_id migration needed direct assertions, not only route tests.
  - Files: `scripts/supabase/rls-smoke.ts`, `supabase/migrations`
  - Verify: `npm run supabase:rls-smoke`
- [x] **T6 (P2, human: ~1.5h / CC: ~15min)** — mobile — Add mobile auth-error UX tests for recipe flows.
  - Surfaced by: Test Issue 6 — auth-required recipe reads need visible mobile login/session states.
  - Files: `mobile/test`, `mobile/app/(tabs)/index.tsx`, `mobile/app/recipe/[id].tsx`
  - Verify: `npm --prefix mobile run test:unit`, `npm run test:mobile:rntl-guard`
- [x] **T7 (P2, human: ~30min / CC: ~5min)** — performance — Cap ingredient search and test owner-scoped limits.
  - Surfaced by: Performance Issue 7 — in-memory ingredient search needed explicit bounds under ownership filtering.
  - Files: `src/db-react.ts`, `src/routes/recipes.ts`, `test/unit/recipes-routes.test.ts`
  - Verify: `npm run test:unit -- --run test/unit/recipes-routes.test.ts`
