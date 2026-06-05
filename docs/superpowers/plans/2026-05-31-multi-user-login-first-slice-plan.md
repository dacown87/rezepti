<!-- /autoplan restore point: /home/patrick/.gstack/projects/unknown/main-autoplan-restore-20260604-104324.md -->

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
  household-scoped.
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
- `shopping_list` und `meal_plan` koennen als erster household-sicherer Datenbereich mit `household_id` betrieben und getestet werden.
- Server kann `user`, `admin`, Haushalt-Mitgliedschaften und aktiven Haushalt im Request-Kontext unterscheiden.
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
- Request-Kontext mit `userId`, `email`, `appRole`, `memberships`, `activeHouseholdId`, `accessToken` und Auth-Status bereitstellen.
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

- Beide haben bereits `user_id` und koennen jetzt gezielt um `household_id` erweitert werden.
- Beide sind eindeutig haushaltsbezogene Nutzer-Daten.
- Es gibt keine globale Default-Semantik wie bei `recipes`.
- Die Household-Grenze ist leicht negativ zu testen: User A darf User-B-Haushalte nicht sehen, aktualisieren oder loeschen.

Aufgaben:

- DB-Funktionen fuer `shopping_list` und `meal_plan` um `householdId`-Parameter erweitern.
- Reads, Updates und Deletes immer mit `household_id = activeHouseholdId` begrenzen.
- Inserts setzen `household_id = activeHouseholdId` und optional `user_id = requestUserId` fuer Audit/Creator-Kontext.
- Legacy-`user_id is null` / `household_id is null` wird nicht als Kompatibilitaetsmodus behalten, weil aktuelle DB-Daten Testdaten sind.
- Massenoperationen wie `DELETE /shopping/all` und `DELETE /planner/week/:weekStart` strikt household-scopen.

DB-Vorbedingungen vor echter RLS-Freigabe:

- Datenbestand pruefen und als Testdaten resetten oder bewusst auf einen Testhaushalt backfillen.
- `household_id` fuer `shopping_list` und `meal_plan` einfuehren.
- Index-Check fuer `shopping_list.household_id`, `meal_plan(household_id, week_start)` und `household_memberships(user_id)`.
- Wenn Daten sauber sind: `NOT NULL` fuer `shopping_list.household_id` und `meal_plan.household_id` pruefen.

RLS-Migrationsrichtung:

- `grant select, insert, update, delete` nur an `authenticated`.
- Sequence-Grants fuer Insert-Pfade setzen.
- Policies pro Operation mit `to authenticated`.
- Household-Praedikat: Zugriff nur, wenn `(select auth.uid())` Mitglied des jeweiligen `household_id` ist.
- `api_keys` und `ingredient_dictionary` ohne Data-API-Grants lassen.
- `recipes` im ersten Slice nicht fuer authenticated CRUD oeffnen; das bestehende breite Template darf nicht direkt als Migration verwendet werden.

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

### Phase 0.5: Auth/DX Runbook und Secret-Schutz

Aufgaben:

- Hardcodierte Supabase-Postgres-URL aus `scripts/get-db-urls.ts` entfernen und Secret rotieren.
- `.env.example` und README von "Supabase Auth future/optional" auf Slice-1-Pflichtvariablen aktualisieren.
- Env-Matrix definieren: Server-only, Mobile-public, Staging-only.
- Admin-/Testuser-Bootstrap dokumentieren: Admin, User A, User B, Default-Haushalt, Memberships.
- API-Error-Kontrakt definieren: `{ error: { code, message, cause, fix } }`.
- Route Privacy Matrix erstellen: public, authenticated, admin, backend-only, deferred-but-warned.

Akzeptanz:

- Ein Entwickler kann in unter 15 Minuten Testuser anlegen, Token holen und `/api/v1/shopping` mit Bearer Token aufrufen.
- Kein Secret steht mehr hardcodiert im Repo.
- Auth-Fehler haben stabile Codes wie `auth_missing`, `auth_invalid`, `token_expired`, `forbidden`, `not_found`, `setup_required`, `no_household`.

### Phase 1: Server Auth Skeleton

Aufgaben:

- Supabase JS Server Dependency im Root ergaenzen, falls noch nicht vorhanden. Aktuell ist nur die Supabase CLI als Root-Dependency vorhanden, nicht `@supabase/supabase-js`.
- Mobile Supabase Dependency ergaenzen, falls noch nicht vorhanden.
- `src/auth.ts` vom Stub zu echter Token-Verifikation umbauen.
- Hono Middleware oder Helper fuer geschuetzte Routen erstellen.
- CORS `Authorization` erlauben.
- AuthContext mit `userId`, `email`, `appRole`, `memberships`, `activeHouseholdId`, `accessToken` bereitstellen.
- Tests fuer Auth-Parsing und Fehlerfaelle schreiben.

Akzeptanz:

- Public Endpoints bleiben public.
- Geschuetzte Test-Route oder Slice-Route verlangt Token und aktiven Haushalt.
- Invalid Token liefert `401`.
- Admin-Kontext kommt aus DB-basierter Rollenquelle, nicht aus `user_metadata`.

Verifikation:

```bash
npm run test:unit -- --run test/unit/auth.test.ts
npx tsc --noEmit
```

### Phase 2: Household-Scoped Shopping und Planner im Server

Aufgaben:

- `shopping_list`-DB-Funktionen um `householdId` erweitern.
- `meal_plan`-DB-Funktionen um `householdId` erweitern.
- Planner-/Shopping-Routen geben den aktiven Haushalt aus dem Auth-Kontext an DB-Funktionen weiter.
- Negative Tests fuer Cross-User-Read/Update/Delete.
- Keine Backward-Kompatibilitaet fuer unauthenticated Single-User in Shopping/Planner; aktuelle Daten sind Testdaten.

Akzeptanz:

- User A sieht, aendert und loescht nur Zeilen seines aktiven Haushalts.
- User B sieht User-A-Haushalt nicht, solange keine gemeinsame Membership existiert.
- Massen-Deletes sind household-scoped.
- Bestehende Single-User-Tests werden auf Household-Scope umgestellt.

Verifikation:

```bash
npm run test:unit -- --run test/unit/planner-routes.test.ts test/unit/db-react.test.ts
npx tsc --noEmit
```

### Phase 3: Mobile Auth Foundation

Aufgaben:

- Mobile Supabase Client und Session-Utility anlegen.
- Settings Account-Block bauen.
- `mobile/utils/api.ts` zu zentralem `apiFetch` mit Auth-Header und Error-Code-Parsing ausbauen.
- Shopping-/Planner-/Planner-Recipe-Fetches auf Wrapper ziehen.
- Query-Cache bei Login/Logout/User-/Household-Wechsel isolieren oder leeren.

Akzeptanz:

- Login/Logout kann ohne App-Neustart Status wechseln.
- Auth-Header wird bei API-Calls gesetzt, wenn Session vorhanden ist.
- Logout entfernt Session und verhindert Cache-Leak zwischen Accounts.
- Settings zeigt Account, Rolle und Haushaltstatus.

Verifikation:

```bash
npm --prefix mobile run test:unit
npm --prefix mobile run typecheck
```

### Phase 4: RLS Migration Draft zu echter Migration

Aufgaben:

- Migration mit Supabase CLI erzeugen, nicht per frei erfundenem Dateinamen. Lokaler CLI-Stand war zuletzt `2.102.0`.
- Datenform fuer `user_profiles`, `households`, `household_memberships`, `shopping_list` und `meal_plan` pruefen.
- Testdaten resetten oder bewusst auf Admin/User-A/User-B-Testhaushalte backfillen; keine Legacy-Null-Kompatibilitaet behalten.
- Policies und Grants fuer Household-Basis, `shopping_list` und `meal_plan` anwenden.
- `recipes` in dieser Migration nicht fuer `authenticated` CRUD oeffnen.
- Admin-Kontext smoke-testen: Admin darf spaeter erweiterte Sicht bekommen, aber Slice-1-Policies duerfen dadurch keine Userdaten global oeffnen.
- Vor dem Anwenden erneut pruefen, dass Extension-Grants nach dem Move nach `extensions` weiter passend sind und keine neuen Advisor-Warnungen aus dem Extension-Track zurueckgekommen sind.

Akzeptanz:

