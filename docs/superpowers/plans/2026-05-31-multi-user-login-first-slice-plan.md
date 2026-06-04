# Multi-User Login First Slice Plan

Datum: 2026-05-31
Urspruenglich erstellt: 2026-05-31, Commit `1484052` (`Plan multi-user login first slice`)
Letztes Review/Update: 2026-06-04
Status: Aktualisierte Richtung, Umsetzung noch offen

## Update 2026-06-04

Seit der urspruenglichen Planerstellung am 2026-05-31 um 19:37 sind mehrere
Vorarbeiten auf `main` gelandet. Sie verbessern die Startbedingungen fuer den
Multi-User-Track, ersetzen ihn aber nicht:

- Supabase Advisor Kern-Remediation war zum Zeitpunkt des Plan-Commits schon
  praktisch abgeschlossen; der finale Stand ist dokumentiert und auf `main`.
- `vector` und `pg_trgm` wurden am 2026-06-01 produktiv aus `public` nach
  `extensions` verschoben. Staging-Probe, Runtime-Smoke und Advisor-Verify sind
  gruen. `extension_in_public` ist damit kein vorgelagerter Blocker mehr.
- Eine `rezepti-staging`-DB existiert und wurde fuer Extension-/Advisor-Proben
  genutzt. Sie ist ein plausibler Kandidat fuer den spaeteren RLS-Smoke, muss
  aber vor Auth/RLS-Tests nochmal explizit als Ziel-DB bestaetigt werden.
- `unused_index` wurde als Hold-Track klassifiziert. Das ist kein Blocker fuer
  Multi-User, solange keine Index-Drops in denselben Slice gezogen werden.
- Expo SDK 56, React Native 0.85 und Mobile-TypeScript-6 sind gelandet. Der
  Mobile-Auth-Slice muss deshalb gegen den aktuellen Expo-SDK-56-Stand gebaut
  werden, nicht gegen den Stand vom 2026-05-31.
- Der Branch `phase/6-multi-user` ist stale und zeigt auf den alten Phase-5-
  Stand. Fuer diese Arbeit sollte er nicht als relevante Implementierungsbasis
  behandelt werden.
- Der lokale `main` war beim Review am 2026-06-04 vier Commits vor
  `origin/main`; vor Shipping muss erneut synchronisiert und entschieden werden,
  ob diese lokalen Doku-/Ops-Commits zuerst gepusht oder in den Feature-Branch
  aufgenommen werden.

Was unveraendert offen ist:

- [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts) ist weiterhin ein
  Stub.
- CORS erlaubt noch kein `Authorization`.
- Server-DB-Funktionen fuer `shopping_list` und `meal_plan` sind noch nicht
  owner-scoped.
- Mobile hat noch keinen Supabase Auth Client, keine App-Session-Schicht und
  keine Bearer-Header-Injection.
- Die RLS-/Grant-Matrix liegt weiter als SQL-Template vor, nicht als
  ausgefuehrte Migration.

## Ausgangslage

Rezepti ist fuer Multi-User vorbereitet, aber noch nicht darauf umgestellt:

- [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts) ist ein Stub; es gibt keinen echten Request-User.
- Die Server-API wird ohne Auth-Middleware gemountet.
- Der produktive Datenzugriff laeuft ueber `DATABASE_URL` und Drizzle, nicht ueber Supabase Data API mit `authenticated` JWT.
- [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts) enthaelt `user_id` bereits fuer `recipes`, `shopping_list`, `meal_plan` und `api_keys`.
- `ingredient_dictionary` ist systemnah und bleibt fuer diesen Track backend-only.
- [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md) und [db/templates/public-multi-user-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-multi-user-data-api-rls.sql) definieren bereits die RLS-/Grant-Matrix, sind aber noch keine ausgefuehrte Migration.
- Mobile hat trotz Expo-SDK-56-Upgrade noch keinen Supabase-Client, keinen Auth-Session-Store, keine `Authorization`-Header-Injection und keinen user-scoped Query-Cache.
- Supabase-Extension-Follow-up ist erledigt: `vector` und `pg_trgm` liegen in `extensions`; WARN-Level Advisor-Smokes waren nach dem Move gruen.
- Staging existiert, ist aber fuer den Auth/RLS-Slice noch nicht als Ziel-DB final festgelegt.

