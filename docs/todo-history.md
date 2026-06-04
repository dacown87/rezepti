# TODO History

Stand: 2026-06-04

Diese Datei archiviert erledigte oder historische Details, die frueher in `TODO.md` standen. `TODO.md` bleibt bewusst kurz und aktiv; diese Datei ist fuer Rueckfragen, Nachweise und Kontext-Rekonstruktion gedacht.

## Archivierungsentscheidung

Am 2026-06-04 wurde `TODO.md` auf eine token-effiziente Steuerdatei reduziert. Die aktive Reihenfolge, offene Watchlist und Kurzstatus bleiben dort. Historische Abschlussdetails, alte Phasen und lange Nachweise stehen hier oder in den verlinkten Spezialdokumenten.

## Aktiver Stand beim Archivieren

- Lokaler `main`: 4 Commits vor `origin/main`.
- Worktree: Doku-Aenderungen in `AGENTS.md`, `TODO.md` und dem Multi-User-Plan.
- Naechster Haupttrack: Multi-User Login.
- Wichtigster Vorlauf: Arbeitsbasis klaeren, dann Auth-Skeleton ohne produktive Grants.

## Erledigt 2026-06-02 bis 2026-06-04

- Multi-User-Plan gegen neue Ausgangslage aktualisiert: Supabase Extension-Follow-up erledigt, Staging-DB vorhanden, Expo-SDK-56-Core-Slice gelandet, `phase/6-multi-user` als stale erkannt.
- TODO auf token-effiziente aktive Steuerdatei reduziert; alte Details in dieses Archiv ausgelagert.
- Doku-/TODO-Push `7523b72` geprueft:
  - Push-CI `26939939417` gruen.
  - Docker-/Northflank-Run `26939939394` gruen.
  - Changelog-/Version-Workflow `26939939535` gruen.
  - Automatischer Version-Commit `8ed8801 chore: v1.0.124 [skip ci]`.
  - Nachgelagerter Docker-/Northflank-Run `26939952178` gruen.
- Scheduled CI seit dem letzten dokumentierten Stand gruen:
  - 2026-06-02: `26802547508`.
  - 2026-06-03: `26868293611`.
  - 2026-06-04: `26934892387`.
- Produkt-/QA-Reste aus [docs/TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md) entschieden/geplant:
  - keine aktive Dictionary-UI,
  - Kurzbegriff-Suche nur mit expliziter Short-Term-Semantik,
  - PDF-E2E nur als optionaler Trigger-Smoke.
  - Plan: [2026-06-02-product-qa-rest-decisions-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-06-02-product-qa-rest-decisions-plan.md).
- Alte manuelle Test-Luecken gegen aktuelle Tests abgeglichen; echte Reste als Produktentscheidung oder optionale QA abgegrenzt.
- Historischer [docs/cleanup-plan.md](/home/patrick/Projekte/rezepti/docs/cleanup-plan.md) geschlossen/archiviert; `AGENTS.md` bleibt aktuelle Projektanweisung.

## Erledigt 2026-06-01

- Supabase Advisor Follow-up Extension-Move produktiv abgeschlossen:
  - `vector` und `pg_trgm` aus `public` nach `extensions` verschoben.
  - Migration/Ops-Datei: [2026-06-01-move-supabase-extensions-out-of-public.sql](/home/patrick/Projekte/rezepti/db/migrations/2026-06-01-move-supabase-extensions-out-of-public.sql).
  - Runtime-Smoke: [prod-extension-runtime-smoke-2026-06-01.sql](/home/patrick/Projekte/rezepti/db/ops/prod-extension-runtime-smoke-2026-06-01.sql), mit `ROLLBACK`.
  - Security- und Performance-Advisor meldeten auf WARN-Level `No issues found`.
  - `unused_index` bleibt Hold: keine Drops ohne Nutzungsperiode, Redundanzanalyse und Query-Plan-Nachweis.
- SDK-56-Branch gelandet und CI-verifiziert:
  - `chore/expo-sdk-56-slice` in `main` gemergt.
  - Automatischer Version-Workflow erzeugte `v1.0.123`.
  - CI, Mobile Release Gate, E2E, Performance Audit, Docker Build/Push und Northflank Deploy waren gruen.