- `anon` hat keinen Zugriff.
- `authenticated` User A kann Rows seines aktiven Haushalts CRUDen.
- User B kann User-A-Haushalt nicht lesen, aendern oder loeschen, solange keine Membership existiert.
- Zwei Mitglieder desselben Haushalts sehen dieselbe Shopping-/Planner-Sicht.
- Admin-Login ist als Rolle nachweisbar, oeffnet aber in Slice 1 keine globale Datenansicht ohne explizite Admin-Policy.
- `recipes` bleibt fuer Data-API-CRUD geschlossen.
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
- README und `.env.example` vor oder zusammen mit Code aktualisieren: Auth ist fuer Slice-1-Shopping/Planner Pflicht, nicht optional.
- [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md) um Auth/RLS-Teststand ergaenzen.
- [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md) von Readiness zu verifizierter Teilumsetzung aktualisieren.
- CI-Luecke dokumentieren: lokaler Postgres-Test beweist keine Supabase-RLS-Korrektheit.
- Geheimnisgeschuetzten RLS-Smoke fuer Staging definieren und vor Release ausfuehren.
- Auth-Runbook aufnehmen: Admin/Testuser bootstrap, Token holen, Household anlegen, Smoke ausfuehren.

Akzeptanz:

- Doku unterscheidet klar zwischen Server-Household-Scoping, Mobile-Session und echter Supabase-RLS-Verifikation.
- Ein Entwickler kann ohne Code-Lesen Admin, User A, User B und zwei Testhaushalte anlegen.
- Vor Push ist klar, welche GitHub Actions/Deploy-Automationen getriggert werden.

## Testmatrix

### Unit

- Auth Header Parsing
- Token Verification Happy/Failure
- AuthContext Rollen, Memberships und aktiver Haushalt
- Household-Scoped DB Helpers
- Route-Level `401`/`403`/`404`
- Shopping Mass Delete household-scoped
- Planner Week Delete household-scoped

### Integration

- User A und User B mit getrennten Haushalten gegen lokale Test-DB.
- User A und User B im selben Haushalt sehen dieselben Shopping-/Planner-Daten.
- Admin-Login liefert Admin-Rolle, aber keine globale Datenfreigabe ohne Admin-Policy.
- Legacy `user_id is null` / `household_id is null` Verhalten entfernt oder durch Reset ausgeschlossen.
- RLS-Smoke gegen Supabase/Staging mit echten authenticated Tokens.
- `recipes` Data-API-CRUD bleibt fuer `authenticated` geschlossen.

### Mobile

- Login Status, Rolle und Haushaltstatus in Settings.
- Logout loescht Session.
- API-Wrapper setzt Bearer Header.
- Query-Cache wird bei User-/Household-Wechsel nicht wiederverwendet.
- Shopping-/Planner-Screens bleiben unter RNTL gruen.

## Risiken

- Lokale Tests mit `DATABASE_URL` koennen RLS-Fehler uebersehen.
- Ein breiter Auth-Schalter kann Import-, Job- und Key-Flows brechen, bevor deren Ownership geklaert ist.
- `recipes` hat globale Defaults; reines `user_id`-Ownership waere fachlich falsch.
- Mobile Query-Persistenz kann Daten zwischen Accounts oder Haushalten leaken, wenn sie nicht user-/household-scoped wird.
- Lokaler `main` kann Doku-/Ops-Commits vor `origin/main` enthalten; vor Shipping muss klar sein, welche Basis der Feature-Branch wirklich hat.

## Offene Entscheidungen

- Wer ist der erste Admin und wie wird dieser Admin reproduzierbar gebootstrapped?
- Wie heisst der Default-Haushalt fuer neue User/Testuser?
- Werden `recipes` im naechsten Slice globale Templates, Haushalt-Rezepte oder User-Kopien?
- Wie werden Import-Jobs, Scanner-Ergebnisse und Extract-Job-Listen user-/household-sicher gemacht?
- Wie werden BYOK/API-Keys und Plattform-Zugangsdaten spaeter an Account oder Haushalt gebunden?

## Empfohlener Start

Start mit Phase 0 und Phase 1:

1. Branch-/Remote-Stand klaeren.
2. Auth-Skeleton mit Tests bauen.
3. Noch keine RLS-Grants oeffnen.
4. Danach Shopping-/Planner-Household-Scoping lokal implementieren.

Das schafft eine harte, testbare Grenze, bevor Datenbankrechte auf Supabase geoeffnet werden.

---

## GSTACK AUTOPLAN REVIEW REPORT

Status: Autoplan Review abgeschlossen; Richtung C bestaetigt, Umsetzung noch offen.
Review-Datum: 2026-06-04
Base Branch: `main`
UI-Scope erkannt: ja, wegen Settings Account-Block, Login/Logout, Session-Status und Cache-Wechsel.
DX-Scope erkannt: ja, wegen API/Auth-Kontrakt, Supabase CLI, Migration, Error-Konventionen und Entwicklerdoku.

### Premise-Gate Entscheidung 2026-06-04

Entscheidung: Der Plan wird auf **Shared Household Cooking mit Account-Sicherheit** ausgerichtet.

Das bedeutet:

- Zielbild ist nicht nur ein einzelner Nutzer mit privaten Daten, sondern ein Haushalt, der Rezepte, Einkaufsliste und Wochenplan gemeinsam nutzen kann.
- Slice 1 darf trotzdem klein bleiben: zuerst Account-Sicherheit, sichere Session, klare Datenisolation, Admin-Grundlage und ein Datenmodell, das Household spaeter nicht blockiert.
- Bestehende Daten in der aktuellen Datenbank sind Testdaten und muessen nicht erhalten werden. Ein harter Reset, bewusster Backfill auf Testnutzer oder das Unsichtbarmachen alter `user_id is null`-Zeilen ist akzeptabel.
- Ein Admin-Login ist explizit gewuenscht. Admins sollen spaeter mehr sehen und mehr Rechte haben koennen. Deshalb darf Authorization nicht nur `user_id = auth.uid()` kennen, sondern braucht von Anfang an eine belastbare Rollen-/Admin-Strategie.
- Keine Authorization ueber `user_metadata`. Admin-/Rolleninformationen muessen aus belastbarer Quelle kommen: Supabase `app_metadata` nur mit JWT-Frischebewusstsein oder, besser fuer serverseitige Rechte, aus einer eigenen DB-Tabelle wie `user_profiles` / `memberships`.

Konsequenz fuer den Slice:

- `user_id` ist weiterhin wichtig fuer den angemeldeten Account.
- Fuer gemeinsam nutzbare Daten wird im ersten Slice direkt `household_id` eingefuehrt, statt `user_id` als Sackgassenmodell zu verwenden.
- Die erste RLS-/Server-Policy darf kein Sackgassenmodell erzeugen: Shopping/Planner werden household-scoped, `user_id` bleibt nur Account-/Audit-Kontext.
- Admin-Faehigkeiten werden im ersten Slice nicht breit gebaut, aber die Auth-Schicht muss Admin-Kontext ausgeben koennen und Tests fuer `user`, `admin`, `unauthenticated` vorbereiten.

### Phase 1: CEO Review

#### 0A: Premise Challenge

| Premise | Bewertung | Risiko | Entscheidung |
|---|---|---|---|
| Multi-User Login ist der richtige erste Problemname. | Zu technisch formuliert. Beide Outside Voices sagen: Nutzer wollen keinen Login, sondern Sync, Haushaltsnutzung, Privatsphaere und keine Datenverluste. | Der Slice kann Wochen kosten und am Ende nur Reibung erzeugen. | User-Challenge: Reframe auf `account-backed cooking continuity` oder `shared household cooking`. |
| Shopping und Meal Plan sind der richtige erste Datenbereich. | Technisch plausibel, aber produktstrategisch noch nicht bewiesen. Sie sind leicht household-sicher zu machen, aber Rezepte/Importe koennen naeher am Kernnutzen liegen. | Wir optimieren fuer einfache Tabellen statt fuer den hoechsten Nutzwert. | Auto-Entscheidung: Shopping/Planner bleiben als erster Sicherheits-Slice, aber der Plan braucht eine Produktwert-Begruendung und ein Strategy-Gate. |
| `recipes` im ersten Slice nicht umzubauen ist richtig. | Plausibel wegen globaler Default-Semantik, aber fachlich zentral. | Wenn Household/Sharing das Ziel ist, kann ein reines `user_id`-Modell spaeter falsch sein. | Auto-Entscheidung: Recipes bleiben aus dem Schreib-Slice, aber die Ownership-Entscheidung muss vor Phase 2 als eigenes Modellkapitel rein. |
| Server-/Household-Scoping vor echter RLS-Migration ist sicherer. | Teilweise richtig, aber nur wenn Supabase-Smoke frueh genug passiert. | Lokale Drizzle-Tests koennen eine falsche RLS-Policy nicht sehen. | Auto-Entscheidung: Minimalen Staging-RLS-Smoke vor Mobile-Login-Gate ziehen. |
| Single-User-Kompatibilitaet kann spaeter entschieden werden. | Falsch. Das ist eine Kernentscheidung fuer Migration, UX und Datenvertrauen. | Nutzer koennen nach Login leere Listen/Planner sehen und Datenverlust vermuten. | User-Challenge/Premise-Gate: Vor Implementierung entscheiden. |
| BYOK, Import-Jobs und Plattform-Credentials duerfen komplett spaeter kommen. | Als Implementierungsscope plausibel, als Privacy-Kommunikation unvollstaendig. | Nutzer koennen nach Login faelschlich glauben, alle privaten Daten seien user-isoliert. | Auto-Entscheidung: Privacy Boundary Inventory vor Auth-Skeleton ergaenzen. |

