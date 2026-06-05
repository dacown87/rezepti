# TODO

Stand: 2026-06-05

Diese Datei ist die kurze, aktive Arbeitsliste fuer Mensch und KI. Alte erledigte Details stehen in [docs/todo-history.md](/home/patrick/Projekte/rezepti/docs/todo-history.md).

## Aktueller Stand

Coverage-/JobManager-Remediation, Supabase-Data-API-Readiness, Supabase-Advisor-Kern-Remediation, Nightly-Strict-Remediation, Node-24-Verifikation, npm-Audit-Triage, RNTL-Migration, Matrix-Nachzug, Restupdates und Expo-SDK-56-Core-Slice sind durch. GitHub Actions seit dem letzten Check sind gruen, inklusive Scheduled CI 2026-06-02 bis 2026-06-04, Push-CI fuer `7523b72`, Docker Build/Push und Northflank Deploy.

Arbeitsbasis ist geklaert: PR #2 `Multi-user login first slice` ist auf `origin/main` gelandet; der automatische Version-Commit steht bei `v1.0.125`. `phase/6-multi-user` ist stale und keine aktive Basis.

## Naechste Reihenfolge

1. **Recipes-Ownership-Slice gegen neue Spec umbauen**
   - Der aktuelle Branch enthaelt brauchbare Auth-/Mutation-/Job-Ownership-Bausteine, darf aber nicht mit globalen Default-Reads als Zielzustand geshippt werden.
   - Neue Zielentscheidung: Rezepte gehoeren privat einem User oder einem Haushalt; keine globalen Templates; Teilen erzeugt Kopien; `user_id is null` Daten duerfen resetet/geloescht werden.
   - Plan-Basis: [Multi-User Login First Slice](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-31-multi-user-login-first-slice-plan.md).
   - Ziel-Spec: [Recipes Household Ownership Design](/home/patrick/Projekte/rezepti/docs/superpowers/specs/2026-06-05-recipes-household-ownership-design.md).
   - Umsetzungsplan: [Recipes Ownership Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-05-recipes-privacy-slice-plan.md).

2. **Progressive Web App (PWA) einbauen**
   - Installierbare App-Shell fuer Web mit Manifest, Service Worker und Offline-Grundlage planen.
   - Homescreen-Installationspfad fuer iOS/Android pruefen.
   - Erst nach dem Multi-User-Basisslice starten, damit Auth-/Session-Verhalten sauber in die PWA-Caches passt.

3. **Dependency-Patch-Drift als separaten Maintenance-Slice nachziehen**
   - Root: `@vitest/coverage-v8`, `@vitest/ui`, `concurrently`, `happy-dom`, `openai`, `supabase`, `vite`, `vitest`.
   - Mobile: `@tanstack/query-async-storage-persister`, `@tanstack/react-query`, `@tanstack/react-query-persist-client`, `@types/react`, `@vitest/coverage-v8`, `react-native-svg`, `vitest`.
   - Nicht mit Auth/RLS vermischen. Expo-/SDK-gebundene Latest-Linien nur ueber `expo install --check` und `expo-doctor`.

4. **Mobile-Persistenz manuell abnehmen**
   - Settings/Theme/PDF nach App-Neustart pruefen.
   - Technische Tests sind gruen; diese manuelle Abnahme fehlt noch.

5. **Spaeter oder trigger-basiert**
   - NativeWind 5/Tailwind 4 separat planen.
   - `unused_index` erst nach Nutzungsperiode plus Staging-Plananalyse anfassen.
   - Northflank nur bei Deploy-Fehlern, Runtime-Warnungen oder Upstream-Abkuendigung neu bewerten.

## Aktive Backlog / Watchlist