- Expo-SDK-56-Core-Slice umgesetzt:
  - `expo@~56.0.8`, `expo-router@~56.2.8`, React `19.2.3`, React Native `0.85.3`.
  - Reanimated `4.3.1`, Worklets `0.8.3`, TypeScript `~6.0.3`.
  - Navigation-Theme ueber `expo-router/react-navigation`; direkte `@react-navigation/native`-Dependency entfernt.
  - Splash-Konfiguration in `expo-splash-screen`-Config-Plugin verschoben.
  - Verifiziert mit Mobile-Typecheck, Mobile-Unit-Tests, RNTL-Guard, `expo install --check`, `expo-doctor`, Mobile-Web-Build, Root-Typecheck und Root-Unit-Tests.
- Restupdates nach SDK-56-Slice:
  - Root `concurrently 9.2.1 -> 10.0.1`.
  - Mobile `@types/react 19.2.14 -> 19.2.15`.
  - `react-test-renderer` exakt auf `19.2.3` gepinnt.
- SDK-56-Audit-Rest klassifiziert:
  - Expo-CLI-/Config-Plugins-Cluster `uuid <11.1.1` ueber `xcode` bleibt Expo-upstream-/SDK-gebunden.
  - Kein `npm audit fix --force`, weil das auf `expo-splash-screen@55.0.21` downgraden wuerde.
- Kleine Patch-Slices aus Matrix-Nachzug umgesetzt:
  - Root: `hono`, `@hono/node-server`, `vite`, `vitest`/`@vitest/*`, `tsx`, `openai`, `@types/node`.
  - Mobile: TanStack Query/Persist, `nativewind` v4, `lucide-react-native`, Vitest-Patch.
  - Tailwind 4/NativeWind 5 bewusst vertagt.

## Erledigt 2026-05-31

- Supabase Advisor Kern-Remediation abgeschlossen:
  - Supabase CLI lokal auf `2.102.0` aktualisiert.
  - Preflight gegen Ziel-DB ausgefuehrt.
  - Runtime-Rolle, `rolsuper`/`rolbypassrls`, Data-API-Grants dokumentiert.
  - `function_search_path_mutable` fuer vier interne Helper behoben.
  - `anon`/`authenticated` EXECUTE fuer interne Helper revoked.
  - 5 fehlende FK-Indexes angelegt und verifiziert.
  - 52 RLS-ohne-Policy Tabellen klassifiziert.
  - Advisor-Resultat: `function_search_path_mutable` und `unindexed_foreign_keys` weg; Rest als Follow-up-Track dokumentiert.
  - Details: [advisor-followups-2026-05-31.md](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md) und [rls-no-policy-classification-2026-05-31.md](/home/patrick/Projekte/rezepti/docs/SupaBase/rls-no-policy-classification-2026-05-31.md).
- Mobile-Testwarnungen reduziert:
  - lokale `FlatList`-Testshims geben gerenderte Items mit stabilen Keys weiter.
  - Retry-/Mutation-Interaktionen laufen ueber kleine `act`-Wrapper.
  - Verifiziert mit Mobile-Unit-Tests, Mobile-Typecheck und RNTL-Guard.

## Erledigt 2026-05-30

- RNTL Runtime-Fix abgeschlossen:
  - Vitest optimiert echte `@testing-library/react-native` gezielt.
  - `react-native` bleibt auf lokalem Test-Shim.
  - `mobile/test/testing-library-rn-real.ts` kapselt CJS-`screen`-Live-Export und Uebergangstypen.
  - alter Compat-Layer entfernt.
- RNTL Strukturzugriffe abgebaut:
  - verbliebene `UNSAFE_queryAllByType`-Zugriffe in migrierten Tests durch sichtbare Queries, Accessibility-Labels und `testID`s ersetzt.
- RNTL File-Migration abgeschlossen:
  - `recipe-list-screen-fallbacks`,
  - `recipe-detail-fallbacks`,
  - `shopping-screen-fallbacks`,
  - `mobile-workflow-list-detail-shopping-ui`,
  - `planner-screen-fallbacks`.
  - Direkte `react-test-renderer`-Imports in Mobile-Testdateien bleiben per Guard blockiert.
