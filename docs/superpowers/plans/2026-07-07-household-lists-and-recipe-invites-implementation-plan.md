# Household Lists and Recipe Invites Implementation Plan

Stand: 2026-07-07
Status: geplant
Design-Basis: [2026-07-07-household-lists-and-recipe-invites-design.md](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-07-07-household-lists-and-recipe-invites-design.md)

## Ziel

Dieser Slice setzt zwei Produktregeln um:

- Haushaltslisten bleiben die geteilten Listen fuer Haushalte und enthalten nur
  Haushaltsrezepte.
- Direktes Teilen an Personen laeuft ueber E-Mail-Invites. Beim Accept entsteht
  eine private Rezeptkopie beim Empfaenger.

Der erste technische Endzustand soll ohne manuelle QA freigegeben werden
koennen, aber mit fokussierten Server- und Mobile-Unit-Tests abgesichert sein.

## Reihenfolge

1. Datenmodell fuer Recipe-Invites ergaenzen.
2. Server-Helfer fuer Token, Invite-Erstellung, Vorschau und Accept bauen.
3. API-Routen fuer Invite-Flow anbinden.
4. Collection-Add so erweitern, dass private Rezepte fuer Haushaltslisten als
   Haushaltskopie eingefuegt werden.
5. Mobile API/Hooks fuer Invites und Autokopie-Zustaende ergaenzen.
6. Mobile UI fuer E-Mail-Invite und bewussten Haushaltskopie-Text anbinden.
7. Fokussierte Tests laufen lassen.

## Phase 1: Datenmodell und Migration

Betroffene Dateien:

- `src/schema.ts`
- `supabase/migrations/*`

Arbeit:

