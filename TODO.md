# TODO

Stand: 2026-06-19

Diese Datei ist die kurze, aktive Arbeitsliste fuer Mensch und KI. Alte erledigte Details stehen in [docs/todo-history.md](/home/patrick/Projekte/rezepti/docs/todo-history.md). Der aktuelle Betriebscheck fuer GitHub CI, Supabase und Northflank steht in [docs/2026-06-06-ci-supabase-northflank-check.md](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).

## Aktueller Stand

Coverage-/JobManager-Remediation, Supabase-Data-API-Readiness, Supabase-Advisor-Kern-Remediation, Nightly-Strict-Remediation, Node-24-Verifikation, npm-Audit-Triage, RNTL-Migration, Matrix-Nachzug, Restupdates und Expo-SDK-56-Core-Slice sind durch. Seit dem letzten Betriebscheck wurden ausserdem der mobile Performance-Regression-Fix fuer den Auth-/Workspace-Web-Entry dokumentiert, die rohen Bundle-Baselines fuer den stabilen Juni-Export nachgezogen, das 10er-Performance-Readiness-Fenster fuer den Juni-Export neu aufgebaut (`ready=true`) und ein separater safe Patch-Maintenance-Slice fuer Root/Mobile nachgezogen. Der `supabase-rls-smoke`-CI-Job ist jetzt gegen Docker-Hub-/Service-Overhead gehaertet (Mirror-Prefetch + reduzierter Supabase-Stack), die GitHub-Actions-Node-20-Deprecation-Warnings sind ueber Action-Upgrades auf Node-24-kompatible Majors nachgezogen, und der Northflank-Deploy laeuft seit 2026-06-08 ohne das veraltete `northflank/deploy-to-northflank@v1`-Action-Wrapper direkt ueber den Northflank-API-Call im Workflow. Der historische Push-CI-Blocker vom 2026-06-06 (`mobile-release-gate` wegen Expo-SDK-Patch-Drift) ist seit PR #19 `v1.0.166 fix(ci): restore root and mobile release gates` remote aufgeloest; PR-Checks, Push-CI und die nachgelagerten Docker-/Northflank-Runs waren am 2026-06-16 gruen. Details: [CI / Supabase / Northflank Check](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).

Arbeitsbasis ist geklaert: PR #2 `Multi-user login first slice` und PR #5 `Complete auth onboarding slice` sind auf `origin/main` gelandet. `phase/6-multi-user` ist stale und keine aktive Basis. Recipes-Ownership, Auth-Onboarding, der RLS-CI-Hardening-Slice, der Performance-Validation-Fix, das frische Juni-Readiness-Fenster, der safe Dependency-Patch-Slice, die manuelle Web-Persistenz-Abnahme, der Credential-Hotfix-Rollout, die Credential-Boundary-Nachzuege, die serverseitig persistierte BYOK-Rate-Limit-Basis und der Cookidoo-Ownership-Slice inklusive RLS-/Staging-Haertung sind damit nachgezogen; offen bleiben jetzt vor allem die bewusst getrennten Follow-up-Slices fuer Admin-Policy, Bug-Reporting und Sharing/Favorites.

## Naechste Reihenfolge

1. **[x] Progressive Web App (PWA) — Phase 6 abgeschlossen (2026-06-13)**
   - [x] Installierbare App-Shell mit Manifest, Service Worker, Offline-Read.
   - [x] Homescreen-Installationspfad fuer iOS/Android implementiert.
   - [x] Per-User-Cache-Boundary (SHA-256-Hashing, CLEAR_USER auf Logout).
   - [x] Dokumentation: `docs/pwa-runbook.md` + PWA-Subsection in `CLAUDE.md`.
   - Plan: `docs/superpowers/plans/2026-06-12-pwa-installable-shell-plan.md`
   - **Reststatus nach Deploy-QA:** Der QA-Durchlauf ist laut [PWA Post-Deploy QA](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-post-deploy-qa.md) seit 2026-06-14 weitgehend abgeschlossen; der Prod-Lighthouse-Lauf gegen `https://p01--rezepti-app--2s7hvlwm5zc5.code.run` war am 2026-06-15 fuer die bestehende Route-/Viewport-Matrix gruen (`9/9` erfolgreich). Offene manuelle Restpruefung bleibt nur noch iOS, sobald wieder Hardware verfuegbar ist.

