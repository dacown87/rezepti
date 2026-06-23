<!-- /autoplan restore point: /home/patrick/.gstack/projects/rezepti/main-autoplan-restore-20260623-102130.md -->
# Recipes Sharing, Favorites & Collections Plan

Stand: 2026-06-23
Status: geplant
Design-Basis: [2026-06-05-recipes-household-ownership-design.md](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-06-05-recipes-household-ownership-design.md)

## Ziel

Rezepti bekommt einen gemeinsamen Produktslice fuer:

- `Sharing` als bewusstes Kopieren eines Rezepts
- `Favorites` als schnelle Merkliste auf derselben Ownership-Basis
- `Collections` als benannte private oder haushaltsbezogene Rezeptlisten
- erste nutzbare UI in Mobile und Web statt nur API-Vorarbeit

Der Slice soll die bereits getroffene Produktregel sauber umsetzen:

- Teilen aendert nie den Owner des Originals.
- Teilen erzeugt immer eine neue Kopie im Zielkontext.
- Favoriten werden nicht als boolesches Feld am Rezept modelliert.
- Collections und Favorites sind eigene Owner-Objekte.

## Warum ein gemeinsamer Slice

`Sharing`, `Favorites` und `Collections` sind fachlich eng gekoppelt:

- Alle drei benoetigen dieselben Ownership-Regeln.
- Alle drei muessen zwischen privaten und haushaltsbezogenen Rezepten
  unterscheiden.
- `Favorites` ist im Zielmodell nur eine spezielle, systemdefinierte
  Collection und sollte nicht separat erfunden werden.

Ein gemeinsamer Slice verhindert drei konkurrierende Modelle fuer dieselbe
Frage: "Wie organisiert oder uebergibt ein Nutzer Rezepte innerhalb seines
Scopes?"

## Empfohlener Zuschnitt

Empfohlen ist ein gemeinsamer Produktslice in mehreren Phasen, aber mit einem
bewusst kleinen ersten Endzustand.

Der erste releasebare Endzustand soll koennen:

1. privates Rezept in den aktiven Haushalt kopieren
2. Haushaltsrezept in eine private Kopie uebernehmen
3. Rezept zu Favoriten hinzufuegen oder daraus entfernen
4. einfache benannte Collections anlegen und Rezepte hinzufuegen oder entfernen
5. dieselben Grundfluesse in Mobile und Web bedienen

Bewusst noch nicht noetig fuer den ersten Endzustand:

1. User-zu-User-Invite- oder Accept-Flow fuer Sharing
2. oeffentliche Share-Links
3. Kollaborationsrechte innerhalb einer Collection
4. Sortierung, Drag-and-drop oder Bulk-Operationen
5. ausgebaute Discovery- oder Recommendation-UX

## Nicht-Ziele

1. Kein Public-Rezeptkatalog.
2. Kein gemeinsames Bearbeiten desselben Rezepts ueber mehrere Owner hinweg.
3. Kein neuer Workspace-/Invite-Mechanismus.
4. Kein Kommentar-, Notiz- oder Activity-Feed an Collections.
5. Kein allgemeines Bookmark-System fuer beliebige Entitaeten ausser Rezepten.
6. Kein Offline-Schreibpfad fuer Collection-Mutationen in diesem ersten Slice.

## Produktregeln

### Sharing

- Sharing bedeutet Kopieren, nie gemeinsames Mutieren.
- Ein privates Rezept kann in den aktiven Haushalt kopiert werden.
- Ein Haushaltsrezept kann in eine private Kopie uebernommen werden.
- Ein Haushaltsrezept kann nicht direkt in einen anderen Haushalt verschoben
  werden; dafuer waere spaeter ein expliziter Zielhaushalt-Flow noetig.
- Die Kopie uebernimmt Inhalt und Medienreferenzen, aber einen neuen Owner.
- Die Kopie behaelt einen optionalen Verweis auf das Ursprungsrezept fuer
  Herkunft und spaetere Diagnose.

### Favorites

- Favorites werden als systemdefinierte Standard-Collection modelliert.
- Jeder User hat genau eine private Favorites-Collection.
- Jeder Haushalt kann genau eine Haushalts-Favorites-Collection haben.
- Private Favorites duerfen private eigene Rezepte und sichtbare
  Haushaltsrezepte enthalten.
- Haushalts-Favorites duerfen nur Rezepte desselben Haushalts enthalten.

### Collections