- Neue Tabelle `recipe_share_invites` in Drizzle-Schema definieren.
- Migration mit `supabase migration new <name>` erzeugen, nicht frei benennen.
- Felder:
  - `id uuid primary key`
  - `source_recipe_id integer not null references recipes(id) on delete cascade`
  - `sender_user_id uuid not null`
  - `recipient_email text not null`
  - `token_hash text not null`
  - `status text not null default 'pending'`
  - `accepted_by_user_id uuid null`
  - `accepted_recipe_id integer null references recipes(id) on delete set null`
  - `expires_at timestamptz not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `accepted_at timestamptz null`
- Constraints:
  - Status-Check fuer `pending`, `accepted`, `revoked`, `expired`.
  - Accepted-Shape-Check: accepted rows brauchen `accepted_by_user_id`,
    `accepted_recipe_id` und `accepted_at`; nicht-accepted rows nicht.
  - Unique Index auf `token_hash`.
  - Indexe auf `sender_user_id`, `recipient_email`, `source_recipe_id` und
    `expires_at`.
- RLS fuer die neue Tabelle aktivieren.
- Policies restriktiv halten. Primaere Mutation laeuft ueber die Server-API,
  nicht ueber direkte Public-Client-Schreibzugriffe.

Supabase-Hinweis:

- Vor Umsetzung CLI-Kommandos mit `supabase --help` und
  `supabase migration --help` verifizieren.
- Nach Migration lokal `supabase migration list --local` pruefen.
- Advisors laufen lassen, wenn die lokale Supabase-Umgebung verfuegbar ist.

## Phase 2: Server-Domain-Helfer

Betroffene Dateien:

- `src/db-react.ts`
- ggf. neuer fokussierter Helfer, z.B. `src/recipe-share-invites.ts`

Arbeit:

- E-Mail normalisieren: trimmen, lowercasen, einfache Formatvalidierung.
- Token erzeugen:
  - kryptografisch zufaelliger Roh-Token fuer Link
  - persistiert wird nur ein Hash
- Invite erstellen:
  - Source-Rezept laden.
  - Sichtbarkeit fuer Sender pruefen.
  - Invite mit Ablaufdatum speichern.
- Invite per Token laden:
  - Token hashen.
  - Invite plus minimale Rezept-/Sender-Vorschau laden.
  - Expired-Zustand stabil darstellen.
- Invite akzeptieren:
  - Auth erforderlich.
  - Account-E-Mail gegen `recipient_email` vergleichen.
  - Pending und nicht abgelaufen erzwingen.
  - Rezeptkopie mit `owner_type = 'user'` und `owner_user_id = auth.userId`
    erzeugen.
  - Invite atomar auf `accepted` setzen.
  - Wiederholter Accept darf keine zweite Kopie erzeugen.

Wichtige Entscheidung:

- Der Accept-Pfad muss transaktional sein. Wenn das bestehende DB-Setup keine
  komfortable Transaktions-Hilfe an dieser Stelle hat, wird zuerst eine kleine
  interne Helper-Funktion ergaenzt, statt Copy und Invite-Update lose
  nacheinander auszufuehren.

## Phase 3: Invite API

Betroffene Dateien:

- neuer Router, z.B. `src/routes/recipe-share-invites.ts`
- `src/api-react.ts`
- Server-Tests unter `test/unit` oder bestehendem API-Testbereich

Endpoints:

- `POST /api/v1/recipes/:id/share-invites`
- `GET /api/v1/share-invites/:token`
- `POST /api/v1/share-invites/:token/accept`

Verhalten:

- `POST` validiert Auth, Rezept-Sichtbarkeit und E-Mail.
- `GET` liefert nur Vorschau: Rezeptname, Sender-Anzeige, Status.
- `POST accept` erzeugt private Kopie und liefert diese Kopie oder einen
  stabilen Already-Accepted-Zustand.

Fehlercodes:

- unsichtbares Rezept: `404`
- ungueltige E-Mail: `400`
- abgelaufener/revoked Invite: klarer Fehlercode im JSON
- falsche eingeloggte E-Mail: `403`
- unbekannter Token: `404`

## Phase 4: Haushaltslisten-Autokopie

Betroffene Dateien:

- `src/db-react.ts`
- `src/routes/recipe-collections.ts`
- bestehende Collection-Tests

Arbeit:

- `POST /api/v1/recipe-collections/:id/items` erweitert:
  - Collection laden und Mutationsrecht pruefen.
  - Rezept laden und Sichtbarkeit pruefen.
  - Falls Collection `owner_type = 'household'` und Rezept privat ist:
    - Haushaltskopie fuer `collection.household_id` erzeugen.
    - Kopie in Collection einfuegen.
    - Antwort enthaelt die tatsaechlich eingefuegte Haushaltskopie.
  - Falls Collection Haushalt und Rezept Haushalt:
    - `household_id` muss uebereinstimmen.
  - Private Collections behalten ihr bisheriges Verhalten.
- Idempotenz:
  - Wenn dieselbe Source bereits als Haushaltskopie in dieser Collection liegt,
    wird kein weiterer Rezeptdatensatz erzeugt.
  - `(collection_id, recipe_id)` bleibt weiterhin eindeutig.

Risiko:

- `source_recipe_id` ist aktuell nur Herkunftskontext. Fuer Idempotenz braucht
  der Query bewusst die Kombination aus Collection, Haushaltskopie und Source.

## Phase 5: Mobile API und Hooks

Betroffene Dateien:

- `mobile/utils/api.ts`
- `mobile/hooks/useCollections.ts`
- ggf. neuer Hook, z.B. `mobile/hooks/useRecipeShareInvites.ts`
- `mobile/test/collections-api.test.ts`
- `mobile/test/collections-hooks.test.ts`

Arbeit:

- API-Funktionen:
  - `createRecipeShareInvite(recipeId, email)`
  - `getRecipeShareInvite(token)`
  - `acceptRecipeShareInvite(token)`
- Types fuer Invite-Vorschau und Status ergaenzen.
- Mutations invalidieren:
  - Rezeptliste
  - Detaildaten der neu erzeugten Kopie
  - Collections-Items nach Haushaltslisten-Autokopie
- Bestehende `addRecipeToCollection`-Antwort ggf. so typisieren, dass die App
  erkennt, ob eine Kopie eingefuegt wurde.

## Phase 6: Mobile UI

Betroffene Dateien:

- `mobile/app/recipe/[id].tsx`
- `mobile/app/collection/[id].tsx`
- ggf. neue Invite-Route unter `mobile/app/share-invite/[token].tsx`
- ggf. bestehende Add-to-Collection-Komponente

Arbeit:

- Rezeptdetail:
  - E-Mail-Share-Aktion anbieten.
  - Eingabe validieren.
  - Erfolg und Fehler sichtbar machen.
  - Falls noch kein echter Mail-Versand existiert, Link aus API-Antwort
    weiterteilbar anzeigen.
- Invite-Route:
  - Token aus Route lesen.
  - Vorschau laden.
  - Bei fehlender Session zu Auth fuehren und danach zurueckkehren.
  - Accept ausloesen.
  - Falsche E-Mail, abgelaufen, revoked und accepted unterscheidbar anzeigen.
- Collection/Add-Flow:
  - Bei privatem Rezept plus Haushaltsliste den bewussten Text
    `Als Haushaltskopie hinzufuegen` verwenden.
  - Nach Erfolg tatsaechliche eingefuegte Kopie anzeigen oder Liste
    invalidieren.

UI-Grenze:

- Kein groesseres Redesign der Rezeptdetailseite.
- Keine manuelle Browser-QA in diesem Schritt.

## Phase 7: Tests und Verifikation

Server:

- Invite fuer eigenes privates Rezept erstellen.
- Invite fuer sichtbares Haushaltsrezept erstellen.
- Fremdes privates Rezept bleibt `404`.
- Accept mit passender E-Mail erzeugt private Kopie.
- Accept mit falscher E-Mail erzeugt keine Kopie.
- Wiederholter Accept erzeugt keine zweite Kopie.
- Abgelaufener Invite erzeugt keine Kopie.
- Token-Hash wird gespeichert, Roh-Token nicht.
- Haushaltsliste plus privates Rezept erzeugt Haushaltskopie.
- Doppelt hinzufuegen bleibt idempotent.

Mobile:

- API-Client sendet korrekte Invite-Requests.
- Invite-Fehler werden als `ApiRequestError` abgebildet.
- Hooks invalidieren relevante Query Keys.
- UI zeigt `Als Haushaltskopie hinzufuegen` fuer den passenden Fall.

Kommandos:

- `npm run test:unit`
- `npm --prefix mobile run test:unit`
- `npm --prefix mobile run typecheck`

Ausgelassen fuer diesen Schritt:

- Keine manuelle QA.
- Kein Browser-Dogfooding.
- Kein Production-Smoke.

## Commit-Zuschnitt

Empfohlene Commit-Reihenfolge:

1. `feat(api): add recipe share invite model`
2. `feat(api): add recipe share invite routes`
3. `feat(api): copy private recipes into household collections`
4. `feat(mobile): add recipe invite client flow`
5. `test: cover recipe invites and household collection copies`

Wenn ein Commit zu gross wird, API und Mobile getrennt halten. Migration,
Schema und Server-Helfer sollten aber nicht auseinandergerissen werden, wenn die
Tests sonst keinen sinnvollen Zwischenstand haben.

## Offene Implementierungsdetails

- Ob der erste Slice echten E-Mail-Versand nutzt oder den Invite-Link nur in
  der App zur Weitergabe zurueckgibt, wird anhand vorhandener Mail-Infrastruktur
  entschieden.
- Der genaue Invite-Ablaufwert wird bei der Umsetzung konservativ gewaehlt,
  z.B. 14 Tage, sofern kein bestehender Projektstandard existiert.
- Die UI-Platzierung der E-Mail-Share-Aktion folgt der bestehenden
  Rezeptdetailstruktur, kein neues Navigationskonzept.