2. **Northflank-Deploy-Hygiene nur noch beobachten**
   - PR #19 ist gemergt; der Remote-Beweis fuer CI, Deploy und Workflow-Hygiene ist erbracht.
   - Der post-deploy Health-Poll ist jetzt als eigener GitHub-Actions-Step `Poll Northflank health` im Workflow hinterlegt und liest seine Ziel-URL ueber das GitHub-Secret `NORTHFLANK_HEALTHCHECK_URL`.
   - Details: [CI / Supabase / Northflank Check](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md).

3. **Produkt-/Ops-Follow-ups mit klarer Slice-Grenze**
   - Admin-Hub fuer weitere Operator-Themen ausbauen; BYOK-Policy ist als erster Punkt live.
   - Bug-Reporting-Flow als eigenen Slice planen und umsetzen.
   - Recipes Sharing/Favorites/Collections getrennt vom Ownership-Slice planen.

4. **PWA nur noch als Rest-QA / optionale Nachpruefung**
   - PWA Phase 6 ist abgeschlossen; der deployte QA-Durchlauf vom 2026-06-14 ist weitgehend gruen.
   - Live verifiziert sind Install, Persistenz, Cross-User-Cache-Isolation und Offline-Lesepfad.
   - Offen bleiben nur optionale bzw. nicht separat gepruefte Restpunkte wie Lighthouse-PWA-Audit und iOS-spezifische Install-/Share-Sheet-Checks.
   - Details: [PWA Post-Deploy QA](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-post-deploy-qa.md).

5. **Spaeter oder trigger-basiert**
   - NativeWind 5/Tailwind 4 separat planen.
   - `unused_index` erst nach Nutzungsperiode plus Staging-Plananalyse anfassen.
   - Northflank nur bei Deploy-Fehlern, Runtime-Warnungen, API-Aenderungen oder Auth-/Secret-Problemen im Workflow neu bewerten.

## Auth Onboarding Follow-ups

### Jetzt

- [x] **Weitere ungeschuetzte Ownership-Flaechen inventarisieren** — Abschluss 2026-06-15: Referenzdokument fuer API-, DB-, lokale Persistenz- und Singleton-Flaechen erstellt; keine `unknown`-Ownership-Flaeche ohne Folgeentscheidung offen. Artefakt: [Ownership Surface Inventory](/home/patrick/Projekte/rezepti/docs/2026-06-15-ownership-surface-inventory.md).

### Spaeter

- [ ] **Workspace-Einladungen** — Einladungsmodell, Invite-Link/Token, Rollen und Annahmefluss separat planen.
- [ ] **Multi-Workspace-Wechsel** — Wechsel zwischen mehreren Workspaces auf Basis der Default-Workspace-Invariante planen.
- [ ] **OAuth / Magic Link** — Zusätzliche Auth-Modi mit Supabase-Konfig, Redirects, Deep Links und Tests als eigenen Slice planen.
- [ ] **Recipe Sharing / Copy / Collections** — Sharing, Kopien und Collections als eigene Ownership-/UX-Arbeit planen; nicht in den Auth-Onboarding-Slice ziehen.
- [ ] **Account-Loeschung und Recovery-Haertung** — Account-Loeschung, Rate-Limit-UX, Support-/Auditpfad und Recovery-Polish nach minimalem Passwort-Reset planen.

## Aktive Backlog / Watchlist

### Jetzt