Offizielle Supabase-Leitplanken fuer diesen Plan:

- RLS-Policies fuer User-Daten muessen gegen `auth.uid()` laufen.
- Policies sollen explizit `to authenticated` setzen.
- Funktionen in Policies wie `auth.uid()` sollen fuer Performance als `(select auth.uid())` verwendet werden.
- Spalten in Policy-Praedikaten, hier `user_id`, brauchen passende Indizes.
- `getSession()` ist nicht belastbar fuer serverseitige Authorization; serverseitig muss der User/JWT verifiziert werden.
- Keine Client-Verwendung von `service_role` oder Secret Keys.
- Keine Authorization auf `user_metadata`; falls spaeter Rollen gebraucht werden, nur belastbare App-Metadaten oder DB-Zuordnung.

## Ziel

Der erste Slice schafft die Auth-Grundlage, ohne sofort die ganze App und DB breit umzubauen.

Nach Abschluss dieses Slice soll gelten:

- Server kann einen Supabase Auth Bearer Token verifizieren und daraus einen Request-User-Kontext bereitstellen.
- CORS und Mobile-Request-Schicht koennen `Authorization: Bearer <token>` transportieren.
- Mobile kann eine Session halten, Login/Logout in Settings anbieten und den Query-Cache bei Account-Wechsel isolieren oder leeren.
- `shopping_list` und `meal_plan` koennen als erster owner-sicherer Datenbereich mit `user_id` betrieben und getestet werden.
- Die echte RLS-Migration wird erst ausgefuehrt, wenn Datenform, Backfill und Token-/Policy-Smoke auf Zielumgebung verifiziert sind.

## Nicht-Ziele

- Kein kompletter Rezept-Ownership-Umbau im ersten Slice.
- Keine direkte Client-Freigabe fuer `api_keys` oder `ingredient_dictionary`.
- Keine Umstellung aller Import-Jobs, BYOK-Keys oder Plattform-Credentials auf per-user Ownership.
- Kein `service_role`-Key im Mobile- oder Web-Client.
- Kein produktiver DB-Grant ohne vorherige Staging-/Ziel-DB-Verifikation.
- Kein Push auf `main` aus dem Feature-Slice heraus; lokaler `main` war beim 2026-06-04-Review vier Commits vor `origin/main` und muss vor Shipping bewusst integriert werden.
- Kein Vermischen mit dem `unused_index`-Cleanup; Index-Drops bleiben ein eigener Hold-Track.

## Empfohlene Architektur

### Server Auth Boundary

Neue oder erweiterte Module:

- [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts)
- [src/api-react.ts](/home/patrick/Projekte/rezepti/src/api-react.ts)
- [src/index.ts](/home/patrick/Projekte/rezepti/src/index.ts)

Aufgaben:

- `Authorization` in CORS erlauben.
- Bearer-Token aus Requests extrahieren.
- Token serverseitig gegen Supabase Auth verifizieren.
- Request-Kontext mit `userId`, `accessToken` und Auth-Status bereitstellen.
- Public Endpoints explizit markieren, statt implizit alles offen zu lassen.
- Fehlerkonvention festlegen:
  - fehlender Token auf geschuetzten Endpoints: `401`
  - valider Token ohne Zugriff: `403`
  - nicht vorhandene eigene Ressource: `404`

Akzeptanz:

- Auth-Unit-Tests decken fehlenden Header, falsches Schema, invalid token und valid token ab.
- Bestehende public Health-/Validation-Pfade bleiben funktionsfaehig.

### Datenzugriff Slice 1: Shopping und Meal Plan

Betroffene Dateien:

- [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts)
- [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts)
- [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts)
- spaeter neue Migration unter `db/migrations/`

Warum diese Tabellen zuerst:

- Beide haben bereits `user_id`.
- Beide sind eindeutig private Nutzer-Daten.
- Es gibt keine globale Default-Semantik wie bei `recipes`.
- Die Owner-Grenze ist leicht negativ zu testen: User A darf User B nicht sehen, aktualisieren oder loeschen.

Aufgaben:

- DB-Funktionen fuer `shopping_list` und `meal_plan` um `userId`-Parameter erweitern.
- Reads, Updates und Deletes immer mit `user_id = userId` begrenzen.
- Inserts setzen `user_id = userId`.
- Legacy-`user_id is null` nur im alten Single-User-Kompatibilitaetsmodus erlauben, falls Auth noch optional bleibt.
- Massenoperationen wie `DELETE /shopping/all` und `DELETE /planner/week/:weekStart` strikt owner-scopen.

DB-Vorbedingungen vor echter RLS-Freigabe:

- Datenbestand pruefen: Anzahl `shopping_list.user_id is null`, `meal_plan.user_id is null`.
- Backfill-Strategie entscheiden:
  - lokale Single-User-Instanz auf ersten migrierten User uebernehmen, oder
  - Legacy-Zeilen bewusst aus authenticated Sicht unsichtbar lassen.
- Index-Check fuer `shopping_list.user_id` und `meal_plan.user_id`.
- Wenn Daten sauber sind: `NOT NULL` fuer beide Spalten pruefen.

RLS-Migrationsrichtung:

- `grant select, insert, update, delete` nur an `authenticated`.
- Sequence-Grants fuer Insert-Pfade setzen.
- Policies pro Operation mit `to authenticated`.
- Owner-Praedikat: `user_id = (select auth.uid())`.
- `api_keys` und `ingredient_dictionary` ohne Data-API-Grants lassen.

### Recipes Erst Danach

`recipes` wird bewusst nicht als erster Schreib-Slice genommen.

Grund:

- `recipes.user_id is null` ist fachlich als globale Default-Rezeptzeile vorgesehen.
- Reads brauchen `user_id = auth.uid() or user_id is null`.
- Writes muessen strikt auf eigene Zeilen begrenzt bleiben.
- Diese Mischsemantik braucht eine eigene Testmatrix, damit globale Defaults nicht versehentlich editierbar werden.

### Mobile Session und Request Layer

Betroffene Dateien:

- [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx)
- [mobile/app/_layout.tsx](/home/patrick/Projekte/rezepti/mobile/app/_layout.tsx)
- [mobile/utils/api.ts](/home/patrick/Projekte/rezepti/mobile/utils/api.ts)
- [mobile/utils/shopping-service.ts](/home/patrick/Projekte/rezepti/mobile/utils/shopping-service.ts)
- [mobile/utils/query-client.ts](/home/patrick/Projekte/rezepti/mobile/utils/query-client.ts)
- neue Auth-/Session-Utilities unter `mobile/utils/`

Aufgaben:

- Supabase Auth Client einbauen. Dabei Publishable-/Anon-Key plus User-JWT nutzen; kein Secret oder `service_role` im Client.
- Native Session sicher speichern; `expo-secure-store` ist bereits vorhanden.
- Web-Fallback fuer Session-Speicher bewusst dokumentieren.
- Zentralen API-Fetch-Wrapper schaffen, der den Bearer Token injiziert.
- Settings bekommt Account-Block mit Login, Logout und Session-Status.
- Query-Cache bei Login/Logout/User-Wechsel leeren oder user-scoped persistieren.
- Direkte `fetch`-Aufrufe schrittweise auf Wrapper ziehen; erster Pflichtbereich: Shopping und Planner.

Nicht im ersten Mobile-Slice:

- Appweite Navigation komplett blockieren.
- Alle Importer und Scanner sofort auth-pflichtig machen.
- Per-user Cookidoo/Pinterest/Facebook-Credential-Isolation.

## Phasen

### Phase 0: Branch- und Daten-Schutz

Aufgaben:

- `git fetch` und ahead/behind gegen `origin/main` sowie vorhandenen `phase/6-multi-user`-Ast pruefen.
- `phase/6-multi-user` nicht als aktive Basis verwenden, solange er weiter auf den alten Phase-5-Stand zeigt.
- Lokale Doku-/Ops-Commits auf `main` einordnen: erst pushen, in Feature-Branch aufnehmen oder bewusst aus dem Auth-Slice heraushalten.
- Ziel-DB fuer Auth/RLS-Smoke festlegen: bevorzugt die vorhandene `rezepti-staging`-DB, falls sie fuer Auth-Testnutzer und Datenform passt; sonst bewusst konfigurierte Dev-DB.
- Keine produktive RLS-/Grant-Migration ohne Export/Backup- und Rollback-Plan.

Akzeptanz:

- Zielbranch und Ziel-DB sind dokumentiert.
- `phase/6-multi-user` ist entweder nachweislich irrelevant oder explizit integriert; am 2026-06-04 war er stale.
- Keine unabsichtlichen Deploy-/main-Push-Nebenwirkungen.

### Phase 1: Server Auth Skeleton

Aufgaben:

- Supabase JS Server Dependency im Root ergaenzen, falls noch nicht vorhanden. Aktuell ist nur die Supabase CLI als Root-Dependency vorhanden, nicht `@supabase/supabase-js`.
- `src/auth.ts` vom Stub zu echter Token-Verifikation umbauen.
- Hono Middleware oder Helper fuer geschuetzte Routen erstellen.
- CORS `Authorization` erlauben.
- Tests fuer Auth-Parsing und Fehlerfaelle schreiben.

Akzeptanz:

- Public Endpoints bleiben public.
- Geschuetzte Test-Route oder Slice-Route verlangt Token.
- Invalid Token liefert `401`.

Verifikation:

```bash
npm run test:unit -- --run test/unit/auth.test.ts
npx tsc --noEmit
```

### Phase 2: Owner-Scoped Shopping und Planner im Server

Aufgaben:

- `shopping_list`-DB-Funktionen um `userId` erweitern.
- `meal_plan`-DB-Funktionen um `userId` erweitern.
- Planner-/Shopping-Routen geben Request-User an DB-Funktionen weiter.
- Negative Tests fuer Cross-User-Read/Update/Delete.
- Backward-Kompatibilitaet fuer unauthenticated Single-User nur dann behalten, wenn bewusst entschieden.

Akzeptanz:

- User A sieht, aendert und loescht nur eigene Shopping-/Planner-Zeilen.
- Massen-Deletes sind owner-scoped.
- Bestehende Single-User-Tests sind entweder angepasst oder bewusst als Legacy-Modus markiert.

Verifikation:

```bash
npm run test:unit -- --run test/unit/planner-routes.test.ts test/unit/db-react.test.ts
npx tsc --noEmit
```

### Phase 3: Mobile Auth Foundation

Aufgaben:

- Mobile Supabase Client und Session-Utility anlegen.
- Settings Account-Block bauen.
- `mobile/utils/api.ts` auf zentralen Fetch mit Auth-Header umstellen.
- Shopping-/Planner-Fetches auf Wrapper ziehen.
- Query-Cache bei Account-Wechsel isolieren oder leeren.

Akzeptanz:

- Login/Logout kann ohne App-Neustart Status wechseln.
- Auth-Header wird bei API-Calls gesetzt, wenn Session vorhanden ist.
- Logout entfernt Session und verhindert Cache-Leak zwischen Accounts.

Verifikation:

```bash
npm --prefix mobile run test:unit
npm --prefix mobile run typecheck
```

### Phase 4: RLS Migration Draft zu echter Migration

Aufgaben:

- Migration mit Supabase CLI erzeugen, nicht per frei erfundenem Dateinamen. Lokaler CLI-Stand war zuletzt `2.102.0`.
- Datenform fuer `shopping_list` und `meal_plan` pruefen.
- Backfill/Legacy-Entscheidung dokumentieren.
- Policies und Grants fuer `shopping_list` und `meal_plan` anwenden.
- `recipes` nur lesen oder noch gar nicht in diese Migration aufnehmen, falls Default-Semantik nicht voll getestet ist.
- Vor dem Anwenden erneut pruefen, dass Extension-Grants nach dem Move nach `extensions` weiter passend sind und keine neuen Advisor-Warnungen aus dem Extension-Track zurueckgekommen sind.

