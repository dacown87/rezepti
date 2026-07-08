# Recipes Sharing Follow-ups Master Plan

Stand: 2026-07-08
Status: lokal umgesetzt, vor Deploy-Staging/Production-Smoke

Vorgaenger:

- [Recipes Sharing, Favorites & Collections Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-23-recipes-sharing-favorites-collections-plan.md)
- [Household Lists and Recipe Invites Design](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-07-07-household-lists-and-recipe-invites-design.md)
- [Household Lists and Recipe Invites Implementation Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-07-07-household-lists-and-recipe-invites-implementation-plan.md)

## Ausgangslage

Der Grundschnitt ist auf Production:

- private und Haushaltsrezepte sind getrennte Owner-Objekte
- Favorites und Collections sind eigene Listenobjekte
- Haushaltslisten enthalten Haushaltsrezepte
- ein privates Rezept wird beim Hinzufuegen zu einer Haushaltsliste als
  Haushaltskopie eingefuegt
- direkte Recipe-Invites sind email-gebunden und erzeugen beim Accept private
  Kopien fuer den Empfaenger
- Staging- und Production-Smokes fuer diesen Vertrag sind gruen

Der alte Gesamtplan vom 2026-06-23 bleibt als Zielbild gueltig, ist aber nicht
mehr der operative Plan fuer die naechsten Schritte. Dieser Masterplan beschreibt
die Folge-Slices nach dem Production-Rollout vom 2026-07-08.

## Implementierungsstand 2026-07-08

Die fuenf Folge-Slices sind lokal umgesetzt und automatisiert verifiziert.

- Slice 1 liefert Invite-Mailversand ueber eine kleine Mail-Service-Schicht mit
  Disabled-Fallback und Resend-Provider. Die Invite-API gibt `shareUrl` und
  `delivery` zurueck; Mobile unterscheidet `sent`, `skipped` und `failed` und
  behaelt den manuellen Share-Link als Fallback.
- Slice 2 erweitert Share-/Collection-Mutationen um explizite Zielhaushalte.
  Mobile zeigt bei mehreren Memberships einen Zielpicker fuer Haushaltskopien
  und Haushaltslisten.
- Slice 3 fuehrt `recipe_collection_items.position`, Reorder, Bulk-Remove,
  Bulk-Copy und die mobile Collection-Auswahl-/Sortieransicht ein.
- Slice 4 nutzt die vorhandenen Household-Rollen: Owner koennen
  Haushalts-Collections erstellen/umbenennen/loeschen; Member duerfen Items
  mutieren, aber keine Listen-Metadaten verwalten.
- Slice 5 haengt ausgewaehlte Collection-Item-Schreibpfade an die bestehende
  Offline-Queue. Invite-Erstellung bleibt bewusst online-only, Bulk-Copy und
  Collection-Metadaten bleiben online, bis dafuer ein separater
  Idempotenz-/Konfliktvertrag existiert.

Lokale Verifikation:

- `npm run test:unit -- --run test/unit/mail.test.ts test/unit/recipe-share-invites-routes.test.ts test/unit/recipe-collections-routes.test.ts`
- `npm --prefix mobile run test:unit -- --run test/queued-mutate.test.ts test/collections-hooks.test.ts test/recipe-detail-sharing.test.tsx test/collection-contents-screen.test.tsx`
- `npm run mobile:typecheck`
- `npm run security:secrets`
- `git diff --check`

Noch offen vor Production:

- Migration `20260708031603_recipe_collection_item_positions.sql` auf Staging
  anwenden.
- Staging-Smoke fuer Zielhaushalt, Bulk/Reorder, Rollen und Offline-Queue
  durchfuehren.
- Mail-Provider-Secrets fuer Staging/Production setzen, falls echter Versand
  statt Disabled-Fallback gewuenscht ist.

## Zielbild

Rezepti soll Sharing und Haushaltsorganisation so bedienen, dass Nutzer:

1. ein Rezept an eine Person schicken koennen, ohne manuell einen Link kopieren
   zu muessen
2. Rezepte gezielt in einen ihrer Haushalte oder eine Haushaltsliste legen
   koennen, nicht nur in den aktuell aktiven Haushalt
3. groessere Collections effizient pflegen koennen
4. Haushaltslisten mit Rollenregeln steuern koennen, wenn einfache
   Mitgliedsrechte zu grob werden
5. wichtige Collection-Aktionen auch offline vormerken koennen, sobald die
   Online-APIs und Konfliktregeln stabil sind

## Reihenfolge

### Slice 1: Recipe-Invite Email Delivery

Plan:
[2026-07-08-slice-1-recipe-invite-email-delivery-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/recipes-sharing-followups/2026-07-08-slice-1-recipe-invite-email-delivery-plan.md)

Warum zuerst:

- Die Invite-API ist bereits produktiv.
- Der aktuelle Link-Rueckgabe-Flow ist technisch korrekt, aber kein fertiger
  Nutzerfluss.
- Dieser Slice hat geringe Datenmodell-Risiken, solange Versandstatus und
  Fehlerbehandlung sauber begrenzt bleiben.

Ergebnis:

- `POST /api/v1/recipes/:id/share-invites` kann optional oder standardmaessig
  eine echte E-Mail versenden.
- Mobile zeigt den Unterschied zwischen "Invite erstellt" und "Mail versendet"
  korrekt.
- Staging-Smoke deckt mindestens einen Mail-Provider-Testpfad ab, ohne
  Production-Empfaenger zu spammen.

### Slice 2: Multi-Household Target Picker

Plan:
[2026-07-08-slice-2-multi-household-target-picker-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/recipes-sharing-followups/2026-07-08-slice-2-multi-household-target-picker-plan.md)

Warum danach:

- Haushaltslisten und Haushaltskopien existieren bereits.
- Der naechste Engpass ist die Zielwahl jenseits des aktiven Haushalts.
- Dieser Slice muss den Active-Household-Vertrag respektieren, ohne heimlich ein
  globales Workspace-Switching umzubauen.

Ergebnis:

- Nutzer koennen fuer erlaubte Aktionen einen Zielhaushalt aus ihren
  Memberships waehlen.
- API akzeptiert explizite `targetHouseholdId` nur, wenn die Membership passt.
- Mobile kann private Rezepte in eine Liste eines ausgewaehlten Haushalts legen.

### Slice 3: Collection Sorting and Bulk Actions

Plan:
[2026-07-08-slice-3-collection-sort-bulk-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/recipes-sharing-followups/2026-07-08-slice-3-collection-sort-bulk-plan.md)

Warum nach dem Zielpicker:

- Sortierung und Bulk-Aktionen werden erst wertvoll, wenn Haushaltslisten aktiv
  genutzt werden.
- Die Datenmodellfrage `position`/`sort_order` sollte nicht mit
  Zielhaushaltslogik vermischt werden.

Ergebnis:

- Collections haben eine stabile explizite Reihenfolge.
- Nutzer koennen mehrere Rezepte gesammelt aus einer Collection entfernen oder
  in eine andere Collection kopieren.
- Tests pruefen Scope-Grenzen fuer Bulk-Mutationen.

### Slice 4: Household Collection Role Refinement

Plan:
[2026-07-08-slice-4-household-collection-roles-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/recipes-sharing-followups/2026-07-08-slice-4-household-collection-roles-plan.md)

Warum spaeter:

- Aktuell duerfen Haushaltsmitglieder Haushaltslisten mutieren.
- Rollenfeinheit ist erst dann sinnvoll, wenn reale Nutzung zeigt, welche
  Aktionen eingeschraenkt werden muessen.
- Dieser Slice beruehrt RLS, Server-Autorisierung und UI-Erklaerbarkeit.