- Collections sind benannte Listen mit `owner_type = user|household`.
- Private Collections koennen private eigene Rezepte und sichtbare
  Haushaltsrezepte referenzieren.
- Haushalts-Collections duerfen nur Rezepte desselben Haushalts referenzieren.
- Loeschen einer Collection loescht nur die Liste, nicht die Rezepte.
- Ein Rezept kann in mehreren Collections liegen.

## Datenmodell

## Neue Tabellen

### `recipe_collections`

Vorgeschlagene Felder:

- `id uuid primary key`
- `owner_type text not null`
- `owner_user_id uuid null`
- `household_id uuid null`
- `kind text not null`
- `name text not null`
- `slug text null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Erlaubte `kind`-Werte:

- `favorites`
- `custom`

Invarianten:

- genau ein Owner-Pfad ist gesetzt
- `favorites` ist systemdefiniert und pro Owner eindeutig
- `custom` ist nutzerbenannt

### `recipe_collection_items`

Vorgeschlagene Felder:

- `id uuid primary key`
- `collection_id uuid not null`
- `recipe_id uuid not null`
- `created_by uuid not null`
- `created_at timestamptz not null default now()`

Invarianten:

- `(collection_id, recipe_id)` ist eindeutig
- Loeschen einer Collection loescht ihre Items
- Loeschen eines Rezepts loescht zugehoerige Collection-Items

### Optionales Herkunftsfeld an `recipes`

Wenn die Rueckverfolgbarkeit direkt im ersten Slice gebraucht wird:

- `source_recipe_id uuid null references public.recipes(id) on delete set null`

Das ist kein Sichtbarkeitsmechanismus, sondern nur Herkunftskontext fuer
spaetere Diagnosen oder UX-Hinweise wie "kopiert aus".

## Constraints und Indizes

Pflicht:

- Owner-Check analog zum bestehenden `recipes`-Modell
- unique partial index fuer private Favorites pro User
- unique partial index fuer Haushalts-Favorites pro Haushalt
- unique index auf `recipe_collection_items(collection_id, recipe_id)`
- Index auf `(owner_user_id, created_at desc)` fuer private Collections
- Index auf `(household_id, created_at desc)` fuer Haushalts-Collections
- Index auf `recipe_id` fuer schnelle Membership-/Delete-Pruefungen

## API-Richtung

## Sharing

Vorgeschlagene Endpoints:

- `POST /api/v1/recipes/:id/share`

Erster Scope des Payloads:

```json
{
  "target": {
    "type": "household" | "user"
  }
}
```

Fuer den ersten Slice gelten nur zwei erlaubte Ziele:

- `household`: in aktiven Haushalt kopieren
- `user`: private Kopie fuer den aktuell eingeloggten User erzeugen

Das deckt die zwei wichtigsten Richtungen ab:

- privat -> Haushalt
- Haushalt -> private Kopie

Antwort:

- `201` mit neuem Rezeptobjekt
- nie Mutation des Originals

Zusatz fuer den ersten Slice:

- die Share-Antwort soll genug Read-Model zurueckgeben, damit der Client ohne
  Voll-Reload in den neuen Zielkontext navigieren oder die Liste aktualisieren
  kann
- `source_recipe_id` wird fuer Share-Kopien im ersten Slice empfohlen statt
  spaeter optional nachzuziehen, damit Herkunfts- und Debugkontext nicht
  verloren geht

## Collections und Favorites

Vorgeschlagene Endpoints:

- `GET /api/v1/recipe-collections`
- `POST /api/v1/recipe-collections`
- `PATCH /api/v1/recipe-collections/:id`
- `DELETE /api/v1/recipe-collections/:id`
- `POST /api/v1/recipe-collections/:id/items`
- `DELETE /api/v1/recipe-collections/:id/items/:recipeId`
- `POST /api/v1/recipes/:id/favorite`
- `DELETE /api/v1/recipes/:id/favorite`

API-Regeln:

- `favorite` arbeitet intern ueber die passende Favorites-Collection
- die API darf fuer den Client ein flaches Toggle-Modell anbieten
- `favorites`-Collections koennen nicht frei umbenannt oder geloescht werden
- `custom`-Collections koennen erstellt, umbenannt und geloescht werden

Noetiges Read-Model fuer den ersten Slice:

- Rezeptliste und Rezeptdetail brauchen ein abgeleitetes UI-Modell statt nur
  nackter Recipe-Felder
- minimal noetig sind `scope = private|household`, `isFavorite` und die
  Information, ob `shareToHousehold` bzw. `copyToPrivate` fuer dieses Rezept
  angeboten werden soll
- Collections-Liste braucht mindestens `id`, `kind`, `name`, `owner_type`,
  `item_count` und ein Kennzeichen `is_system`

## Ownership- und Sichtbarkeitsregeln

### Sharing

- Nutzer duerfen nur sichtbare Rezepte kopieren.
- Privat -> Haushalt nur bei Membership im aktiven Haushalt.
- Haushalt -> privat nur bei Sichtbarkeit des Haushaltsrezepts.
- Fremde Rezepte liefern `404`.

### Private Collections

- nur der Owner darf sie lesen und mutieren
- sie duerfen sichtbare eigene private oder sichtbare Haushaltsrezepte
  enthalten

### Haushalts-Collections

- alle Haushaltsmitglieder duerfen sie lesen
- im ersten Slice duerfen alle Haushaltsmitglieder sie auch mutieren, analog
  zum bestehenden Haushaltsrezept-Modell
- falls das spaeter zu offen ist, wird Rollenfeinheit ein separater Folgeslice

## UI-Richtung

## Gemeinsame UX-Ziele

- Share ist eine klare bewusste Aktion mit Zielkontext, kein stiller Save.
- Favorites muessen mit einem Tap erreichbar sein.
- Collections brauchen einen einfachen Basispfad statt eines komplexen
  Organizers.

## Mobile und Web: erster Scope

Pflichtflaechen:

1. Rezeptdetail
2. Rezeptliste
3. optional Settings oder Haushaltsbereich nur fuer spaetere Erklaertexte,
   nicht als primaerer Einstieg

### Rezeptdetail

- CTA `Zu Favoriten`
- CTA `Zu Collection hinzufuegen`
- CTA `In Haushalt kopieren` bei privatem Rezept
- CTA `Private Kopie erstellen` bei Haushaltsrezept

### Rezeptliste

- einfacher Filter fuer `Favoriten`
- Zugang zu `Collections`
- sichtbarer Scope-Hinweis, ob ein Rezept privat oder haushaltsbezogen ist

### Collections-Ansicht

Erster Scope:

- Liste der eigenen sichtbaren Collections
- neue Collection anlegen
- Collection umbenennen
- Rezeptliste der Collection anzeigen
- Rezept aus Collection entfernen

Bewusst nicht noetig im ersten Slice:

- Drag-and-drop-Sortierung
- Coverbilder
- verschachtelte Collections

## Architekturentscheidung

Empfohlen ist ein `backend-first, UI-im-selben-Slice`-Vorgehen.

Reihenfolge:

1. Datenmodell und Ownership-Invarianten
2. API fuer Sharing und Collections
3. Client-Services und Query-Modelle
4. Detail- und Listen-UI in Mobile und Web
5. gezielte End-to-End-Smokes fuer Kernpfade

Warum:

- Die groessten Risiken liegen in Ownership, Referenzregeln und API-Vertrag.
- Die UI ist wichtig, aber soll auf stabile Server-Regeln aufsetzen.
- `Favorites` als Spezialfall von `Collections` verhindert doppelte
  Clientlogik.

Technische Guardrails:

- Ownership-Checks fuer Sichtbarkeit, Share-Copy und Collection-Membership
  muessen als zentrale DB-/Server-Helper existieren, nicht pro Route neu
  zusammengesetzt werden
- der erste Slice soll das bestehende `recipes`-Read-Model bewusst erweitern,
  statt die UI spaeter aus mehreren adhoc Requests selbst zusammenzustueckeln
- Mutationen muessen die bestehenden Recipe-Listen-/Detail-Caches und PWA-
  Reads deterministisch invalidieren, damit Share/Favorite nicht nur nach
  hartem Refresh sichtbar werden

## Mehrphasenplan

## Phase 1: Datenmodell und Server-Basis

Ziel:

- belastbares Modell fuer Collections/Favorites
- Sharing-Kopie serverseitig korrekt

Arbeit:

1. Migrationen fuer `recipe_collections` und `recipe_collection_items`
2. `recipes.source_recipe_id` fuer Share-Kopien nachziehen
3. Drizzle-Schema nachziehen
4. zentrale DB-Helper fuer Collection-Reads, Writes, Favorite-Resolve und
   Share-Copy
5. zentrale Ownership-Praedikate fuer sichtbare Recipe-Referenzen pro
   Collection-Typ
6. Favorites-Bootstrap pro User und optional pro Haushalt
7. Read-Model-Mapper fuer `scope`, `isFavorite` und erlaubte Share-Aktionen
   definieren

Abschlusskriterien:

- Sharing-Kopie erzeugt neue Rezepte mit korrektem Owner
- Favorites existieren deterministisch
- Collection-Items koennen keine fremden oder unzulaessigen Rezepte referenzieren
- derselbe Ownership-Helper steuert Liste, Detail, Share und Collection-Checks

## Phase 2: API-Vertrag und Tests

Ziel:

- stabile Endpoints und Fehlercodes

Arbeit:

1. Sharing-Route
2. Collections-Routen
3. Favorite-Toggle-Routen
4. `GET /api/v1/recipes` und `GET /api/v1/recipes/:id` um das noetige
   Read-Model fuer Scope/Favorite/Share-Zustaende erweitern
5. Unit-/Contract-Tests fuer Ownership, `404`, Duplicate-Guards und
   Scope-Regeln
6. ggf. RLS-/Grant-Hardening falls Tabellen im `public`-Schema exposed sind

Pflichttests:

1. User A sieht private Collections von User B nicht
2. Haushaltsmitglieder sehen dieselbe Haushalts-Collection
3. private Collection lehnt fremdes privates Rezept ab
4. Haushalts-Collection lehnt privates Rezept ab
5. privat -> Haushalt erzeugt neue Recipe-ID
6. Haushalt -> privat erzeugt neue Recipe-ID
7. Favorite-Toggle ist idempotent
8. Rezeptliste liefert fuer private und Haushaltsrezepte den korrekten
   Scope-Hinweis
9. Rezeptdetail zeigt `isFavorite` konsistent zur Favorites-Collection
10. Share-Route liefert nie Original-ID oder stilles Owner-Umschreiben zurueck

## Phase 3: Client-Services und erste UI

Ziel:

- erste reale Nutzbarkeit in Mobile und Web

Arbeit:

1. API-Services fuer Collections/Favorites/Share
2. Query-Keys und Invalidation-Strategie fuer Recipe-Liste, Recipe-Detail,
   Collections und Favorite-Zustaende
3. Rezeptdetail-CTAs
4. einfache Collections-Liste
5. Add-to-Collection-Flow
6. Favoritenfilter in der Rezeptliste
7. Scope-Hinweise fuer private vs household Rezepte
8. nach Share/Favorite/Add-to-Collection kein Hard-Reload noetig
9. UI-Zustaende fuer duplicate / already-favorited / not-found sauber abbilden

Abschlusskriterien:

- Favorit-Toggle funktioniert in Mobile und Web
- Nutzer koennen eine Collection anlegen und ein Rezept hinzufuegen
- Nutzer koennen ein privates Rezept in den Haushalt kopieren
- Listen- und Detailscreen bleiben nach Mutationen cache-konsistent

## Phase 4: QA, Smoke und Doku

Ziel:

- releasebare Verifikation

Arbeit:

1. Root-/Mobile-Unit- und Typecheck-Nachweis
2. gezielte UI-Tests fuer Favoriten und Collections
3. manueller Smoke auf Web/PWA fuer Share/Favorite/Collection
4. PWA-Read-/Cache-Verhalten nach Share/Favorite kurz mitpruefen
5. Doku in `TODO.md`, Runbook oder Learnings nachziehen

Smoke-Mindestpfade:

1. privates Rezept -> Favorit an/aus
2. privates Rezept -> neue private Collection -> enthalten
3. privates Rezept -> in Haushalt kopieren -> im Haushaltskontext sichtbar
4. Haushaltsrezept -> private Kopie -> im privaten Kontext sichtbar
5. Favoritenfilter spiegelt den Toggle ohne App-Neustart

## Review-Entscheidungen aus Autoplan

1. `source_recipe_id` wird fuer den ersten Share-Slice empfohlen und nicht als
   spaeteres Nice-to-have vertagt.
2. Das noetige Recipe-Read-Model fuer `scope`, `isFavorite` und Share-CTAs ist
   Teil des ersten Slices und kein spaeteres UI-Polish.
3. Der erste Slice bleibt trotzdem korrekt klein: kein Invite-Sharing, kein
   Multi-Household-Zielpicker, kein Sortier-/Bulk-UX-Ausbau.

## Was nach dem ersten Slice bewusst noch offen bleibt

Diese Punkte sollen nicht in den ersten Lieferumfang rutschen:

1. User-zu-User-Sharing mit Invite/Accept
2. Teilen in einen anderen als den aktiven Haushalt
3. Collection-Sortierung, Drag-and-drop, Bulk-Select
4. Collection-Cover, Beschreibung, Such- und Filterpolish
5. Rollenfeinheit fuer Haushalts-Collections
6. Offline-Schreibpfad und Konfliktaufloesung fuer Collection-Mutationen

## Empfohlene Reihenfolge im Backlog

1. PWA iOS Privacy-Hardwaretest abschliessen
2. Phase 1-4 dieses Sharing/Favorites/Collections-Slices umsetzen
3. danach Einladungen und Multi-Workspace weiter ausbauen

## GSTACK REVIEW REPORT

Autoplan ausgefuehrt am 2026-06-23 auf Branch `main` gegen Base `main`.

### Phase 0 Summary

- Plan-Summary: gemeinsamer Slice fuer Share-als-Kopie, Favorites-als-
  systemdefinierte Collection und einfache private bzw. haushaltsbezogene
  Collections mit erster Mobile-/Web-UI.
- UI-Scope: ja. Rezeptdetail, Rezeptliste und Collections-Ansicht sind
  explizit Teil des Plans.
- DX-Scope: leicht, aber vorhanden. Der Slice fuehrt mehrere interne API-
  Flaechen und einen neuen Read-Model-Vertrag fuer Clients ein.
- Realer Code-Stand: Recipe-Ownership ist vorhanden ueber [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts:3), [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts:202) und [src/routes/recipes.ts](/home/patrick/Projekte/rezepti/src/routes/recipes.ts:45). Collections/Favorites existieren noch nicht. Die aktuelle Client-Recipe-Liste nutzt einen einzigen Query-Key ueber [mobile/hooks/useRecipes.ts](/home/patrick/Projekte/rezepti/mobile/hooks/useRecipes.ts:4) und bekommt bislang kein Scope- oder Favorite-Read-Model aus [mobile/utils/api.ts](/home/patrick/Projekte/rezepti/mobile/utils/api.ts:131).

### Phase 1 — CEO Review

#### Premise Challenge

- Die Kernpraemisse ist richtig: Sharing, Favorites und Collections sollten
  nicht als drei getrennte Slices auseinanderlaufen, weil sie dasselbe
  Ownership-Modell benutzen.
- Die urspruengliche Fassung war an einer Stelle zu optimistisch: sie plante
  Favorite-Toggle und Scope-Hinweise in der UI, ohne den dafuer noetigen
  Read-Model-Vertrag im ersten Slice fest zu verankern.
- Es gibt keinen guten Produktgrund, `source_recipe_id` fuer Share-Kopien in
  einen spaeteren Slice zu schieben. Wenn Herkunft im ersten Release fehlt,
  fehlt sie genau in dem Moment, in dem Copy-Verhalten neu eingefuehrt wird.

#### What Already Exists

| Sub-problem | Existing code | Reuse decision |
|---|---|---|
| Recipe owner model | `src/schema.ts`, migration `20260605120000_*` | reuse |
| Recipe visibility / mutation helpers | `src/db-react.ts:202-397` | reuse and extend |
| Route auth + active household context | `src/auth.ts`, `src/routes/recipes.ts` | reuse |
| Mobile recipe detail surface | `mobile/app/recipe/[id].tsx` | extend |
| Recipe list query/cache basis | `mobile/hooks/useRecipes.ts`, `mobile/utils/api.ts` | extend |

#### CEO Verdict

- Empfehlung: **SELECTIVE EXPANSION**.
- Beibehalten: gemeinsamer Slice und die bewusst knappe erste Produktgrenze.
- Erweitern: Read-Model fuer Favorite-/Scope-Zustaende und Herkunftsverweis bei
  Share-Kopien muessen in den ersten Slice hinein, sonst ist die UX zwar
  geplant, aber nicht sauber auslieferbar.
- Kein User Challenge. Die Nutzer-Richtung "alles zusammen, aber phasenweise"
  bleibt richtig.

### Phase 2 — Design Review

#### Design Scorecard

| Dimension | Score | Review |
|---|---:|---|
| Task clarity | 8/10 | Die Kernaktionen sind klar, aber der Zustand nach einer Mutation war vorher zu implizit. |
| Information architecture | 7/10 | Detail, Liste und Collection-Ansicht sind richtig, doch die Verbindung ueber Favorite-/Scope-State musste expliziter werden. |
| Interaction design | 7/10 | CTA-Sets sind plausibel, aber Duplicate-/Already-added-/Not-found-Zustaende waren noch nicht benannt. |
| State model | 6/10 | Groesste Luecke der Ursprungsfassung; jetzt als Read-Model und Cache-Regel nachgezogen. |
| Cross-platform consistency | 8/10 | Mobile und Web teilen denselben Slice sinnvoll. |
| Error ergonomics | 7/10 | API- und UI-Fehlerpfade sollten sichtbar geplant sein; jetzt in Phase 3 benannt. |
| Scope discipline | 9/10 | Gute Non-Goals und klare Deferred-Liste. |

#### Design Verdict

- Der Slice bleibt UX-seitig tragfaehig, sobald Scope-Hinweise, `isFavorite`
  und Mutation-Feedback nicht nur als UI-Wunsch, sondern als Datenvertrag
  geplant sind.
- Kein zusaetzlicher Screen-Zoo noetig. Die bestehende Recipe-Liste und das
  Detail koennen der Einstieg bleiben.

### Phase 3 — Engineering Review

#### Architecture Check

- Der Plan sitzt auf einer realen Basis: zentrale Recipe-Owner-Regeln bestehen
  bereits serverseitig. Das reduziert Risiko gegenueber einem Greenfield-Slice.
- Die urspruengliche Fassung benoetigte aber einen klareren zentralen
  Ownership-Pfad fuer Collection-Membership und Share. Ohne das droht dieselbe
  Sichtbarkeitslogik an mehreren Stellen zu duplizieren.
- Die aktuelle Client-Architektur hat einen einfachen Recipes-Cache. Damit
  Share/Favorite sofort sichtbar werden, muessen Query-Key- und Invalidation-
  Regeln Teil des Plans sein, nicht Implementierungsdetail.

#### Main Risks

1. **Read-model gap**: UI will Scope/Favorite anzeigen, aber das aktuelle
   `GET /api/v1/recipes` liefert diese Informationen nicht.
2. **Predicate drift**: Collection-Regeln koennten in Route, Helper und UI
   unterschiedlich implementiert werden.
3. **Cache inconsistency**: Favorite/Share klappt serverseitig, wirkt im Client
   aber erst nach Reload.

#### Engineering Verdict

- Empfehlung: **APPROVE WITH CHANGES INCORPORATED**.
- Die noetigen Plan-Schaerfungen wurden direkt in Phase 1-4 aufgenommen.
- Kein Architektur-Blocker bleibt offen fuer den ersten Slice.

### Phase 3.5 — DX Review

#### DX Summary

- Das ist kein externes API-Produkt, daher ist DX hier kein Hauptthema.
- Trotzdem gibt es eine interne Entwickleroberflaeche: mehrere neue Endpoints,
  neue Query-Invalidation und ein erweitertes Recipe-Read-Model.
- Wichtigster DX-Punkt: derselbe serverseitige Read-/Ownership-Mapper soll
  Liste, Detail und UI-CTAs bedienen. Das senkt spaetere Debug-Kosten.

#### DX Verdict

- DX insgesamt: 7/10.
- TTHW fuer einen neuen Contributor bleibt gut, wenn Collections/Favorites ueber
  zentrale Helper und ein kleines, klares Read-Model gebaut werden.

### Decisions Made

- `source_recipe_id` in ersten Slice gezogen.
- Recipe-Read-Model fuer `scope`, `isFavorite` und Share-CTA-Faehigkeit in
  Phase 2/3 gezogen.
- zentrale Ownership-Praedikate explizit gemacht.
- Cache-/Invalidation-Verhalten fuer Mutationen als Pflichtteil des Plans
  aufgenommen.

### Final Recommendation

- **Approved** als umsetzbarer Mehrphasenplan.
- Prioritaet fuer die Implementierung: erst Phase 1 mit zentralen Helpern und
  Read-Model, dann API-Tests, dann UI.
- Rest-Risiko: Die aktuelle TODO-Reihenfolge bleibt richtig; der offene iOS-
  Privacy-Hardwaretest muss nicht blockieren, sollte aber vor einem groesseren
  PWA-nahen Follow-up nicht vergessen werden.