- [x] **Multi-Auth-Hardening-Track** — Web-Auth-Stabilisierung, Persistenz-Abnahme, Credential-Boundaries und Ownership-Inventur sind dokumentiert bzw. nachgezogen. Referenzen: [Multi-Auth Hardening Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-09-multi-auth-hardening-plan.md), [Ownership Surface Inventory](/home/patrick/Projekte/rezepti/docs/2026-06-15-ownership-surface-inventory.md).
- [x] **CI / Supabase / Northflank Track** — PR #19 `v1.0.166 fix(ci): restore root and mobile release gates` ist am 2026-06-16 gemergt; PR-Checks (`27599696794`), Push-CI auf `main` (`27599914223`) sowie Docker Build/Push + Northflank Deploy (`27599914284`, `27599929657`) waren gruen. Betriebsstand und Ausfuehrungsplan: [docs/2026-06-06-ci-supabase-northflank-check.md](/home/patrick/Projekte/rezepti/docs/2026-06-06-ci-supabase-northflank-check.md), [2026-06-15-ci-supabase-northflank-execution-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-ci-supabase-northflank-execution-plan.md).
- [x] **Northflank post-deploy health poll** — Nach dem Deploy-API-Call im Northflank-Workflow laeuft jetzt der separate GitHub-Actions-Step `Poll Northflank health` mit Retry-Schleife gegen `/api/v1/health`; die Ziel-URL kommt ueber das GitHub-Secret `NORTHFLANK_HEALTHCHECK_URL`, damit spaetere Domain-Wechsel ohne Workflow-Diff moeglich bleiben.
- [x] **BYOK-Validation-Policy im Admin sichtbar und aenderbar machen** — Eigener Admin-Hub mit aktiver `BYOK Validation Policy`-Seite ist umgesetzt; die gemeinsame Validation-Policy fuer `/api/v1/keys/validate` und die BYOK-Extraction-Einstiege wird jetzt serverseitig gemeinsam geladen und admin-only gepflegt. Der Hub enthaelt ausserdem bereits den sichtbaren Andockpunkt `Bug Reports` fuer den naechsten Slice. Plan: [2026-06-16-byok-rate-limit-admin-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-16-byok-rate-limit-admin-plan.md).
- [x] **BYOK-Policy: Browser-/PWA-Save live smoke** — Am 2026-06-20 mit echtem Admin-Login auf Production verifiziert: `Settings -> Admin Hub -> BYOK Validation Policy` speichert per Browser/PWA erfolgreich, der echte `PUT /api/v1/admin/byok-validation-policy` lief mit `200 OK`, und der Read-back zeigte `windowMinutes=15`, `maxRequests=3`, `source=database`, `status=active`. Runbook: [docs/byok-validation-policy-runbook.md](/home/patrick/Projekte/rezepti/docs/byok-validation-policy-runbook.md).
- [x] **BYOK-Policy: gemeinsamer Runtime-smoke auf Production** — Am 2026-06-20 nach Hotfix-Deploy `v1.0.177` live verifiziert: `POST /api/v1/keys/validate` liefert mit ungueltigem Key wieder `200` + `valid:false` inklusive aktiver Policy, `extract/react`, `extract/photo` und `extract/text` liefern wieder `400 byok_key_invalid`, und das geteilte Budget ueber mehrere Entry-Points kippt wie erwartet auf `429 byok_validation_rate_limited`. Die temporaere Smoke-Policy `15 / 3` wurde danach wieder auf `60 / 20` zurueckgesetzt. Runbook: [docs/byok-validation-policy-runbook.md](/home/patrick/Projekte/rezepti/docs/byok-validation-policy-runbook.md).
- [ ] **Bug-Reporting-Flow planen und umsetzen** — Globalen Bug-Button, Importfehler-Report mit Modal, `bug_reports`-Tabelle, Admin-Uebersicht und kleinen Nutzerbereich `Meine Meldungen` in Settings als eigenen Slice umsetzen. Design: [2026-06-15-bug-reporting-design.md](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-06-15-bug-reporting-design.md). Umsetzung: [2026-06-16-bug-reporting-implementation-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-16-bug-reporting-implementation-plan.md).
- [ ] **PWA: Rest-QA nur noch iOS-Hardwarelauf** — Post-Deploy-QA ist weitgehend gruen; der Prod-Lighthouse-Lauf war am 2026-06-15 fuer die bestehende Matrix gruen. Die frueher notierten PWA-Audit-IDs (`installable-manifest`, `service-worker`, `offline-start-url`) stehen in `lighthouse@13.3.0` nicht mehr als verwertbarer Automationsnachweis zur Verfuegung; offen bleiben damit nur noch Safari-/Homescreen-Pruefungen, sobald wieder iOS-Hardware verfuegbar ist. Referenz: [PWA Post-Deploy QA](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-post-deploy-qa.md).
- [ ] **PWA: Multi-Tab/Multi-Account SW-Limitation** — Known issue: single SW shares one currentUserHash; letzte SET_USER gewinnt. Aktuell ok fuer Single-Tenant; revisiten bei Multi-Account-Support. Dokumentiert in `docs/pwa-runbook.md`.
- [ ] **Recipes Sharing/Favorites Folgeslices planen** — Teilen erzeugt Kopien; Favoriten/Collections werden eigene private oder haushaltsbezogene Owner-Objekte. Nicht in den aktuellen Ownership-Slice ziehen.