- npm-Audit-Findings triagiert:
  - Root reduzierte `5 moderate -> 4 moderate`.
  - Mobile reduzierte `14 total -> 11 moderate`.
  - Force-Fixes wurden wegen Major-/Downgrade-Risiken nicht genutzt.
  - Details: [2026-05-25-npm-audit-triage-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-25-npm-audit-triage-plan.md).

## Erledigt 2026-05-25 bis 2026-05-24

- Node-24-Upgrade verifiziert:
  - Lokale Runtime `node v24.15.0`, npm `11.12.1`.
  - Root und Mobile `npm ci` gruen.
  - Root-/Mobile-Typecheck, Expo Doctor, Root-/Mobile-Unit-Tests gruen.
  - Production-Docker-Build mit Node 24.15.0 erfolgreich.
- Nightly-Strict-Beobachtungsperiode nach Remediation abgeschlossen:
  - Push-Run und Baseline-Dispatch gruen.
  - Drei Strict-Dispatch-Runs auf demselben `workflow_dispatch`-Strict-Pfad gruen.
- Nightly-Strict-Code-Remediation:
  - `validate-status.mjs` wertet Strict-Findings typisiert aus.
  - `ready=false` wird als `observation_blocked` statt pauschaler Fail klassifiziert.
  - Performance-History-Cache auf `performance-history-v5`.
- GitHub Docker-Build repariert:
  - `Dockerfile` Base und Web Builder auf `node:24.15.0-slim`.
- Coverage-Gates nach Vitest-4-Migration wieder angezogen:
  - Root und Mobile Mindest-Floors `30`.
- `JobManager`-Tests auf reale Laufzeitlogik umgestellt.
- Supabase Data API Readiness konkretisiert:
  - [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md).
  - [db/templates/public-multi-user-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-multi-user-data-api-rls.sql).

## Erledigt 2026-05-13

- Supabase RLS aktiviert:
  - RLS auf `recipes`, `ingredient_dictionary`, `shopping_list`, `meal_plan`, `api_keys`.
  - REST-Grants fuer `anon`/`authenticated` entzogen.
  - `rls_auto_enable()` REST-EXECUTE revoked.
- Strict-Schedule eskaliert:
  - Nightly cron laeuft strict.
  - `push`/`pull_request` bleiben warn.
- Dockerfile changelog-stage stabilisiert:
  - `COPY public/changelog.json` durch BuildKit bind mount mit JSON-Fallback ersetzt.
- Pre-commit-Hook gegen Phantom-Submodule eingefuehrt.
- Mobile-Plan Code-Review-Findings abgearbeitet:
  - canonicalName Length-Limit,
  - React/RN Exact-Pins,
  - Chrome-Major-Pin,
  - Coverage-Floors,
  - Performance-History-Cache,
  - E2E empirisch ohne `continue-on-error`-Problem.

## Aeltere Produkt-/Feature-Historie

### Phase 9 Quality & Stability, 2026-04-16

- PostgreSQL/Supabase-Doku aktualisiert.
- `db-react.test.ts` neu geschrieben; DB-Integration unter `TEST_DATABASE_URL`.
- React Query v5 und AsyncStorage-Persistenz eingefuehrt.
- QR-Scanner mit jsQR-Fallback fuer Firefox/Safari.
- `user_id` nullable UUID in `recipes`, `shopping_list`, `meal_plan`, `api_keys`; `src/auth.ts` Stub.
- Parser-/Fetcher-Tests fuer YouTube, Schema.org und Chefkoch.
- Connection Pool in `src/db-react.ts`.

### Bugfixes nach Phase 9

- QR-PDF durch groesseren QR und `errorCorrectionLevel: L` scannbar gemacht.
- QR-Scan oeffnet Rezept direkt ueber URL-Muster `/recipe/<id>`.
- Planer-Leerzustand durch Query-Param- und Response-Parsing-Fix behoben.
- Planer-TS-Fehler durch doppeltes Prop entfernt.

### SQLite zu Supabase

- Mobile `expo-sqlite` entfernt.
- Server nutzt PostgreSQL via Supabase.
- Migration in Produktion abgeschlossen.