#### 0B: Existing Code Leverage Map

| Subproblem | Existierender Hebel | Gap |
|---|---|---|
| Request-User-Kontext | [src/auth.ts](/home/patrick/Projekte/rezepti/src/auth.ts) existiert als klarer Stub. | Keine Request-Parameter, keine Supabase-Verifikation, keine Middleware. |
| API-Mounting | [src/api-react.ts](/home/patrick/Projekte/rezepti/src/api-react.ts) mountet zentrale Router. | Keine Public/Protected-Routenklassifikation. |
| CORS | [src/index.ts](/home/patrick/Projekte/rezepti/src/index.ts) nutzt Hono CORS. | `Authorization` fehlt in `allowHeaders`; aktuell nur `Content-Type` und `x-groq-key`. |
| Shopping/Planner Routen | [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts) enthaelt alle relevanten Endpunkte. | Reads/Writes/Deletes rufen DB-Helper ohne `userId` auf. |
| Shopping DB | [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts) hat CRUD und Duplicate Guard. | `getShoppingList`, Toggle, Delete, Clear nutzen keine Owner-Bedingung; `clearAllShoppingItems` ist global. |
| Meal Plan DB | [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts) hat weekbasierte Helpers. | `clearMealPlanForWeek` loescht global fuer diese Woche. |
| Schema | [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts) hat `user_id` auf Zieltabellen. | Keine `NOT NULL`-Entscheidung, keine expliziten `user_id`-Indexes fuer Policy-Praedikate im Schema-Migrationspfad. |
| Mobile API | [mobile/utils/api.ts](/home/patrick/Projekte/rezepti/mobile/utils/api.ts) ist ein erster zentraler Wrapper. | Viele direkte `fetch`-Aufrufe in Shopping, Planner, Extract, Scanner und Recipe Detail bleiben ausserhalb. |
| Mobile Settings | [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx) hat bereits App-/Credential-Settings. | Noch kein Account-Block, keine Auth-Status-Zustaende, keine Migration/Claim-UX. |
| RLS Template | [db/templates/public-multi-user-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-multi-user-data-api-rls.sql) nutzt gute Supabase-Leitplanken. | Template umfasst auch `recipes`; erster Slice will eigentlich nur Shopping/Planner produktiv oeffnen. |

#### 0C: Dream State Diagram

```text
CURRENT
  Single-user app
  Auth stub
  Global shopping/planner mutations
  Mobile direct fetches
  RLS template only

THIS PLAN, AFTER CEO FIXES
  Account-backed continuity proof
  Explicit public/protected endpoint map
  Shopping/planner household-scoped in server
  Settings login/logout with no perceived data loss
  Minimal staging RLS smoke before mobile release gate
  Privacy boundary inventory for imports, BYOK, platform credentials

12-MONTH IDEAL
  Household/workspace model if sharing is the strategic bet
  Recipes modeled as global templates, user copies, or household assets
  Import jobs and credentials user/household-bound
  Supabase RLS and server authorization agree by construction
  Invite/share flows are product features, not auth afterthoughts
```

Dream-State-Delta: Der Plan bringt Rezepti von Auth-Stub zu erstem household-sicheren Bereich. Er bringt Rezepti noch nicht zu Haushaltskollaboration, sauberem Recipe-Ownership-Modell oder per-user Import-/Credential-Isolation.

#### 0C-bis: Implementation Alternatives

| Ansatz | Aufwand | Risiko | Pro | Contra | Entscheidung |
|---|---:|---|---|---|---|
| A: Aktueller technischer Auth-Slice | mittel | mittel | Klare Sicherheitsgrenze, wenig Tabellen, gut testbar. | Geringer sichtbarer Nutzwert; Migration/Haushalt bleiben offen. | Nicht allein ausreichend. |
| B: Account-backed cooking continuity | mittel | mittel | Login hat sofortes Nutzerziel: Daten auf Account halten, kein Cache-/Account-Leak, Shopping/Planner ueberleben Account-Wechsel. | Braucht explizite Legacy-/Claim-Entscheidung vor Code. | Empfohlen. |
| C: Shared household cooking erster Slice | hoch | hoch | Strategisch staerker, zwingt richtiges Kollaborationsmodell. | Mehr Datenmodell, Invite-UX, Berechtigungen und Testmatrix im ersten Slice. | Als Zielbild aufnehmen, aber nicht komplett in Slice 1 ziehen. |

#### 0D: Mode-Specific Analysis: Selective Expansion

Auto-entschieden nach `/autoplan`-Prinzipien:

- In Scope ergaenzen: Produktversprechen `account-backed cooking continuity`, weil es den bestehenden Auth-Slice schaerft und keine neue Infrastruktur verlangt.
- In Scope ergaenzen: Privacy Boundary Inventory fuer alle Endpunkte/Jobs/Credentials, weil es im direkten Auth-Blastradius liegt und falsche Nutzerannahmen verhindert.
- In Scope ergaenzen: Minimaler Staging-RLS-Smoke vor Mobile-Release-Gate, weil lokale Tests RLS nicht beweisen.
- Nicht in Scope ziehen: Voller Household-/Invite-Slice, weil das mehr als ein 1-Tages-CC-Expansion ist und mehrere neue Modellentscheidungen erzwingt.
- Nicht in Scope ziehen: Voller Recipes-Schreibumbau, weil globale Defaults fachlich eine eigene Matrix brauchen.

#### 0E: Temporal Interrogation

| Zeitpunkt | Was muss wahr sein | Risiko wenn falsch |
|---|---|---|
| Stunde 1 | Branch, Ziel-DB, Produktversprechen, Single-User-Migration und Scope sind entschieden. | Middleware und Tests kodieren falsche Annahmen. |
| Stunde 2-3 | Auth-Kontrakt und Public/Protected-Routenkarte stehen. | Import-/Health-/Validation-Pfade brechen oder bleiben implizit offen. |
| Stunde 4-5 | Shopping/Planner Household-Scoping hat negative Cross-User-Tests. | Massen-Deletes oder ID-only Updates bleiben global. |
| Stunde 6+ | Mobile Login/Logout zeigt keine leeren/verlorenen Daten ohne erklaerte Migration. | Nutzer erleben Login als Datenverlust. |
| Vor Release | Staging-RLS-Smoke mit echten JWTs prueft User A/User B. | Serverfilter sind gruen, DB-Policy ist trotzdem falsch. |

#### 0F: Mode Selection Confirmation

Modus: `SELECTIVE EXPANSION`.

Begruendung: Der Plan ist nicht zu klein im technischen Sinn. Er ist zu unscharf im Produktversprechen. Die richtigen Erweiterungen liegen im direkten Blastradius: Produktziel, Migration/Claim-Entscheidung, Privacy Boundary Inventory und frueher RLS-Smoke. Voller Household-Sync und Recipes-Ownership bleiben bewusst Folgeslices.

#### 0.5: Dual Voices

##### CLAUDE SUBAGENT (CEO - strategic independence)

Kernaussagen:

- Kritisch: Der Plan loest Login-Plumbing, nicht sichtbar den Nutzerwunsch nach Haushaltssync, privater Kochkontinuitaet, Multi-Device-Nutzung und keinem Datenleck.
- Kritisch: Single-User-Migration ist zentral, nicht Nebenfrage. Ohne Claim-/Legacy-Entscheidung droht wahrgenommener Datenverlust.
- Hoch: RLS erst spaet zu beweisen schafft falsche Sicherheit.
- Hoch: BYOK, Import-Jobs und Plattform-Credentials brauchen zumindest eine Privacy Boundary Inventory, auch wenn sie nicht implementiert werden.
- Mittel: Wettbewerber verkaufen Sync/Sharing/Haushalt, nicht Auth-Infrastruktur.

##### CODEX SAYS (CEO - strategy challenge)

Kernaussagen:

- Multi-User Login ist kein bewiesenes strategisches Problem. Account-Portabilitaet, Haushaltssharing, Privacy, Backup, Monetarisierung und BYOK-Isolation waeren unterschiedliche Produktwetten.
- Shopping/Planner first ist technisch bequem, aber nicht zwingend der hoechste Produktnutzen.
- `user_id`-only kann in sechs Monaten falsch sein, falls der Kernnutzen Haushalt/Workspace ist.
- Supabase RLS plus serverseitiges Drizzle-Household-Scoping erzeugen ein Split-Brain-Risiko, wenn die Architekturentscheidung nicht explizit ist.
- Der Plan hat keine Adoption-Metrik und keinen Moment, der Login fuer Nutzer notwendig oder wertvoll macht.

##### CEO DUAL VOICES - CONSENSUS TABLE

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| 1. Premises valid? | Nein, Produktpremisse zu technisch | Nein, Problem nicht bewiesen | DISAGREE_WITH_PLAN |
| 2. Right problem to solve? | Nur wenn als Haushalt/Kontinuitaet gerahmt | Nur wenn als Account-/Household-Proof gerahmt | CONFIRMED CONCERN |
| 3. Scope calibration correct? | Shopping/Planner ok, aber Value-Gate fehlt | Technisch bequem, strategisch unsicher | DISAGREE_WITH_PLAN |
| 4. Alternatives sufficiently explored? | Nein | Nein | CONFIRMED GAP |
| 5. Competitive/market risks covered? | Nein | Nein | CONFIRMED GAP |
| 6. 6-month trajectory sound? | Risiko: Auth ohne Produktnutzen | Risiko: falsches Ownership-Modell | CONFIRMED CONCERN |

#### Sections 1-10 CEO Review

##### Section 1: User Pain / Product Bet

Geprueft: Ziel, Nicht-Ziele, Phasen, offene Entscheidungen und beide Outside Voices. Der Plan benennt technische Faehigkeiten, aber kein messbares Nutzerergebnis. Login muss als Mittel zu `account-backed cooking continuity` oder spaeter `shared household cooking` definiert werden.

Entscheidung: Produktversprechen in den Plan aufnehmen. Success Metric: Eine existierende Single-User-Instanz kann sich anmelden, Shopping/Planner bleiben sichtbar oder werden bewusst als Legacy erklaert, Account-Wechsel leakt keinen Cache, und User A/User B sind getrennt.

##### Section 2: Error & Rescue Registry

| Fehlerfall | Nutzer sieht | Rescue im Plan | Gap |
|---|---|---|---|
| Fehlender Token auf geschuetztem Endpoint | `401` | Fehlerkonvention vorhanden | Mobile muss Login/Retry/Logout-Zustand spezifizieren. |
| Valider Token, fremde Ressource | `403` oder `404` | Konvention vorhanden | Routen brauchen konsistente Wahl; fuer fremde IDs besser `404`, damit Existenz nicht leakt. |
| Login nach vorhandenen Legacy-Daten | Leere Liste/Planner moeglich | Offen | Claim-/Legacy-UX fehlt. |
| Logout nach Account-Nutzung | Alte Daten koennten im Cache bleiben | Cache leeren oder scopen | Query-Key-/Persistenz-Strategie muss konkret werden. |
| Staging-RLS-Fehler | Lokal gruen, Supabase rot | Spaeter Smoke | Smoke frueher ziehen. |
| Supabase Auth nicht konfiguriert | Login blockiert | Nicht spezifiziert | Setup-/Env-Fehlertext braucht Ursache und Fix. |

##### Section 3: Market / Competitive Reality

Geprueft: Plan und Outside Voices. Der Plan enthaelt keine Wettbewerbsposition. Das ist fuer Implementierung nicht blockierend, aber fuer Scope riskant, weil Multi-User bei Koch-/Planungsapps normalerweise Sync, Sharing, Haushalte und gemeinsame Listen bedeutet.

Entscheidung: Kein grosser Wettbewerbsresearch-Slice. Aber der Plan muss seinen ersten sichtbaren Nutzen benennen: nicht `Login`, sondern `Shopping/Planner account-backed continuity ohne Datenleck`.

##### Section 4: Scope Expansion / Boil the Lake

In den Blastradius gehoeren Auth-Kontrakt, Ziel-DB, Household-Scoping, mobile API-Injection, Query-Cache und RLS-Smoke. Privacy Boundary Inventory gehoert dazu, weil sonst Login falsche Privatheitsannahmen erzeugt.

Nicht in den Blastradius gehoeren vollstaendige Household-Invites, voller Recipes-Schreibumbau, BYOK-Persistenzmodell und Import-Job-Persistenz. Diese werden als Folgeslices notiert.

##### Section 5: Data Ownership Strategy

Geprueft: `schema.ts`, RLS-Template, offene Entscheidungen. Der Plan nutzt `user_id`, aber beantwortet nicht, ob die eigentliche Zukunft `user`, `household` oder `workspace` ist. Fuer Slice 1 ist `user_id` als Sicherheitsgrenze akzeptabel, aber nur, wenn Household als bewusst spaeteres Modell markiert wird.

Entscheidung: Slice 1 bleibt user-owned. Plan muss aber festhalten: Kein Household-Versprechen in Slice 1; kein Schema-Entwurf, der spaetere Household-Zuordnung blockiert.

##### Section 6: Migration / Existing Users

Geprueft: Phasen 0-5 und offene Entscheidungen. Die Migration bestehender `user_id is null`-Zeilen ist aktuell offen, aber sie bestimmt die Nutzerwahrnehmung.

Entscheidung: Premise-Gate erforderlich. Vor Code muss entschieden werden: Claim bestehender Shopping/Planner-Daten beim ersten Login oder Legacy-Daten bleiben bewusst unauthenticated/lokal sichtbar.

##### Section 7: Security / Trust Positioning

Geprueft: Supabase-Leitplanken, RLS-Template, Auth-Ziel. Der Plan vermeidet `service_role` im Client, `user_metadata`-Authorization und offene Grants. Gut. Der Trust-Gap ist Kommunikation und Abdeckung: Import-Jobs, BYOK und Plattform-Credentials bleiben global/ungeklaert.

Entscheidung: Privacy Boundary Inventory aufnehmen und alle nicht isolierten Bereiche in UI/Doku nicht als user-private darstellen.

##### Section 8: Architecture Direction

Geprueft: Server via `DATABASE_URL`/Drizzle, spaetere Supabase Data API/RLS. Der Plan laesst offen, ob Supabase-native Clientzugriffe wirklich kommen oder ob der Server die dauerhafte API-Grenze bleibt.

Entscheidung: Fuer Slice 1 Server bleibt Autorisierungsgrenze; RLS ist Defense-in-Depth und spaeter Data-API-Voraussetzung. Direkter Client-Data-API-Zugriff bleibt Nicht-Ziel.

##### Section 9: Adoption Metric

Geprueft: Akzeptanzkriterien. Sie sind technisch, aber nicht produktorientiert.

Entscheidung: Neue Release-Metrik: Login ist nur erfolgreich, wenn ein Nutzer nach Login/Logout/Account-Wechsel Shopping/Planner ohne Datenverlust-Verwirrung benutzen kann und User-A/User-B-Isolation in Server-Tests plus Staging-Smoke belegt ist.

##### Section 10: Six-Month Regret

Risiko: In sechs Monaten existieren Auth, Middleware und Teil-RLS, aber kein klares Household-/Sharing-Modell, keine saubere Recipe-Semantik und kein Credential-/Import-Ownership. Dann waere der Slice Infrastruktur ohne Produktfortschritt.

Entscheidung: Plan darf starten, aber nur mit scharfem Slice-Namen und expliziten Nicht-Versprechen: Slice 1 beweist account-gestuetzte Kontinuitaet fuer Shopping/Planner, nicht kompletten Multi-User-Haushalt.

#### NOT in Scope

| Deferred Item | Grund |
|---|---|
| Voller Household-/Workspace-/Invite-Slice | Strategisch wichtig, aber zu gross fuer Auth First Slice. |
| Voller `recipes` Schreib-Ownership-Umbau | Globale Defaults brauchen eigene Testmatrix. |
| BYOK/API-Key per-user Persistenz | Muss modelliert werden, aber erster Slice kann nur Privacy Boundary markieren. |
| Import-Jobs persistent user-bound | Eigenes Job-/Lifecycle-Thema. |
| Direkter Supabase Data API Client-Zugriff | Server bleibt in Slice 1 API-Grenze. |

#### What Already Exists

- `user_id`-Spalten existieren auf `recipes`, `shopping_list`, `meal_plan`, `api_keys`.
- RLS-Template existiert und nutzt `to authenticated`, `(select auth.uid())` und keine `service_role`-Client-Annahme.
- Shopping/Planner-Routen und DB-Helper sind zentral genug, um den Household-Slice klein zu halten.
- Mobile Settings und API-Utilities existieren, aber direkte Fetches sind noch breit verteilt.
- Tests fuer Planner/Shopping existieren und koennen als Basis fuer negative Cross-User-Tests erweitert werden.