Ergebnis:

- Haushaltslisten haben klare Mutationsrechte fuer Owner/Admin/Member oder eine
  bewusst kleinere Rollenmatrix.
- API und RLS erzwingen denselben Vertrag.
- Mobile zeigt nicht erlaubte Aktionen nicht an und behandelt 403 robust.

### Slice 5: Offline Write Path for Collections and Invites

Plan:
[2026-07-08-slice-5-collections-invites-offline-write-path-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/recipes-sharing-followups/2026-07-08-slice-5-collections-invites-offline-write-path-plan.md)

Warum zuletzt:

- Offline Writes brauchen stabile Online-Semantik und idempotente Server-APIs.
- Shopping und Planner haben bereits eine Queue, aber Collections/Invites haben
  andere Konflikte: Kopien, Zielhaushalte, ablaufende Tokens und Mailversand.
- Invite-Erstellung mit E-Mail-Versand sollte nicht blind offline wiederholt
  werden, ohne Idempotenz und Nutzerfeedback zu klaeren.

Ergebnis:

- Ausgewaehlte Collection-Mutationen koennen offline gequeued werden.
- Invite-Erstellung bleibt entweder online-only oder bekommt einen expliziten,
  idempotenten Queue-Vertrag.
- Mobile zeigt ausstehende, synchronisierte und fehlgeschlagene Mutationen pro
  Collection nachvollziehbar.

## Abhaengigkeiten

```text
Production-Basis 2026-07-08
  -> Slice 1 Email Delivery
  -> Slice 2 Multi-Household Target Picker
       -> Slice 3 Sorting/Bulk
       -> Slice 4 Roles
            -> Slice 5 Offline Writes
```

Slice 3 und Slice 4 koennen nach Slice 2 parallel vorbereitet werden. Slice 5
sollte erst nach Slice 3 beginnen, weil Bulk-/Sortiermutationen sonst spaeter
erneut in die Offline-Queue integriert werden muessen.

## Gemeinsame Regeln fuer alle Slices

- Sharing bleibt Kopieren, nie gemeinsames Mutieren desselben Rezeptdatensatzes.
- Haushaltslisten bleiben Haushaltslisten.
- Direkt an Personen geteilte Rezepte werden private Kopien.
- Server-Autorisierung ist die primaere Grenze; Mobile-UI ist nur Erklaerung.
- Supabase-RLS und Grants duerfen keine direkteren Rechte eroeffnen als die
  Server-API.
- Jede neue Mutation braucht Idempotenz- oder Wiederholungsregeln.
- Staging-Smoke kommt vor Production-Rollout.

## Gemeinsame Verifikation

Minimum je Slice:

- Root-Unit-Tests fuer API/AuthZ/DB-Helfer
- Mobile-Unit-Tests fuer API-Client, Hooks und sichtbare UI-Zustaende
- `npm run security:secrets`
- `git diff --check`
- Supabase-RLS-Smoke, wenn Migration oder RLS/Grant betroffen ist
- Staging-Smoke fuer alle Slices mit Datenmodell- oder externem Provider-Anteil

Production-Smoke:

- verpflichtend fuer Slice 1, weil externer Mail-Provider beteiligt ist
- verpflichtend fuer Slice 2, weil Zielhaushalt-Scope produktkritisch ist
- optional fuer Slice 3, wenn nur UI/API ohne Migration ausserhalb von
  `recipe_collection_items` beruehrt wird
- verpflichtend fuer Slice 4 und Slice 5

## Nicht-Ziele dieses Tracks

- kein Public-Rezeptkatalog
- keine gemeinsame Bearbeitung desselben Rezeptdatensatzes ueber Usergrenzen
- kein genereller Household-Invite-/Workspace-Onboarding-Umbau
- kein neues Social-/Activity-Feed-System
- kein Data-API-Open-up fuer Recipes oder Collections