### Bildauswahl nach Foto-Import

- Modal nach Foto-Import.
- Rezeptname als Suchvorausfuellung.
- Bildanzahl in Settings konfigurierbar.
- Backend `GET /api/v1/images/search?q=&limit=N`.

### Phase 10 bis 13 Import-Qualitaet

- `ingredientGroups` eingefuehrt und in DB/LLM/UI verarbeitet.
- Universelle Bildauswahl nach Import.
- Social-Media-/Web-Fetching verbessert:
  - HTML-Cleanup,
  - Nutrition-Typen,
  - HTML Entity Decoding,
  - `twitter:image` Fallback,
  - Instagram/TikTok/Pinterest Verbesserungen,
  - Facebook Quelltyp,
  - Cobalt.tools Fallback.
- Phase 13 Import-Qualitaet:
  - Sample-Test mit 19 URLs.
  - CSS-Selektor-Erweiterung.
  - bessere Fehlerkategorien.
  - Quality Warnings.
  - Microdata und Wild JSON-LD.
  - Freitext-Import.
  - Ingredient Parser.
  - Nutrition-Schaetzung.
  - Plugin-Architektur.
  - ML-Fallback hinter Feature Flag.

## Historischer Feature-Backlog aus Phase 13

Diese Punkte sind keine aktive naechste Reihenfolge, koennen aber spaeter als Produktideen dienen:

- Supadata.ai fuer Instagram-Transkripte.
- OpenRouter als BYOK-LLM-Alternative.
- Ollama als lokaler LLM-Fallback.
- Llama 4 Scout fuer Textextraktion.
- Bild-Optimierung beim Import via WebP/Resizing.
- Vision-basierte Rezeptkarten-Erkennung.
- Rezept-Qualitaets-Scoring.
- Open Food Facts Barcode-API.
- PDF-Import.
- Paprika/Nextcloud Cookbook/Cooklang/weitere Migrationsformate.
- CSV-/Markdown-Export.
- bessere Bildauswahl durch Ranking.
- AI-Schritt-Sortierung.
- `mobile/app/recipe/[id].tsx` modularisieren.

## Historische QA-/Cleanup-Punkte

- Cleanup-Plan: [2026-05-05-cleanup-punkte-3-4-5-6-7-8-9-12-13.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-05-cleanup-punkte-3-4-5-6-7-8-9-12-13.md).
- Stand 2026-05-06: Code-Punkte 3, 4, 5, 6, 7, 8, 9 und 12 committed.
- Punkt 13 als separater manueller Supabase-Ops-Schritt gegen `rezepti-dev`; Vorab-Pruefung fuer `recipes.id = 36` ergab bereits keinen Datensatz, transaktionaler Delete war verifizierter No-Op.
- Veraltete QA-Punkte:
  - Frontend-Build fehlt: erledigt.
  - Phase-13-Plan gegenlesen: erledigt.
  - Logo-Asset 404: behoben.
  - Chefkoch Plugin Dead Code: behoben.
  - TikTok OCR doppelter LLM-Aufruf: behoben.

## Test-/Dependency-Historie

- Root Unit Tests zuletzt dokumentiert: `448 passed`, `13 skipped` am 2026-06-01.
- Mobile Unit Tests zuletzt dokumentiert: `87 passed` am 2026-06-01.
- Mobile RNTL Guard gruen.
- Expo Doctor nach SDK-56-Core-Slice: `21/21`.
- Root/Mobile Patch-Drift wurde am 2026-06-04 erneut festgestellt und in `TODO.md` aktiv gehalten.

## Wichtige Langzeitdokumente

- [TEST_STATUS.md](/home/patrick/Projekte/rezepti/docs/TEST_STATUS.md)
- [Dependency Upgrade Matrix](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-13-full-stack-upgrade-target-matrix.md)
- [Mobile Testing and Performance Plan](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-06-mobile-testing-and-performance-plan.md)
- [Supabase Advisor Follow-ups](/home/patrick/Projekte/rezepti/docs/SupaBase/advisor-followups-2026-05-31.md)
- [Supabase Data API Readiness](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md)