#### Failure Modes Registry

| Failure Mode | Severity | Phase | Mitigation |
|---|---|---|---|
| Login erzeugt wahrgenommenen Datenverlust | Critical | Phase 0/3 | Claim-/Legacy-Entscheidung und UX vor Code festlegen. |
| Globaler Mass-Delete bleibt bestehen | Critical | Phase 2 | DB-Helper verlangen `userId`; Tests fuer `clearAll` und `clearWeek`. |
| RLS-Policy falsch trotz lokaler Tests | High | Phase 4 vorziehen | Minimaler Staging-Smoke vor Mobile-Release-Gate. |
| Nutzer glaubt BYOK/Importer seien privat isoliert | High | Phase 0/5 | Privacy Boundary Inventory und Doku/UI-Wording. |
| Falsches `user_id`-Modell blockiert Household spaeter | High | Phase 0 | Household als Folgemodell bewusst offenhalten; kein falsches Versprechen. |
| Direkte mobile Fetches umgehen Auth-Header | High | Phase 3 | Pflichtbereich Shopping/Planner zentralisieren, Rest inventarisieren. |

#### Phase 1 Completion Summary

| Bereich | Ergebnis |
|---|---|
| CEO Score | 7/10 nach Korrekturen; 5/10 ohne Produkt-Reframe. |
| Auto-Entscheidungen | Produktversprechen schaerfen, Privacy Inventory aufnehmen, RLS-Smoke vorziehen, Server als Slice-1-Grenze festlegen. |
| Taste Decisions | Keine reine Geschmacksfrage; die grossen Punkte sind strategische Premissen. |
| User Challenges | Ja: Plan nicht als `Multi-User Login`, sondern als `account-backed cooking continuity` rahmen; Single-User-Migration vor Code entscheiden. |
| Codex Voice | 15 strategische Blind Spots, Kern: Login ist nicht das Produkt. |
| Claude Subagent | 7 Findings, Kern: Household/Continuity und Migration sind zentral. |
| Consensus | 5/6 Dimensionen mit bestaetigter Sorge, 1/6 als direkte Planabweichung. |

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Produktversprechen von Login auf Shared Household Cooking mit Account-Sicherheit schaerfen | User Challenge resolved | P1/P2 | User hat Household-Ziel plus Account-Sicherheit und Admin-Wunsch bestaetigt. | Auth-Slice unveraendert als Ziel verkaufen |
| 2 | CEO | Shopping/Planner bleiben erster Sicherheits-Slice, aber mit Produktwert-Gate | Auto | P3/P5 | Kleinster testbarer household-sicherer Bereich, solange Nutzen und Migration geklaert werden. | Sofort voller Recipes-/Household-Slice |
| 3 | CEO | Minimaler Staging-RLS-Smoke vor Mobile-Release-Gate | Auto | P1/P2 | Lokale Tests beweisen Supabase-RLS nicht. | RLS erst nach kompletter Migration pruefen |
| 4 | CEO | Privacy Boundary Inventory vor Auth-Skeleton aufnehmen | Auto | P1/P2 | Login erzeugt Privatheitsannahmen fuer BYOK, Importer und Credentials. | Deferred Bereiche komplett unkommentiert lassen |
| 5 | CEO | Server bleibt in Slice 1 Auth-/Datenzugriffsgrenze | Auto | P5/P3 | Verhindert Supabase Data API Split-Brain im ersten Slice. | Gleichzeitig Server- und Direct-Client-Data-API bauen |
| 6 | CEO | Single-User-Migration vor Implementierung entscheiden | User Challenge | P1 | Diese Entscheidung bestimmt Datenvertrauen, UX und RLS-Form. | Als offene Folgeentscheidung behalten |
| 7 | CEO | Aktuelle DB-Daten als Testdaten behandeln, keine Legacy-Claim-UX erzwingen | User Decision | P3 | User hat bestaetigt, dass aktuelle DB-Daten nicht wichtig sind. | Aufwendige Migration/Claim-UX fuer Testdaten |
| 8 | CEO | Admin-Rolle als explizite Auth-/Datenmodell-Anforderung aufnehmen | User Decision | P1/P5 | Admin soll spaeter mehr sehen und mehr Rechte haben koennen; das muss die Auth-Schicht vorbereiten. | Admin spaeter ad hoc ueber unsichere Metadaten ergaenzen |

### Phase 2: Design Review

#### Step 0: Design Scope

Design Scope: Settings Account-Bereich, Login/Logout, Session-Restore, Rollenanzeige, passiver Haushalt-Anker, Shopping-/Planner-Empty-States nach Testdaten-Reset, Auth-Fehlerzustaende.

Initiale Design-Vollstaendigkeit: 4/10.

Warum: Der Plan nennt Dateien und technische Aufgaben, aber nicht was der Nutzer sieht, in welcher Reihenfolge, mit welchen Texten und in welchen Fehlerzustaenden. Fuer einen Auth-Slice ist das zu wenig, weil Login sonst wie Reibung oder Datenverlust wirkt.

Bestehende UI-Pattern:

- [mobile/app/(tabs)/settings.tsx](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/settings.tsx) nutzt gestapelte Settings-Sektionen mit Icon, Titel, Formularfeldern, Statuszeilen und Aktionen.
- Der Account-Bereich muss oberhalb von Groq/API-Key, Server und Integrationen liegen, weil er kuenftig steuert, welche Daten sichtbar sind.
- Bestehende Modals/Alerts sind fuer destruktive Aktionen vorhanden; Login selbst sollte kein Alert-getriebener Flow werden.

#### Step 0.5: Dual Voices

##### CLAUDE SUBAGENT (Design - independent review)

Kernaussagen:

- Kritisch: Settings hat keine klare Informationshierarchie. Nutzer muessen zuerst Account-Status, Rolle und Haushaltstatus sehen.
- Hoch: Household-Zielbild ist entschieden, aber die UI bleibt im Plan Single-User.
- Hoch: Admin wird technisch genannt, aber nicht als sichtbarer Nutzerzustand geplant.
- Kritisch: Nach Login leere Shopping-/Planner-Daten koennen wie Datenverlust wirken, auch wenn aktuelle Daten nur Testdaten sind.
- Hoch: Es fehlen konkrete Zustaende fuer Loading, abgelaufene Session, Offline, Login abgebrochen, Logout pending, Admin ohne Admin-Oberflaeche und User ohne Haushalt.

##### CODEX SAYS (Design - UX challenge)

Kernaussagen:

- Der Plan ist strategisch korrigiert, aber UI/UX-ready ist er nicht.
- `Settings bekommt Account-Block` ist keine Design-Spezifikation.
- Responsive Strategie fehlt: inline, eigener Screen, Modal oder Bottom Sheet ist nicht entschieden.
- Accessibility ist nur implizit. Auth-UI braucht konkrete Anforderungen fuer Fokus, Feldfehler, Screenreader, Touch Targets und Statusbadges.
- Privacy-Wording muss eng sein: `Einkaufsliste und Wochenplan sind accountgeschuetzt`, nicht `alle Rezepti-Daten sind privat`.

##### Design Litmus Scorecard

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| 1. Informationshierarchie klar? | Nein | Nein | CONFIRMED GAP |
| 2. Zustaende vollstaendig? | Nein | Nein | CONFIRMED GAP |
| 3. Household sichtbar vorbereitet? | Nein | Nein | CONFIRMED GAP |
| 4. Admin sichtbar vorbereitet? | Nein | Nein | CONFIRMED GAP |
| 5. Privacy-Wording sicher? | Teilweise | Teilweise | CONFIRMED CONCERN |
| 6. Responsive Strategie klar? | Nicht spezifiziert | Nein | CONFIRMED GAP |
| 7. Accessibility testbar? | Nicht spezifiziert | Nein | CONFIRMED GAP |

#### Pass 1: Informationshierarchie

Score: 5/10 nach CEO-Korrektur, 3/10 im Originalplan.

Entscheidung: Settings bekommt eine oberste Sektion `Account & Haushalt`. Reihenfolge:

1. Account-Status: `Nicht angemeldet`, `Angemeldet als <email>`, oder `Session abgelaufen`.
2. Rolle: `Rolle: Nutzer` oder `Rolle: Admin`.
3. Haushalt: `Haushalt: Noch nicht eingerichtet` oder `Haushalt: <Name> · 1 Mitglied`.
4. Datenwirkung: `Einkaufsliste und Wochenplan sind accountgeschuetzt. Rezept-Importe, BYOK und Plattform-Zugangsdaten werden in diesem Slice noch separat behandelt.`
5. Primaere Aktion passend zum Zustand: `Anmelden`, `Erneut anmelden`, `Abmelden`.

