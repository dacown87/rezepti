# Slice 4: Household Collection Role Refinement Plan

Stand: 2026-07-08
Status: geplant
Masterplan:
[2026-07-08-recipes-sharing-followups-master-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-07-08-recipes-sharing-followups-master-plan.md)

## Ziel

Haushaltslisten sollen bei Bedarf feinere Mutationsrechte bekommen. Heute duerfen
Haushaltsmitglieder Haushaltslisten mutieren. Der Slice fuehrt nur dann neue
Regeln ein, wenn die Produktentscheidung klar ist, welche Aktionen geschuetzt
werden muessen.

## Nicht-Ziele

- kein vollstaendiges Organisations-/Team-Rollenmodell
- kein Rollen-Editor fuer alle App-Bereiche
- kein Household-Invite-Onboarding
- keine Moderation oder Audit-Timeline

## Entscheidungsfrage vor Umsetzung

Welche Matrix ist das Ziel?

Option A: Bestehende Household-Rollen nutzen

- `owner`: Listen erstellen, umbenennen, loeschen, Items mutieren
- `member`: Items hinzufuegen/entfernen, aber Listen nicht loeschen

Option B: Collection-spezifische Rollen

- pro Collection `manager`/`contributor`/`viewer`
- flexibler, aber deutlich mehr Datenmodell und UI

Empfehlung fuer ersten Slice:

- Option A, solange keine echte Nutzeranforderung fuer
  collection-spezifische Rollen existiert.

## Datenmodell

Option A:

- kein neues Collection-Rollenmodell
- Server nutzt `household_memberships.role`

Moegliche kleine Erweiterung:

- `recipe_collections.created_by` wird fuer Owner-Only-Sonderfaelle genutzt,
  aber nicht als Sicherheitsgrenze fuer Haushaltsowner ersetzt.

Option B:

- neue Tabelle `recipe_collection_memberships`
- wird vorerst nicht empfohlen.

## API

Betroffene Endpoints:

- `POST /api/v1/recipe-collections`
- `PATCH /api/v1/recipe-collections/:id`
- `DELETE /api/v1/recipe-collections/:id`
- `POST /api/v1/recipe-collections/:id/items`
- `DELETE /api/v1/recipe-collections/:id/items/:recipeId`
- Bulk-Endpoints aus Slice 3

Regeln fuer Option A:

- Owner darf alle Collection-Mutationen im Haushalt.
- Member darf Items mutieren, wenn Produktregel das erlaubt.
- Member darf Haushaltscollection nicht loeschen oder umbenennen.
- Private Collections bleiben nur Owner-mutierbar.

## RLS und Grants

- Direkte Data-API-Schreibrechte bleiben geschlossen oder enger als Server-API.
- RLS muss Read fuer Haushaltsmitglieder erlauben.
- Falls direkte Writes fuer authenticated irgendwann geoeffnet werden, muessen
  Policies dieselbe Rollenmatrix abbilden.
- Supabase Advisors nach Migration/Policy-Aenderung laufen lassen.

## Mobile

UX:

- Nicht erlaubte Aktionen verstecken oder disabled darstellen.
- 403 aus der API als Berechtigungszustand anzeigen.
- Kein Rollenmanagement bauen, falls Option A gewaehlt wird.

## Tests

Server:

- Owner darf Collection umbenennen/loeschen.
- Member darf erlaubte Item-Aktion.
- Member darf verbotene Collection-Aktion nicht.
- Fremder Haushalt bleibt 404/403.
- Private Collection bleibt privat.

RLS:

- Read-Vertrag fuer Haushaltsmitglieder bleibt.
- Keine direkten Writes ausserhalb des erlaubten Vertrags.

Mobile:

- Rollenbasiert ausgeblendete Aktionen.
- 403 wird als Berechtigungsfehler angezeigt.

## Umsetzungsschritte

1. Rollenmatrix final entscheiden.
2. Server-AuthZ-Helper fuer Collection-Mutationsarten trennen.
3. Tests fuer Owner/Member/Fremder.
4. Falls noetig Migration/RLS-Anpassung.
5. Mobile-Aktionssichtbarkeit nachziehen.
6. Staging-RLS-Smoke und zielgerichteter App-Smoke.

## Risiken

- Rollenregeln koennen Nutzer ueberraschen, wenn bisher alle gemeinsam Listen
  pflegen konnten.
- RLS und Server koennen auseinanderlaufen; Tests muessen beide Grenzen pruefen.
- Collection-spezifische Rollen waeren ein groesserer Produktbereich und sollten
  nicht nebenbei entstehen.
