# Slice 5: Collections and Invites Offline Write Path Plan

Stand: 2026-07-08
Status: erster Scope lokal umgesetzt
Masterplan:
[2026-07-08-recipes-sharing-followups-master-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-07-08-recipes-sharing-followups-master-plan.md)

## Ziel

Ausgewaehlte Collection-Mutationen sollen offline vormerkbar sein und bei
Netzwerk-Reconnect synchronisieren. Recipe-Invite-Erstellung wird nur dann in
den Offline-Pfad aufgenommen, wenn der Idempotenz- und Mailversand-Vertrag klar
ist.

## Ergebnis 2026-07-08

- Collection-Item-Mutationen `add`, `remove`, `reorder` und `bulk-remove`
  koennen offline ueber die bestehende Mutation-Queue vorgemerkt werden.
- Queue-Objektkoerper bekommen fuer POST/PATCH/DELETE ein `client_op_id`.
- Invite-Erstellung bleibt online-only, um wiederholten Mailversand durch
  Queue-Retry zu vermeiden.
- Bulk-Copy sowie Collection-Erstellen/-Umbenennen/-Loeschen bleiben im ersten
  Scope online-only; dafuer fehlt noch ein sauberer Temp-ID- und
  Idempotenzvertrag.

## Nicht-Ziele

- keine vollstaendige Offline-Recipe-Editing-Suite
- kein Offline-Accept von Invite-Links
- kein mehrfacher Mailversand durch naive Retry-Queue
- kein Konflikteditor fuer alle moeglichen Collection-Races

## Bestehende Basis

Shopping und Planner nutzen bereits eine Offline-Mutation-Queue. Dieser Slice
soll diese Basis wiederverwenden, aber nicht blind kopieren:

- Collections haben Scope-Regeln ueber private/household Owner.
- Household-Kopien koennen serverseitig entstehen.
- Bulk und Sortierung erzeugen andere Konflikte als Shopping-Items.
- Invite-Erstellung kann externe Mail ausloesen.

## Scope

Empfohlen fuer ersten Offline-Scope:

- Collection erstellen
- Collection umbenennen
- Recipe zu Collection hinzufuegen
- Recipe aus Collection entfernen
- Reorder nach Slice 3, falls `position` stabil ist

Vorerst online-only:

- Recipe-Invite erstellen und Mail senden
- Invite akzeptieren
- Rollen-/Permission-Aenderungen
- Bulk-Copy ueber Haushaltsgrenzen

## API-Anforderungen

Alle offline-faehigen Mutationen brauchen:

- `clientOpId`
- idempotentes Serververhalten
- stabile Fehlercodes
- Response mit tatsaechlichem Serverzustand

Moegliche Erweiterungen:

- `recipe_collections.client_op_id` fuer Create-Idempotenz
- `recipe_collection_items.client_op_id` fuer Add-Idempotenz, falls der
  bestehende Unique Guard nicht ausreicht
- Reorder-Endpoint mit `clientOpId` und Versions-/Updated-at-Pruefung

## Konfliktregeln

Collection erstellen:

- gleicher `clientOpId` erzeugt nie zweite Collection

Collection umbenennen:

- letzter erfolgreicher Server-Write gewinnt fuer ersten Slice
- bei 404/403 Queue-Item als fehlgeschlagen markieren

Item hinzufuegen:

- wenn Collection noch existiert und Rezept sichtbar ist, Server fuehrt
  normale Add-Regeln aus
- private Rezeptquelle plus Haushaltsliste kann online eine Haushaltskopie
  erzeugen
- wenn Rezept/Collection nicht mehr sichtbar ist, sichtbarer Sync-Fehler

Item entfernen:

- idempotent: bereits entfernt gilt als Erfolg oder stabiler `already_removed`
  Zustand

Reorder:

- nur nach Slice 3
- bei geaenderter Item-Menge entweder serverseitig normalisieren oder Client
  muss Liste neu laden

## Mobile

UX:

- Offline-Aktion wird sofort lokal optimistisch sichtbar, wenn Risiko niedrig
  ist.
- Pending-Indikator pro Item/Collection.
- Fehlgeschlagene Queue-Items koennen erneut versucht oder verworfen werden.
- Invite-Erstellung zeigt online-only, solange Mailversand nicht idempotent
  gequeued ist.

Cache-Key-Regel:

- Queue-Keys muessen User und Household/Zielhaushalt enthalten.
- Keine Mutation darf nach Accountwechsel in den falschen Scope synchronisieren.

## Tests

Unit:

- Queue serialisiert Collection-Mutationen.
- `clientOpId` wird gesetzt und wiederverwendet.
- Account-/Household-Wechsel stoppt falsche Replay-Ziele.
- 401/403/404 werden als dauerhafte oder auth-abhaengige Fehler klassifiziert.

Server:

- idempotente Create/Add/Remove-Pfade.
- duplicate `clientOpId` erzeugt keine Duplikate.
- Scope-Grenzen bleiben bei Replay erhalten.

Integration/Staging:

- Offline Add, Reload, Reconnect, Serverzustand korrekt.
- Accountwechsel vor Replay synchronisiert nicht in falschen Account.

## Umsetzungsschritte

1. Offline-faehige Mutationen final auswaehlen.
2. Server-Idempotenzluecken schliessen.
3. Mobile-Queue-Adapter fuer Collections bauen.
4. Optimistische UI minimal anbinden.
5. Fehler-/Retry-UI nachziehen.
6. Staging-Smoke mit Netzwerk-Off/Online-Browserpfad.

## Risiken

- Mailversand darf nicht mehrfach durch Queue-Retry passieren.
- Household-Kopien entstehen serverseitig; lokale optimistische UI darf nicht
  falsche Recipe-IDs dauerhaft anzeigen.
- Reorder-Konflikte koennen komplex werden; fuer ersten Offline-Slice lieber
  ohne Reorder starten, falls Slice 3 noch nicht stabil genug ist.