#### Pass 2: Zustandsmatrix

Score: 4/10 im Originalplan; nach Addendum 8/10.

| Zustand | Settings-Anzeige | Shopping/Planner-Anzeige | Aktion |
|---|---|---|---|
| `auth:loading` | `Account wird geladen...` | Bestehende Daten nicht neu laden, bis Status klar ist. | Keine destruktiven Aktionen. |
| `signed_out` | `Nicht angemeldet` | Falls geschuetzt: Login-Hinweis statt leere Liste. | `Anmelden`. |
| `authenticating` | `Anmeldung laeuft...` | Keine Mutation starten. | Submit deaktiviert. |
| `authenticated:user` | Email, `Rolle: Nutzer`, Haushaltstatus | Accountgeschuetzte Daten laden. | `Abmelden`. |
| `authenticated:admin` | Email, `Rolle: Admin`, Haushaltstatus | Normale Nutzeransicht plus spaeter Admin-Anker. | `Abmelden`; Admin-Bereich darf noch `Noch nicht verfuegbar` zeigen. |
| `no_household` | `Haushalt: Noch nicht eingerichtet` | Daten gehoeren zunaechst dem Account. | `Haushalt einrichten` als deaktivierter/kommender Anker oder nicht anklickbare Statuszeile. |
| `token_expired` | `Sitzung abgelaufen` | Keine alten Accountdaten anzeigen. | `Erneut anmelden`. |
| `auth_error` | Problem + Ursache + Fix | Retry-Hinweis, keine stillen leeren Listen. | `Erneut versuchen`. |
| `logout_pending` | `Abmeldung laeuft...` | Mutationen gesperrt; Cache wird geleert. | Buttons deaktiviert. |
| `empty_after_reset` | Kein Warnbanner noetig, weil Testdaten bewusst nicht migriert werden. | `Noch nichts hier. Lege deine erste Einkaufsliste an.` / `Plane deine erste Woche.` | Erste-Aktion-Buttons. |

#### Pass 3: Nutzerreise

Score: 6/10 nach Addendum.

Geplante Journey:

1. Nutzer oeffnet Settings und sieht oben `Account & Haushalt`.
2. Nutzer meldet sich an.
3. Settings bestaetigt: `Angemeldet. Einkaufsliste und Wochenplan sind jetzt diesem Account zugeordnet.`
4. Wenn Daten leer sind: Shopping/Planner zeigen Erstaktionen, nicht generische Fehlermeldungen.
5. Logout bestaetigt: `Abgemeldet. Account-Daten werden auf diesem Geraet nicht mehr angezeigt.`

Keine Claim-UX fuer aktuelle Testdaten noetig. Trotzdem darf die App leere Daten nicht als Fehler oder verlorene Daten darstellen.

#### Pass 4: Specificity

Score: 7/10 nach Addendum.

Konkrete Copy-Grenzen:

- Erlaubt: `Einkaufsliste und Wochenplan sind accountgeschuetzt.`
- Erlaubt: `Haushaltssharing wird vorbereitet.`
- Nicht erlaubt: `Alle deine Daten sind privat`, solange Importer, BYOK, Scanner und Plattform-Credentials nicht voll user-/household-isoliert sind.
- Nicht erlaubt: `Haushalt aktiv`, solange keine echte Household-Mitgliedschaft existiert.

#### Pass 5: Responsive Strategy

Score: 6/10.

Auto-Entscheidung: Login bleibt fuer Slice 1 inline in Settings, nicht als Modal. Grund: Settings ist bereits der Ort fuer Server, Keys und Integrationen; ein eigener Screen waere erst noetig, wenn Signup/OAuth/Invite komplexer wird.

Vorgaben:

- Auf kleinen Phones: Account-Sektion als eigene volle Settings-Sektion oben; Labels duerfen umbrechen.
- Auf Tablet/Web: gleiche Reihenfolge, keine separate Admin-Spalte im ersten Slice.
- Keine Bottom-Sheet-Abhaengigkeit fuer Login; Form muss mit Tastatur und Screenreader stabil bleiben.

#### Pass 6: Accessibility

Score: 5/10 im Originalplan; 8/10 nach Addendum.

Akzeptanz:

- Auth-Fehler sind Text, nicht nur Farbe.
- Fokus springt nach fehlerhaftem Submit auf das erste fehlerhafte Feld.
- Touch Targets fuer Login/Logout/Retry mindestens 44px.
- Rollenbadges haben sichtbaren Text: `Admin`, `Nutzer`.
- Loading-Zustaende haben Text plus Spinner.
- Logout-Confirm ist per Keyboard/Screenreader bedienbar.

#### Pass 7: Visual / Product Fit

Score: 7/10.

Der Account-Bereich soll ruhig und utilitaristisch bleiben, passend zur bestehenden Settings-Seite. Kein heroartiger Login-Screen, kein Marketing-Text. Der erste visuelle Signalwert ist Vertrauen: Wer bin ich, welche Rolle habe ich, welcher Haushalt gilt, welche Daten sind gerade geschuetzt.

#### Design Completion Summary

| Bereich | Ergebnis |
|---|---|
| Design Score | 8/10 nach Addendum; 4/10 vorher. |
| Wichtigste Auto-Entscheidung | Account & Haushalt als oberste Settings-Sektion mit Rolle und Haushaltstatus. |
| Codex Voice | Backend glaubwuerdig, UX-Spezifikation vorher unzureichend. |
| Claude Subagent | Kritisch: Informationshierarchie, Household-Anker, Admin-Sichtbarkeit, Datenverlust-Wahrnehmung. |
| Consensus | 7/7 Design-Dimensionen hatten bestaetigte Gaps oder Sorgen. |
| Taste Decisions | Inline-Settings-Login statt eigener Login-Screen ist Geschmack/Scope; Empfehlung: inline fuer Slice 1. |

### Phase 2 Task List

- [ ] **DES-1 (P1, human: ~0.5d / CC: ~20 min) — Settings Account & Haushalt** — Spezifische Account-Sektion oben in Settings planen und bauen: Status, Rolle, Haushalt, Datenwirkung, primaere Aktion.
  - Surfaced by: design-review — Informationshierarchie fehlt.
  - Files: mobile/app/(tabs)/settings.tsx
- [ ] **DES-2 (P1, human: ~0.5d / CC: ~20 min) — Auth Zustandsmatrix** — Loading, Signed-out, User, Admin, Token-expired, Auth-error, Logout-pending und Empty-after-reset als UI-Zustaende abdecken.
  - Surfaced by: design-review — Fehlende Zustaende.
  - Files: mobile/utils/auth*, mobile/app/(tabs)/settings.tsx, mobile/app/(tabs)/shopping.tsx, mobile/app/(tabs)/planner.tsx
- [ ] **DES-3 (P2, human: ~0.25d / CC: ~10 min) — Privacy Copy** — UI-Texte eng halten: nur Shopping/Planner als accountgeschuetzt versprechen.
  - Surfaced by: design-review — Privacy-Wording kann ueberversprechen.
  - Files: mobile/app/(tabs)/settings.tsx, docs/supabase-data-api-readiness.md

### Phase 3: Engineering Review

#### Step 0: Scope Challenge

Der Plan ist nach deiner Entscheidung nicht mehr nur ein Auth-Slice. Er ist der erste technische Schritt zu Shared Household Cooking mit Account-Sicherheit und Admin-Grundlage. Damit ist ein reines `user_id`-Owner-Modell fuer Shopping/Planner zu kurz gedacht.

Konkreter Codebefund:

- [src/schema.ts](/home/patrick/Projekte/rezepti/src/schema.ts) hat `user_id`, aber keine `households`, `household_memberships`, `app_role` oder `household_id`.
- [src/db-react.ts](/home/patrick/Projekte/rezepti/src/db-react.ts) hat globale Shopping-/Planner-Helper. `clearAllShoppingItems` loescht alles, `clearMealPlanForWeek` loescht eine Woche global.
- [src/routes/planner.ts](/home/patrick/Projekte/rezepti/src/routes/planner.ts) reicht keinen Auth-Kontext an DB-Helper weiter.
- [mobile/utils/query-client.ts](/home/patrick/Projekte/rezepti/mobile/utils/query-client.ts) persistiert Cache unter einem festen Key. Ohne User-/Household-Scope kann Cache zwischen Accounts leaken.
- [db/templates/public-multi-user-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-multi-user-data-api-rls.sql) oeffnet `recipes`, obwohl der Slice `recipes` nicht freigeben soll.

Komplexitaetsentscheidung:

Auto-Entscheidung: Slice 1 muss ein kleines AuthZ-Datenmodell aufnehmen:

- `user_profiles(user_id uuid primary key, email text, app_role text check in ('user','admin'), created_at, updated_at)`
- `households(id uuid primary key, name text, created_by uuid, created_at, updated_at)`
- `household_memberships(household_id uuid, user_id uuid, role text check in ('owner','member'), primary key(household_id,user_id))`
- `shopping_list.household_id uuid not null`
- `meal_plan.household_id uuid not null`

Warum: Aktuelle Daten sind Testdaten. Jetzt ist der guenstigste Zeitpunkt, die sharebaren Tabellen auf Haushalt statt nur User zu drehen. Spaeter muessten Unique Constraints, RLS, Server-Helper, Mobile Cache Keys und UI-Sprache erneut migriert werden.

#### Step 0.5: Dual Voices

##### CLAUDE SUBAGENT (Eng - independent review)

Kernaussagen:

- High: Household-Ziel ist nicht architektonisch abgesichert. Empfehlung: `user_profiles`, `households`, `household_memberships` vor Phase 1 festlegen.
- High: Admin ist kein belastbares AuthZ-Modell. Quelle der Wahrheit muss serverseitige DB sein, nicht `user_metadata`.
- High: RLS-Template widerspricht First-Slice-Scope, weil es `recipes` oeffnet.
- High: Server-Household-Scoping ist aktuell die eigentliche Sicherheitsgrenze und muss bewusst alle Helper brechen.
- Medium: Token-Verifikation ist zu ungenau; `getUser(jwt)` oder JWKS-Verifikation konkretisieren.
- Medium: Mobile-Auth-Wrapper muss fuer alle geschuetzten Shopping-/Planner-/Planner-Recipe-Aufrufe erzwungen werden.

##### CODEX SAYS (Eng - architecture challenge)

Kernaussagen:

- Blocker: `user_id` als Sicherheitsmodell widerspricht Shared Household Cooking.
- Blocker: Admin-/Rollen-Autorisierung ist nur erwaehnt, nicht modelliert.
- High: Drizzle-Server-Scoping und Supabase RLS koennen auseinanderlaufen.
- High: Public/Protected-Routenklassifikation muss BYOK, Plattform-Credentials, Extraction Jobs und Job Listing einbeziehen.
- High: Mobile-Wrapper-Arbeit ist groesser als geplant, weil Planner auch Recipes liest und schreibt.
- Medium: Legacy-`user_id is null` sollte entfernt werden, weil aktuelle Daten Testdaten sind.
- Medium: RLS-Template fuer `recipes` ist zu breit.
- Security: [scripts/get-db-urls.ts](/home/patrick/Projekte/rezepti/scripts/get-db-urls.ts) enthaelt eine hardcodierte Supabase-Postgres-URL mit Passwort. Secret rotieren und Script auf Env-Variable umbauen, bevor Auth/RLS-Arbeit landet.

##### ENG DUAL VOICES - CONSENSUS TABLE

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| 1. Architecture sound? | Nein, Household fehlt | Nein, `user_id`-Sackgasse | CONFIRMED BLOCKER |
| 2. Test coverage sufficient? | Nein | Nein | CONFIRMED GAP |
| 3. Performance risks addressed? | Teilweise, Indexe fehlen | Teilweise, Constraints/RLS muessen neu | CONFIRMED CONCERN |
| 4. Security threats covered? | Teilweise | Nein, Secret + Route Matrix | CONFIRMED BLOCKER |
| 5. Error paths handled? | Teilweise | Teilweise | CONFIRMED GAP |
| 6. Deployment risk manageable? | Nur nach enger Migration | Nur nach Secret-Rotation und Scope-Fix | CONFIRMED CONCERN |

#### Section 1: Architecture

Neue Zielarchitektur fuer Slice 1:

```text
Mobile Settings
  -> Supabase Auth Client
  -> mobile apiFetch() injects Bearer token
  -> Hono auth middleware
       verifies Supabase JWT
       loads user_profiles.app_role
       loads household_memberships
       builds AuthContext
  -> Protected routes
       shopping/planner require active household
       admin routes require app_role = admin
  -> db-react scoped helpers
       getShoppingList(auth.householdId)
       clearShopping(auth.householdId)
       getMealPlanForWeek(auth.householdId, weekStart)
  -> Postgres
       user_profiles
       households
       household_memberships
       shopping_list.household_id
       meal_plan.household_id
       RLS/Data API remains narrow and separately smoked
```

Empfohlener `AuthContext`:

```ts
type AuthContext = {
  userId: string;
  email: string | null;
  appRole: 'user' | 'admin';
  memberships: Array<{ householdId: string; role: 'owner' | 'member' }>;
  activeHouseholdId: string;
  accessToken: string;
};
```

Entscheidung: `appRole` aus `user_profiles` oder eigener `app_admins`-Tabelle laden. `user_metadata` ist verboten. `app_metadata` darf hoechstens Bootstrap-/UX-Hinweis sein, aber serverseitig wird DB-Zustand final.

#### Section 2: Code Quality / DRY / Contracts

Aktuelle direkte Fetches in Shopping/Planner und lokale Helper muessen in einen zentralen `apiFetch` gehen. `mobile/utils/api.ts` darf nicht nur Recipes abdecken, sondern muss `Authorization`, JSON-Parsing, `401`/`403`/`404`, Token-expired und Retry-Konvention zentralisieren.

DB-Helper sollen bewusst ihre Signatur brechen. Kein optionaler `userId?: string`, weil das globale Fallbacks erhaelt. Fuer geschuetzte Tabellen gilt: ohne `householdId` kein Query.

#### Section 3: Test Review

Testdiagramm:

| Flow / Codepath | Testtyp | Bestehend | Gap |
|---|---|---|---|
| Bearer fehlt | Unit Auth | nein | `401`, keine DB-Abfrage |
| Bearer invalid/expired | Unit Auth | nein | `401`, Error-Code fuer Mobile |
| Bearer valid, kein Profil | Unit Auth/Route | nein | Profil bootstrap oder `403 setup_required` entscheiden |
| User ohne Haushalt | Route/UI | nein | Default-Haushalt anlegen oder `no_household` Zustand |
| Admin User | Unit Auth/Settings | nein | `appRole: admin` sichtbar und serverseitig pruefbar |
| Shopping list read | DB/Route | Single-user Tests | Nur activeHousehold rows |
| Shopping toggle/delete foreign row | DB/Route negative | nein | `404` ohne Existenzleck |
| Shopping clear checked/all | DB/Route negative | Global heute | Loescht nur activeHousehold |
| Planner week read/delete | DB/Route negative | Global heute | Woche nur activeHousehold |
| Mobile cache Accountwechsel | Mobile unit | nein | Persistenz geloescht oder user/household-keyed |
| RLS/Data API Smoke | Staging SQL/API | Template | Echte JWTs: User A/B, admin separat |
| Recipes bleiben geschlossen | RLS smoke | nein | Keine authenticated CRUD Grants fuer recipes in Slice 1 |

Testplan-Artefakt: `/home/patrick/.gstack/projects/unknown/main-test-plan-20260604-multi-user-household-auth.md`

#### Section 4: Performance

RLS-/Server-Filter brauchen passende Indexe:

- `shopping_list.household_id`
- `shopping_list(household_id, recipe_id, canonical_name)` als neuer Duplicate Guard.
- `meal_plan(household_id, week_start)`
- `household_memberships(user_id)`
- `household_memberships(household_id)`
- optional `user_profiles(app_role)` nur wenn Admin-Listen relevant werden.

`auth.uid()`-Policies muessen weiterhin `(select auth.uid())` nutzen. Fuer Household-RLS duerfen Policies keine teuren Subqueries ohne Indexe erzwingen.

#### Mandatory Engineering Decisions

| Entscheidung | Ergebnis |
|---|---|
| Household-Modell | Direkt in Slice 1 ein kleines Household/Membership-Modell aufnehmen. |
| Admin-Modell | App-Admin serverseitig aus DB, getrennt von Household-Rolle. |
| Legacy-Testdaten | Keine Legacy-Null-Kompatibilitaet. Daten resetten/backfillen, danach `NOT NULL` fuer Slice-Tabellen pruefen. |
| RLS Scope | Neue enge Migration nur fuer Shopping/Planner/Household-Basis; `recipes` geschlossen lassen. |
| Server vs Data API | Server/Drizzle ist fuer Slice 1 die autoritative Policy-Schicht; RLS ist zusaetzlicher externer Contract. |
| Secret | Hardcodierte Supabase-URL in `scripts/get-db-urls.ts` rotieren/entfernen vor Auth/RLS-Arbeit. |

#### Failure Modes Registry Additions

