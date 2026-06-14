# TODO

Stand: 2026-06-09

Diese Datei ist die kurze, aktive Arbeitsliste fuer Mensch und KI. Alte erledigte Details stehen in [docs/todo-history.md](/home/patrick/Projekte/rezepti/docs/todo-history.md). Der aktuelle Betriebscheck fuer GitHub CI, Supabase und Northflank steht in [docs/2026-06-06-ci-supabase-northflank-check.md](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).

## Aktueller Stand

Coverage-/JobManager-Remediation, Supabase-Data-API-Readiness, Supabase-Advisor-Kern-Remediation, Nightly-Strict-Remediation, Node-24-Verifikation, npm-Audit-Triage, RNTL-Migration, Matrix-Nachzug, Restupdates und Expo-SDK-56-Core-Slice sind durch. Seit dem letzten Betriebscheck wurden ausserdem der mobile Performance-Regression-Fix fuer den Auth-/Workspace-Web-Entry dokumentiert, die rohen Bundle-Baselines fuer den stabilen Juni-Export nachgezogen, das 10er-Performance-Readiness-Fenster fuer den Juni-Export neu aufgebaut (`ready=true`) und ein separater safe Patch-Maintenance-Slice fuer Root/Mobile nachgezogen. Der `supabase-rls-smoke`-CI-Job ist jetzt gegen Docker-Hub-/Service-Overhead gehaertet (Mirror-Prefetch + reduzierter Supabase-Stack), die GitHub-Actions-Node-20-Deprecation-Warnings sind ueber Action-Upgrades auf Node-24-kompatible Majors nachgezogen, und der Northflank-Deploy laeuft seit 2026-06-08 ohne das veraltete `northflank/deploy-to-northflank@v1`-Action-Wrapper direkt ueber den Northflank-API-Call im Workflow. Der historische Push-CI-Blocker vom 2026-06-06 (`mobile-release-gate` wegen Expo-SDK-Patch-Drift) ist lokal behoben; der naechste Push-/PR-Lauf ist der relevante Remote-Beweis. Details: [CI / Supabase / Northflank Check](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).

Arbeitsbasis ist geklaert: PR #2 `Multi-user login first slice` und PR #5 `Complete auth onboarding slice` sind auf `origin/main` gelandet. `phase/6-multi-user` ist stale und keine aktive Basis. Recipes-Ownership, Auth-Onboarding, der RLS-CI-Hardening-Slice, der Performance-Validation-Fix, das frische Juni-Readiness-Fenster und der safe Dependency-Patch-Slice sind damit lokal nachgezogen; offen sind jetzt vor allem PWA, die manuelle Web-Persistenz-Abnahme hinter einer belastbar nutzbaren Multi-Auth und die bewusst getrennten Follow-up-Slices.

## Naechste Reihenfolge

