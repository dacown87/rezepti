<!-- /autoplan restore point: /home/patrick/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260506-091159.md -->
# Mobile Testing and Web Performance Plan

Stand: 2026-05-13

## Aktueller Stand (2026-05-13, nach zweitem gruenen Strict-Probe-Run + Schedule-Eskalation)

Kurzfassung: Der urspruengliche Plan ist fuer Phase 1-4 abgeschlossen. Phase 4c ist technisch abgeschlossen: Throttling-Vergleich, Bundle-Slice, statische App-Shell und Budget-Mechanik sind umgesetzt und nicht-sandboxiert verifiziert. **Beide Strict-Probe-Runs gruen** (`25742783313` am 2026-05-12, `25781366107` am 2026-05-13). **Strict-Schedule-Eskalation am 2026-05-13 live**: `schedule` (nightly cron 02:00 UTC) laeuft jetzt `strict`, `push`/`pull_request` bleiben `warn`, `workflow_dispatch` wahlweise. Die naechste Eskalationsstufe (`pull_request` strict) ist offen und braucht eine eigene Datenbasis aus 1-2 Wochen stabilen Nightly-Strict-Runs.

Erledigt:

- Phase 1: Mobile Release Gate, CI-Split, `expo-doctor`, Shared Contracts.
- Phase 2: Mobile Workflow Reliability inkl. Cache-/Retry-/Mutation-/Offline-Pfade.
- Phase 3: Warn-only Lighthouse-/Bundle-Foundation mit Artefakten, CI-Job, History/Readiness-Mechanik.
- Phase 4: React-Performance-Slices fuer Recipe List und Planner, plus Skeleton-Refactor fuer Shopping/Recipe Detail.
- Phase 5 bleibt bewusst deferred; kein Web-Vitals-Track ohne konkrete Feldmetrik-Frage.

Phase-4c erledigt:

- `scripts/performance/lighthouse-runner.mjs`: `LIGHTHOUSE_THROTTLING=simulate|devtools` validiert, schreibt Methode in Status/Summary/Results und startet bei Import in Unit-Tests nicht mehr automatisch.
- `scripts/performance/throttling-compare.mjs`: setzt `LIGHTHOUSE_THROTTLING` als Environment, sammelt erfolgreiche Lighthouse-Reports und schreibt p50/p75 plus `simulate-minus-devtools`-Deltas.
- `scripts/performance/bundle-report.mjs`: schreibt gzip JS-Metriken und exportiert testbare Bundle-Report-Helfer.
- `scripts/performance/validate-status.mjs`: unterstuetzt methodenfaehige Lighthouse-Budgets, gzip-JS-Budget und JS-Ausfuehrungszeit via Lighthouse `bootup-time`.
- Tests ergaenzt: Runner-Throttling, Throttling-Compare, Bundle-Gzip, Performance-Budget-Validation.
- Entscheidung dokumentiert in `docs/performance/throttling-analysis.md`: Outcome Z ist der validierte LCP-Fix; Outcome Y wurde als vorbereitender Bundle-Slice umgesetzt.
- Phase-B-Slices umgesetzt: PDF-Export wird in Recipe List und Recipe Detail dynamisch importiert; `mobile/app/+html.tsx` rendert eine route-aware `rd-audit-shell` vor dem Expo-Root.
- Ergebnis im frischen Expo-Web-Export: Entry-Chunk von 4,614,669 Bytes auf 4,156,752 Bytes reduziert; `pdf-export` liegt jetzt als eigener 459,615-Bytes-Chunk vor.

Strict-Hardening-Tooling-Slice erledigt:

- `scripts/performance/stability-seed.mjs`: automatisiert `perf:bundle` einmalig und danach N-mal `perf:lighthouse` + `perf:validate` sequenziell. Default: 10 Runs, Methode `simulate`; steuerbar ueber `PERF_STABILITY_RUNS`, `PERF_STABILITY_METHOD`/`LIGHTHOUSE_THROTTLING`, `PERF_STABILITY_SKIP_BUNDLE=1`.
- `scripts/performance/budget-suggestions.mjs`: berechnet Budget-Vorschlaege aus echten vollstaendigen History-Runs, gefiltert nach Methode/Viewport. Default-Regel: `p95 * 1.10`; p50/p75/p95 werden als Evidenz mitgeschrieben.
- `scripts/performance/validate-status.mjs`: schreibt `throttlingMethod` in neue History-Eintraege und erzeugt eindeutige `runId`s auch bei mehreren Validierungen innerhalb eines CI-Runs (`GITHUB_RUN_ID` + Attempt + Messzeitpunkt). Damit ueberschreibt ein 10er-Loop seine eigenen Runs nicht.
- `package.json`: neue Commands `perf:stability:seed`, `perf:budget:suggest`, `perf:strict-hardening`.
- Tests ergaenzt: `test/unit/stability-seed.test.ts`, `test/unit/budget-suggestions.test.ts`, plus Run-ID-Test in `test/unit/validate-status-performance-budgets.test.ts`.

Strict-Hardening-Seed erledigt:

- `npm run perf:stability:seed` lief nicht-sandboxiert vollstaendig durch. Der erste Sandbox-Versuch scheiterte erwartbar an `listen EPERM` fuer `127.0.0.1:4173`; ausserhalb der Sandbox konnte der lokale Static Server starten.
- `npm run perf:budget:suggest` wertete ein komplettes `10/10`-Window aus (`2026-05-12T06:06:18.985Z` bis `2026-05-12T06:22:53.599Z`).
- `scripts/performance/baseline.json` wurde geschaerft: `maxGzipJsBytes=1140411`, `maxLargestJsAssetBytes=4572427`; `maxJsBytes` bleibt bei der bestehenden strengeren 5.2-MB-Grenze.
- Lighthouse-Budgets fuer `simulate/mobile-375x812` wurden geschaerft. Der `/`-LCP-Vorschlag von 24616 ms wurde nicht uebernommen, weil er aus einem einzelnen Cold-Run-Ausreisser (22378 ms) kam; die warmen `/`-Runs clustern bei ~903 ms.

Beobachtungs- und Probe-Gate erledigt (2026-05-12 + 2026-05-13):

- ✅ 1. Probe-Window (2026-05-12): 5/5 gruene Warn-Mode-CI-Runs (`25740992098`, `25741507844`, `25741808184`, `25742133438`, `25742437228`); Beobachtungsartefakt im finalen Warn-Run: `strictProbeEligible=true`, `consecutiveGreenRuns=5`, `readiness.ready=true`, `warmupSeed.ready=true`.
- ✅ 1. Strict-Probe (Run `25742783313`, 2026-05-12) gruen: `performance-audit`-Job gruen, `expectedRuns=9/9`, `warningRuns=0`, alle Budgets passed.
- ✅ 2. Probe-Window (2026-05-13): 5/5 gruene Warn-Mode-CI-Runs (`25745137766`, `25750452339`, `25750960475`, `25752160250`, `25759065411`).
- ✅ 2. Strict-Probe (Run `25781366107`, 2026-05-13) gruen: `performance-audit`-Job 7m39s, `enforcement=strict`, `lighthouse=ok`, `readiness ready=true 10/10`, `warningRate=0.0000`, `fullCoverage=true`.
- ✅ Warm-up-Lauf vor `lighthouse-1` ist im `perf:stability:seed`-Pfad implementiert und unterdrueckt First-Sample-Ausreisser; der `/`-Cold-Run-Ausreisser-Vorschlag (24616 ms) wurde nicht in `baseline.json` uebernommen.
- ✅ PR #1 `feat/mobile-release-gate-and-perf-foundation` am 2026-05-12 via Squash gemerged (Squash-Commit `d291c0f`); die vier leeren Trigger-Commits aus dem 1. Probe-Window wurden mit-squashed.

Strict-Schedule-Eskalation erledigt (2026-05-13, Commit `7bf820e`):

- `.github/workflows/ci.yml`: Schritte `Enforce browser readiness` und `Validate performance status` triggern auf `github.event_name == 'schedule' || (workflow_dispatch && perf_enforcement == 'strict')`.
- `push`/`pull_request` bleiben weiter `warn` — kein PR-Block bei Lighthouse-Flakes.
- `workflow_dispatch` weiter wahlweise `warn` (default) oder `strict`.
- Runbook (`docs/performance/strict-probe-runbook.md`) und `CLAUDE.md` auf neue Policy aktualisiert.

Noch offen:

- **Nightly-Strict-Beobachtung** (passiv) — Erste 1-2 Wochen Nightly-Cron-Runs auf Drift/Flakes beobachten. Bei stabil gruen: Eskalation auf `pull_request` strict erwaegen. Bei rot: Root-Cause-Analyse + ggf. Budget-Anpassung via `perf:budget:suggest`.
- **Phase 5 (Optional Web Vitals)** bleibt deferred bis konkrete Feldmetrik-Frage entsteht, die Lighthouse/Bundle nicht beantwortet.
- **Test-Infra-Migration `react-test-renderer` → `@testing-library/react-native`** (Follow-up, kein Blocker): wartet auf den aktuellen Vitest/RN-Runtime-Blocker.
- **Kosmetisches Follow-up** (kein Perf-Treiber): `matchedCount` direkt aus der API-Antwort lesen statt clientseitig in `recipe-list-screen-data.ts` zu rekomputieren — beseitigt nur die Logik-Doppelung.

Aktuelle lokale Verifikation am 2026-05-12:

- `npm --prefix mobile run typecheck` gruen.
- `npm --prefix mobile run test:unit` gruen: 15 Dateien, 85 Tests.
- `npm run test:unit` gruen: 35 Dateien passed, 1 skipped; 412 Tests passed, 12 skipped.
- `npx vitest run test/unit/lighthouse-runner-api-mock.test.ts test/unit/lighthouse-runner-throttling.test.ts test/unit/throttling-compare.test.ts test/unit/bundle-report-gzip.test.ts test/unit/validate-status-performance-budgets.test.ts` gruen: 5 Dateien, 34 Tests.
- `npx vitest run test/unit/stability-seed.test.ts test/unit/budget-suggestions.test.ts test/unit/validate-status-performance-budgets.test.ts` gruen: 3 Dateien, 13 Tests.
- `node --check` fuer `lighthouse-runner`, `throttling-compare`, `bundle-report`, `validate-status`, `stability-seed` und `budget-suggestions` gruen.
- `timeout 180s npm run build:mobile` exportiert `public/` erfolgreich, beendet sich aber wie bekannt nicht sauber und wurde mit Timeout beendet.
- `npm run perf:bundle` gruen; Bundle-Report zeigt Entry-Chunk 4,156,752 Bytes und gzip JS total 1,036,737 Bytes.
- `npm run perf:lighthouse:compare` nicht-sandboxiert gruen: 3/3 `simulate` + 3/3 `devtools`, jeweils 9 Samples.
- Historischer Zwischenstand 2026-05-11: `perf:validate` war gruen, aber die methodenmarkierte 10er-Serie fehlte noch.
- Dieser Blocker ist am 2026-05-12 erledigt; siehe die folgenden Seed-/Suggest-/Validate-Nachweise.
- `npm run perf:stability:seed` nicht-sandboxiert gruen: 10 Lighthouse-Zyklen, 10 History-Writes, `fullCoverage=true`.
- `npm run perf:budget:suggest` gruen: `Window: 10/10 complete runs, complete=true`.
- `npm run perf:validate` gruen nach Baseline-Schaerfung: `lighthouse=ok`, `warningRate=0.0000`, `fullCoverage=true`.
- `npx vitest run test/unit/budget-suggestions.test.ts test/unit/stability-seed.test.ts test/unit/validate-status-performance-budgets.test.ts test/unit/bundle-report-gzip.test.ts` gruen: 4 Dateien, 14 Tests.

Konsequenz:

- Die historische `ready=true`-Readiness vom 2026-05-08 bleibt als Nachweis fuer die alte Foundation bestehen.
- Fuer Budget-Hardening zaehlt ab jetzt die neue Phase-4c-Messbasis mit echter `throttling-comparison.json`, methodenfaehiger Budgetauswertung, methodenmarkierter History und den am 2026-05-12 geschaerften Budgets.
- Strict-Probe-Gate ist zweimal erreicht und beide Probe-Runs waren gruen. **CI-Policy seit 2026-05-13**: `schedule` (nightly) faehrt `strict`, `push`/`pull_request` bleiben `warn`, `workflow_dispatch` wahlweise. Jede weitere Ausweitung von `strict` (insbesondere auf `pull_request`) ist eine separate Entscheidung und setzt eine eigene Datenbasis voraus (1-2 Wochen stabilen Nightly-Strict).

Wegweiser fuer naechste Schritte (post-Schedule-Eskalation):

1. **Nightly-Strict-Beobachtung** — Erste 1-2 Wochen Nightly-Cron-Runs auf Drift/Flakes beobachten. Bei stabil gruen: `pull_request` strict erwaegen.
2. **Bei rotem Nightly-Run** kein Reflex-Rollback — zuerst Artefakte sichern, Ursache als Budget-/Flake-/Infrastrukturproblem klassifizieren, dann gezielt reagieren (z.B. `perf:budget:suggest` fuer eine neue Budget-Schaerfungsrunde).
3. Erst nach 1-2 Wochen stabiler Nightly-Strict-Runs entscheiden, ob `strict` auf `pull_request` ausgeweitet wird.

## Implementation Status (2026-05-08)

Branch: `feat/mobile-release-gate-and-perf-foundation`

Bereits umgesetzt:

- Mobile-Vitest-Basis angelegt: `mobile/vitest.config.ts`, `mobile/test/setup.ts`
- Erster Mobile-Contract-Test angelegt: `mobile/test/recipe-mapper.test.ts`
- `ApiRecipe -> Recipe` Mapping in testbares Utility extrahiert: `mobile/utils/recipe-mapper.ts`
- Root- und Mobile-Skripte fuer Release Gate angelegt:
  - Root: `mobile:typecheck`, `mobile:build:web`, `test:mobile`, `mobile:release-gate`
  - Mobile: `typecheck`, `build:web`, `test:unit`, `test:watch`
- CI um separaten Job `mobile-release-gate` erweitert (inkl. Cache fuer beide Lockfiles)
- Fehlende Mobile-Build-Dependency `react-native-svg` ergaenzt
- Lucide Type-Debt zentral behoben via `mobile/types/lucide-react-native.d.ts`
- `mobile:typecheck` auf vollen Scope (`tsconfig.json`) umgestellt
- Phase-2 Workflow-Tests deutlich ausgebaut:
  - `mobile/test/recipe-workflow-cache-mutations.test.ts`
  - `mobile/test/utils-api.test.ts`
  - `mobile/test/recipe-mapper.test.ts`
  - `mobile/test/hooks-query-reliability.test.ts`
  - `mobile/test/query-client-integration.test.ts` (echter QueryClient fuer Invalidate/Refetch + Recovery-Pfade)
  - `mobile/test/recipe-list-screen-fallbacks.test.tsx` (UI-nahe Loading/Error/Retry-Fallbacks im Recipe-List-Screen)
  - `mobile/test/shopping-screen-fallbacks.test.tsx` (UI-naher Error/Retry-Fallback bei Shopping-API-Fehlern)
  - `mobile/test/recipe-detail-fallbacks.test.tsx` (UI-naher Not-Found-Fallback inkl. Back-Navigation)
- Shopping-Screen Fehlerbehandlung verbessert:
  - `fetchItems()` wirft bei non-ok Responses
  - Screen zeigt sichtbaren Error-Text + Retry-Button statt stillem Empty-State