| Failure Mode | Severity | Mitigation |
|---|---|---|
| `user_id`-Modell blockiert Haushaltssharing | Critical | `household_id`/Membership direkt in Slice 1. |
| Admin wird spaeter unsicher ueber Metadata gebaut | Critical | DB-basierte `appRole` als AuthContext-Feld. |
| RLS-Migration oeffnet `recipes` zu frueh | High | Neues enges Migrationstemplate; recipes geschlossen halten. |
| Secret bleibt im Repo waehrend Auth-Arbeit | Critical | Secret rotieren, Datei auf Env umstellen, Git-Historie bewerten. |
| Direkte mobile Fetches umgehen Auth | High | `apiFetch` verpflichtend fuer alle Slice-Requests. |

#### Engineering Completion Summary

| Bereich | Ergebnis |
|---|---|
| Eng Score | 8/10 nach Scope-Fix; 5/10 vorher. |
| Codex Concerns | 2 Blocker, 5 High/Medium, 1 Security Adjacent. |
| Claude Subagent Issues | 4 High, 3 Medium. |
| Consensus | 6/6 Dimensionen mit bestaetigten Gaps/Sorgen. |
| Taste Decisions | Keine reine Geschmackssache; Household/Admin-Modell ist fuer User-Ziel notwendig. |

### Phase 3 Task List

- [ ] **ENG-1 (P1, human: ~1d / CC: ~45 min) — Household/AuthZ Datenmodell** — `user_profiles`, `households`, `household_memberships`, `shopping_list.household_id`, `meal_plan.household_id` planen und migrieren.
  - Surfaced by: eng-review — `user_id`-only blockiert Household-Ziel.
  - Files: src/schema.ts, db/migrations/*
- [ ] **ENG-2 (P1, human: ~0.5d / CC: ~30 min) — AuthContext mit Rollen** — Auth-Middleware liefert User, App-Role, Memberships und activeHouseholdId.
  - Surfaced by: eng-review — Admin/Rollenquelle fehlt.
  - Files: src/auth.ts, src/api-react.ts, src/routes/*
- [ ] **ENG-3 (P1, human: ~1d / CC: ~45 min) — Scoped Shopping/Planner DB API** — Helper verlangen `householdId`; Mass-Deletes und Week-Deletes sind household-scoped.
  - Surfaced by: eng-review — globale Helper aktuell unsicher.
  - Files: src/db-react.ts, src/routes/planner.ts, test/unit/planner-routes.test.ts, test/unit/db-react.test.ts
- [ ] **ENG-4 (P1, human: ~0.25d / CC: ~15 min) — Secret Rotation/Removal** — Hardcodierte Supabase-Postgres-URL aus `scripts/get-db-urls.ts` entfernen, Secret rotieren, Env-Variable nutzen.
  - Surfaced by: eng-review — echter DB-Secret im Repo.
  - Files: scripts/get-db-urls.ts, docs/ops/security-notes*
- [ ] **ENG-5 (P2, human: ~0.5d / CC: ~25 min) — Narrow RLS Template** — Slice-1-RLS nur fuer Household/Shopping/Planner; `recipes` bleibt ohne authenticated CRUD.
  - Surfaced by: eng-review — bestehendes Template ist zu breit.
  - Files: db/templates/*, db/migrations/*

### Phase 3.5: Developer Experience Review

#### DX Finding Summary

Der Plan ist nach CEO/Design/Eng fachlich klarer, aber ohne Runbook noch schwer reproduzierbar. Auth/RLS-Arbeit scheitert in der Praxis oft nicht am Code, sondern daran, dass niemand schnell und eindeutig Admin, User A, User B, Tokens, Testhaushalte und Staging-Smokes herstellen kann.

Kernaussagen aus Dual Review:

- Kritisch: Es fehlt ein ausfuehrbarer Bootstrap fuer Admin, normale User und Household-Memberships.
- Kritisch: Lokale Tests beweisen nicht, dass Supabase-RLS mit echten JWTs korrekt ist.
- Hoch: Env-Namen muessen getrennt werden in Server-only, Mobile-public und Staging-only.
- Hoch: Mobile braucht stabile API-Error-Codes, nicht frei formulierte Fehlermeldungen.
- Hoch: README/.env.example muessen vor oder zusammen mit Code aktualisiert werden, sonst ist Time-to-Hello-World zu hoch.
- Blocker: Hardcodierte Supabase-Postgres-URL in `scripts/get-db-urls.ts` muss entfernt und rotiert werden, bevor diese Arbeit landet.

#### DX Scorecard

| Dimension | Vor Review | Nach Plan-Fix |
|---|---:|---:|
| Lokaler Start mit Auth | 3/10 | 8/10 |
| Testuser reproduzierbar | 2/10 | 8/10 |
| Staging-RLS-Verifikation | 4/10 | 8/10 |
| Mobile Fehlerdiagnose | 4/10 | 7/10 |
| Secret Hygiene | 2/10 | 8/10 nach Rotation/Removal |

#### Developer Journey Map

```text
Fresh checkout
  -> README Auth env matrix
  -> npm install / mobile install
  -> auth bootstrap creates admin, user-a, user-b, households
  -> auth token command prints Bearer tokens
  -> server starts with Authorization CORS
  -> auth smoke verifies 401/403/200 and household isolation
  -> mobile settings login shows account, role, household
  -> staging smoke verifies Supabase RLS with real JWTs
```

#### Required Scripts / Commands

- `npm run auth:seed:staging` oder dokumentierter SQL/CLI-Fallback: Admin, User A, User B, Default-Haushalte und Memberships anlegen.
- `npm run auth:token -- --email user-a@example.test`: echten Bearer Token fuer Smoke-Tests holen.
- `npm run auth:smoke`: Server-Routen mit fehlendem Token, falschem Token, User A, User B und Admin pruefen.
- `npm run test:auth`: schnelle lokale Unit-/Route-Suite fuer AuthContext, Rollen und Household-Scoping.

Falls diese Scripts im ersten Implementierungsschritt noch nicht gebaut werden, muss README exakt zeigen, welche `supabase`/SQL/HTTP-Kommandos sie ersetzen.

#### API Error Contract

Mobile und Server sollen diese Form teilen:

```json
{
  "error": {
    "code": "auth_missing",
    "message": "Anmeldung erforderlich.",
    "cause": "No Authorization bearer token was sent.",
    "fix": "Sign in again from Settings."
  }
}
```

Erforderliche Codes fuer Slice 1:

- `auth_missing`
- `auth_invalid`
- `token_expired`
- `forbidden`
- `not_found`
- `setup_required`
- `no_household`
- `admin_required`

#### DX Implementation Checklist

- [ ] README: Auth-Setup, Env-Matrix, Testuser, Admin-Bootstrap, Staging-Smoke.
- [ ] `.env.example`: Server-only Supabase URL/Service Role/JWT-Kontext klar von `EXPO_PUBLIC_*` trennen.
- [ ] `scripts/get-db-urls.ts`: Secret entfernen, Env-Variable nutzen, Rotation dokumentieren.
- [ ] Smoke-Runbook: User A/B getrennte Haushalte, gemeinsamer Haushalt, Admin-Rolle, recipes geschlossen.
- [ ] Mobile Fehlertexte: Error-Codes aus API in Settings/Shopping/Planner sichtbar und testbar machen.

### Phase 3.5 Task List

- [ ] **DX-1 (P1, human: ~0.5d / CC: ~20 min) — Auth Runbook** — README und `.env.example` so aktualisieren, dass ein neuer Entwickler Admin/User/Household-Smoke ohne Code-Lesen ausfuehren kann.
  - Surfaced by: devex-review — Auth-Setup ist sonst nicht reproduzierbar.
  - Files: README.md, .env.example, docs/TEST_STATUS.md
- [ ] **DX-2 (P1, human: ~0.5d / CC: ~30 min) — Bootstrap/Smoke Commands** — Auth-Seed, Token-Erzeugung und Smoke-Test als Script oder dokumentierten CLI-Fallback bereitstellen.
  - Surfaced by: devex-review — lokale Tests reichen fuer RLS/Auth nicht aus.
  - Files: package.json, scripts/*, test/e2e/*
- [ ] **DX-3 (P1, human: ~0.25d / CC: ~15 min) — Stable Error Envelope** — Server- und Mobile-Fehlerkontrakt mit stabilen Codes festlegen.
  - Surfaced by: devex-review — Mobile braucht diagnostizierbare Auth-Fehler.
  - Files: src/auth.ts, src/routes/*, mobile/utils/api.ts
- [ ] **DX-4 (P0, human: ~0.25d / CC: ~10 min) — Secret Hygiene Gate** — Hardcodiertes DB-Secret entfernen, Rotation dokumentieren und vor PR als Blocker behandeln.
  - Surfaced by: devex-review + eng-review — Secret im Repo.
  - Files: scripts/get-db-urls.ts, docs/ops/security-notes*