0. [x] **P0 Sicherheit — Credential-Auth-Hotfix (PR #7 offen, CI gruen, 2026-06-12, pending merge)**
   - Tasks T1-T16 + S3-Inventur umgesetzt: `requireUserAuth` pro Route, totes `api_keys`-Store+Route geloescht, Pinterest/Facebook-Routes deaktiviert (501), Privacy-Copy korrigiert, Unauth-Denied-/Cross-User-Tests, Session-Persistenz (T11/T12), Query-Cache-Namespacing (T7), `/api/v1/images/search` nun auth-gated (S3-Fund).
   - **Vor Merge: Supabase-Migration manuell auf Prod anwenden:** `DROP TABLE IF EXISTS api_keys;` (Dashboard → SQL Editor)
   - **Nach Merge: Manueller Smoke:** `GET /api/v1/cookidoo/status` ohne Bearer → 401; Session persistent nach Reload; InPrivate cleared.
   - Plan + Review: [Post-Hotfix Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-post-hotfix-auth-hardening-plan.md).

1. **[x] Progressive Web App (PWA) — Phase 6 abgeschlossen (2026-06-13)**
   - [x] Installierbare App-Shell mit Manifest, Service Worker, Offline-Read.
   - [x] Homescreen-Installationspfad fuer iOS/Android implementiert.
   - [x] Per-User-Cache-Boundary (SHA-256-Hashing, CLEAR_USER auf Logout).
   - [x] Dokumentation: `docs/pwa-runbook.md` + PWA-Subsection in `CLAUDE.md`.
   - Plan: `docs/superpowers/plans/2026-06-12-pwa-installable-shell-plan.md`
   - **➡️ Naechster Schritt (nach Deploy):** Post-Deploy-QA der 11 nur am deployten Build pruefbaren Akzeptanzkriterien (Lighthouse Installable, Chrome/iOS Install, Cross-User-Cache-Isolation, Flugmodus-Offline). Plan: [PWA Post-Deploy QA](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-post-deploy-qa.md) — ausfuehrbar via `/qa` gegen die Prod-URL.

2. **Web-Persistenz absichern, sobald Multi-Auth im Web belastbar funktioniert**
   - Erst den Web-Auth-/Account-/Workspace-Einstieg soweit stabilisieren, dass Login/Signup/Session fuer die normale Nutzung nicht mehr blockieren.
   - **Gate ist jetzt ein automatisierter Session-E2E** (Login -> Reload -> authed; neuer Kontext -> persisted/cleared), nicht mehr nur die manuelle Abnahme (die bleibt als Smoke). Grund: der reale Bug ist der nach `userId` nicht namespace-te Query-Cache (New-Tab zeigt Rezepte des Vor-Users) — timing-abhaengig, manuell unzuverlaessig. Review 2026-06-09.
   - Danach Settings/Theme/PDF im echten Web-Flow pruefen: Reload, neuer Tab, neue Browser-Session.

3. **Multi-Auth-Hardening-Track abarbeiten**
   - Web-Auth-/Account-/Workspace-Einstieg im Browser stabilisieren.
   - Web-Persistenz fuer Settings/Theme/PDF unter echter Session manuell abnehmen.
   - Ownership-Flaechen und Credential-Boundaries explizit inventarisieren und nachziehen.
   - Details: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md).

4. **Spaeter oder trigger-basiert**
   - NativeWind 5/Tailwind 4 separat planen.
   - `unused_index` erst nach Nutzungsperiode plus Staging-Plananalyse anfassen.
   - Northflank nur bei Deploy-Fehlern, Runtime-Warnungen, API-Aenderungen oder Auth-/Secret-Problemen im Workflow neu bewerten.

## Auth Onboarding Follow-ups

- [ ] **Workspace-Einladungen** — Einladungsmodell, Invite-Link/Token, Rollen und Annahmefluss separat planen.
- [ ] **Multi-Workspace-Wechsel** — Wechsel zwischen mehreren Workspaces auf Basis der Default-Workspace-Invariante planen.
- [ ] **OAuth / Magic Link** — Zusätzliche Auth-Modi mit Supabase-Konfig, Redirects, Deep Links und Tests als eigenen Slice planen.
- [ ] **Recipe Sharing / Copy / Collections** — Sharing, Kopien und Collections als eigene Ownership-/UX-Arbeit planen; nicht in den Auth-Onboarding-Slice ziehen.
- [ ] **BYOK- und Plattform-Credential-Ownership** — Geklaert + re-priorisiert: ist jetzt der **P0-Hotfix oben** (Routes sind unauth, live). Zielregeln aus dem Review: Cookidoo `admin/global` + ehrliche Copy, Pinterest/Facebook `disabled`, BYOK-Store droppen. Plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md).
- [ ] **Weitere ungeschuetzte Ownership-Flaechen inventarisieren** — Inventur ist Phase 3 des Multi-Auth-Hardening-Plans (ein `grep`-Pass). Bisher gefundene unscoped Flaeche zusaetzlich zu Credentials: `ingredient_dictionary` (global mutable). Plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md).
- [ ] **Account-Loeschung und Recovery-Haertung** — Account-Loeschung, Rate-Limit-UX, Support-/Auditpfad und Recovery-Polish nach minimalem Passwort-Reset planen.