- Fragile Source-Tests auf Verhaltenstests migriert:
  - `test/unit/shopping-screen-source.test.ts`
  - `test/unit/pdf-export-native-source.test.ts`
- Asset-Hash-Flakiness entschärft:
  - `test/unit/static-assets.test.ts` nutzt dynamische `Logo.<hash>.png`-Auflösung
- CI Mobile-Job in getrennte Schritte aufgeteilt (`mobile ci`, `typecheck`, `build`, `test`) fuer bessere Fehlersicht/Re-Runs
- E2E aus Root-`test` Job in dedizierten CI-Job `e2e` entkoppelt
- Coverage-Gating als echte Pipeline-Bedingung aktiviert (Root + Mobile `thresholds` in Vitest, Artefakt-Upload mit `if-no-files-found: error`)
- Root-Coverage-Scope bereinigt (`src/**/*.ts` als Include; Ausschluss von `mobile/**`, `artifacts/**`, `public/**`, `scripts/**`)
- Doppelte CI-Testlaeufe entfernt: Coverage-Lauf ersetzt separaten Unit-Lauf in `test` und `mobile-release-gate`
- Phase-3 Foundation angelegt:
  - `perf:bundle`, `perf:lighthouse`, `perf:audit` in `package.json`
  - `scripts/performance/bundle-report.mjs` (Artefakte + Summary)
  - `scripts/performance/lighthouse-runner.mjs` (warn-only Platzhalter)
  - Artefakte unter `artifacts/performance/**`
- Lighthouse-Runner erweitert auf feste Routen/Viewports + status file (`artifacts/performance/status.json`) + feste Port-Topologie
- `performance-audit` CI-Job inkl. Artefakt-Upload (`if: always()`) ergaenzt
- Lighthouse als Dev-Dependency in Root aufgenommen (für echte CI-Messlaeufe)
- Lighthouse-Runner konsolidiert (`lighthouse-runner.mjs`), inkl. robuster CLI-/Chrome-Erkennung und maschinenlesbarer Skip-Reason-Codes
- `perf:lighthouse:doctor` und `perf:validate` in CI integriert (Diagnose + Statuspruefung)
- Optionaler Enforce-Pfad mit Guardrails:
  - Nightly (`schedule`) enforced
  - Manuell nur bei `workflow_dispatch` mit `enforce_lighthouse=true`
  - zusaetzliche Browser-Readiness-Pruefung im Enforce-Pfad
  - Enforce verlangt jetzt `lighthouse=ok` und volle Run-Abdeckung (`successfulRuns == expectedRuns`)
- Toolchain-Upgrade abgeschlossen:
  - Node-Version-Pinning auf 24.15.0 in Projekt + CI (`.nvmrc`, `engines`, `actions/setup-node`)
  - Mobile-Stack auf Expo SDK 55 aktualisiert (`expo ~55.0.23`)
  - React/React-DOM auf 19.2.0 und React Native auf 0.83.6 aktualisiert
  - `react-test-renderer` auf 19.2.0 aktualisiert
  - `mobile/tsconfig.json` auf `expo/tsconfig.base.json` umgestellt (Expo 55 kompatibel)
- Expo-Doctor-Nacharbeiten abgeschlossen:
  - `.expo/` ignoriert (`.gitignore`, `mobile/.gitignore`) und zuvor versionierte `.expo`-Artefakte aus Git-Index entfernt
  - fehlende App-Assets fuer Icon/Splash/Adaptive-Icon/Favicon in `mobile/assets/images/` hinterlegt
  - `mobile/app.json` Schema-Bereinigung (`newArchEnabled`, `android.edgeToEdgeEnabled` entfernt)
  - `expo-doctor` Ergebnis: 18/18 Checks bestanden
- SDK-55-Kompatibilitaet nach Patch-Update-Versuch wiederhergestellt:
  - `react`, `react-dom`, `react-native` und `react-native-svg` bewusst auf Expo-Expected zurueckgesetzt (`19.2.0`, `19.2.0`, `0.83.6`, `15.15.3`)
  - `react-test-renderer` wieder auf `19.2.0` ausgerichtet
  - `expo-doctor` erneut verifiziert: 18/18 Checks bestanden
- Expo-Web-Build nach Asset-Fix wieder stabil:
  - `mobile/assets/images/favicon.png` war inhaltlich eine ICO-Datei mit falscher `.png`-Endung
  - Asset durch echte PNG ersetzt; `npm run mobile:build:web` exportiert wieder erfolgreich nach `public/`
- Phase-4 Slice 1 umgesetzt:
  - `mobile/utils/recipe-list-screen-data.ts` extrahiert Recipe-List-Derivationen (Tags, Search, Category, Ingredient-Match-Counts) aus `index.tsx`
  - `mobile/app/(tabs)/index.tsx` nutzt jetzt deferred search / deferred ingredient input, stabilere `FlatList`-Konfigurationen und keinen teuren Inline-Match-Work mehr im `renderItem`
  - `mobile/test/fixtures/recipe-performance-fixture.ts` liefert deterministische 300-1000-Rezepte-Fixtures fuer Such-/Filter-/Listenpfade
  - `mobile/test/recipe-list-screen-data.test.ts` sichert den neuen Derived-Data-Pfad gegen einen 600-Rezepte-Datensatz ab
  - `mobile/app/(tabs)/shopping.tsx` und `mobile/app/recipe/[id].tsx` reduzieren wiederholte Render-Ableitungen auf Low-Risk-Hotspots
  - Mobile-Verifikation nach Phase-4 Slice 1: `npm --prefix mobile run typecheck` + `npm --prefix mobile run test:unit` -> `13` Dateien, `60` Tests gruen
- Phase-2-Restluecken weiter geschlossen:
  - `mobile/utils/shopping-service.ts` enthaelt `addIngredients` jetzt als testbaren Service mit bounded concurrency
  - `mobile/utils/query-client.ts` verwirft korrupten persistierten Query-Cache und entfernt den defekten AsyncStorage-Eintrag
  - `mobile/app/(tabs)/planner.tsx` zeigt sichtbaren Load-/Retry-Fallback fuer fehlgeschlagenen Wochen-Load und sichtbaren Retry fuer Shopping-Aggregationsfehler
  - `mobile/test/planner-screen-fallbacks.test.tsx`, `mobile/test/shopping-screen-fallbacks.test.tsx`, `mobile/test/query-client-integration.test.ts` und `mobile/test/mobile-workflow-shopping-recovery.test.ts` sichern diese Recovery-Pfade ab
  - Mobile-Verifikation nach dem Strict-Phase-2-Slice: `npm --prefix mobile run typecheck` + `npm --prefix mobile run test:unit` -> `14` Dateien, `68` Tests gruen
- Phase-2 Planner-Mutationspfade abgeschlossen:
  - `mobile/app/(tabs)/planner.tsx` deckt jetzt auch sichtbare Pending-/Retry-Zustaende fuer `add` und `remove` ab
  - Retry waehrend eines Planner-Rescue-Pfads bleibt sichtbar (`Wird versucht…`), Add-Retry behaelt den Zieltag, Remove-Retry laeuft ohne zweiten Confirm-Dialog
  - `mobile/test/planner-screen-fallbacks.test.tsx` deckt jetzt add/remove rescue, pending retry label und den direkten remove retry ab
  - Mobile-Verifikation nach dem Planner-Final-Slice: `npm --prefix mobile run typecheck` + `npm --prefix mobile run test:unit` -> `14` Dateien, `71` Tests gruen
- Phase-3-Abschluss im Code/CI-Setup geliefert:
  - `performance-audit` stellt Chrome im CI jetzt deterministisch via `browser-actions/setup-chrome@v1` bereit
  - `perf:validate` schreibt jetzt `artifacts/performance/history.json` und `artifacts/performance/readiness.json`
  - die Performance-Historie wird im CI ueber `actions/cache` branch-spezifisch zwischen Runs weitergetragen
  - `artifacts/performance/summary.md` enthaelt jetzt einen `Baseline History`-Abschnitt mit Readiness-Status
- Phase 3 empirisch abgeschlossen (2026-05-08):
  - 10 lokale Lighthouse-Runs gegen den frischen Web-Export geseedet (`/`, `/shopping`, `/recipe/1` × `mobile-375x812/tablet-768x1024/desktop-1366x768`)
  - finale Readiness: `ready=true`, alle vier Checks gruen (`minRunsMet`, `warningRateMet`, `fullCoverageMet`, `metricStabilityMet`)
  - Run-Window: 2026-05-08T16:33:02Z – 2026-05-08T16:49:42Z, 90 Lighthouse-Runs total, 0 Warnings, spreadRatio fuer LCP/CLS auf allen drei Routen <= 2%
  - `artifacts/performance/history.json` und `artifacts/performance/readiness.json` werden mit dem Repo versioniert (siehe `.gitignore` Negation), sodass CI weiter darauf aufbauen kann
  - **Befund fuer Folgearbeit (behoben 2026-05-09):** LCP auf `mobile-375x812` ist auf `/` ~902 ms, aber auf `/shopping` und `/recipe/1` jeweils ~25 s. Ursache: API-Mock in `lighthouse-runner.mjs` deckte nur `/api/v1/recipes`, `/api/v1/planner`, `/api/v1/shopping`, `/api/v1/health` ab; verschachtelte/parametrisierte Pfade fielen in den `return json({})`-Default. Behoben: `matchApiRoute()` extrahiert und auf alle erwarteten Routen erweitert (siehe `test/unit/lighthouse-runner-api-mock.test.ts`). Verbleibende ~25 s LCP sind ein Simulate-Throttling-Artefakt (Spinner-dann-Content-Pattern), kein Mock-Problem mehr.
- Review-Bugfixes aller Phasen umgesetzt (2026-05-07):
  - `src/routes/planner.ts` — `canonicalName` Length-Limit (max 500 Zeichen) ergaenzt
  - `mobile/utils/query-client.ts` — `AsyncStorage.removeItem` in eigenem try/catch abgesichert
  - `mobile/app/(tabs)/planner.tsx` — redundanter innerer Block entfernt; `.catch()` fuer `loadAllRecipes()` im RecipePickerModal; try/catch + konsistente Fehler-UI fuer QR-Recipe-Link-Pfad via `handlePlannerActionError`
  - `scripts/performance/lighthouse-runner.mjs` — API-Mock im statischen Lighthouse-Server: `/api/*`-Anfragen werden mit leeren JSON-Antworten beantwortet; LCP misst jetzt den tatsaechlichen Empty-State statt eines ~25s API-Timeouts
  - `scripts/performance/baseline.json` — LCP/CLS-Budgets ergaenzt (initial 5s, tighten nach 10+ stabilen CI-Runs; Zielbudget laut Plan: LCP 3.0–3.4s)
  - `scripts/performance/validate-status.mjs` — LCP- und CLS-Budget-Checks pro Route und Viewport implementiert
- Phase-4 Slice 2 abgeschlossen (2026-05-07):
  - `mobile/utils/planner-screen-data.ts` extrahiert `groupEntriesByDay`, `filterPickerRecipes`, `buildRecipeIdMap`, `pickRecipesByIds` als pure, framework-neutrale Utilities
  - `mobile/test/planner-screen-data.test.ts` deckt alle vier Funktionen ab (12 Tests, inkl. Performance-Smoke gegen 1000 Rezepte / 50 Entries)
  - `mobile/app/(tabs)/planner.tsx` integriert: `useDeferredValue` + `useMemo` im RecipePickerModal (statt Filter-Effect mit Doppel-State), `useMemo`-gestuetztes `entriesByDay` (statt 7-fachem `mealPlan.filter` pro Render), `React.memo` auf `DayColumn`, stabilere `useCallback`-Refs fuer Mutationshandler
  - Backend/Search Follow-up fuer Zutaten-Suche dokumentiert: bei realistischem Datensatz (10–300 Rezepte) ist kein Backend-Refactor gerechtfertigt — Phase 4 Acceptance Criteria erfuellt ueber „dokumentierter Backend-Follow-up"
  - Mobile-Verifikation nach Phase-4 Slice 2: `npm --prefix mobile run typecheck` + `npm --prefix mobile run test:unit` -> `15` Dateien, `83` Tests gruen
- Phase-4b Spinner-zu-Skelett-Refactor umgesetzt (2026-05-09):
  - **Ziel:** struktureller Content-Shell ab erstem React-Frame sichtbar, damit Lighthouse ein LCP-Element fruehzeitig messen kann
  - **Methode (b) Minimal-Refactor** fuer beide Screens:
    - `mobile/app/(tabs)/shopping.tsx`: Vollbild-`ActivityIndicator` entfernt; stattdessen Header mit "Einkaufsliste"-Text + kleiner Spinner im Header + 7 Skeleton-Listenzeilen (`testID="shopping-skeleton"`) ab erstem Frame. Error-Fallback prueft jetzt `!loading` als Bedingung.
    - `mobile/app/recipe/[id].tsx`: Vollbild-`ActivityIndicator` entfernt; stattdessen Header-Shell mit Zurueck-Button + Titelplatzhalter + kleiner Spinner + Skeleton-Inhaltsbereich (`testID="recipe-skeleton"` mit Emoji-Kreis, Titelzeile, Meta-Zeile, 5 Zutatenzeilen)
  - Neue Tests: `mobile/test/shopping-screen-fallbacks.test.tsx` und `mobile/test/recipe-detail-fallbacks.test.tsx` pruefen jeweils: Header-Text und Skeleton-Container sind vor dem ersten API-Response sichtbar
  - Mobile-Verifikation: `npm --prefix mobile run typecheck` + `npm --prefix mobile run test:unit` -> `15` Dateien, `85` Tests gruen
  - **LCP-Befund (lokal gemessen 2026-05-09):**
    - Vorher: `/shopping` 24824 ms, `/recipe/1` 25158 ms, `/` 902 ms (Quelle: `artifacts/performance/lighthouse/summary.json`, Run 2026-05-08)
    - Nachher (neue Build-Hashes, gleiche Lighthouse-Messung): `/shopping` 25162 ms, `/recipe/1` 25415 ms, `/` 904 ms
    - **Erklaerung:** Lighthouse Simulate-Throttling misst den Browser-Paint-Zeitpunkt des LCP-Elements. FCP = 902 ms (statisches Expo-HTML), LCP = 25s weil das LCP-Element (grosser Text/Bild) erst nach React-JS-Hydration gerendert wird. Die ~4.6 MB Entry-Bundle unter 4× CPU-Throttling benoetigt ~25s zum Parsen/Ausfuehren — unabhaengig davon, ob nach Ausfuehrung ein Spinner oder Skelett erscheint. Der Skelett-Refactor verbessert die **wahrgenommene Performance** auf echten Geraeten signifikant (Content ist sichtbar sobald React laeuft, statt erst nach API-Antwort), aendert aber den Lighthouse-Simulate-Wert nicht, weil React selbst erst nach der Bundle-Ausfuehrung rendern kann.
    - **Naechster Schritt fuer Lighthouse-LCP:** Bundle-Splitting / Lazy-Loading der nicht-kritischen Screens (z.B. Cook-Modus, Edit-Modus, PDF-Export nur bei Bedarf laden) wuerde die Entry-Bundle-Groesse reduzieren und damit die JS-Hydration unter Throttling beschleunigen.

Wichtig fuer die aktuelle Einfuehrungsphase:

- `mobile:typecheck` laeuft jetzt auf dem vollen Mobile-Scope.
- Das Release Gate ist stabil und in CI granular sichtbar (Install, Typecheck, Expo-Web-Export, Mobile-Unit-Tests).

Naechste priorisierte Reihenfolge (aktualisiert 2026-05-13):