Akzeptanz:

- `anon` hat keinen Zugriff.
- `authenticated` User A kann eigene Rows CRUDen.
- User A kann User-B-Rows nicht lesen, aendern oder loeschen.
- Advisor zeigt keine neuen kritischen RLS-/Grant-Regressionen.

Verifikation:

```bash
npx supabase --version
npx supabase migration new multi_user_shopping_planner_rls
npx supabase db advisors
```

Je nach Zielumgebung erfolgt die SQL-Verifikation mit Supabase CLI oder direktem SQL-Fallback.

### Phase 5: Docs, CI und Release-Gate

Aufgaben:

- [TODO.md](/home/patrick/Projekte/rezepti/TODO.md) Status nachziehen.
- [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md) um Auth/RLS-Teststand ergaenzen.
- [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md) von Readiness zu verifizierter Teilumsetzung aktualisieren.
- CI-Luecke dokumentieren: lokaler Postgres-Test beweist keine Supabase-RLS-Korrektheit.
- Optional neuen manuellen oder geheimnisgeschuetzten RLS-Smoke fuer Staging definieren.

Akzeptanz:

- Doku unterscheidet klar zwischen Server-Owner-Scoping, Mobile-Session und echter Supabase-RLS-Verifikation.
- Vor Push ist klar, welche GitHub Actions/Deploy-Automationen getriggert werden.

## Testmatrix

### Unit

- Auth Header Parsing
- Token Verification Happy/Failure
- Owner-Scoped DB Helpers
- Route-Level `401`/`403`/`404`
- Shopping Mass Delete owner-scoped
- Planner Week Delete owner-scoped

### Integration

- User A und User B mit getrennten `user_id`s gegen lokale Test-DB.
- Legacy `user_id is null` Verhalten dokumentiert und gezielt getestet oder entfernt.
- RLS-Smoke gegen Supabase/Staging mit echten authenticated Tokens.

### Mobile

- Login Status in Settings.
- Logout loescht Session.
- API-Wrapper setzt Bearer Header.
- Query-Cache wird bei User-Wechsel nicht wiederverwendet.
- Shopping-/Planner-Screens bleiben unter RNTL gruen.

## Risiken

- Lokale Tests mit `DATABASE_URL` koennen RLS-Fehler uebersehen.
- Ein breiter Auth-Schalter kann Import-, Job- und Key-Flows brechen, bevor deren Ownership geklaert ist.
- `recipes` hat globale Defaults; owner-only waere fachlich falsch.
- Mobile Query-Persistenz kann Daten zwischen Accounts leaken, wenn sie nicht user-scoped wird.
- Lokaler `main` kann Doku-/Ops-Commits vor `origin/main` enthalten; vor Shipping muss klar sein, welche Basis der Feature-Branch wirklich hat.

## Offene Entscheidungen

- Soll unauthenticated Single-User-Modus waehrend der Migration weiter funktionieren?
- Welche bestehende DB-Zeilen werden welchem ersten User zugeordnet?
- Wird `recipes` im zweiten Slice ueber Server-API owner-scoped oder direkt ueber Supabase Data API gelesen?
- Werden Import-Jobs user-bound in Memory gehalten oder in eine persistente Job-Tabelle verschoben?
- Werden BYOK/API-Keys pro Nutzer in `api_keys` modelliert oder bleiben sie serverseitige Instance-Konfiguration?

## Empfohlener Start

Start mit Phase 0 und Phase 1:

1. Branch-/Remote-Stand klaeren.
2. Auth-Skeleton mit Tests bauen.
3. Noch keine RLS-Grants oeffnen.
4. Danach Shopping-/Planner-Owner-Scoping lokal implementieren.

Das schafft eine harte, testbare Grenze, bevor Datenbankrechte auf Supabase geoeffnet werden.