## Aktive Backlog / Watchlist

- [x] **Auth-Onboarding-Slice** — Signup, Login, serverseitiger Account-/Default-Haushalt-Bootstrap, Account-&-Workspace-Screen und sichtbare Auth-Zustaende sind auf `main` gelandet. Plan: [Auth Onboarding Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-slice-plan.md).
- [x] **Multi-User Login First Slice** — Supabase Auth + echte Household-RLS-Policies ueber Memberships; App-Requests laufen mit Supabase User-JWT als `authenticated`. Plan am 2026-06-04 aktualisiert und PR #2 gelandet.
- [ ] **Multi-Auth-Hardening-Track** — Web-Auth-Stabilisierung, Web-Persistenz-Abnahme, Ownership-Inventur und Credential-Boundaries als naechster Konsolidierungsslice. Main plan: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md).
- [x] **Progressive Web App (PWA)** — Phase 6 abgeschlossen: Installierbare Web-App mit Manifest, Service Worker, Offline-Grundlage und Homescreen-Installationspfad. Plan + Runbook: `docs/pwa-runbook.md`.
- [x] **Dependency-Patch-Drift** — safe Patch-Slice fuer Root/Mobile lokal nachgezogen; Expo-/SDK-gebundene Linien bleiben laut `expo install --check` sauber und bewusst separat.
- [ ] **CI / Supabase / Northflank Track** — aktueller Betriebsstand, Findings und Vorgehen: [docs/2026-06-06-ci-supabase-northflank-check.md](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).
- [x] **Performance-Readiness neu aufbauen** — frisches 10er-Window fuer den Juni-Web-Export ist lokal aufgebaut; `artifacts/performance/readiness.json` steht wieder auf `ready=true`.
- [ ] **Web-Persistenz-Abnahme nach Multi-Auth-Stabilisierung (TODO:52)** — Erst wenn der Multi-Auth-Web-Flow belastbar nutzbar ist, Settings/Theme/PDF per Reload, neuem Tab und neuer Browser-Session manuell pruefen und als Dokument festhalten. **Gate ist jetzt automatisierter Session-E2E (T12 umgesetzt):** Login → Reload → authed; neuer Kontext → cleared. Manuelle Abnahme bleibt als Smoke. Artefakt: Datum, Umgebung, Testnutzer-Typ, Ergebnis pro Fall.
- [ ] **T12-Cold-Start-Tests ergaenzen** — In `mobile/test/session-persistence.test.ts` (oder `query-client-auth-cache.test.ts`): prevKey-Wechsel-Szenario (`prevKey !== nextKey → clear + removeItem assertiert`) und `getSupabaseClient() = null → sessionRestoring korrekt false` als explizite Testfaelle ergaenzen.
- [ ] **T9-Verifikation: Confirmation-Link-Error code-seitig nachweisen** — In `src/auth.ts` verifizieren dass expired/invalid Confirmation-Link einen sichtbaren Fehlercode surfaced (nicht still scheitert). Aktueller Stand: nicht code-verifizierbar; Test oder Log-Assertion ergaenzen.
- [ ] **BYOK-Rate-Limit-Persistenz bewerten** — [src/byok-validator.ts](/home/patrick/Projekte/rezepti/src/byok-validator.ts) erlaubt im TODO-Pfad aktuell alle Requests; vor Multi-User-/BYOK-Ausweitung DB/Redis/serverseitige Begrenzung entscheiden.
- [x] **PWA: Precache-Cap von 6 MB zurueck auf 5 MB** — Aktueller Export ist ~5.26 MB. Nach Bundle-Optimierung auf <5 MB `JS_SIZE_LIMIT_BYTES` in `scripts/pwa/build-sw.ts` zurueckfahren. Siehe `build-sw.ts` Zeile 40-41. **Plan: Phase 1 (Tasks 1-2) in [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md).** — erledigt 2026-06-13 (Cap auf 5 MB; PDF-Export-Chunks aus Precache ausgeschlossen, Laufzeit-CacheFirst deckt sie ab).
- [ ] **PWA: Background Sync / Push Notifications** — Offline writes (Mutations-Queue + Konfliktloesung) fuer Shopping/Planner und Push-Notifications fuer Job-Fertigstellung. Deferred nach Phase 6. **Plan: Phase 3 (Tasks 10-17) in [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md).**
- [ ] **PWA: Schreibender Offline-Pfad** — Mutations-Queue mit Konfliktloesung fuer Shopping-List und Planner-Aenderungen; Sync bei Netzwerk-Reconnect. Deferred nach Phase 6. **Plan: Phase 2 (Tasks 3-9) in [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md).**
- [ ] **PWA: Multi-Tab/Multi-Account SW-Limitation** — Known issue: single SW shares one currentUserHash; letzte SET_USER gewinnt. Aktuell ok fuer Single-Tenant; revisiten bei Multi-Account-Support. Dokumentiert in `docs/pwa-runbook.md`.
- [x] **Recipes-Ownership-Slice umsetzen** — Server-API fuer `recipes` auf explizites Owner-Modell umbauen: private User-Rezepte, Haushaltsrezepte, keine globalen Templates, keine Null-Owner-Kompatibilitaet. Plan: [Recipes Ownership Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-05-recipes-ownership-slice-plan.md).
- [ ] **Recipes Sharing/Favorites Folgeslices planen** — Teilen erzeugt Kopien; Favoriten/Collections werden eigene private oder haushaltsbezogene Owner-Objekte. Nicht in den aktuellen Ownership-Slice ziehen.
- [x] **Stale Test-Doku nachziehen** — [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md) ist auf den aktuellen Stand gebracht; die alten `TBD`-/Naechste-Aktion-Zeilen im Legacy-Flake-Inventory sind durch aktuellen Betriebsstand und Restaktionen ersetzt.
- [ ] **Supabase `unused_index` Hold-Track** — keine Production-Drops ohne Nutzungsperiode, Redundanzanalyse und Query-Plan-Nachweis. Details: [advisor followups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md).
- [ ] **Northflank-Deploy-Pfad** — nach dem direkten API-Deploy vom 2026-06-08 nur noch bei roten Deploys, Runtime-Warnungen, API-Aenderungen oder Auth-/Secret-Problemen neu bewerten.
- [ ] **Styling-Track** — NativeWind 5/Tailwind 4 bleibt nach Expo-SDK-56 bewusst vertagt.