1. Nightly-Strict-Cron (02:00 UTC) ueber die ersten 1-2 Wochen beobachten; bei stabil gruen `pull_request` strict erwaegen.
2. Bei rotem Nightly-Run zuerst klassifizieren (Budget / Flake / Infrastruktur) — kein Reflex-Rollback der Schedule-Policy.
3. Phase 5 (Optional Web Vitals) bleibt deferred, bis Lighthouse/Bundle/Throttling-Daten eine konkrete Feldmetrik-Frage stellen.
4. Follow-up, nicht Blocker: Migration auf `@testing-library/react-native` bleibt separat offen. Grund ist weiterhin der aktuelle Vitest/RN-Runtime-Blocker; bis dahin bleiben die UI-nahen Tests stabil auf `react-test-renderer`.

## Summary

Dieser Plan operationalisiert die drei neuen Skills `vitest`, `performance` und `react-performance-optimization` fuer das Projekt `rezepti`. Fokus ist nicht das Root-Backend allgemein, sondern die tatsaechlich passende Schnittstelle:

- `vitest` fuer eine saubere zweite Testspur in `mobile/`
- `performance` fuer die Expo-Web-Ausgabe nach `public/`
- `react-performance-optimization` fuer die listen- und screenlastigen React-Native-/Expo-Pfade

Das Ziel ist eine messbare Qualitaetsschicht fuer Frontend und Expo-Web, ohne die bestehende Root-Testspur zu destabilisieren.

## Current Baseline

- Root-Vitest ist bereits aktiv:
  - `package.json` hat `test`, `test:unit`, `test:e2e`, `test:docker`
  - [`vitest.config.ts`](/home/patrick/Projekte/rezepti/vitest.config.ts:1) existiert
  - `mobile/**` ist dort aktuell explizit ausgeschlossen
- Mobile-Stack:
  - Expo Router, React 19.2, React Native 0.83 (Expo SDK 55)
  - React Query mit Persistenz in [`mobile/app/_layout.tsx`](/home/patrick/Projekte/rezepti/mobile/app/_layout.tsx:1)
  - zentrale, renderkritische Screens in:
    - [`mobile/app/(tabs)/index.tsx`](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/index.tsx:1)
    - [`mobile/app/(tabs)/shopping.tsx`](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/shopping.tsx:1)
    - [`mobile/app/recipe/[id].tsx`](/home/patrick/Projekte/rezepti/mobile/app/recipe/[id].tsx:1)
- Expo-Web-Ausgabe:
  - Build geht nach `public/`
  - Root HTML liegt in [`mobile/app/+html.tsx`](/home/patrick/Projekte/rezepti/mobile/app/+html.tsx:1)
  - bisher keine Lighthouse-, Web-Vitals- oder Bundle-Analyse-Pipeline

## Goals

1. Mobile-Tests mit klarer, stabiler Vitest-Konfiguration einfuehren.
2. Einen kleinen, reproduzierbaren Performance-Audit-Workflow fuer Expo Web schaffen.
3. React-Performance nicht pauschal, sondern profiling- und messgetrieben verbessern.
4. Sichtbare Qualitaetschecks in CI und im lokalen Workflow verankern.
5. Doppelte oder driftende Frontend-Logik identifizieren und testbarer machen.

## Non-Goals

- Keine allgemeine Backend-Performance-Initiative in diesem Plan.
- Kein vorzeitiger Umbau aller Screens auf einmal.
- Kein sofortiges Einfuehren komplexer RUM-Infrastruktur mit externer Telemetriepflicht.
- Keine generische Optimierung ohne Messdaten.

## Recommended Rollout

Dieser Rollout ist die verbindliche Umsetzungsreihenfolge. Die drei Skills bleiben wichtig, werden aber als Werkzeuge unter dem Ziel `Core Mobile Workflow Reliability` eingesetzt.

### Phase 1: Release Gate Closure und Shared Contracts

Ziel: PRs duerfen nicht mehr gruen sein, wenn `mobile/` nicht installiert, typisiert, gebaut oder getestet werden kann.

#### Work

- Mobile-Skripte in `mobile/package.json` anlegen: `typecheck`, `test:unit`, `test:watch`, `build:web`.
- Root-Skripte anlegen: `mobile:typecheck`, `mobile:build:web`, `test:mobile`, `mobile:release-gate`.
- `mobile:release-gate` fuehrt aus: `npm --prefix mobile ci`, `npm --prefix mobile run typecheck`, `npm run build:mobile`, `npm --prefix mobile run test:unit`.
- CI um separaten Mobile-Job erweitern, inklusive npm cache fuer `package-lock.json` und `mobile/package-lock.json`.
- `expo-doctor` als eigenen CI-Step in den Mobile-Release-Gate aufnehmen, damit SDK-/Asset-/Config-Drift frueh blockiert.
- Dependency-freie Shared-Domain-Utilities fuer Ingredient-/Category-/Recipe-Normalisierung extrahieren; nicht direkt aus `src/db-react.ts` importieren.
- Erste Contract-Tests fuer `ApiRecipe -> Recipe`, Recipe-Edit-Payloads, Ingredient Groups und Category/Ingredient Matching schreiben.

Status:

- Erledigt: Skripte, CI-Job, granularer CI-Step-Split, `expo-doctor` im CI-Gate, Shared-Domain-Utilities fuer Ingredient/Category und Contract-Tests fuer Mapping, Edit-Payloads und Ingredient-/Category-Logik.
- Kein offener Rest in Phase 1.

#### Acceptance Criteria

- `npm run mobile:release-gate` laeuft lokal und in CI.
- Mobile-Install, Mobile-Typecheck, Expo-Web-Export und Mobile-Vitest sind getrennt sichtbar.
- `expo-doctor` blockiert SDK-/Asset-/Config-Drift im selben Mobile-Gate.
- Recipe-Edit-Payloads bleiben Arrays/Objekte und werden nicht doppelt JSON-kodiert.
- Shared-Domain-Logik kann von Root und Mobile getestet werden, ohne DB- oder Hono-Imports.

### Phase 2: Mobile Vitest fuer Workflow Reliability

Ziel: Mobile-Vitest prueft zuerst datenflussnahe und workflowkritische Pfade, nicht fragile Screen-Snapshots.

#### Work

- `mobile/vitest.config.ts` und `mobile/test/setup.ts` anlegen.
- Mobile-local Dev Dependencies explizit aufnehmen: `vitest`, `@testing-library/react-native`, `jsdom` oder `happy-dom` nach kompatiblem Proof, plus notwendige RN/Expo Mock-Helfer.
- Zentrale Mocks fuer Expo Router, AsyncStorage, Reanimated, Safe Area und native Module in `mobile/test/setup.ts`.
- Shopping- und Recipe-Detail-Mutationslogik in testbare Services oder React-Query-Mutationspfade verschieben.
- Tests fuer Recipe List, Recipe Detail, Shopping und Offline/Cache-States gemaess State Matrix schreiben.
- Screen-Tests erst nach stabilen Service-/Hook-/Contract-Tests einfuehren.

Status:

- Erledigt: Vitest-Config + Setup + zentrale Mocks stehen; Workflow-Tests fuer cache/query/mutation/offline-error-Pfade sind breit ausgebaut; der durchgehende list -> detail -> shopping UI-Workflow-Test steht; State-Matrix fuer Recipe List, Detail, Shopping, Planner und Query-Cache-Recovery ist fuer die geplanten Kernpfade sichtbar abgesichert.
- Kein offener Rest im kritischen Phase-2-Pfad.
- Follow-up ausserhalb des kritischen Pfads: Migration auf `@testing-library/react-native`, sobald der aktuelle Vitest/RN-Transform-Blocker geklaert ist.

#### Acceptance Criteria

- `npm run test:mobile` laeuft stabil und unabhaengig von Root-Vitest.
- Workflow: cached recipe list -> search/filter -> detail -> add ingredients to shopping -> shopping use -> network failure recovery ist abgedeckt.
- Mutation-Fehler werden sichtbar behandelt; keine stillen `catch`-Pfade in core workflow.

### Phase 3: Expo-Web Baseline Hardening

> **Status (2026-05-08):** ABGESCHLOSSEN — Code/CI plus empirische Reife (`ready=true`). Details siehe Implementation Status oben. Der untenstehende Text ist die ursprüngliche Spec.

Ziel: Die Expo-Web-Ausgabe wird reproduzierbar messbar, aber in v1 nur warn-only.

#### Work

- Exakte Skripte definieren: `perf:lighthouse`, `perf:bundle`, `perf:audit`.
- Audit-Topologie festlegen: Expo-Web-Export aus `public/`, lokaler Static Server auf festem Port, API-Server oder Proxy mit seeded Fixture Data.
- Feste Audit-Routen: `/`, `/shopping`, eine Recipe-Detail-Route.
- Viewports: `375x812`, `768x1024`, `1366x768`.
- Reports immer schreiben: `artifacts/performance/lighthouse/*.json`, `artifacts/performance/lighthouse/*.html`, `artifacts/performance/bundle/*.json`, `artifacts/performance/summary.md`.
- CI laedt Performance-Artefakte auch bei Audit-Fehlern hoch; Budgets sind erst warn-only.
- Nach der Foundation: mindestens 10 vollstaendige CI-Messreihen sammeln, Skip-Reasons abbauen und erst dann Budgets schrittweise Richtung blocking bewegen.

Start-Budgets (warn-only, initial):

- LCP (mobile 375x812):
  - `/` <= 3.0s
  - `/shopping` <= 3.2s
  - `/recipe/1` <= 3.4s
- INP (mobile 375x812): <= 250ms
- CLS: <= 0.10
- Gesamtgroesse JS-Bundles (uncompressed): <= 5.2 MB
- Groesstes einzelnes JS-Asset (Entry-Chunk): <= 4.8 MB

Migration warn-only -> blocking:

1. Mindestens 10 aufeinanderfolgende CI-Runs mit vollstaendigen Messungen.
2. p75-Stabilitaet je Metrik/Route innerhalb ±10%.
3. Warnrate <= 10% über 10 Runs, keine dauerhafte P0-Verletzung (`/`, `/shopping`).
4. Zuerst blocking für Bundle-Budgets, danach P0 LCP/INP/CLS, zuletzt P1 (`/recipe/1`).

#### Acceptance Criteria

- `npm run perf:audit` erzeugt Build, Server, Lighthouse-Reports, Bundle-Report und Summary.
- CI zeigt Performance-Artefakte, blockiert aber erst nach spaeter definierter Baseline.
- Audit misst keine leere/fake App, ausser die Route ist explizit als static-only markiert.

### Phase 4: Profiling-getriebene React Performance

> **Status (2026-05-08):** ABGESCHLOSSEN — Slice 1 (`recipe-list-screen-data.ts`) + Slice 2 (`planner-screen-data.ts` + `React.memo` auf `DayColumn` + `useDeferredValue` im Picker) + Backend/Search-Follow-up dokumentiert. Details siehe Implementation Status oben.

Ziel: `react-performance-optimization` wird nur nach Messdaten eingesetzt.

#### Priority Targets

- [`mobile/app/(tabs)/index.tsx`](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/index.tsx:1)
- [`mobile/app/(tabs)/shopping.tsx`](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/shopping.tsx:1)
- [`mobile/app/recipe/[id].tsx`](/home/patrick/Projekte/rezepti/mobile/app/recipe/[id].tsx:1)

#### Work

- 300-1000 Recipe Fixture fuer Such-/Filter-/Listenpfade anlegen.
- Vor jeder Optimierung Profiling/Baseline festhalten.
- Teure Berechnungen aus Renderpfaden ziehen, insbesondere fuzzy Ingredient Matching und abgeleitete Kategorien.
- `FlatList`-Konfiguration, stabile Keys, Component Boundaries und Memoisierung nur bei nachgewiesenem Nutzen anwenden.
- Backend/Search-Follow-up dokumentieren, wenn der Engpass aus `searchRecipesByIngredientsAdvanced` oder API/Image-Latenz kommt.

Status:

- Erledigt: Recipe-List-Derivationen sind in `mobile/utils/recipe-list-screen-data.ts` ausgelagert; `index.tsx` nutzt deferred search / deferred ingredient input, stabilere `FlatList`-Configs und keinen Inline-Match-Work mehr im Zutaten-Such-Modal.
- Erledigt: deterministischer 300-1000-Rezepte-Fixture-Harness steht (`mobile/test/fixtures/recipe-performance-fixture.ts`) und wird gegen einen 600-Rezepte-Datensatz getestet (`mobile/test/recipe-list-screen-data.test.ts`).
- Erledigt: Low-Risk-Hotspots in `shopping.tsx` und `recipe/[id].tsx` reduziert.
- Erledigt: `planner.tsx`-Hotspot bearbeitet: `mobile/utils/planner-screen-data.ts` (pure Utility), `mobile/test/planner-screen-data.test.ts` (12 Tests), Integration mit `useDeferredValue`/`useMemo`/`React.memo`. Mobile-Suite: 83/83 gruen.
- Erledigt: Backend/Search-Follow-up dokumentiert (siehe Sub-Section unten) — bei realistischem Datensatz kein Backend-Refactor gerechtfertigt.

#### Backend/Search Follow-up Analyse (2026-05-07)

**Aktueller Befund:**

- Ingredient-Matching findet auf dem **Server** statt (`src/db-react.ts:133-181`, `searchRecipesByIngredientsAdvanced`): alle Rezepte werden per `db.select().from(recipes)` ohne WHERE-Klausel geladen (`db-react.ts:137`), dann in JS mit `evaluateIngredientSearch` gefiltert — vollstaendiger Table-Scan + In-Memory-Loop.
- `evaluateIngredientSearch` laeuft dabei auch auf dem **Client** nochmals (`mobile/utils/recipe-list-screen-data.ts:102-105`, `buildIngredientResultRows`), um den `matchedCount`-Anzeigewert fuer die UI zu berechnen. Der Client ruft damit dieselbe Fuzzy-Logik ein zweites Mal auf bereits vom Server gefilterteten Treffern auf — redundante Arbeit, aber ausschliesslich auf den zurueckgegebenen Ergebnissen (nicht auf dem Gesamtbestand).
- Der Client debounced Anfragen 300 ms und schickt erst dann einen HTTP-Request (`index.tsx:226-242`); `useDeferredValue` schuetzt nur das Text-Search-Feld (Name/Tag), nicht das Ingredient-Search-Modal. Das Ingredient-Modal loest pro Eingabe-Burst genau einen Network-Round-Trip aus, kein lokales Re-Filter ohne Netz.
- **Realistischer Datensatz:** RecipeDeck ist ein Single-User-Tool fuer 10–300 Rezepte. Bei 300 Rezepten mit je ~10 Zutaten ergeben sich ca. 3 000 String-Vergleiche pro Suchanfrage. Levenshtein laeuft pro Paar in O(m*n); bei kurzen Ingredients (< 30 Zeichen) und wenigen Such-Termen ist das < 1 ms gesamt.

**Empfehlung:**

- **Kein Backend-Follow-up gerechtfertigt.** Bei realistischen 10–300 Rezepten ist der In-Memory-Scan + Levenshtein auf dem Server vernachlaessigbar. Die redundante `evaluateIngredientSearch`-Ausfuehrung auf dem Client (`recipe-list-screen-data.ts:104`) ist kosmetisch — dort wird sie nur auf den bereits gefilterten Treffern aufgerufen.
- Optional (kein Perf-Treiber, nur Code-Hygiene): den `matchedCount`-Wert direkt aus der API-Antwort (`match_scores`) lesen statt erneut clientseitig zu berechnen, um die Logik-Doppelung zu beseitigen.