### Spaeter

- [ ] **Supabase `unused_index` Hold-Track** — keine Production-Drops ohne Nutzungsperiode, Redundanzanalyse und Query-Plan-Nachweis. Details: [advisor followups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md).
- [ ] **Northflank-Deploy-Pfad** — nach dem direkten API-Deploy vom 2026-06-08 nur noch bei roten Deploys, Runtime-Warnungen, API-Aenderungen oder Auth-/Secret-Problemen neu bewerten.
- [ ] **Styling-Track** — NativeWind 5/Tailwind 4 bleibt nach Expo-SDK-56 bewusst vertagt.

### Erledigt / Nachweis

- [x] **Auth-Onboarding-Slice** — Signup, Login, serverseitiger Account-/Default-Haushalt-Bootstrap, Account-&-Workspace-Screen und sichtbare Auth-Zustaende sind auf `main` gelandet. Plan: [Auth Onboarding Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-07-auth-onboarding-slice-plan.md).
- [x] **Multi-User Login First Slice** — Supabase Auth + echte Household-RLS-Policies ueber Memberships; App-Requests laufen mit Supabase User-JWT als `authenticated`. Plan am 2026-06-04 aktualisiert und PR #2 gelandet.
- [x] **Progressive Web App (PWA)** — Phase 6 abgeschlossen: Installierbare Web-App mit Manifest, Service Worker, Offline-Grundlage und Homescreen-Installationspfad. Plan + Runbook: `docs/pwa-runbook.md`.
- [x] **Dependency-Patch-Drift** — safe Patch-Slice fuer Root/Mobile lokal nachgezogen; Expo-/SDK-gebundene Linien bleiben laut `expo install --check` sauber und bewusst separat.
- [x] **Performance-Readiness neu aufbauen** — frisches 10er-Window fuer den Juni-Web-Export ist lokal aufgebaut; `artifacts/performance/readiness.json` steht wieder auf `ready=true`.
- [x] **Web-Persistenz-Abnahme nach Multi-Auth-Stabilisierung (TODO:52)** — Manueller Smoke gegen Production Web am 2026-06-15 dokumentiert: Login, Reload, neuer Tab, neue Browser-Session sowie Theme-/Settings-/PDF-Pfad geprueft. Artefakt: [docs/2026-06-15-web-persistence-acceptance.md](/home/patrick/Projekte/rezepti/docs/2026-06-15-web-persistence-acceptance.md).
- [x] **Credential-Auth-Hotfix-Rollout abgeschlossen** — Production-Migration `DROP TABLE IF EXISTS api_keys;` am 2026-06-15 erfolgreich ausgefuehrt; Pflicht-Smoke (`cookidoo/status` ohne Bearer -> `401`, Session bleibt nach Reload/neuem Tab erhalten, Private Session uebernimmt keinen Login) sowie optionale `401`-Checks fuer `/api/v1/keys/validate` und `/api/v1/cookidoo/credentials` bestanden. Nachweis: [Credential Hotfix Rollout Checklist](/home/patrick/Projekte/rezepti/docs/2026-06-15-credential-hotfix-rollout-checklist.md).
- [x] **BYOK- und Plattform-Credential-Ownership** — Akute Boundary-Haertung ist umgesetzt: serverseitiger `api_keys`-Store entfernt, Credential-Routen auth-gated, Pinterest/Facebook bleiben `disabled` (`501`). Neuer Folgeplan fuer das Zielmodell: BYOK bleibt user-lokal mit Server-Fallback bei leerem Key; Cookidoo soll von globalem Singleton auf user-default mit optionalem Household-Share umgebaut werden. Plan: [2026-06-15-cookidoo-user-household-ownership-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-cookidoo-user-household-ownership-plan.md).
- [x] **Cookidoo-Credential-Ownership nachgezogen** — `v1.0.172` / PR #20 ist auf `main`: private User-Credentials als Default, optionale Household-Freigabe nur fuer Owner, `cookidoo_credentials` mit RLS/Grant-Hardening, und Async-Foto-/Text-Imports snapshotten `activeHouseholdId`. Design: [2026-06-15-cookidoo-user-household-ownership-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-cookidoo-user-household-ownership-plan.md). Umsetzung: [2026-06-15-cookidoo-user-household-ownership-implementation-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-15-cookidoo-user-household-ownership-implementation-plan.md).
- [x] **T12-Cold-Start-Tests ergaenzt** — `prevKey !== nextKey`-Szenarien sind ueber `mobile/test/query-client-auth-cache.test.ts` und `mobile/test/query-client-offline-restore.test.ts` abgedeckt; `getSupabaseClient() = null -> sessionRestoring false` ist explizit in `mobile/test/session-persistence.test.ts` abgesichert (2026-06-15).
- [x] **T9-Verifikation: Confirmation-Link-Error code-seitig nachgewiesen** — `mobile/utils/auth.ts` surfaced bei fehlgeschlagenem `exchangeCodeForSession()` einen sichtbaren Fehler ueber `onLinkError`; abgedeckt in `mobile/test/auth-redirect-observer.test.ts` (expired/invalid code, 2026-06-15 bestaetigt).
- [x] **BYOK-Rate-Limit-Persistenz bewertet und umgesetzt** — `/api/v1/keys/validate` ist seit 2026-06-15 serverseitig DB-persistiert begrenzt (pro User + Key-Hash + Stundenfenster) ueber `public.byok_validation_rate_limits`; Route gibt `429 byok_validation_rate_limited` mit `remaining`/`resetTime` zurueck. Migration: [20260615065211_byok_rate_limit_validate.sql](/home/patrick/Projekte/rezepti/supabase/migrations/20260615065211_byok_rate_limit_validate.sql).
- [x] **PWA: Precache-Cap von 6 MB zurueck auf 5 MB** — Aktueller Export ist ~5.26 MB. Nach Bundle-Optimierung auf <5 MB `JS_SIZE_LIMIT_BYTES` in `scripts/pwa/build-sw.ts` zurueckfahren. Siehe `build-sw.ts` Zeile 40-41. **Plan: Phase 1 (Tasks 1-2) in [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md).** — erledigt 2026-06-13 (Cap auf 5 MB; PDF-Export-Chunks aus Precache ausgeschlossen, Laufzeit-CacheFirst deckt sie ab).
- [x] **PWA: Background Sync / Push Notifications** — Offline writes (Mutations-Queue + Konfliktloesung) fuer Shopping/Planner und Push-Notifications fuer Job-Fertigstellung. Deferred nach Phase 6. **Plan: Phase 3 (Tasks 10-17) in [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md).** — erledigt 2026-06-13, Plan docs/superpowers/plans/2026-06-13-pwa-followups-plan.md
- [x] **PWA: Schreibender Offline-Pfad** — Mutations-Queue mit Konfliktloesung fuer Shopping-List und Planner-Aenderungen; Sync bei Netzwerk-Reconnect. Deferred nach Phase 6. **Plan: Phase 2 (Tasks 3-9) in [PWA Follow-up Slices Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-13-pwa-followups-plan.md).** — erledigt 2026-06-13, Plan docs/superpowers/plans/2026-06-13-pwa-followups-plan.md
- [x] **Recipes-Ownership-Slice umsetzen** — Server-API fuer `recipes` auf explizites Owner-Modell umbauen: private User-Rezepte, Haushaltsrezepte, keine globalen Templates, keine Null-Owner-Kompatibilitaet. Plan: [Recipes Ownership Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-05-recipes-ownership-slice-plan.md).
- [x] **Stale Test-Doku nachziehen** — [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md) ist auf den aktuellen Stand gebracht; die alten `TBD`-/Naechste-Aktion-Zeilen im Legacy-Flake-Inventory sind durch aktuellen Betriebsstand und Restaktionen ersetzt.

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
- [Bug Reporting Implementation Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-16-bug-reporting-implementation-plan.md)
- [Supabase Data API Readiness](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md)
- [Supabase Advisor Follow-ups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md)
- [Dependency Upgrade Matrix](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-13-full-stack-upgrade-target-matrix.md)
- [Test Status](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md)
- [TODO History Archive](/home/patrick/Projekte/rezepti/docs/todo-history.md)