## Kurzstatus

### Supabase / Security

- RLS ist auf den relevanten Public-Tabellen aktiviert; `npm run test:auth` deckt den schnellen Auth-/Route-Vertrag ab. Lokaler Supabase-RLS-Smoke fuer Shopping/Planner ist automatisiert, lokal gruen und als eigener CI-Job vorbereitet. Der gegatete Staging-Smoke lief am 2026-06-04 gegen `rezepti-staging` gruen; der CI-Job prefetcht benoetigte Supabase-Images inzwischen aus `public.ecr.aws`-Mirrors und startet den Stack reduziert.
- Die Node-20-Deprecation-Warnings aus GitHub Actions sind auf Workflow-Ebene adressiert: Artifact-, Cache- und Chrome-Setup-Actions wurden auf Node-24-kompatible Majors gehoben, und der fruehere Northflank-Sonderfall wurde am 2026-06-08 durch einen direkten API-Deploy in `.github/workflows/docker-publish.yml` entfernt. Das ist getrennt vom bereits bestehenden Repo-/Job-Node-24-Stand.
- Data-API-RLS-/Grant-Matrix fuer Multi-User ist fuer Slice 1 umgesetzt: Shopping/Planner sind household-scoped, `recipes` ist fuer `anon`/`authenticated` ueber die Data API geschlossen. Das explizite Recipe-Owner-Modell ist serverseitig gelandet; Data-API-Oeffnung fuer `recipes` bleibt ein spaeterer Folge-Slice.
- `vector` und `pg_trgm` liegen seit 2026-06-01 in `extensions`; WARN-Level Advisor-Smokes waren gruen.
- `rezepti-staging` wurde als RLS-Smoke-Ziel bestaetigt und migriert.