**Begruendung:**

Der Engpass bei Ingredient-Suche entsteht erst ab mehreren Tausend Rezepten — weit ausserhalb des aktuellen Zielnutzerprofils. Die Phase-4-Acceptance-Criteria (`messbare Verbesserung oder dokumentierter Backend-Follow-up`) gilt damit als erfuellt: kein Backend-Follow-up ist bei aktuellem Scale sinnvoll, mobile Memoization und 300 ms Debounce sind ausreichend.

#### Acceptance Criteria

- Such-, Scroll- oder Listeninteraktionen zeigen messbare Verbesserung oder einen dokumentierten Backend-Follow-up.
- Keine pauschale `useMemo`-/`useCallback`-Streuung ohne Profiling-Beleg.

### Phase 5: Optional Web Vitals

> **Status (2026-05-08):** DEFERRED — Lighthouse/Bundle-Baseline (Phase 3) liefert die noetigen Daten. Web Vitals erst aktivieren, wenn eine konkrete Feldmetrik-Frage entsteht, die Lighthouse nicht beantwortet.

Ziel: Web Vitals nur einfuehren, wenn Lighthouse/Bundle-Daten eine konkrete Feldmetrik-Frage offenlassen.

#### Work

- `web-vitals` nur im Web-Pfad integrieren.
- Zuerst lokal oder Preview logging verwenden.
- Kein API-Endpunkt ohne Payload-Validierung, Sampling, Retention, Rate Limiting und Alert-Entscheidung.

#### Acceptance Criteria

- Web-Vitals-Metriken beantworten eine dokumentierte Frage, die Lighthouse/Bundle nicht beantworten.
- Native-Pfade bleiben unberuehrt.

## Additional Improvements Enabled By The Skills

### 1. Shared frontend logic entkoppeln

In [`mobile/app/(tabs)/index.tsx`](/home/patrick/Projekte/rezepti/mobile/app/(tabs)/index.tsx:1) liegt duplizierte Ingredient- und Category-Logik, die Backend-Helfer spiegelt. Das ist ein guter Kandidat fuer eine kleine shared, framework-neutrale Utility-Schicht.

Nutzen:

- weniger Drift zwischen Root und Mobile
- mehr testbare Fachlogik
- bessere Basis fuer Vitest auf beiden Seiten

### 2. Hook- und API-Vertrag haerten

Mit Mobile-Vitest lassen sich die Vertraege von Query-Hooks, Error-States und API-Adaptern systematisch absichern.

Sinnvolle Kandidaten:

- Query-Key-Stabilitaet
- leere/offline/error states
- Mapping `ApiRecipe -> Recipe`
- server URL resolution je Plattform

### 3. Performance-Budgets in PR-Checks

Sobald Lighthouse und Bundle-Analyse drei stabile Baselines haben, koennen Budgetverletzungen von warn-only auf blocking hochgestuft werden.

### 4. Screen-Refactoring nach Messwerten

Wenn Phase 5 zeigt, dass einzelne Screens zu viel Verantwortung tragen, ist ein strukturierter Zuschnitt in:

- Datenzugriff
- Filter-/Suchlogik
- Listendarstellung
- Card-Komponenten

eine sinnvolle Folgearbeit.

## CI Plan

Empfohlene Trennung in drei Achsen:

1. Root-Testjob: bestehendes `npm ci`, `npx tsc --noEmit`, Root-Vitest und bestehende E2E-Regel.
2. Mobile-Release-Job: separate Steps fuer `npm --prefix mobile ci`, `npm --prefix mobile run typecheck`, `npx expo-doctor`, `npm run build:mobile`, `npm --prefix mobile run test:unit`.
3. Web-Performance-Job: `npm run perf:audit`, warn-only Budgets, Upload von `artifacts/performance/**`.

Der Node-Cache muss beide Lockfiles kennen: `package-lock.json` und `mobile/package-lock.json`.

## Proposed PR Breakdown

### PR 1: CI Gate Completion + Shared Contracts

- `expo-doctor` in den Mobile-Release-Job integrieren
- Shared dependency-free Ingredient-/Category-/Recipe-Utilities vervollstaendigen
- Contract tests fuer Edit Payloads, Ingredient Groups und Category/Ingredient Matching schliessen
- Mobile-Gate wieder als kanonischen Blocker dokumentieren

### PR 2: Workflow Reliability Completion

- Bestehenden list -> detail -> shopping Workflow-Test als Basis behalten
- Offline recovery, shopping use, Retry- und Error-State-Matrix ergaenzen
- Nur noch gezielte Service-/Hook-Haertungen auf kritischen Pfaden vornehmen

### PR 3: Performance Baseline Stabilization

- Vollstaendige warn-only Messreihen stabilisieren
- Skip-Reasons, Artefakt-Qualitaet und nicht-leere Audit-Routen absichern
- Kriterien fuer spaeteres blocking anhand echter Baselines nachziehen

### PR 4: Targeted React Optimization

- Slice 1 geliefert:
  - 300-1000 Recipe Fixture
  - helperbasierte Recipe-List-Derivationen statt Renderpfad-Arbeit
  - low-risk shopping/detail render hotpaths reduziert
- Offen:
  - profiling documentation / follow-up hotspot
  - before/after metrics oder dokumentierter backend/search follow-up

### PR 5: Non-Blocking Test Harness Follow-up / Optional Web Vitals Decision

- Migration auf `@testing-library/react-native` erst nach Runtime-Fix
- only if Lighthouse/bundle leave an unanswered field-metric question
- no ingestion endpoint without validation, sampling, retention, rate limits, and alerting decision

## Risks

- Mobile-Testsetup kann an Expo-/Native-Mocks kleinteilig werden, wenn Scope am Anfang zu gross ist.
- Lighthouse fuer Expo-Web kann noisig werden, wenn die Auslieferung nicht reproduzierbar ist.
- Bundle-Analyse kann Tooling-Aufwand erzeugen, wenn sie zu frueh zu komplex gebaut wird.
- React-Performance-Arbeit ohne Profiling fuehrt schnell zu unnoetiger Komplexitaet.

## Recommended First Slice

Wenn nur ein kleiner, sinnvoller Start gemacht werden soll:

1. `expo-doctor` in das bestehende Mobile-Release-Gate ziehen
2. Shared-Domain-Contracts fuer Recipe/Ingredient/Category absichern
3. Danach nur die noch fehlenden Workflow-State-Matrix-Luecken schliessen

Das liefert den besten Ertrag pro Aufwand und schafft die Grundlage fuer alles Weitere.

## Definition of Done

Dieser Plan gilt als erfolgreich umgesetzt, wenn:

- `npm run mobile:release-gate` lokal und in CI stabil laeuft ✅
- mobile install/typecheck/expo-doctor/export/test als getrennte Fehlerbilder sichtbar sind ✅
- Shared-Domain-Contracts Recipe/Ingredient/Category-Drift verhindern ✅
- Core Workflow Reliability fuer recipe list, detail, shopping und offline/cache states getestet ist ✅
- Expo Web einen reproduzierbaren warn-only Lighthouse-/Bundle-Audit mit Artefakten besitzt ✅
- mindestens ein messgetriebener React-Performance-Durchgang stattgefunden hat oder ein konkreter Backend/Search-Follow-up dokumentiert ist ✅
- `artifacts/performance/readiness.json` zeigt `ready=true` mit allen vier Checks gruen ✅ (Stand 2026-05-08)

**Status:** Alle Definition-of-Done-Kriterien erfuellt.

## Lessons Learned (2026-05-08)

Die volle Liste der wiederverwendbaren Pitfalls/Operationals liegt in [`docs/PROJECT_LEARNINGS.md`](../../PROJECT_LEARNINGS.md) (gepflegt via `/learn`). Hier nur die Phase-3-/4-spezifischen Beobachtungen, weil sie den Plan-Verlauf erklaeren:

**Was unerwartet teuer war:**

- **`bash -c "..."` mit Inline-Newlines:** Im Background-Loop fuer das Phase-3-Seeding wurden Newlines zu Leerzeichen — der gesamte for-Loop-Body parste als eine einzige Pipeline ohne Befehlsseparatoren. Loop lief 10 Stunden ohne irgendetwas zu tun. Fix: Loop-Body in eine separate Script-Datei (`/tmp/foo.sh`) auslagern, dann via `nohup` starten. Plan-Lernfeld: bei langlebigen Background-Tasks niemals mehrzeilige `bash -c`-Inline-Loops verwenden.

- **`expo export` haengt nach erfolgreichem Build:** `npm run build:mobile` druckt `Exported: ../public` und scheint fertig — aber der `sh`/`npm`/`expo`-Wrapper-Stack exited nicht (Metro-Bundler-Worker bleibt aktiv). Mehrere parallele Versuche akkumulieren Zombie-Prozesse, die RAM blockieren und nachfolgende Builds verlangsamen. Fix fuer das Phase-3-Seeding: `build:mobile` einmalig vor dem Loop ausfuehren, im Loop nur `perf:bundle` + `perf:lighthouse` + `perf:validate` aufrufen. Iteration sank dadurch von >25 min auf 111 s, Gesamtdauer von >5 h auf 18,5 min.

- **Lighthouse-API-Mock matcht nur exakte Pfade:** `handleApiMock()` greift fuer `/api/v1/recipes` und `/api/v1/shopping`, faellt aber bei `/api/v1/recipes/1` (parametrisiert) in den `json({})` Catchall. Folge: `/shopping` und `/recipe/1` zeigen LCP ~25 s (Lighthouse-Timeout, weil React-App auf eine sinnvolle Recipe-Struktur wartet), waehrend `/` sauber bei ~902 ms liegt. Phase-3-Mechanik ist davon nicht betroffen (`metricStabilityMet` prueft Spread, nicht Werte), aber als Folgearbeit dokumentiert.

**Was die Mechanik impliziert:**

- **Readiness ≠ Werte gut:** `metricStabilityMet=true` bedeutet "die Werte sind ueber 10 Runs stabil reproduzierbar" — *nicht* "die Werte erfuellen die Budgets". Ein konstant schlechter LCP von 25 s mit Spread 0,3 % erfuellt das Stability-Kriterium und kippt `ready=true`. Das Gate ist die Voraussetzung fuer Strict-Enforcement, nicht der Beweis dafuer, dass die App schnell ist. Budget-Verletzungen werden separat in `validate-status.mjs` als WARN getrackt, fliessen aber nicht in `readiness.warningRate` (die Metrik zaehlt nur Lighthouse-Run-Failures, nicht Budget-Misses).

**Was eingespart wurde:**

- **`build:mobile` aus dem Loop ziehen:** Der statische Web-Export aendert sich zwischen Lighthouse-Iterationen nicht. `perf:audit` baut per Default neu (`npm run build:mobile && npm run perf:bundle && npm run perf:lighthouse`), was im 10er-Loop 10× redundant ist. Lokales Seeden mit nur Bundle+LH+Validate ist um Faktor ~10 schneller. CI macht das anders, weil dort nur ein einziger Run pro Workflow-Lauf passiert — dort ist der Rebuild korrekt.

## GSTACK AUTOPLAN REVIEW

Stand: 2026-05-06

### Intake

- Base branch: `main`
- Plan file: `docs/superpowers/plans/2026-05-06-mobile-testing-and-performance-plan.md`
- Restore point: `/home/patrick/.gstack/projects/dacown87-rezepti/main-autoplan-restore-20260506-091159.md`
- UI scope: yes. The plan touches Mobile screens, interaction states, layout, responsive Expo Web, and user-visible performance.
- DX scope: yes. The plan adds npm scripts, CI jobs, reports, setup steps, and developer-facing test/audit workflows.
- Review mode: `/autoplan` with SELECTIVE EXPANSION, auto-decisions via completeness, blast-radius, DRY, explicitness, and action bias.

### Phase 1: CEO Review

#### Premises Confirmed

The user confirmed these premises as the review basis:

- This is a frontend/mobile quality plan, not a general backend-performance project.
- Root Vitest already exists and intentionally excludes `mobile/**`.
- Mobile needs its own quality gate because `mobile/package.json` has no test/typecheck script today.
- Expo Web performance should be measured from the exported build, not from development server behavior.
- Web Vitals should come after Lighthouse and bundle visibility, not before.
- React optimization must be based on profiling data from real flows.

#### 0A: Premise Challenge

| Premise | Verdict | Finding | Decision |
|---|---|---|---|
| The plan should start from three new skills. | Weak | Both outside voices found this tool-led. It protects engineering artifacts, not yet the product-critical cooking/shopping workflows. | Reframe the plan around "make core mobile cooking and shopping workflows reliable under real-world conditions." |
| Mobile Vitest is the right first implementation slice. | Partial | Valid, but too narrow. CI currently installs only root dependencies and does not typecheck or build `mobile/`. | PR 1 must start with a Mobile Release Gate: `cd mobile && npm ci`, `npx tsc --noEmit`, and Expo Web export, then Mobile Vitest. |
| Expo Web performance deserves a full audit path. | Partial | Valid only if web is a meaningful app surface. It is currently useful for shipped `public/`, but the plan does not prove web is the highest-value channel. | Keep Lighthouse and bundle analysis, demote Web Vitals to optional Phase 4 and tie all budgets to core workflow screens. |
| Duplicated ingredient/category logic can wait until PR 5. | Wrong | The duplication affects search/category correctness and could freeze tests around drifted behavior. | Move shared, framework-neutral domain logic and contract tests into PR 1. |
| Backend performance is out of scope. | Partial | General backend tuning can stay out. But API latency, image delivery, and search correctness are direct dependencies of mobile workflow quality. | Keep broad backend performance out, but include API/search/image bottleneck checks if profiling points there. |

#### 0B: Existing Code Leverage Map

| Sub-problem | Existing code to reuse | CEO assessment |
|---|---|---|
| Root test baseline | `vitest.config.ts`, `test/unit/*`, `.github/workflows/ci.yml` | Good base. Do not merge Mobile tests into root config casually because `mobile/**` is intentionally excluded. |
| Mobile query/offline cache | `mobile/hooks/useRecipes.ts`, `mobile/hooks/useRecipe.ts`, `mobile/utils/query-client.ts` | High leverage. These should be tested before screen-level tests. |
| API contract | `mobile/utils/api.ts`, `src/routes/recipes.ts`, `src/routes/planner.ts` | Needs contract tests for recipe list/detail, shopping, planner, ingredient search, and error payloads. |
| Shared domain logic | `src/db-react.ts` category/search helpers and duplicated helpers in `mobile/app/(tabs)/index.tsx` | Biggest correctness-risk in this plan. Move earlier. |
| Core screens | `mobile/app/(tabs)/index.tsx`, `shopping.tsx`, `planner.tsx`, `extract.tsx`, `recipe/[id].tsx` | Performance/testing should be workflow-based, not screen-name based. |
| Expo Web build | `npm run build:mobile`, Docker `web-builder`, `public/_expo/static/js/web/*` | Good audit target, but build/typecheck gate should come before Lighthouse. |

#### 0C: Dream State Delta

```text
CURRENT
  Root tests are green, but mobile has no dedicated typecheck/test gate.
  Expo Web ships from public/, but performance and bundle size are not measured.
  Core mobile flows depend on duplicated logic and untested cache/error states.

THIS PLAN AFTER REVIEW
  Quality work is anchored to core recipe/cooking/shopping workflows.
  PR 1 creates a mobile release gate plus shared-domain contract tests.
  Lighthouse and bundle analysis measure exported Expo Web only where it matters.
  React optimization is driven by actual slow workflows and constrained data sets.

12-MONTH IDEAL
  RecipeDeck can prove that top flows work under low network, cached data, 300 recipes,
  100 shopping items, photo/QR/PDF flows, and future auth/data isolation.
```

