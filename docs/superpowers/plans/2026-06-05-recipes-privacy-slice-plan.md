# Recipes Ownership Slice Plan

Datum: 2026-06-05
Branch: `multi-auth-continuation`
Status: Plan nach Household-Ownership-Entscheidung ueberarbeitet
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

Die bestehende `user_id`-Spalte soll nicht mehr Sichtbarkeitsquelle bleiben.
Sie kann in der Migrationsphase in `created_by` ueberfuehrt und danach
entfernt oder als technische Altspalte durch `created_by` ersetzt werden. Die
konkrete mechanische Entscheidung faellt beim Migrationsentwurf, aber neue
Route-Logik darf nicht weiter auf `user_id is null` fuer Sichtbarkeit setzen.

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
6. Strenge Constraints setzen.
7. Servercode auf neue Owner-Helper umstellen.

Kein Serverpfad behaelt Legacy-Null-Kompatibilitaet.

## Server-Design

### Sichtbarkeitsregeln

Route-Reads akzeptieren optional Auth nur fuer App-Shell-Kompatibilitaet:

- Ohne Auth: keine privaten oder Haushaltsrezepte ausgeben.
- Mit Auth: private eigene Rezepte plus Haushaltsrezepte der eigenen
  Memberships.

Falls die App fachlich Login fuer Recipes erzwingen soll, kann `GET
/api/v1/recipes` in diesem Slice auth-pflichtig werden. Das ist
produktseitig sauberer, bricht aber unauthenticated E2E-/Web-Smokes. Empfehlung
fuer diesen Slice: unauthenticated Reads liefern eine leere Liste oder einen
klaren Auth-Fehler nur dort, wo Mobile den Login-State sauber behandelt. Keine
globalen Rezeptdaten mehr als Fallback.

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
- `GET /api/v1/recipes` ohne Token liefert keine globalen Daten.
- Detail fremder Rezepte liefert `404`.
- Bildroute fremder Rezepte liefert `404`.
- Ingredient-Search nutzt dieselbe Owner-Sicht wie Recipe-Liste.

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

## Implementierungsreihenfolge

1. Diesen Plan gegen die neue Ownership-Spec als Quelle der Wahrheit committen.
2. Aktuellen Diff in zwei Teile trennen:
   - behalten: Auth-Mutation-Grenze, Job-Ownership, Mobile-Auth-Fehlerpfade
   - ersetzen: globale Default-Read-Semantik
3. Migration fuer Recipe-Owner-Spalten mit Supabase CLI planen.
4. Schema und DB-Helper auf `RecipeOwner` umstellen.
5. Routes auf neues Sichtbarkeitsmodell umstellen.
6. Planner-/Shopping-Referenzvalidierung auf Haushaltsrezepte begrenzen.
7. Tests umschreiben: keine globalen Defaults mehr als erwartetes Verhalten.
8. `npm run test:auth`, relevante Unit-Tests, `npx tsc --noEmit`,
   `npm run supabase:rls-smoke` und Secret-Scan ausfuehren.

## Offene Folge-Slices

- Copy-/Share-Flow: privat zu Haushalt, Haushalt zu privat, Haushalt zu
  Haushalt.
- Private und Haushalts-Favoriten/Collections.
- UX fuer "privates Rezept im Haushalt verwenden".
- Optional spaetere Data-API-RLS-Oeffnung fuer `recipes`.
- BYOK/API-Key-Ownership und Plattform-Credentials.