- [ ] **Multi-User Login** — Supabase Auth + echte Household-RLS-Policies ueber Memberships; App-Requests laufen mit Supabase User-JWT als `authenticated`. Plan am 2026-06-04 aktualisiert.
- [ ] **Progressive Web App (PWA)** — Installierbare Web-App mit Manifest, Service Worker, Offline-Grundlage und Homescreen-Installationspfad fuer iOS/Android einbauen.
- [ ] **Dependency-Patch-Drift** — siehe Reihenfolge Punkt 4; kein Blocker fuer Multi-User Phase 0/1.
- [ ] **Mobile-Persistenz Neustart-Pruefung** — Settings/Theme/PDF nach App-Neustart.
- [ ] **BYOK-Rate-Limit-Persistenz bewerten** — [src/byok-validator.ts](/home/patrick/Projekte/rezepti/src/byok-validator.ts) erlaubt im TODO-Pfad aktuell alle Requests; vor Multi-User-/BYOK-Ausweitung DB/Redis/serverseitige Begrenzung entscheiden.
- [ ] **Recipes-Ownership-Slice umsetzen** — Server-API fuer `recipes` auf explizites Owner-Modell umbauen: private User-Rezepte, Haushaltsrezepte, keine globalen Templates, keine Null-Owner-Kompatibilitaet. Plan: [Recipes Ownership Slice Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-05-recipes-privacy-slice-plan.md).
- [ ] **Recipes Sharing/Favorites Folgeslices planen** — Teilen erzeugt Kopien; Favoriten/Collections werden eigene private oder haushaltsbezogene Owner-Objekte. Nicht in den aktuellen Ownership-Slice ziehen.
- [ ] **Stale Test-Doku nachziehen** — [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md) enthaelt im Legacy-Flake-Inventory noch alte `TBD`-/Naechste-Aktion-Zeilen, obwohl mehrere P1/P2/P3a-Punkte abgeschlossen sind.
- [ ] **Supabase `unused_index` Hold-Track** — keine Production-Drops ohne Nutzungsperiode, Redundanzanalyse und Query-Plan-Nachweis. Details: [advisor followups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md).
- [ ] **Northflank-Deploy-Pfad** — nur bei roten Deploys, Runtime-/Action-Warnungen oder `northflank/deploy-to-northflank@v1`-Abkuendigung neu bewerten.
- [ ] **Styling-Track** — NativeWind 5/Tailwind 4 bleibt nach Expo-SDK-56 bewusst vertagt.

## Kurzstatus

### Supabase / Security

- RLS ist auf den relevanten Public-Tabellen aktiviert; `npm run test:auth` deckt den schnellen Auth-/Route-Vertrag ab. Lokaler Supabase-RLS-Smoke fuer Shopping/Planner ist automatisiert, lokal gruen und als eigener CI-Job vorbereitet. Der gegatete Staging-Smoke lief am 2026-06-04 gegen `rezepti-staging` gruen.
- Data-API-RLS-/Grant-Matrix fuer Multi-User ist fuer Slice 1 umgesetzt: Shopping/Planner sind household-scoped, `recipes` ist fuer `anon`/`authenticated` ueber die Data API geschlossen und bleibt bis zum expliziten Owner-Modell serverseitig.
- `vector` und `pg_trgm` liegen seit 2026-06-01 in `extensions`; WARN-Level Advisor-Smokes waren gruen.
- `rezepti-staging` wurde als RLS-Smoke-Ziel bestaetigt und migriert.

### Tests / CI

- Zuletzt dokumentiert: Root Unit Tests `448 passed`, `13 skipped`; Mobile Unit Tests `87 passed` (2026-06-01).
- Mobile RNTL Guard ist gruen; direkte `react-test-renderer`-Imports in Mobile-Testdateien bleiben blockiert.
- Scheduled CI am 2026-06-02 (`26802547508`), 2026-06-03 (`26868293611`) und 2026-06-04 (`26934892387`) war gruen.
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
- [Supabase Data API Readiness](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md)
- [Supabase Advisor Follow-ups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md)
- [Dependency Upgrade Matrix](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-13-full-stack-upgrade-target-matrix.md)
- [Test Status](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md)
- [TODO History Archive](/home/patrick/Projekte/rezepti/docs/todo-history.md)