#### 0C-bis: Implementation Alternatives

| Approach | Effort | Risk | Pros | Cons | Decision |
|---|---:|---|---|---|---|
| A. Keep skill-led plan as written | M | Medium | Fast to implement; directly uses the three installed skills. | Risks measuring infrastructure instead of product trust. | Rejected |
| B. Reframe to core workflow reliability, then use the skills as tools | M | Low | Protects user-visible flows and still delivers Mobile Vitest, Lighthouse, and React profiling. | Requires rewriting PR order and acceptance criteria. | Accepted |
| C. Pause this plan until Multi-User/Auth is implemented | L | Medium | Aligns with next strategic phase in TODO. | Delays immediate mobile quality and audit gains. | Deferred |

#### 0D: Scope Decisions

| Item | Decision | Rationale |
|---|---|---|
| Add Mobile Release Gate before Mobile Vitest | Add to scope | In blast radius, prevents tests from masking broken mobile builds. |
| Move shared domain logic cleanup into PR 1 | Add to scope | DRY and correctness issue in direct plan scope. |
| Add core workflow QA matrix | Add to scope | Testing must protect add/edit/search/shop/plan/export/offline workflows. |
| Keep Web Vitals | Defer behind Lighthouse and bundle analysis | Useful only after Lab metrics and channel value are known. |
| Add Multi-User/Auth implementation | Not in scope | Strategic concern, but too large and already tracked as next major phase. |
| Add import/export format work | Not in scope | Competitive opportunity, but outside this quality plan. |

#### 0E: Temporal Interrogation

| Time | Expected problem | Plan adjustment |
|---|---|---|
| Hour 1 | Mobile test setup may fail on Expo/native module resolution. | Start with typecheck/export gate and pure utility/contract tests before component tests. |
| Hour 6 | Screen smoke tests may require brittle mocks. | Prefer hook/API/shared-domain tests first; add screen tests only for stable flows. |
| Day 2 | Lighthouse may produce noisy results. | Pin exported build, local static server, fixed routes, and budget warnings before blocking CI. |
| Week 2 | Team may have reports but not better product reliability. | Definition of Done must include workflow reliability outcomes, not only artifacts. |
| Month 6 | Perf gates could feel irrelevant if auth/data isolation or mobile capture still fails. | Record Auth/RLS and import reliability as explicit deferred strategic work. |

#### Dual Voices

CEO dual voices ran:

- Claude subagent: completed, 6 findings.
- Codex CLI: completed, 10 findings.

##### CEO Dual Voices Consensus Table

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Premises valid? | Partial | Partial | DISAGREE with current framing |
| Right problem to solve? | No, too skill-led | No, too tool-led | CONFIRMED issue |
| Scope calibration correct? | Needs release gate + device QA | Web scope may be too heavy | CONFIRMED issue |
| Alternatives explored? | Missing mobile release gate/device QA | Missing core workflow reliability framing | CONFIRMED issue |
| Competitive/product risks covered? | Underweights auth/import trust | Underweights workflow/data trust | CONFIRMED issue |
| 6-month trajectory sound? | Risk of perf reports before private user trust | Risk of mature process around wrong surface | CONFIRMED concern |

#### CEO Review Sections

1. Architecture: Examined the plan, `mobile` hooks, API helpers, query client, CI, duplicated logic, and Expo build path. The plan needs one extra layer: `Core Workflow Reliability` should drive Mobile Vitest, Lighthouse, and React profiling rather than each tool acting independently.
2. Error & Rescue Map: The plan names error states but does not specify rescue behavior for offline cache corruption, API failures, Lighthouse server startup failure, native module mock failures, or Expo export failure. Add named failure handling to the implementation plan.
3. Security & Threat Model: No new production auth surface is introduced. The strategic risk is existing global data and stub auth, which stays out of scope but must remain a deferred item because performance/audit work does not reduce privacy risk.
4. Data Flow & Interaction Edge Cases: Core mobile flows depend on API helpers, React Query persistence, AsyncStorage, server URL override, and duplicated domain logic. The plan should map tests by workflow and data flow instead of by file names only.
5. Code Quality: Shared ingredient/category helpers are a current DRY violation and should move before screen tests.
6. Test Review: Current plan under-specifies Mobile typecheck/export and native workflow QA. Add a workflow test diagram in Engineering Review.
7. Performance: Good principle of profiling before optimization. Needs concrete data sets and user situations: cold start, 300 recipes, 100 shopping items, spotty network, low-end Android/Web.
8. Observability & Debuggability: Reports are planned, but no failure-reporting standard exists for audit artifacts. Add stable artifact paths and summary output.
9. Deployment & Rollout: CI proposal is sound, but Mobile CI must install `mobile` dependencies before typecheck/export/test.
10. Long-Term Trajectory: Reversibility 4/5 if Web Vitals remains optional. Risk grows if CI becomes noisy and blocks unrelated backend work.
11. Design & UX: UI scope exists. Needs Design Review for loading/empty/error/offline/performance states.

#### Error & Rescue Registry

| Error path | Trigger | Current plan handling | Gap | Required rescue |
|---|---|---|---|---|
| Mobile native module unavailable in Vitest | Expo/React Native imports fail under test runner | Generic "Mocks" | Yes | Central mock policy in `mobile/test/setup.ts`; start with pure utilities before screen tests. |
| Mobile build fails | Type error, Expo export error, missing dependency | Not first-class | Yes | PR 1 release gate: mobile install, typecheck, Expo export. |
| Cached query data corrupt/stale | AsyncStorage contains invalid persisted cache | Error states mentioned | Yes | Test cache/error fallback and visible retry path. |
| Ingredient/category logic drift | Backend and mobile helper behavior diverge | PR 5 cleanup | Yes | Move shared utility/contracts into PR 1. |
| Lighthouse server/audit flakes | Port conflict, slow local server, variable timings | "local server" | Yes | Fixed static server command, retry once, artifact output even on failure. |
| Bundle analysis noisy | Tool reports non-actionable size diff | Report planned | Medium | Establish baseline first; warn-only before blocking CI. |

#### Failure Modes Registry

| Failure mode | Severity | Likelihood | Plan fix |
|---|---|---:|---|
| Tests pass but mobile build is broken | High | Medium | Add Mobile Release Gate before test-only work. |
| Tests lock in duplicated wrong domain behavior | High | Medium | Shared domain logic and contract tests move to PR 1. |
| CI fails on noisy Lighthouse data | Medium | Medium | Lighthouse starts as report/warn-only, then budgets harden after baseline. |
| Performance improves on web but mobile cooking flow remains slow | Medium | Medium | Profiling must use core workflow scenarios and constrained data sets. |
| Web Vitals adds noise without decisions | Low | Medium | Defer Web Vitals until Lighthouse/bundle findings justify it. |
| Auth/privacy risk remains unaddressed | High | Known | Explicitly defer to Multi-User phase, do not imply this plan solves user trust. |

#### CEO Completion Summary

| Area | Result |
|---|---|
| Mode | SELECTIVE EXPANSION |
| Major finding | Plan must be outcome-led: core mobile cooking/shopping workflow reliability |
| Auto-decisions | Add Mobile Release Gate, move shared logic to PR 1, add workflow QA matrix, defer Web Vitals |
| User challenge | Reframe the plan away from skill-led structure |
| Critical gaps | 3: mobile build gate, shared domain drift, workflow-based acceptance criteria |
| Not in scope | Auth/RLS implementation, import/export format expansion, broad backend performance |
| What already exists | Root Vitest/CI, mobile query hooks, API helpers, Expo Web build path, duplicated helper logic |

### NOT in scope

- Multi-User/Auth/RLS implementation. It remains the next major phase and a strategic concern, but this plan should not absorb it.
- New import/export formats such as Paprika, Nextcloud Cookbook, Cooklang, CSV, or Markdown.
- Broad backend performance work. Only API/search/image bottlenecks discovered by mobile workflow profiling should enter this plan.
- Full RUM telemetry. Web Vitals remains optional and should not become a hard dependency for PR 1-3.

### What already exists

- Root Vitest setup and CI with Postgres service.
- `mobile` Expo app with React Query persistence and API helper layer.
- Expo Web export to `public/` via `npm run build:mobile`.
- Docker `web-builder` stage and production static serving path.
- Backend route/unit tests for many recipe, shopping, planner, extraction, and PDF helpers.
- Nullable `user_id` schema stubs and `src/auth.ts`, but no active auth boundary yet.

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Reframe plan around core mobile cooking/shopping workflow reliability | User Challenge | P1/P2 | Both voices agree the current plan is tool-led and risks protecting the wrong outcome. | Keep skill-led framing |
| 2 | CEO | Add Mobile Release Gate before Mobile Vitest | Mechanical | P1/P5 | Typecheck/export failures are higher-order than tests and are in direct blast radius. | Start with Vitest only |
| 3 | CEO | Move shared domain logic cleanup to PR 1 | Mechanical | P4 | Duplicated ingredient/category behavior is a correctness risk, not late cleanup. | Keep as PR 5 |
| 4 | CEO | Defer Web Vitals until after Lighthouse/bundle baseline | Mechanical | P3/P5 | Web Vitals has no clear decision path yet. | Implement Web Vitals in Phase 4 unconditionally |
| 5 | CEO | Keep Auth/RLS out of this plan but mark it as strategic deferred work | Taste | P3 | It is important but too large for this quality plan. | Add Auth/RLS implementation here |
| 6 | Design | Add screen state matrix before UI/component tests | Mechanical | P1/P5 | Both design voices found loading/empty/offline/error/slow states underspecified. | Keep "error states" as generic test candidates |
| 7 | Design | Replace screen-list targets with workflow QA matrix | Mechanical | P1 | User reliability depends on complete cooking/shopping journeys, not isolated screen names. | Test only hooks/utilities/smoke screens |
| 8 | Design | Make Web Vitals optional, not a main rollout phase | Mechanical | P3/P5 | Lighthouse/bundle baseline must first produce a decision Web Vitals can answer. | Keep Web Vitals as required Phase 4 |
| 9 | Eng | Rewrite the executable rollout, not only append review notes | Mechanical | P1/P5 | The current document has conflicting rollout orders; the implementer needs one authoritative sequence. | Leave original PR order intact |
| 10 | Eng | PR 1 must add mobile install/typecheck/export/test scripts and CI gate | Mechanical | P1/P5 | Current CI never installs mobile deps or proves Expo export works. | Add Vitest config only |
| 11 | Eng | Extract dependency-free shared domain logic before mobile tests rely on it | Mechanical | P4 | Backend helpers live behind DB imports, so mobile cannot import them safely as-is. | Import from `src/db-react.ts` directly |
| 12 | Eng | Add recipe edit payload contract tests before UI smoke tests | Mechanical | P1 | Mobile currently sends JSON-stringified arrays into an API layer that stringifies values again. | Only test `useRecipe` happy path |
| 13 | Eng | Move shopping/detail mutation logic into testable service or React Query layer | Mechanical | P1/P5 | Core workflow failures are now hidden inside screen-local fetch code and silent catches. | Keep screen-local fetches untested |
| 14 | Eng | Keep Lighthouse/bundle budgets warn-only until audit topology is reproducible | Mechanical | P3 | Static Expo Web export can measure a fake app without backend/proxy/fixture data. | Fail CI on first audit |
| 15 | Eng | Do not add a Web Vitals endpoint without validation, sampling, and rate limits | Mechanical | P3/P5 | RUM ingestion has operational/security surface area not justified by this phase. | Add unbounded metrics collection |
| 16 | DX | Use mobile-local scripts with root wrappers | Mechanical | P5 | Developers need commands that work from either repo root or `mobile/` without guessing. | Rely on ad hoc `cd mobile` commands |
| 17 | DX | Add exact performance artifact paths and upload rules | Mechanical | P5 | Reports must be findable in local runs and CI failures. | Use "e.g. artifacts/performance" |
| 18 | DX | Document first-run commands and warn-only interpretation | Mechanical | P5 | The current README pattern can mislead because root `build:mobile` does not run from `mobile/`. | Leave setup implicit |

### Phase 2: Design Review

#### Design Scope Assessment

- Completeness before review: 5/10. The plan names the right surfaces but does not yet define the user states or workflow outcomes those surfaces must support.
- Existing UI patterns inspected: recipe list, recipe detail, shopping, planner, extraction, `OfflineBanner`, React Query persistence.
- DESIGN.md equivalent found only as older project design context. No current design-system doc governs this plan.
- Focus areas: information hierarchy, interaction state coverage, offline policy, responsive Expo Web scope, accessibility, and slow-network behavior.

#### Design Dual Voices

Design dual voices ran:

- Claude subagent: completed, 8 findings.
- Codex CLI: completed, 1 verdict with detailed Direct Answers and workflow matrix recommendation.

##### Design Litmus Scorecard

| Dimension | Claude | Codex | Consensus |
|---|---|---|---|
| Information hierarchy user-first? | No, tool-first | No, developer-first | CONFIRMED issue |
| Interaction states specified? | No, named but not designed | No, left to implementer | CONFIRMED issue |
| User journey protected? | No, trust under stress missing | No, cooking/shopping outcome missing | CONFIRMED issue |
| Responsive strategy intentional? | Under-specified | Under-specified | CONFIRMED issue |
| Accessibility requirements present? | Sparse | Absent | CONFIRMED issue |
| UI specificity sufficient? | No | No | CONFIRMED issue |
| Offline policy decided? | No | No | CONFIRMED issue |

#### Pass 1: Information Architecture

Score: 4/10 -> 8/10 after required fixes.

The original plan hierarchy serves the implementer: skills, test config, Lighthouse, bundle analysis, Web Vitals. The user hierarchy should start with the core RecipeDeck journey:

```text
Find recipe -> open recipe while cooking -> add ingredients to shopping ->
use shopping list in store -> recover from offline/slow network -> resume cached data
```

Required fix: rewrite the rollout headings around `Core Workflow Reliability`, with `vitest`, Lighthouse, bundle analysis, and React profiling as tools underneath.

#### Pass 2: Interaction State Coverage

Score: 3/10 -> 8/10 after required fixes.

The plan must add a state matrix before implementation:

| Surface | Required states |
|---|---|
| Recipe list | loading, first-time empty, search-empty, category-empty, stale cached data, offline with cached data, offline without cache, image failure, slow refresh |
| Recipe detail | loading, missing recipe, partial recipe JSON, offline cached detail, mutation pending, mutation failed, PDF/share failed, destructive action confirmation |
| Shopping | empty with manual-add affordance, add pending, add failed, toggle pending, offline policy, long list, clear checked undo/retry |
| Planner | week loading, empty week, add/remove pending, QR import success/failure, shopping aggregation failure |
| Extract/photo | selecting, compressing, upload pending, job polling, timeout, extraction failed, image selection fallback |
| Expo Web | exported `/`, core tabs, recipe detail, 375px mobile web, desktop width, keyboard/focus states |

#### Pass 3: User Journey & Emotional Arc

Score: 4/10 -> 8/10 after required fixes.

The plan must protect trust under stress: cooking, shopping, low network, stale cache, and mid-task failures. Acceptance criteria should prove the user can finish the task, not only that a test command or report exists.

Required storyboard:

```text
Open app -> see cached recipes quickly -> search recipe -> open detail ->
start cooking/use ingredients -> add shopping items -> use list in store ->
network drops -> cached data remains usable -> failed actions show retry/undo.
```

#### Pass 4: AI Slop Risk

Score: 6/10 -> 8/10 after required fixes.