### Tests / CI

- Zuletzt dokumentiert: Root-/Auth-Gates und der mobile Auth-Cache-Watch-Regressionstest sind gruen; Details und historische Zaehler stehen in [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md).
- Mobile RNTL Guard ist gruen; direkte `react-test-renderer`-Imports in Mobile-Testdateien bleiben blockiert.
- Scheduled CI am 2026-06-02 (`26802547508`), 2026-06-03 (`26868293611`) und 2026-06-04 (`26934892387`) war gruen.
- Der zuletzt dokumentierte rote Push-CI auf `main` vom 2026-06-06 (`27069886762`) bleibt als Historie relevant; der lokale Expo-Drift-Fix ist verifiziert, aber der naechste Push-/PR-Lauf ist der Remote-Beweis. Live-Betriebscheck und Plan: [CI / Supabase / Northflank Check](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).
- `perf:validate:strict` ist lokal seit 2026-06-08 ohne Budget-Findings gruen; nach dem Seed-Lauf steht das frische Juni-Readiness-Fenster jetzt ebenfalls wieder auf `ready=true`.
- Push-CI fuer `7523b72` (`26939939417`) war gruen: `test`, `mobile-release-gate`, `e2e`, `performance-audit`; `e2e-legacy-soak` war beim Push erwartbar skipped.
- Docker Build/Push und Northflank Deploy waren fuer `7523b72` (`26939939394`) und den nachgelagerten Version-Commit `8ed8801` (`26939952178`) gruen.
- Fuer den aktuellen Multi-User-Branch wurden lokale Supabase-Migration, lokaler RLS-Smoke, Staging-RLS-Smoke, Root/Mobile-Tests, Typechecks, Secret-Scan und `git diff --check` dokumentiert; nach dem RLS-Smoke-Nachzug liefen `npm run supabase:rls-smoke`, `npm run supabase:rls-smoke:staging`, Root-Unit-Auswahl und `npx tsc --noEmit` gruen.
- Branch-/Remote-Pruefung 2026-06-04: `origin/main` und lokaler `main` sind Ancestors von `feature/multi-user-login-first-slice`; Abstand zu `origin/main` ist `0 behind / 15 ahead`, Abstand zu lokalem `main` ist `0 behind / 10 ahead`. Der Branch hat noch keinen Upstream; Push/PR-CI ist der naechste Gate.
- Fuer die lokalen Doku-Aenderungen vor dem Multi-User-PR wurden keine Tests neu ausgefuehrt.

### Dependencies

- Node bleibt `>=24.15.0 <25`, npm `>=11`.
- Expo SDK 56 ist die gueltige Mobile-Achse: React `19.2.3`, React Native `0.85.3`, Reanimated `4.3.1`, Worklets `0.8.3`.
- Nicht direkt ziehen: React `19.2.7`, `react-dom` `19.2.7`, `react-test-renderer` `19.2.7`, AsyncStorage `3.1.1`, neuere `react-native-*` Latest-Linien, Tailwind 4.

## Wichtige Links

- [Multi-User Login First Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-31-multi-user-login-first-slice-plan.md)
- [Auth Onboarding Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-slice-plan.md)
- [Auth Onboarding Deferred Follow-Ups Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-deferred-followups-plan.md)
- [Recipes Ownership Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-05-recipes-ownership-slice-plan.md)
- [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md) — Precache-Cap, Offline-Writes, Background Sync/Push (Design: `docs/superpowers/specs/2026-06-13-pwa-followups-design.md`)
- [Supabase Data API Readiness](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md)
- [Supabase Advisor Follow-ups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md)
- [Dependency Upgrade Matrix](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-13-full-stack-upgrade-target-matrix.md)
- [Test Status](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md)
- [TODO History Archive](/home/patrick/Projekte/rezepti/docs/todo-history.md)
