# Slice 3: Collection Sorting and Bulk Actions Plan

Stand: 2026-07-08
Status: geplant
Masterplan:
[2026-07-08-recipes-sharing-followups-master-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-07-08-recipes-sharing-followups-master-plan.md)

## Ziel

Collections sollen bei wachsender Nutzung effizient gepflegt werden koennen:
stabile Reihenfolge, einfache Sortieroptionen und fokussierte Bulk-Aktionen.

## Nicht-Ziele

- kein komplexer Kanban-/Board-Modus
- keine automatische KI-Sortierung
- kein Drag-and-drop als Pflicht fuer den ersten Slice
- keine Bulk-Bearbeitung der Rezeptinhalte selbst

## Produktvertrag

Erster Scope:

- explizite Reihenfolge innerhalb einer Collection
- Bulk-Remove aus einer Collection
- Bulk-Copy/Add in eine andere Collection, soweit Scope-Regeln passen
- optional einfache Sortieransichten: `zuletzt hinzugefuegt`, `Titel`,
  `manuell`

Nicht im ersten Scope:

- Bulk-Delete von Rezepten
- Bulk-Share an Personen
- Cross-Household-Bulk ohne Zielhaushalt-Entscheidung aus Slice 2

## Datenmodell

Option:

- `recipe_collection_items.position numeric null` oder `sort_order integer null`

Empfehlung:

- `position integer not null default 0` plus Rebalancing bei Reorder reicht fuer
  den ersten Slice.
- Bestehende Reihenfolge per Migration aus `created_at` initialisieren.

Indexe:

- `(collection_id, position)`
- bestehendes `(collection_id, recipe_id)` bleibt Unique Guard

## API

Neue oder erweiterte Endpoints:

- `PATCH /api/v1/recipe-collections/:id/items/reorder`
- `POST /api/v1/recipe-collections/:id/items/bulk-remove`
- `POST /api/v1/recipe-collections/:id/items/bulk-copy`

Regeln:

- Jede Bulk-Aktion prueft Collection-Mutationsrecht einmal und Item-Scope pro
  betroffenem Rezept.
- Bulk-Antwort enthaelt `succeeded`, `skipped` und `failed` mit stabilen Codes.
- Kein partielles stilles Scheitern.
- Reorder akzeptiert nur Items, die bereits in der Collection liegen.

## Mobile

UX:

- Auswahlmodus in Collection-Detail.
- Mehrfachauswahl mit sichtbarer Anzahl.
- Aktionen: Entfernen, In Collection kopieren.
- Sortiermenu fuer `Manuell`, `Neueste`, `Titel`.
- Reorder nur, wenn die Plattform/Komponente stabil ist; sonst manuelle
  Reihenfolge spaeter per Up/Down oder separatem Drag-Slice.

## Tests

Server:

- Reorder veraendert nur Items der erlaubten Collection.
- Bulk-Remove loescht Listeneintraege, nicht Rezepte.
- Bulk-Copy respektiert private/household Scope-Regeln.
- Fremde Collection liefert 404/403.
- Teilfehler sind in der Antwort sichtbar.

Mobile:

- Auswahlmodus an/aus.
- Bulk-Remove aktualisiert Liste.
- Sortierauswahl aendert Query/Local View korrekt.
- Fehler bei Teilmengen werden angezeigt.

Migration:

- Bestehende Items bekommen stabile Positionen.
- Unique Guards bleiben intakt.

## Umsetzungsschritte

1. Datenmodell fuer Position festlegen.
2. Migration und Backfill schreiben.
3. Server-API fuer Reorder und Bulk-Remove.
4. Bulk-Copy nur implementieren, wenn Scope-Regeln aus Slice 2 stabil sind.
5. Mobile-Auswahlmodus und Sortiermenu.
6. Tests und Staging-Smoke mit grosserer Collection.

## Risiken

- Drag-and-drop kann mobile/web unterschiedlich instabil sein.
- Position-Rebalancing kann bei Offline Writes spaeter relevant werden.
- Bulk-Copy darf keine unbemerkten Haushaltskopien in falschen Zielhaushalten
  erzeugen.