No mockups were generated because this is a plan review, not a new visual design. The risk is generic QA language: "screen smoke test", "realistic budgets", "visible reports", "measurable improvement". Replace those with concrete scenario names, data volumes, routes, and visible UI outcomes.

#### Pass 5: Design System Alignment

Score: 6/10 -> 7/10 after required fixes.

The current app uses warm colors, rounded cards, icon buttons, and NativeWind. The plan does not require a visual redesign, so design-system risk is limited. It must still specify that any new states reuse current patterns: `OfflineBanner`, existing primary color, existing card/list structure, and current Expo Router navigation.

#### Pass 6: Responsive & Accessibility

Score: 2/10 -> 7/10 after required fixes.

Required accessibility and responsive defaults:

- Touch targets: at least 44px for checkboxes, icon buttons, destructive actions, and modal controls.
- Expo Web keyboard: search, modal close, retry, and primary actions must be reachable by keyboard.
- Screen reader labels: icon-only actions need labels.
- Reduced motion: audits must not require animation.
- Responsive audit viewports: 375x812, 768x1024, 1366x768.
- Text must not be clipped in German copy for empty/error/offline states.

#### Pass 7: Unresolved Design Decisions

| Decision | Recommendation | Classification |
|---|---|---|
| Offline policy for mutations | Read cached data offline; do not queue destructive edits in this plan; failed mutations show retry/undo where safe. | Taste |
| Recipe detail hierarchy | Keep this plan focused on states/tests, but record detail hierarchy as follow-up if profiling or QA shows cooking flow friction. | Taste |
| Web as channel | Audit exported web because it ships, but keep budgets warn-only until web value is established. | Mechanical |

#### Design Completion Summary

| Pass | Result |
|---|---|
| Step 0 | 5/10 initial completeness; UI scope confirmed |
| Pass 1 Info Arch | 4/10 -> 8/10 after workflow-first reframing |
| Pass 2 States | 3/10 -> 8/10 after state matrix requirement |
| Pass 3 Journey | 4/10 -> 8/10 after stress-storyboard requirement |
| Pass 4 AI Slop | 6/10 -> 8/10 after concrete scenarios |
| Pass 5 Design System | 6/10 -> 7/10 using existing patterns |
| Pass 6 Responsive/A11y | 2/10 -> 7/10 after explicit defaults |
| Pass 7 Decisions | 3 unresolved, 2 taste decisions |

### Phase 3: Engineering Review

#### Engineering Scope Assessment

- Completeness before review: 5/10. The plan selected useful tools but did not yet provide one executable architecture, CI gate, or workflow-level acceptance criteria.
- Main architectural risk: mobile reliability is split across React Query hooks, screen-local fetch code, duplicated matching logic, and backend-only helpers with DB imports.
- Required rewrite: the rollout must be workflow-first and make `Mobile Release Gate + Shared Domain Contracts` the first PR, before broad Vitest or Lighthouse work.

#### Engineering Dual Voices

Engineering dual voices ran:

- Claude subagent: completed, 8 findings.
- Codex CLI: completed, 8 findings.

##### Engineering Consensus Table

| Question | Verdict | Required correction |
|---|---|---|
| Is the architecture sound? | Partial | Define one mobile quality architecture around shared domain utilities, API contracts, React Query/cache ownership, and workflow tests. |
| Is the rollout executable? | No | Rewrite the top-level PR sequence and Definition of Done; do not leave review notes as an appendix only. |
| Is CI sufficient? | No | Add mobile dependency install, typecheck, Expo Web export, and mobile test commands. |
| Are contract risks covered? | No | Test recipe edit payload shape, `ApiRecipe -> Recipe` normalization, and ingredient/category matching drift. |
| Are core workflow failures covered? | No | Extract/test shopping and recipe-detail mutations, failed responses, rollback/retry, and cache behavior. |
| Are performance risks addressed? | Partial | Add a 300-1000 recipe fixture and keep Lighthouse/bundle budgets warn-only initially. |
| Are security/ops risks covered? | Partial | Defer Auth/RLS explicitly and avoid Web Vitals ingestion unless validation, sampling, retention, and rate limiting are specified. |

#### Target Architecture

```text
GitHub CI
  -> root npm ci + root typecheck + root Vitest
  -> mobile npm ci
  -> mobile typecheck
  -> Expo Web export
  -> mobile Vitest
  -> warn-only Expo Web Lighthouse/bundle artifacts

Core mobile workflow matrix
  -> shared dependency-free domain utilities
  -> API contract normalizers
  -> React Query/cache-owned reads and mutations
  -> recipe list/detail/shopping/planner screen states

Performance audit
  -> seeded fixture data
  -> static Expo export + API server/proxy
  -> Lighthouse mobile/desktop
  -> bundle report
  -> optional Web Vitals only after a concrete decision need exists
```

#### Required Test Map

| Area | Required tests/scenarios |
|---|---|
| Mobile release gate | `cd mobile && npm ci`, `npm run typecheck`, `npm run build:web` or root `npm run build:mobile`, `npm run test:unit`. |
| Shared domain contracts | Ingredient/category matching, fuzzy matching, `ApiRecipe -> Recipe`, recipe edit payload normalization, ingredient group flattening. |
| Recipe workflow | Cached list opens, search/category filters work, detail opens, missing/404 detail is visible, edit/save/delete failures show recovery. |
| Shopping workflow | Add/toggle/delete/clear success and `500`/partial failure cases; add ingredients uses bounded concurrency or batch behavior; failed actions surface retry/undo where safe. |
| Offline/cache | Cached recipe list/detail remains readable offline; failed mutations are not silently queued unless explicitly implemented; corrupt AsyncStorage cache recovers. |
| Search/performance | 300-1000 recipe fixture proves ingredient search and client-side fuzzy matching stay below agreed local thresholds or produce a documented backend follow-up. |
| Expo Web audit | Exported `/`, `/shopping`, and one recipe-detail route at `375x812`, `768x1024`, `1366x768`; Lighthouse and bundle outputs are stored as CI artifacts, warn-only in v1. |

#### Failure Modes To Design Out

| Failure | Plan correction |
|---|---|
| Tests pass while mobile cannot build | Mobile CI gate blocks before merge. |
| Shared logic drifts again | Dependency-free shared module with root and mobile contract tests. |
| Recipe edit corrupts JSON fields | Payload normalizer tests assert arrays/objects, not pre-stringified values. |
| Shopping list diverges after failed network call | Mutations return checked errors and update UI/cache only through one tested service path. |
| Offline policy becomes accidental | Reads can use stale cached data; destructive/offline mutations are not queued in this plan. |
| Lighthouse measures empty/fake app | Audit topology includes backend/proxy and fixture data, or explicitly marks no-data routes as static-only checks. |
| RUM endpoint becomes noisy/security-sensitive | Web Vitals ingestion is deferred until validation, sampling, rate limits, retention, and alert decisions exist. |

#### Engineering Completion Summary

| Pass | Result |
|---|---|
| Architecture | 5/10 -> 8/10 after shared domain and workflow-service boundary |
| CI/release gate | 3/10 -> 8/10 after mobile install/typecheck/export/test gate |
| Test strategy | 4/10 -> 8/10 after contract, workflow, state, cache, and perf fixture coverage |
| Performance | 5/10 -> 7/10 with warn-only Lighthouse/bundle and search-scale fixture |
| Ops/security | 4/10 -> 7/10 after Auth/RLS deferral and Web Vitals endpoint guardrails |

### Phase 3.5: Developer Experience Review

#### DX Scope Assessment

- Completeness before review: 5/10. The plan had good intentions but still left command ownership, CI cache paths, artifact names, and first-run flow open.
- Developer persona: an engineer implementing PR 1 from a clean checkout and a reviewer diagnosing CI failures without local context.
- DX risk: a correct architectural plan can still fail if commands are not copy-pasteable and artifacts are not deterministic.

#### DX Dual Voices

DX dual voices ran:

- Claude subagent: completed, 7 findings.
- Codex CLI: completed, 5 findings.

##### DX Corrections

| Area | Decision |
|---|---|
| Script ownership | Mobile owns `typecheck`, `test:unit`, `test:watch`, `build:web`; root owns wrappers `mobile:typecheck`, `mobile:build:web`, `test:mobile`, `mobile:release-gate`. |
| CI cache | `actions/setup-node` uses `cache-dependency-path` with both `package-lock.json` and `mobile/package-lock.json`. |
| Mobile test deps | Prefer mobile-local devDependencies so `cd mobile && npm run test:unit` is self-contained. |
| Performance commands | `perf:lighthouse`, `perf:bundle`, and `perf:audit` are root scripts because they coordinate root server, `public/`, and artifacts. |
| Artifact paths | Use `artifacts/performance/lighthouse/*.json`, `artifacts/performance/lighthouse/*.html`, `artifacts/performance/bundle/*.json`, and `artifacts/performance/summary.md`. |
| Upload policy | CI uploads `artifacts/performance/**` even on failure; v1 audit is warn-only. |
| First-run docs | Document root `npm ci`, `npm --prefix mobile ci`, `npm run mobile:release-gate`, `npm run perf:audit`, report locations, and how to read warn-only results. |

#### Developer Journey

```text
Clean checkout
  -> npm ci
  -> npm --prefix mobile ci
  -> npm run mobile:release-gate
  -> npm run perf:audit
  -> inspect artifacts/performance/summary.md
  -> open CI job with separated root/mobile/perf failures
```

#### DX Completion Summary

| Pass | Result |
|---|---|
| Command clarity | 4/10 -> 8/10 after root/mobile script ownership |
| CI diagnosability | 4/10 -> 8/10 after separate mobile job and dual lockfile cache |
| Audit usability | 5/10 -> 8/10 after exact artifacts and warn-only rules |
| First-run docs | 3/10 -> 8/10 after copy-paste flow |

## Code Review — Branch `feat/mobile-release-gate-and-perf-foundation` (2026-05-07)

### Scope Check

```
Scope Check: CLEAN (mit Cleanup-Overhead)
Intent: Mobile Release Gate + CI + Shared Contracts + Performance Foundation
Plan: docs/superpowers/plans/2026-05-06-mobile-testing-and-performance-plan.md
Delivered: Phase 1 vollständig, Phase 2 vollständig, Phase 3 Härtung im Code/CI-Setup
Plan items: Phase 1 DONE, Phase 2 DONE, Phase 3 CODE/CI DONE, EMPIRICAL READINESS PENDING, Phase 4/5 NOT DONE
```

Der zweite Commit (`chore: Cleanup-PR Punkte 3–9, 12`) bringt Backend-Änderungen in `src/` und `test/` mit, die nicht explizit im Plan stehen. Diese sind legitimer Cleanup-Overhead und kein Scope Creep — aber sie erhöhen den Diff-Radius erheblich.

### Plan Completion Audit

| Item | Status | Nachweis |
|------|--------|----------|
| Mobile-Skripte `typecheck`, `test:unit`, `build:web` | DONE | `mobile/package.json` |
| Root-Wrapper `mobile:typecheck`, `mobile:release-gate` | DONE | `package.json` |
| CI Mobile-Release-Gate-Job | DONE | `.github/workflows/ci.yml` |
| `expo-doctor` im CI-Gate | DONE | `ci.yml:139` |
| Shared Domain Utilities (Ingredient/Category) | DONE | `mobile/utils/ingredient-category-domain.ts` |
| Contract-Tests (ApiRecipe→Recipe, Edit-Payloads) | DONE | `mobile/test/recipe-mapper.test.ts`, `recipe-edit-payload-contract.test.ts`, `ingredient-category-domain.test.ts` |
| Vitest-Config + Setup + Mocks | DONE | `mobile/vitest.config.ts`, `mobile/test/setup.ts` |
| Workflow-Tests (list→detail→shopping) | DONE | `mobile-workflow-list-detail-shopping-ui.test.tsx` |
| Shopping-/Detail-Mutations in Service-Layer verschieben | DONE | `mobile/utils/shopping-service.ts`, `mobile/app/recipe/[id].tsx`, `mobile/app/(tabs)/planner.tsx` |
| State-Matrix (offline recovery, retry, shopping use) | DONE | `recipe-list-screen-fallbacks`, `recipe-detail-fallbacks`, `shopping-screen-fallbacks`, `planner-screen-fallbacks`, `query-client-integration`, `mobile-workflow-shopping-recovery` |
| Migration auf `@testing-library/react-native` | NOT DONE | Absichtlich verschoben (Runtime-Blocker) |
| `perf:bundle`, `perf:lighthouse`, `perf:audit` Skripte | DONE | `package.json` |
| Performance CI-Job mit Artefakt-Upload | DONE | `.github/workflows/ci.yml` |
| Echter Lighthouse-Run in CI | DONE | `.github/workflows/ci.yml`, `browser-actions/setup-chrome@v1` |
| Performance-History + Readiness | DONE | `scripts/performance/validate-status.mjs`, `artifacts/performance/history.json`, `artifacts/performance/readiness.json` |

### Findings (keine Code-Änderungen — für nächste PRs)

#### RESOLVED — Bounded concurrency in `addIngredients`

**`mobile/utils/shopping-service.ts`**

Der fruehere unbounded `Promise.all()`-Pfad ist nicht mehr aktiv. `addIngredients` liegt jetzt in einem testbaren Service und nutzt bounded concurrency, abgesichert durch `mobile/test/mobile-workflow-shopping-recovery.test.ts`.

Status: erledigt in Phase 2; kein offenes Acceptance-Criterion mehr.

#### RESOLVED — `canonicalName` ohne Length-Limit

**`src/routes/planner.ts` — POST /api/v1/shopping**

`canonicalName` hat ein Length-Limit von 500 Zeichen implementiert (Zeile 53–55). Validierung prüft `canonicalName.length > 500` und gibt 400-Fehler zurück.

Status: erledigt am 2026-05-07; siehe `src/routes/planner.ts:53–55`.

#### RESOLVED — Business Logic aus Screen-File extrahiert

**`mobile/utils/shopping-service.ts` → `mobile/app/recipe/[id].tsx`, `mobile/app/(tabs)/planner.tsx`**

`addIngredients` wird nicht mehr aus einem Screen-File exportiert. Die Logik liegt jetzt in `mobile/utils/shopping-service.ts` und wird von Recipe Detail und Planner als Service konsumiert.

Status: erledigt in Phase 2.

#### RESOLVED — Coverage-Schwellenwert effektiv 1%

**`vitest.config.ts` + `mobile/vitest.config.ts`**

Status: erledigt am 2026-05-13. Per-Metrik-Floors via `COVERAGE_BASELINES`-Objekt, optionaler `COVERAGE_RATCHET_MIN`-Env-Override raises über alle Metriken. Floor-Formel: `floor(measured * 0.8 / 5) * 5`.

- Root-Floors: `lines=30`, `statements=30`, `functions=30`, `branches=60`
- Mobile-Floors: `lines=30`, `statements=30`, `functions=35`, `branches=55`
- Gemessene Coverage am 2026-05-13: Root `lines/statements 38.14% / functions 39.62% / branches 78.33%`; Mobile `lines/statements 37.52% / functions 47.84% / branches 70.94%`.
- Nächster Ratchet-Schritt bleibt manuell über `COVERAGE_RATCHET_MIN`-Env oder Baseline-Anhebung in den Config-Files.

#### RESOLVED — Chrome im `performance-audit` CI-Job

**`.github/workflows/ci.yml` — Job `performance-audit`**

Chrome/Chromium wird im `performance-audit`-Job jetzt deterministisch bereitgestellt. Damit haengt der Lighthouse-Run nicht mehr vom Runner-Zustand ab.

