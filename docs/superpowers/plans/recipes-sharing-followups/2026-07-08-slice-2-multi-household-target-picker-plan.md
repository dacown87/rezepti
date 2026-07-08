# Slice 2: Multi-Household Target Picker Plan

Stand: 2026-07-08
Status: lokal umgesetzt, vor Staging-Smoke
Masterplan:
[2026-07-08-recipes-sharing-followups-master-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-07-08-recipes-sharing-followups-master-plan.md)

## Ziel

Nutzer mit mehreren Haushalten sollen bei passenden Recipe-/Collection-Aktionen
einen Zielhaushalt auswaehlen koennen. Der aktive Haushalt bleibt Default, aber
nicht die einzige erlaubte Zielgrenze.

## Ergebnis 2026-07-08

- Share- und Collection-Item-Mutationen akzeptieren explizite Zielhaushalte und
  validieren Memberships serverseitig.
- `GET /api/v1/recipe-collections` kann nach `ownerType` und `householdId`
  filtern.
- Mobile nutzt Memberships aus `auth/me`, zeigt bei mehreren Haushalten einen
  Zielpicker und filtert Haushaltslisten passend zum Zielhaushalt.
- Collection-Clienttypen fuehren `household_id` mit.

## Nicht-Ziele

- kein kompletter Household-Switcher fuer die ganze App
- kein Household-Invite-Onboarding
- kein Rollenumbau ueber bestehende Membership-Rollen hinaus
- keine direkte Kopie von Haushalt A nach Haushalt B ohne expliziten
  Copy-Vertrag

## Produktvertrag

Erster Scope:

- private Rezepte in eine Haushaltsliste eines ausgewaehlten Haushalts legen
- private Rezepte in einen ausgewaehlten Haushalt kopieren
- Haushaltslisten nach Zielhaushalt filtern

Nicht im ersten Scope:

- Haushaltsrezept von Haushalt A direkt in Haushalt B verschieben
- alle App-Daten auf einen anderen aktiven Haushalt umstellen
- globale Navigation fuer Multi-Workspace

## API

Noetige Read-Modelle:

- `GET /api/v1/auth/me` oder ein neuer fokussierter Endpoint muss die
  Memberships liefern, falls der Client sie noch nicht stabil hat.
- Collections-Liste muss per `ownerType` und optional `householdId` filterbar
  sein.

Mutationserweiterungen:

- `POST /api/v1/recipes/:id/share`
  - akzeptiert optional `target.householdId`
  - prueft Membership
  - erzeugt Haushaltskopie im Zielhaushalt
- `POST /api/v1/recipe-collections/:id/items`
  - Collection-ID bleibt die primaere Zielgrenze
  - wenn zusaetzlich `targetHouseholdId` kommt, muss sie zur Collection passen
    oder abgelehnt werden

Fehlercodes:

- `target_household_forbidden`
- `target_household_not_found`
- `target_household_mismatch`
- `unsupported_cross_household_copy`

## Datenmodell

Wahrscheinlich kein neues Datenmodell noetig.

Pruefen:

- Indexe auf `household_memberships(user_id)` und `recipe_collections(household_id)`
  sind fuer Zielauswahl ausreichend.
- Bestehende `source_recipe_id`-Idempotenz fuer Haushaltskopien funktioniert
  auch, wenn Zielhaushalt explizit statt aktiv ist.

## Mobile

Betroffene Stellen:

- Recipe-Detail-Share-/Add-to-Collection-Flow
- Collection-Auswahl
- evtl. Settings/Account-Anzeige fuer aktuelle Memberships

UX-Regeln:

- Wenn nur ein Haushalt existiert, kein Picker.
- Wenn mehrere Haushalte existieren, Zielhaushalt als kurze Auswahl vor oder in
  der Collection-Auswahl.
- Aktiver Haushalt ist vorausgewaehlt.
- Haushaltslisten werden nach Zielhaushalt gruppiert oder gefiltert.
- Der Text fuer private Rezepte bleibt ehrlich:
  `Als Haushaltskopie in <Haushalt> hinzufuegen`.

## Tests

Server:

- User mit zwei Haushalten kann in Zielhaushalt A kopieren.
- User kann nicht in fremden Haushalt kopieren.
- Collection-Ziel und expliziter `targetHouseholdId` duerfen nicht
  auseinanderfallen.
- Private-zu-Haushalt-Kopie bleibt idempotent pro Zielhaushalt und Collection.

Mobile:

- Picker erscheint nur bei mehreren Haushalten.
- Aktiver Haushalt ist Default.
- Auswahl sendet die richtige Ziel-ID.
- 403/404 Fehler werden sichtbar, nicht als leere Liste geschluckt.

Staging:

- Smoke mit einem User in zwei Haushalten und einem zweiten User ohne Zugriff.

## Umsetzungsschritte

1. Aktuelles Membership-Read-Model im Client pruefen.
2. API-Filter und explizite Zielparameter minimal erweitern.
3. Server-Tests fuer erlaubte und verbotene Zielhaushalte.
4. Mobile-Picker in bestehenden Add-/Share-Fluss integrieren.
5. Mobile-Tests fuer Single- und Multi-Household.
6. Staging-Smoke.

## Risiken

- Verwechslung zwischen aktivem Haushalt und Zielhaushalt.
- Cache-Keys muessen `householdId` enthalten, sonst zeigen Collections falsche
  Listen.
- Cross-Household-Kopien koennen Datenschutz unklar machen; deshalb nur private
  Quelle in Zielhaushalt im ersten Scope.