Status: erledigt in Phase 3 ueber `browser-actions/setup-chrome@v1`.

#### RESOLVED — `^`-Constraints für React/RN in Expo SDK 55

**`mobile/package.json`**

`"react": "^19.2.0"` und `"react-native": "^0.83.6"` verwenden Caret statt exakter Versionen. Expo empfiehlt exakte Pinning für react/react-native. `expo-doctor` läuft aktuell durch (18/18), aber beim nächsten `npm install` nach einem React-Patch könnte Doctor schlagen.

Fix: Vor dem Merge prüfen, ob Expo SDK 55 exakte Versionen fordert, und ggf. auf `"react": "19.2.0"` (ohne `^`) wechseln.

Status: erledigt am 2026-05-13; `react`, `react-dom`, `react-native`, `react-native-svg` (dependencies) sowie `react-test-renderer` (devDependencies) auf exakte Versionen gepinnt, expo-doctor weiterhin grün (18/18).

#### RESOLVED — E2E ohne `continue-on-error`

**`.github/workflows/ci.yml` — Job `e2e`**

Status: erledigt am 2026-05-13 durch Empirie — E2E-Job ist seit dem Cleanup beweislich stabil.

- 30/30 E2E-Runs in den letzten 30 CI-Runs erfolgreich (Stand 2026-05-13, Window: 2026-05-04 bis 2026-05-13).
- Die 5 Failures in den letzten 30 Runs verteilten sich auf `test` (4×, Unit-Tests) und `performance-audit` (1×) — keine E2E-Failure.
- Damit ist der ursprüngliche Plan ("Beobachtung wird zeigen, ob der Schritt hält") erfüllt: er hält. Kein `continue-on-error` einführen.

### Ship-Readiness

| Gate | Status |
|------|--------|
| Phase 1 vollständig | ✅ |
| Phase 2 vollständig | ✅ |
| `expo-doctor` im CI | ✅ |
| Coverage-Gating aktiv | ✅ (Schwellenwert zu niedrig — P3) |
| `addIngredients` bounded + im Service | ✅ |
| Chrome für Lighthouse in CI | ✅ |
| History-/Readiness-Mechanismus | ✅ |
| Planner-/Shopping-State-Matrix Kernpfade | ✅ |

**Fazit (aktualisiert 2026-05-12, nach Strict-Probe-Run):** Phase 1, 2, 3, 4 und 4c sind abgeschlossen. Phase 3 war empirisch fuer die Foundation erledigt — `artifacts/performance/readiness.json` zeigte am 2026-05-08 `ready=true` mit allen vier Checks gruen, basierend auf 10 lokal geseedeten Lighthouse-Runs (Spread <2% pro Route). Nach dem Phase-4b-/Phase-4c-Befund zaehlt fuer Budget-Hardening jetzt die neue methodenmarkierte Messbasis. Der Strict-Hardening-Seed vom 2026-05-12 lieferte 10 vollstaendige `simulate/mobile-375x812`-Runs und eine geschaerfte `baseline.json`. Danach wurden 5/5 aufeinanderfolgende gruene Warn-Mode-CI-Runs erreicht und der erste manuelle Strict-Probe-Run (`workflow_dispatch`, Run `25742783313`) ist gruen abgeschlossen. Aktive Arbeit ist jetzt PR-Aufraeumarbeit (vier leere Trigger-Commits squashen) und die separate Entscheidung, ob `strict` ueber den Manual-Dispatch hinaus ausgeweitet wird. Phase 5 (Optional Web Vitals) bleibt deferred. Verschoben: Test-Infra-Migration `react-test-renderer` → `@testing-library/react-native` (Vitest/RN-Runtime-Blocker).

Folgearbeit API-Mock erledigt (Commit `3c2c7fd`, 2026-05-09): `matchApiRoute()` aus `handleApiMock()` extrahiert und auf parametrisierte Pfade erweitert — `/api/v1/recipes/:id` gibt validen Recipe-Stub zurueck; `/api/v1/shopping/:id|checked|all` abgedeckt; 17 Unit-Tests in `test/unit/lighthouse-runner-api-mock.test.ts`. Mock-Korrektheit verifiziert ueber Unit-Tests + Network-Requests.

Phase-4b Spinner-zu-Skelett-Refactor erledigt (Commit `04ca16e`, 2026-05-09): `shopping.tsx` und `recipe/[id].tsx` rendern Header-Shell + Skeleton-Container ab erstem React-Frame statt Vollbild-Spinner. Real-Device-UX deutlich verbessert (Content sichtbar sobald React laeuft, nicht erst nach API-Antwort). Tests: 85 Mobile + 387 Root grun.

**Phase-4c-LCP-Fix verifiziert (2026-05-11):** Der Skelett-Refactor allein hatte Lighthouse-LCP fuer `/shopping` und `/recipe/1` nicht verbessert (weiterhin ~25 s). Die Phase-4c-Vergleichsmessung zeigte danach: PDF-Lazy-Loading reduziert den Entry-Chunk, aber loest LCP nicht allein. Die statische App-Shell in `mobile/app/+html.tsx` ist der wirksame Fix: mobile p50 LCP liegt nach `npm run perf:lighthouse:compare` bei `/` 903/1450 ms, `/shopping` 902/1448 ms und `/recipe/1` 1052/1414 ms (`simulate`/`devtools`).

**Naechste Folgearbeit fuer Budget-Hardening:** Phase 4c ist als Decision Slice technisch erledigt. 10er-Seeding, Budget-Vorschlaege und Baseline-Schaerfung sind erledigt. Beobachtungs- und Probe-Gate ebenfalls erfuellt (5/5 gruene Warn-Runs + ein gruener Strict-Probe-Run am 2026-05-12). `push`/`pull_request`/`schedule` bleiben weiter warn-only; jede breitere Aktivierung von `strict` ist eine separate Entscheidung und setzt einen neuen 5er-Beobachtungs-Zyklus voraus.

### Phase 4c — Throttling Validation + One Optimization Slice

Status: abgeschlossen am 2026-05-11; echte Lighthouse-Vergleichsmessung wurde ausserhalb der Sandbox erfolgreich ausgefuehrt.

Ziel: entscheiden, ob der ~25s-LCP ein Lighthouse-`simulate`-Artefakt, ein echter Bundle-/Hydration-Engpass oder ein App-Shell-Problem ist. Danach wird genau eine Optimierung umgesetzt und erst dann werden Budgets verschaerft.

```text
Phase A: Messmethode validieren
  |
  |-- simulate hoch, devtools ok
  |     -> Outcome X: Gate auf devtools/validated method umstellen
  |
  |-- simulate und devtools beide hoch, JS-Bundle dominiert
  |     -> Outcome Y: Expo Router asyncRoutes / route-basiertes Splitting
  |
  |-- beide hoch, aber LCP braucht statischen First Content
        -> Outcome Z: statische App-Shell fuer auditable First Paint

Phase B: genau eine gewaehlte Optimierung umsetzen
Phase C: Baseline/Budgets nach 10 stabilen Runs haerten
```

#### Phase A — Validation

- ✅ Erledigt: `scripts/performance/lighthouse-runner.mjs` unterstuetzt `LIGHTHOUSE_THROTTLING=simulate|devtools`; Default bleibt `simulate`.
- ✅ Erledigt: `scripts/performance/throttling-compare.mjs` setzt `LIGHTHOUSE_THROTTLING` als Env-Var, aggregiert p50/p75 pro Route/Viewport/Methode und schreibt `simulate-minus-devtools`-Deltas.
- ✅ Erledigt: `package.json` enthaelt `perf:lighthouse:compare`.
- ✅ Erledigt: `scripts/performance/baseline.json` ist auf methodenfaehige Budgets vorbereitet, ohne Strict-Gate vorzeitig zu aktivieren.
- ✅ Erledigt: `scripts/performance/validate-status.mjs` unterstuetzt methodenfaehige Budget-Auswertung plus gzip-JS und JS-Ausfuehrungszeit.
- Tests:
  - ✅ `test/unit/lighthouse-runner-throttling.test.ts`: `LIGHTHOUSE_THROTTLING=simulate|devtools`, invalid value, Default-Verhalten.
  - ✅ `test/unit/throttling-compare.test.ts`: p50/p75/Deltas pro Route/Viewport/Methode, fehlende Methode, partial/skipped/failed runs und Output-Schema.
  - ✅ `test/unit/bundle-report-gzip.test.ts`: Gesamt-JS gzip, groesstes JS gzip, raw bytes und doppelte Alias-Dateien.
  - ✅ `test/unit/validate-status-performance-budgets.test.ts`: methodenfaehige LCP-Budgets, gzip-Budget, JS-Ausfuehrungszeit-Budget, `warn` vs. `strict`, fehlende/NaN-Metriken.
  - Artifact-Flow ist ueber die Pure-Function-Tests und die erfolgreiche Script-Ausfuehrung (`perf:bundle`, `perf:lighthouse:compare`, `perf:validate`) abgedeckt.
- ✅ Dokumentation: `docs/performance/throttling-analysis.md` mit Entscheidung X/Y/Z und realer 2026-05-11-Messung aktualisiert.

#### Current Phase-4c Evidence (2026-05-11)

- ✅ `npm run perf:lighthouse:compare` lief nicht-sandboxiert erfolgreich: 3/3 `simulate`-Runs und 3/3 `devtools`-Runs, jeweils 9 Samples.
- ✅ Mobile p50 LCP nach App-Shell: `/` 903.006 ms (`simulate`) / 1449.870 ms (`devtools`); `/shopping` 901.733 / 1448.252 ms; `/recipe/1` 1051.650 / 1413.536 ms.
- ✅ `npm run perf:validate`: `lighthouse=ok`, `warningRate=0.0000`, `fullCoverage=true` in der Phase-4c-Vergleichsmessung.
- Strict-Gate-Aktivierung ist nicht mehr durch Phase-4c-Messbarkeit blockiert; nach dem 2026-05-12-Seed bleibt nur noch CI-Bewaehrung der geschaerften Budgets.

#### Phase B — Chosen Optimization Only

- Outcome X: nicht gewaehlt; `simulate` ist nach Shell-Fix ebenfalls stabil und nicht mehr der alleinige Problemfaktor.
- ✅ Outcome Y umgesetzt als vorbereitender Bundle-Slice: PDF-Export-Code wird in `mobile/app/(tabs)/index.tsx` und `mobile/app/recipe/[id].tsx` nur noch bei Export/PDF-Aktion dynamisch importiert.
- ✅ Outcome Z gewaehlt und verifiziert: `mobile/app/+html.tsx` rendert eine minimale route-aware `rd-audit-shell` vor dem Expo-Root, damit `/shopping` und `/recipe/*` vor Hydration einen stabilen LCP-Kandidaten haben.
- Messbarer Bundle-Effekt: Entry-Chunk im frischen Expo-Web-Export von 4,614,669 Bytes auf 4,156,752 Bytes reduziert; neuer `pdf-export`-Chunk 459,615 Bytes; aktuelles `gzipJsBytes=1,036,737`.
- Messbarer LCP-Effekt: `/shopping` und `/recipe/1` fallen auf Mobile von ~23-26s p50 auf ~0.9-1.45s p50.

#### Phase C — Budget Hardening

- ✅ Budget-Mechanik umgesetzt: methodenfaehige LCP/CLS/JS-Ausfuehrungszeit-Budgets und gzip-JS-Budget sind im Code abgedeckt.
- ✅ Bundle-Ziel als gzip-Messwert erfasst; aktueller frischer Bundle-Report: `gzipJsBytes=1,036,737`, unter dem Startlimit `1,400,000`.
- ✅ LCP-Ziel ist in der aktuellen nicht-sandboxierten Vergleichsmessung erfuellt.
- ✅ 10-Run-Automation umgesetzt: `npm run perf:stability:seed` fuehrt `perf:bundle` einmalig aus und laesst danach pro echter Messung `perf:lighthouse` + `perf:validate` laufen. `validate-status.mjs` bleibt der einzige Writer fuer `history.json`/`readiness.json`.
- ✅ Budget-Vorschlaege umgesetzt: `npm run perf:budget:suggest` filtert vollstaendige History-Runs nach Methode/Viewport und schreibt p50/p75/p95 plus `p95 * 1.10`-Vorschlag nach `artifacts/performance/budget-suggestions.json` (Artefakt ist lokal/CI, nicht versioniert).
- ✅ History-Integritaet gehaertet: neue History-Eintraege enthalten `throttlingMethod`; `runId` bleibt auch bei mehreren Validierungen im selben CI-Run eindeutig.
- ✅ Vollstaendige 10-Run-Serie ausgefuehrt: `npm run perf:stability:seed` lief am 2026-05-12 nicht-sandboxiert gruen, `perf:budget:suggest` meldete `10/10 complete`.
- ✅ `baseline.json` geschaerft: gzip-JS und groesstes JS-Asset nach Vorschlag gesenkt, `maxJsBytes` bei der strengeren bestehenden 5.2-MB-Grenze belassen, methodenfaehige Lighthouse-Budgets aktualisiert.
- ⚠ Der `/`-LCP-Vorschlag von 24616 ms wurde nicht uebernommen, weil er einen einzelnen Cold-Run-Ausreisser widerspiegelt; warm runs liegen nahe 903 ms.
- ✅ Folgeentscheidung umgesetzt: `perf:stability:seed` fuehrt einen verworfenen Warm-up-`perf:lighthouse`-Lauf aus, damit First-Sample-Ausreisser nicht in das gemessene Stabilitaetsfenster geschrieben werden.
- Strict-Gate erst aktivieren, wenn die geschaerften Budgets mehrere CI-Runs ohne Regressionsrauschen bestehen und `budgetPass=true` fuer LCP, JS gzip und JS-Ausfuehrungszeit unter der validierten Methode bleibt.

#### NOT in scope fuer Phase 4c

- Web-Vitals-Felddatensammlung: deferred, bis `throttling-comparison.json` eine konkrete Lab-vs-Field-Frage zeigt.
- Firebase Test Lab oder andere Geraetefarm: deferred, bis das Lab-Gate stabil und relevant ist.
- Visual Regression / Storybook / Chromatic: eigener UI-Qualitaets-Track, nicht Voraussetzung fuer Performance-Gating.
- OTA-Update-Simulation: eigener Release-Safety-Track, nicht Voraussetzung fuer Lighthouse-LCP.

---

## Code Review — Phase 2 (2026-05-07)

> Archivierter Review-Kontext. Dieser Abschnitt ist nicht mehr die aktuelle Implementierungsanweisung; Phase 4c ist abgeschlossen, aktive Arbeit fuer Performance-Gating ist nur noch Stability-History fuer Strict-Gates.

### Was behoben wurde (aus dem Phase-1-Review)

| Vorher (P1/P2-Finding) | Jetzt |
|---|---|
| `addIngredients` — 20+ parallele Requests ohne Limit | `mobile/utils/shopping-service.ts` mit Concurrency=4 ✅ |
| Business Logic aus Screen-File exportiert | `addIngredients` in Service ausgelagert, Planner importiert aus `shopping-service` ✅ |

### Neue Findings (nichts ändern — für PR 3 oder separates Cleanup)

#### RESOLVED — `RecipePickerModal.loadAllRecipes()` ohne `.catch()`

**Status:** Erledigt am 2026-05-07; `.catch()` implementiert in Zeile 119.

**`mobile/app/(tabs)/planner.tsx:117-120`**

```js
loadAllRecipes()
  .then(rows => { setRecipes(rows); })
  .catch(() => { /* stay empty, loading stops in finally */ })
  .finally(() => setLoading(false));
```

Fehlerbehandlung ist jetzt vorhanden. Bei Ablehnung bleibt die Rezeptliste leer, `loading` wird false gesetzt — konsistent mit dem erwarteten Verhalten.

#### RESOLVED — `handleQRScanned` — ungeschütztes `await fetch` im Recipe-Link-Pfad

**Status:** Erledigt am 2026-05-07; try/catch + `handlePlannerActionError` implementiert in Zeilen 452-475.

**`mobile/app/(tabs)/planner.tsx:449-477`**

```js
if (urlMatch) {
  const recipeId = parseInt(urlMatch[1], 10);
  if (targetDay !== null) {
    try {
      await fetch(`${serverUrl}/api/v1/planner`, { method: 'POST', ... });
      await loadData();
      Alert.alert('Hinzugefügt', ...);
    } catch {
      handlePlannerActionError('Rezept konnte nicht zum Wochenplan hinzugefügt werden.', ...);
    }
  }
  return;
}
```

Fehlerbehandlung und Retry-Callback sind jetzt konsistent mit dem Rest des Planners.

#### RESOLVED — `query-client.ts:33` — `AsyncStorage.removeItem` ohne Fehlerbehandlung

**Status:** Erledigt am 2026-05-07; innerer try/catch implementiert in Zeilen 33-35.

**`mobile/utils/query-client.ts:29-37`**

```js
} catch {
  try {
    await AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch { /* ignore cleanup failure */ }
  return undefined;
}
```

Fehler beim `removeItem` propagieren nicht mehr nach oben. Der Persistence-Layer bleibt robust.

#### RESOLVED — Kosmetisch — Redundanter innerer Block in `loadAllRecipes`

**Status:** Erledigt am 2026-05-07; innerer Block entfernt in Zeile 33-61.

**`mobile/app/(tabs)/planner.tsx:33-61`**

```js
async function loadAllRecipes(): Promise<Recipe[]> {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/recipes`);
  // ... direct scope, no inner block
}
```

Innere `{}` sind entfernt. Code ist sauberer.

#### RESOLVED — Bounded Concurrency bei Fehler: partielle Shopping-Liste

**Status (2026-05-13):** Implementiert und verifiziert (tsc grün, 15/15 Unit-Tests grün).

**`mobile/utils/shopping-service.ts:36-44`**

Das Worker-Pattern ist für JS korrekt (single-threaded, kein race). Aber: wenn Zutat #3 eines Batches scheitert, lehnt `Promise.all` ab und der Caller bekommt einen Fehler — Zutaten #1 und #2 wurden jedoch bereits hinzugefügt. Kein Retry-Button in `recipe/[id].tsx` (ursprüngliche Beschreibung war ungenau — `handleAddToShopping` hat kein try/catch und keinen Retry). Duplikate entstehen primär durch mehrfaches Antippen bei langsamer Verbindung oder erneutem Tap nach Partial-Failure.

**Analyse (2026-05-13):** `POST /api/v1/shopping` ist **nicht** idempotent. `shopping_list` hat weder unique constraint auf `(canonical_name, recipe_id)` noch einen ON CONFLICT-Upsert (`src/schema.ts:34-43`, `src/db-react.ts:358-367`). Jeder POST erzeugt bedingungslos einen neuen Datensatz.

**Umgesetzter Fix (2026-05-13):**
- `src/schema.ts:34-53`: Composite unique constraint `shopping_list_user_recipe_name_uidx` auf `(user_id, recipe_id, canonical_name)` mit `NULLS NOT DISTINCT` (zukunftssicher für Multi-User, funktioniert heute mit `user_id = NULL`).
- `src/db-react.ts:358-384`: Insert mit `.onConflictDoNothing({ target: [...] })` + Lookup-Fallback; API-Contract (`{ id: number }`) bleibt stabil.
- Migration: `db/migrations/2026-05-13-shopping-unique-constraint.sql` (Dedup-DELETE + `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE NULLS NOT DISTINCT`).
- Test: `test/unit/planner-routes.test.ts` — neuer Test "is idempotent on duplicate POST" verifiziert gleiche id bei zwei identischen Requests.

### Acceptance Criteria Phase 2 — Stand

| Criterion | Status |
|---|---|
| `npm run test:mobile` läuft stabil | ✅ 14 Dateien, 71 Tests |
| list → search → detail → shopping Workflow | ✅ `mobile-workflow-list-detail-shopping-ui.test.tsx` |
| Network failure recovery (shopping) | ✅ `mobile-workflow-shopping-recovery.test.ts` |
| Planner add/remove/retry Mutation-Paths | ✅ `planner-screen-fallbacks.test.tsx` |
| Sichtbare Error-States (kein stiller catch) | ✅ (bis auf `RecipePickerModal` — P2 offen) |
| Offline cached data bleibt nutzbar | ✅ `query-client.ts` corrupt-cache discard |
| Bounded concurrency für `addIngredients` | ✅ `shopping-service.ts` concurrency=4 |

---

## Code Review — Phase 3 (2026-05-07)

> Archivierter Review-Kontext. Einzelne Findings unten wurden spaeter behoben oder durch den Phase-4b-/Phase-4c-LCP-Befund ueberholt. Fuer neue Arbeit gilt: Strict-Gates erst nach 10 stabilen vollstaendigen Runs aktivieren.

### Was behoben wurde (aus dem Phase-1-Review + Review-Bugfix-Session)

| Vorher (Finding) | Jetzt |
|---|---|
| Chrome fehlt im CI-Job (P3) | `browser-actions/setup-chrome@v1` in `performance-audit` ✅ |
| LCP ~25s: API-Timeout statt Content-Render (P1) | API-Mock im statischen Server → leere JSON-Antworten → EmptyState rendert schnell ✅ |
| LCP/CLS-Budgets nicht geprüft (P1) | `validate-status.mjs` prüft jetzt LCP/CLS aus `baseline.json` ✅ |
| `baseline.json` hat keine Lighthouse-Limits (P1) | LCP 5s + CLS 0.25 als großzügige Startwerte ergänzt ✅ |

### Infrastruktur-Status

Lighthouse läuft vollständig:
- 9/9 Runs erfolgreich (`successfulRuns: 9, warningRuns: 0, lighthouse: "ok"`)
- Chrome via `browser-actions/setup-chrome@v1` deterministisch installiert
- Bundle-Limits werden geprüft (JS 4.9 MB vs 5.2 MB Budget ✅)
- History-Tracking aktiv, 1 Run gespeichert

### Findings (P1 — hohe Auswirkung)

#### RESOLVED — LCP-Messungen sind wertlos: ~25s auf allen drei Routen

**`scripts/performance/lighthouse-runner.mjs` + statische Expo-Web-Ausgabe**

Status: erledigt mit Phase 4c (2026-05-11) durch route-aware statische App-Shell in `mobile/app/+html.tsx`. Mobile p50 LCP nach Vergleich `simulate`/`devtools`: `/` 903/1450 ms, `/shopping` 902/1448 ms, `/recipe/1` 1052/1414 ms — alle weit unter dem Plan-Budget 3.0–3.4 s. Acceptance-Criteria Phase 3 (Tabelle unten) bestätigt: "LCP-Messungen spiegeln echte Performance ✅".

Aktuelle Messwerte (mobile-375x812) — vor Fix:

| Route | LCP | Performance Score |
|---|---|---|
| `/` | 25.3 s | 41/100 |
| `/shopping` | 24.9 s | 42/100 |
| `/recipe/1` | 25.2 s | 41/100 |

Der Plan-Budget liegt bei LCP <= 3.0–3.4 s. Die Abweichung beträgt den Faktor 8.

**Ursache:** `lighthouse-runner.mjs` startet einen lokalen statischen File-Server auf `public/`. Die React-App rendert Loading-Spinner, wartet auf API-Antworten die nie kommen, und LCP triggert erst wenn der Spinner nach ~25s durch einen Fehler-Zustand ersetzt wird (oder Lighthouse die Messung abbricht). Das ist kein UI-Performance-Problem — es ist eine Mess-Topologie-Lücke.

**Auswirkung:** Die gesammelten LCP/INP/CLS-Werte sind nicht interpretierbar. 10 Messreihen für die Readiness-Freigabe zu sammeln ist sinnlos solange die Werte den API-Timeout messen statt echte Render-Zeiten.

**Fix-Optionen für Phase 3 Stabilization:**

Option A (empfohlen): Statischer Lighthouse mit leeren Initial-States
- Die React-App zeigt auch ohne API einen sinnvollen First-Paint (Skeleton, Leer-UI)
- LCP könnte auf den initialen App-Shell-Render beschleunigt werden: `public/index.html` mit einem sinnvollen LCP-Element im statischen HTML (kein JS-Spinner als LCP-Element)
- Kurzes `perf:serve-and-wait` Script bevor Lighthouse startet, das prüft ob `/` eine 200 gibt

Option B: Fixture-API-Proxy
- Minimaler HTTP-Server der static fixture JSON zurückgibt, wenn die React-App API-Endpunkte aufruft
- Aufwendiger, aber Messungen spiegeln echten Zustand

Option C: Routen als static-only markieren
- Lighthouse nur für `/` messen (App-Shell-LCP), `/shopping` und `/recipe/1` als "data-dependent" ausschließen
- Einfachste Lösung, hat aber geringsten Informationswert

**Dringlich:** Keine der 10 Messreihen für die Blocking-Freigabe sollten auf Basis dieser Infrastruktur gesammelt werden.

#### RESOLVED — LCP/INP/CLS-Budgets werden in validate-status nicht geprüft

**`scripts/performance/validate-status.mjs:376-400`**

Status: erledigt durch Review-Bugfix-Session (2026-05-07) und Phase 4c (2026-05-11). `validate-status.mjs` prüft jetzt LCP + CLS pro Route und Viewport aus `baseline.json` (methodenfaehig nach `LIGHTHOUSE_THROTTLING`), Tests in `test/unit/validate-status-performance-budgets.test.ts`. Acceptance-Criteria Phase 3 (Tabelle unten) bestätigt: "LCP-Budgets werden in CI geprüft ✅".

`validate-status.mjs` liest `baseline.json` und prüft **nur Bundle-Limits** (JS-Bytes, CSS-Bytes, etc.). Die im Plan definierten Core Web Vitals Budgets (LCP <= 3.0s, INP <= 250ms, CLS <= 0.10) sind in `baseline.json` nicht vorhanden und werden nicht geprüft.

Die `warningRuns` in `status.json` bedeuten "Lighthouse-CLI ist abgestürzt" — nicht "LCP überschreitet Budget". CI berichtet `lighthouse=ok` und 0 Warning-Runs, obwohl LCP 25 Sekunden beträgt.

**Fix:** `baseline.json` um Lighthouse-Metriken erweitern und in `validate-status.mjs` gegen `summary.json` prüfen:

```json
{
  "bundle": { "limits": { ... } },
  "lighthouse": {
    "mobile-375x812": {
      "/": { "lcp": 3000, "cls": 0.10 },
      "/shopping": { "lcp": 3200, "cls": 0.10 },
      "/recipe/1": { "lcp": 3400, "cls": 0.10 }
    }
  }
}
```

Aber: Budgets erst eintragen wenn die Messungen valide sind (Topologie-Problem lösen zuerst).

### Findings (P3 — niedrige Auswirkung)

#### RESOLVED — `browser-actions/setup-chrome@v1` ohne Chrome-Versions-Pin

**`.github/workflows/ci.yml:192-194`**

Status: Erledigt am 2026-05-13. Chrome gepinnt auf Major-Version `150`, weil die letzten beiden grünen Strict-Probe-Runs (`25742783313`, `25781366107`) auf Chromium 150.0.7839.0 liefen — die etablierten Strict-Budgets sind gegen diese Major kalibriert. Major-Pin bekommt Security-Patches innerhalb der Version, verhindert aber überraschende Major-Bumps.

~~`browser-actions/setup-chrome@v1` installiert immer die neueste Chrome-Stable-Version ohne Versions-Lock.~~ ✅

#### RESOLVED — Performance-History-Cache fallback kann Cross-Branch-History einschleusen

**`.github/workflows/ci.yml` — cache restore-keys**

Status: erledigt am 2026-05-13 durch Doppelmechanik aus früherer Cache-Versionierung und Strict-Schedule-Eskalation.

- Aktuelle restore-keys (`ci.yml:188`): nur `performance-history-v4-${{ github.ref_name }}-` — der frühere reine `performance-history-` Fallback (matchte alle Branches) ist mit dem `v4-`-Umstieg entfernt worden.
- Restrisiko aus GitHub-Default-Cache-Cascade (Feature-Branches erben automatisch `main`-Caches, unabhängig von `restore-keys`) ist im warn-only Modus folgenlos und im Strict-Modus folgenlos, weil Strict seit 2026-05-13 nur auf `schedule` (= `main` Cron) automatisch läuft.
- Bei `workflow_dispatch perf_enforcement=strict` auf einem Feature-Branch bleibt das Restrisiko theoretisch bestehen; das ist aber Operator-Opt-in, kein automatisches Verhalten. Wird im Runbook (`docs/performance/strict-probe-runbook.md`) als Operator-Verantwortung dokumentiert.

### Acceptance Criteria Phase 3 — Stand

| Criterion | Status |
|---|---|
| `npm run perf:audit` erzeugt Build, Server, Reports | ✅ |
| CI Performance-Job mit Artefakt-Upload | ✅ |
| Chrome im CI deterministisch | ✅ `browser-actions/setup-chrome@v1` |
| Budgets warn-only (nicht blocking) | ✅ `PERF_ENFORCEMENT_LEVEL=warn` |
| Bundle-Limits geprüft | ✅ JS 4.9 MB / 5.2 MB Limit |
| LCP/INP/CLS werden gesammelt | ✅ (in history.json und summary.json) |
| LCP-Messungen spiegeln echte Performance | ✅ Phase 4c validiert `simulate` vs. `devtools`; App-Shell senkt mobile p50 LCP auf ~0.9-1.45s |
| LCP-Budgets werden in CI geprüft | ✅ `validate-status.mjs` prüft LCP + CLS aus `baseline.json` |
| Readiness für blocking-Budgets | ⏳ Nur noch durch 10 stabile vollstaendige Runs blockiert; Phase-4c-Messbarkeit ist geloest |

**Fazit Phase 3 (historisch, aktualisiert 2026-05-11):** Infrastruktur und Artefakt-Mechanik sind vollstaendig. Die spaetere Phase-4b-Messung zeigte, dass die LCP-Frage nicht allein durch API-Mock-Fixes geloest war; Phase 4c hat den Lab-LCP mit einer statischen App-Shell geloest. Neue Strict-Gates warten nur noch auf Stability-History.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | Autoplan 2026-05-06: mobile reliability first, Web Vitals deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | - | No separate Codex plan review recorded |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR | Latest 2026-05-11: Phase 4c Decision Slice freigegeben |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | - | Not run for this perf-plan update |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | CLEAR | Autoplan 2026-05-06: command clarity and CI diagnosability improved |

- **RESOLVED (2026-05-12):** 10 stabile vollstaendige Runs erreicht; 5/5 gruene Warn-Mode-CI-Runs erreicht; erster manueller Strict-Probe-Run (`25742783313`) gruen abgeschlossen.
- **UNRESOLVED:** Branch-PR-Aufraeumarbeit (vier leere Trigger-Commits) und Entscheidung ueber breitere `strict`-Aktivierung.
- **VERDICT:** Phase 4c abgeschlossen und durch ersten gruenen Strict-Probe-Run validiert — CI-Policy bleibt fuer `push`/`pull_request`/`schedule` weiterhin warn-only.
