# Implementierte Features — Test-Status

## Phase 3c: Dictionary + Einkaufsliste (implementiert, nicht vollständig getestet)

### Backend
| Feature | Datei | Status |
|---------|-------|--------|
| `ingredient_dictionary` Tabelle | `src/schema.ts` | ✅ Migration |
| `shopping_list` Tabelle | `src/schema.ts` | ✅ Migration |
| `extractIngredientName()` | `src/ingredient-dictionary.ts` | ✅ |
| `isSimilar()` mit Levenshtein | `src/ingredient-dictionary.ts` | ✅ |
| Dictionary CRUD (db) | `src/db-react.ts` | ✅ |
| Shopping List CRUD (db) | `src/db-react.ts` | ✅ |
| `/api/v1/shopping` Endpoints | `src/api-react.ts` | ✅ |
| `/api/v1/dictionary` Endpoints | `src/api-react.ts` | ✅ |
| Ingredient-Suche (`?ingredients=`) | `src/api-react.ts`, `src/db-react.ts` | ✅ |

### Frontend
| Feature | Datei | Status |
|---------|-------|--------|
| `ShoppingPage` Komponente | `frontend/src/components/ShoppingPage.tsx` | ✅ |
| Einkauf-Nav-Link | `frontend/src/components/Layout.tsx` | ✅ |
| "Einkauf" Button in RecipeDetail | `frontend/src/components/RecipeDetail.tsx` | ✅ |
| "Aus Rezept hinzufügen" Modal | `ShoppingPage.tsx` | ✅ |
| Abhaken/Löschen/Erledigte löschen | `ShoppingPage.tsx` | ✅ |
| Clipboard-Export | `ShoppingPage.tsx` | ✅ |
| API Services erweitert | `frontend/src/api/services.ts` | ✅ |
| `extractIngredientName()` in frontend | `frontend/src/utils/scaling.ts` | ✅ |

---

## Phase 4: Share + Smart (implementiert, nicht vollständig getestet)

### Backend
| Feature | Datei | Status |
|---------|-------|--------|
| Zutaten-Suche OR-Logik | `src/db-react.ts` | ✅ |
| `/api/v1/recipes?ingredients=` | `src/api-react.ts` | ✅ |

### Frontend
| Feature | Datei | Status |
|---------|-------|--------|
| Zutaten-Suchfeld in RecipeList | `frontend/src/components/RecipeList.tsx` | ✅ |
| PDF-Export mit jsPDF | `frontend/src/utils/pdf-export.ts` | ✅ |
| QR-Code Generierung | `pdf-export.ts` | ✅ |
| "PDF" Button in RecipeDetail | `frontend/src/components/RecipeDetail.tsx` | ✅ |

---

## Bekannte Test-Lücken

Stand 2026-06-02: Die alte Lueckenliste wurde gegen den aktuellen Testbestand abgeglichen. Mehrere Punkte sind inzwischen abgedeckt und waren nur dokumentarisch veraltet.

### Inzwischen abgedeckt

- Einkaufsliste laden via API: `test/unit/planner-routes.test.ts` prueft `GET /api/v1/shopping`.
- "Aus Rezept hinzufuegen"-Flow: `mobile/test/mobile-workflow-list-detail-shopping-ui.test.tsx` prueft `list -> detail -> shopping` inklusive `addIngredients([...], recipeId)`.
- Dictionary-Matching-Endpoint: `test/unit/planner-routes.test.ts` prueft `/api/v1/dictionary/match`.
- Zutaten-Suche OR-/AND-Vertrag: `test/unit/recipes-routes.test.ts` prueft Defaults, `match=or`, `match=and`, Threshold und Limit.
- PDF-Helfer ohne `source_url`, QR-Ziel/Optionen und Umlaute/Sonderzeichen: `test/unit/pdf-export-helpers.test.ts`.

### Weiter offen / Produktentscheidung

- Dictionary-UI: Es gibt weiterhin keine dedizierte UI zum Anzeigen/Verwalten des Ingredient-Dictionaries. Das ist ein Produkt-/Feature-Backlog-Punkt, keine reine Testluecke.
- Zutaten-Suche mit kurzem Begriff wie `ei`: noch kein expliziter Regressionstest fuer den konkreten Suchfall `ei -> Ei/Eier`. Erst aufnehmen, wenn die gewuenschte Semantik fuer Kurzbegriffe festgelegt ist.
- Vollstaendiger PDF-Download-/Rendering-Smoke im Browser oder Native-Print-Pfad: Helper sind getestet; ein End-to-End-PDF-Rendercheck bleibt optional fuer QA, wenn PDF-Regressionen auftreten.

---

## Durchgeführte Tests

- ✅ Multi-User Staging-Smoke Vorbereitung (2026-06-04): `scripts/supabase/rls-smoke.ts` kann jetzt per `SUPABASE_RLS_SMOKE_TARGET=staging` gegen explizit bestaetigtes Staging laufen und bricht ohne `SUPABASE_RLS_SMOKE_CONFIRM=rezepti-staging` ab. Die RLS-Migration verhindert nun `user_id`-Umschreibungen auf Shopping-/Planner-Zeilen, waehrend gemeinsame Household-Updates erlaubt bleiben; der Smoke prueft diesen Vertrag. Verifiziert mit `npx tsc --noEmit`, `npm run test:unit -- --run test/unit/auth.test.ts test/unit/planner-auth-routes.test.ts test/unit/planner-routes.test.ts` (lief als volle Root-Unit-Auswahl: 461 passed, 13 skipped), `npm run security:secrets`, `git diff --check` und nach `npx supabase db reset --local --yes` mit `npm run supabase:rls-smoke`. Staging-/Cloud-RLS-Smoke bleibt vor Release offen.
- ✅ Multi-User RLS CI-Gate Vorbereitung (2026-06-04): `.github/workflows/ci.yml` enthaelt jetzt einen eigenen `supabase-rls-smoke` Job. Der Job startet lokale Supabase-Container, setzt die lokale DB auf die Migrationen zurueck, fuehrt `npm run supabase:rls-smoke` aus, laedt bei Fehlern Containerdiagnostik in die Logs und stoppt Supabase danach ohne Backup. CI-Ausfuehrung bleibt bis zum Branch-Push/PR offen.
- ✅ Multi-User Active-Household Determinismus (2026-06-04): `loadUserAuthorization` sortiert Memberships jetzt stabil nach Owner-vor-Member und `householdId`, damit Multi-Household-User nicht von DB-Rueckgabe-Reihenfolge abhaengen. Verifiziert mit `npx tsc --noEmit`, `npm run test:unit -- --run test/unit/db-react.test.ts test/unit/auth.test.ts test/unit/planner-auth-routes.test.ts test/unit/planner-routes.test.ts` (lief als volle Root-Unit-Auswahl: 463 passed, 13 skipped) und `git diff --check`.
- ✅ Multi-User Auth-Test-DX (2026-06-04): `npm run test:auth` fuehrt die schnelle Auth-/Household-/Route-Auswahl direkt aus, ohne die relevante Vitest-Dateiliste aus Doku oder Shell-History rekonstruieren zu muessen.
- ✅ Multi-User Mobile Auth-Error-DX (2026-06-04): Mobile `apiFetch` hat jetzt zentrale `ApiRequestError`-/`assertApiOk`-Helfer, die stabile Server-Error-Codes wie `auth_missing` und `no_household` aus dem JSON-Envelope erhalten. Shopping und Planner nutzen die Helfer fuer geschuetzte Route-Fehler; Planner behandelt ein nicht-ok `GET /planner` nicht mehr als leere Woche. Verifiziert mit `npm --prefix mobile run typecheck`, `npm --prefix mobile run test:unit -- test/utils-api.test.ts`, `npm --prefix mobile run test:unit` (89 passed) und `git diff --check`.
- ✅ Multi-User Login First Slice Start (2026-06-04): Server-Auth-Skeleton, DB-basierte Admin-/Household-Kontextquelle, household-scoped Shopping-/Planner-Serverpfade, Mobile Supabase Session-Grundlage, Bearer-Header-Injection und Settings-Account-Block implementiert. Verifiziert mit `npx tsc --noEmit`, `npm run test:unit -- test/unit/auth.test.ts test/unit/planner-routes.test.ts test/unit/shopping-screen-source.test.ts` (lief als volle Root-Unit-Auswahl: 456 passed, 13 skipped), `npm --prefix mobile run typecheck`, `npm --prefix mobile run test:unit` (87 passed), `npm run security:secrets` und `git diff --check`. Lokale Supabase-Migration verifiziert mit `npx supabase start`, `npx supabase migration list --local` und direkten Postgres-Checks auf Slice-Tabellen/Policies.
- ✅ Multi-User RLS Smoke Nachzug (2026-06-04): `npm run supabase:rls-smoke` erstellt lokale Supabase-Testuser/Haushalte, prueft echte Data-API/RLS-Isolation fuer Shopping/Planner, bestaetigt `anon`-Block und geschlossene `recipes`-Data-API, und raeumt Testdaten auf. Route-Auth-Boundary verifiziert mit `test/unit/planner-auth-routes.test.ts`; Dictionary-Mutation ist jetzt Admin-only. Verifiziert mit `npm run supabase:rls-smoke`, `npm run test:unit -- --run test/unit/auth.test.ts test/unit/planner-auth-routes.test.ts test/unit/planner-routes.test.ts` (lief als volle Root-Unit-Auswahl: 461 passed, 13 skipped) und `npx tsc --noEmit`. Cloud-/Staging-RLS-Smoke bleibt vor Release offen.
- ✅ GitHub Actions nach Doku-/TODO-Push (2026-06-04): Push-CI `26939939417` fuer `7523b72` gruen (`test`, `mobile-release-gate`, `e2e`, `performance-audit`; `e2e-legacy-soak` beim Push erwartbar skipped). Docker-/Deploy-Run `26939939394` gruen, inklusive Docker Build/Push und Northflank Deploy. Automatischer Changelog-/Version-Workflow `26939939535` gruen und erzeugte `8ed8801 chore: v1.0.124 [skip ci]`; nachgelagerter Docker-/Northflank-Run `26939952178` auf `8ed8801` ebenfalls gruen.
- ✅ Scheduled CI seit dem letzten dokumentierten Stand (2026-06-02 bis 2026-06-04): Runs `26802547508`, `26868293611` und `26934892387` alle gruen. Jeweils gruen: `test`, `mobile-release-gate`, `e2e`, `e2e-legacy-soak` und `performance-audit`; Nightly/Schedule-Performance lief im Strict-Pfad inklusive Browser-Readiness-Enforcement.
- ✅ GitHub Actions nach Merge auf `main` (2026-06-01): CI-Run `26739588618` gruen (`test`, `mobile-release-gate`, `e2e`, `performance-audit`; `e2e-legacy-soak` erwartbar skipped). Docker-/Deploy-Runs `26739588567` und `26739599281` gruen, inklusive Docker Build/Push und Northflank Deploy. Automatischer Version-Workflow `26739588576` gruen und erzeugte `v1.0.123`.
- ✅ `npm run build:mobile` — baut die Expo-Web-App nach `public/`
- ✅ `npx tsc --noEmit` — TypeScript-Check (Root + Mobile)
- ✅ `npm run test:unit` — **448 Tests bestanden, 13 skipped** (Stand: 2026-06-01)
- ✅ `npm --prefix mobile run test:unit` — **87 Tests bestanden** (Stand: 2026-06-01)
- ✅ Expo-SDK-56-Core-Slice (2026-06-01): Mobile steht auf Expo SDK 56 (`expo-doctor` `21/21`), React `19.2.3`, React Native `0.85.3`, Reanimated/Worklets `4.3.1`/`0.8.3` und TypeScript `~6.0.3`. Verifiziert mit Mobile-Typecheck, Mobile-Unit-Tests, RNTL-Guard, `cd mobile && npx expo install --check`, `cd mobile && CI=1 npx expo-doctor`, `npm run build:mobile`, Root-Typecheck und Root-Unit-Tests. NativeWind 5/Tailwind 4 bleibt ein separater Styling-Track.
- ✅ Restupdates nach SDK 56 (2026-06-01): `concurrently@10.0.1`, `@types/react@19.2.15` und exakt gepinntes `react-test-renderer@19.2.3`. Verifiziert mit Root-/Mobile-Typecheck, Root-/Mobile-Unit-Tests, RNTL-Guard, Expo-Gates und kurzem `npm run dev:mobile`-Smoke.
- ⚠️ Mobile-Audit nach SDK 56 bleibt SDK-/Expo-CLI-gebunden: `uuid <11.1.1` ueber `xcode`/`@expo/config-plugins`/Expo-CLI-Cluster (`12 moderate`). `npm audit fix --force` wuerde laut npm auf `expo-splash-screen@55.0.21` downgraden und wird nicht verwendet.
- ✅ Kleine Patch-Slices aus dem Dependency-Matrix-Nachzug (2026-06-01): Root-Patches fuer `hono`, `@hono/node-server`, `openai`, `tsx`, `vite`, `vitest`, `@vitest/coverage-v8`, `@vitest/ui`, `@types/node`; Mobile-Patches fuer TanStack Query/Persist, `nativewind`, `lucide-react-native`, `vitest` und `@vitest/coverage-v8`. Verifiziert mit Root-/Mobile-Typecheck, Root-/Mobile-Unit-Tests, RNTL-Guard, `npx expo install --check`, `CI=1 npx expo-doctor` (`19/19`), `npm run build:mobile` und Root-Server-Boot-Smoke.
- ✅ Test-Infra-File-Migration abgeschlossen (2026-05-30; Runtime-Follow-up 2026-05-31): `recipe-list-screen-fallbacks.test.tsx`, `recipe-detail-fallbacks.test.tsx`, `shopping-screen-fallbacks.test.tsx`, `mobile-workflow-list-detail-shopping-ui.test.tsx` und `planner-screen-fallbacks.test.tsx` nutzen jetzt echte `@testing-library/react-native`-API statt direkter `react-test-renderer`-Imports. Vitest optimiert RNTL gezielt und verwendet `mobile/test/testing-library-rn-real.ts` nur als duennen Live-`screen`-/Uebergangstyp-Wrapper; der alte Compat-Layer ist entfernt. Inventory, Autor-Checkliste und `npm run test:mobile:rntl-guard` sind dokumentiert/verdrahtet; die Guard-Allowlist ist leer. `renderAsync` ist entfernt; die verbliebenen `UNSAFE_queryAllByType`-Strukturzugriffe in migrierten Tests wurden durch sichtbare Queries, Accessibility-Labels und gezielte `testID`s ersetzt.
- ✅ Mobile-RNTL ist funktional gruen und im dokumentierten Mobile-Unit-Lauf warnfrei (Stand: 2026-06-01). `key`-Prop-Warnungen sind weg, die verbliebenen `act(...)`-Warnungen aus `recipe-list-screen-fallbacks` wurden durch einen neutralen AsyncStorage-Focus-Mock beseitigt, und die bekannte RNTL/React-19-`react-test-renderer is deprecated`-Upstream-Meldung wird im Mobile-Test-Setup exakt gefiltert. Verifikation: `npm --prefix mobile run test:unit` -> **87 Tests bestanden**, `react-test-renderer warnings: 0`, `act warnings: 0`; Mobile-Typecheck und RNTL-Guard gruen.
- ✅ npm-Audit-Triage (2026-05-30): `npm audit fix` ohne `--force` fuer Root und Mobile; Root `5 moderate -> 4 moderate`, Mobile `14 total (13 moderate, 1 high) -> 11 moderate`; `@xmldom/xmldom` high, `dompurify`, `brace-expansion` und Root-`ws` geloest. Restfindings sind dokumentierte `drizzle-kit`-/Expo-SDK-bound Ausnahmen.
- ✅ Root-API-Contract-Gate ist jetzt CI-verbindlich mit echtem Server-Boot (Stand: 2026-05-15): `e2e` startet `npm start`, wartet auf `/api/v1/health`, failt bei Timeout hart und führt danach `npm run test:e2e:contract` aus.
- ✅ Lokale Verifikation gegen laufenden Server (2026-05-15): `npm run test:e2e:contract` -> **11/11 passed**.
- ✅ Historische Root-E2E-Suite ist vom Pflicht-Gate getrennt: `test:e2e:legacy*` läuft separat im neuen `e2e-legacy-soak` Job (nightly per `schedule`, optional manuell per `workflow_dispatch`-Flag `run_e2e_legacy_soak=true`).
- ℹ️ Legacy-Soak bleibt bewusst nicht-blockierend für PRs und dient als Drift-/Flake-Frühwarnsystem; bei Rot gilt Triage nach `infra` / `test-flake` / `produkt-regression`.

Kurzabgrenzung (contract vs performance-signal):
- `contract` (gating): funktionale API-Verträge, deterministisch, PR-blockierend bei Fehlern.
- `performance-signal` (non-gating): Legacy-Soak-Latenzindikatoren mit robusten Soft-Budgets; Warnsignal bei Drift/Spikes, aber kein Merge-Blocker.

### Legacy-Soak Report & Triage (Stand: 2026-05-15)

- CI-Artefakte aus `e2e-legacy-soak`:
- `artifacts/test-reports/e2e-legacy-junit.xml` (maschinenlesbarer Vitest-JUnit-Report)
- `/tmp/rezepti-server.log` (Server-Boot-/Runtime-Log)
- Lokaler Repro-Command fuer den gleichen Report:
- `npm run test:e2e:legacy:ci`

Schnelle Auswertung fehlgeschlagener Testcases (lokal):

```bash
rg -n "<failure|<error" artifacts/test-reports/e2e-legacy-junit.xml
```

Triage-Regel pro rotem Nightly:

1. `infra` — Server/DB/Runner/Boot fehlgeschlagen (zuerst `rezepti-server.log` lesen).
2. `test-flake` — nicht-deterministische Testinstabilitaet ohne Produktaenderung.
3. `produkt-regression` — reproduzierbare Verhaltensaenderung in API/Flows.

P3a-Klassifikationsregel (verbindlich, gegen False-Positive):
- `Docker-/Environment-Diagnostik` ist **kein** API-Contract-Signal. Faelle aus `docker.test.ts`, Container-Namen, Port-Bindings, Host-CPU/IO, fehlende Runtime-Dependencies werden initial immer als `infra` klassifiziert.
- `produkt-regression` darf nur gesetzt werden, wenn dieselbe Abweichung mit gesundem Server (`/api/v1/health` gruen), ohne Docker-Sonderpfad und mit lokalem Repro (`npm run test:e2e:contract` oder `npm run test:e2e:legacy:ci`) erneut auftritt.
- Wenn Ursache in den ersten 15 Minuten unklar ist: Pflichtlabel `infra-unverified`, **nicht** `produkt-regression`.

Erst-15-Minuten-Checklist (pro rotem Legacy-Soak):
1. Minute 0-3: `rezepti-server.log` auf Boot-/Bind-/Crash-Signale pruefen.
2. Minute 3-6: JUnit + Skip-Signal (`e2e-legacy-junit.xml`, `e2e-legacy-skip-signal.json`) gegenlesen.
3. Minute 6-10: Health lokal/CI-validieren (`/api/v1/health` erreichbar?).
4. Minute 10-15: Vorlaeufige Klasse setzen: `infra` oder `test-flake`; `produkt-regression` nur bei reproduzierbarer API-Abweichung.

Pflichtformulierung im Incident-/PR-Thread:
- `Noch nicht als Produktregression eingestuft: zuerst Docker/Environment-Diagnostik abgeschlossen.`
- `Produktregression erst nach Repro in stabiler Runtime und ohne Container-/Host-Sondereinfluss.`

Erwartung:
- Jeder rote Lauf bekommt eine Kategorie + Owner + naechste Aktion im Issue/PR-Thread.

P2a Skip-Wave-Klassifikation (verbindlich):
- `e2e-legacy-soak` erzeugt zusaetzlich `artifacts/test-reports/e2e-legacy-skip-signal.json` mit `tests/skipped/failures/errors`.
- Wenn `skipped > 0`, muss der Lauf bis spaetestens naechster Arbeitstag 18:00 CET als `infra` oder `test` klassifiziert sein.
- Pflichtfelder im Incident-/PR-Thread: Run-ID, Signalwerte, finale Klasse, Repro-Command (`npm run test:e2e:legacy:ci`), naechste Aktion + Owner.

P2 Legacy-DB-Isolation (verifiziert):
- `Database Operations` in `test/e2e/react-api.test.ts` laufen mit deterministischen, pro Test isolierten Fixtures und explizitem Cleanup-Lifecycle.
- Stabilisierungs-Repro bestanden: `test:e2e:legacy:db` lief 10-mal hintereinander lokal gruen.

### Legacy Flake Inventory (Top 5) (Stand: 2026-05-15, nach P1/P2/P3a)

Quelle: [docs/testing/e2e-legacy-flake-inventory.md](/home/patrick/Projekte/rezepti/docs/testing/e2e-legacy-flake-inventory.md)

| Prio | Kandidatengruppe | Klasse | Naechste Aktion | Owner |
|---|---|---|---|---|
| 1 | Legacy-Suite wird bei fehlender Server-Readiness komplett geskippt (`skipIf`) | infra | Skip-Wellen im Nightly als eigenes Triage-Signal erfassen (Server-Log + Health-Wait + Skip-Count) | TBD |
| 2 | Asynchrones Job-Polling (`pollJobStatus`, Poll/Timeout) | test-flake | Polling-Parameter gruppenweit vereinheitlichen und Finalstatus-Assertions deterministisch halten | TBD |
| 3 | Harte Performance-Grenzen in Legacy-E2E (`<500ms/<1000ms/<200ms`) | test-flake | Performance-Checks aus Legacy-Soak entkoppeln oder auf robuste Budget-Fenster umstellen | TBD |
| 4 | DB-Mutationspfade mit shared state (`update/delete` auf erstes Rezept) | produkt-regression | Deterministische Fixture pro Testfall + explizites Cleanup einfuehren | TBD |
| 5 | Docker-/Umgebungsabhaengige Legacy-Pfade (Container/Ports/Assets) | infra | Diagnostik klar von API-Contract-Pruefungen trennen und bei Rot zuerst Runtime klassifizieren | TBD |

---

## Mobile / Expo Status (2026-06-01)

- ✅ `cd mobile && CI=1 npx expo-doctor` — `21/21` Checks bestanden
- ✅ `cd mobile && npx expo install --check` — Dependencies up to date
- ✅ Expo SDK 56 Core: `expo@~56.0.8`, `expo-router@~56.2.8`, React `19.2.3`, React Native `0.85.3`, Reanimated `4.3.1`, Worklets `0.8.3`, TypeScript `~6.0.3`
- ✅ `npm --prefix mobile run typecheck` — erfolgreich
- ✅ `npm --prefix mobile run test:unit` — `87/87` Tests bestanden
- ✅ `npm run test:mobile:rntl-guard` — keine neuen direkten `react-test-renderer`-Imports
- ✅ `npm --prefix mobile run test:unit -- recipe-detail-fallbacks recipe-list-screen-fallbacks shopping-screen-fallbacks planner-screen-fallbacks mobile-workflow-list-detail-shopping-ui` — `22/22` Tests bestanden nach Abbau der `UNSAFE_queryAllByType`-Testzugriffe
- ✅ `npm run build:mobile` — erfolgreicher Expo-Web-Export nach `public/`
- ✅ Phase-2-Reliability weiter gehaertet:
  - Planner zeigt jetzt sichtbaren Ladefehler mit Retry/Close bei fehlgeschlagenem Wochen-Load
  - `RecipePickerModal` zeigt jetzt lokalen Ladefehler mit Retry/Close statt stillen Empty-State bei fehlgeschlagenem Rezept-Load
  - Planner-Mutationen zeigen jetzt sichtbare Pending-/Retry-Zustaende fuer Add/Remove, inklusive direktem Retry ohne zweiten Confirm-Dialog beim Remove-Pfad
  - Shopping behaelt gecachte Items bei fehlgeschlagenem Refresh sichtbar
  - Persistierter React-Query-Cache heilt bei korruptem AsyncStorage-Eintrag selbst
  - `addIngredients` liegt als testbarer Service mit bounded concurrency in `mobile/utils/shopping-service.ts`
- ✅ Phase-3-Haertung aktiviert:
  - `performance-audit` richtet Chrome im CI jetzt deterministisch fuer Lighthouse ein
  - `perf:validate` schreibt `artifacts/performance/history.json` und `artifacts/performance/readiness.json`
  - Phase 3 ist damit im Code-/CI-Setup abgeschlossen; Phase 4c hat die spaetere LCP-Messluecke geloest
  - `schedule` laeuft seit 2026-05-13 unter `strict`; offen bleibt nur die Beobachtung weiterer Nightly-Runs vor einer moeglichen Eskalation auf `pull_request`
- ✅ Review-Bugfixes (2026-05-07):
  - `mobile/utils/query-client.ts` — `AsyncStorage.removeItem` in eigenem try/catch abgesichert
  - `mobile/app/(tabs)/planner.tsx` — redundanter innerer Block entfernt; `RecipePickerModal` mit lokalem Error/Retry-State statt stillem Empty-State; try/catch + Fehler-UI fuer QR-Recipe-Link-Pfad
  - `src/routes/planner.ts` — `canonicalName` Length-Limit (max 500 Zeichen)
  - `scripts/performance/lighthouse-runner.mjs` — API-Mock im statischen Server: `/api/*` → realistische Mock-Antworten; parametrisierte Recipe-/Shopping-Pfade sind abgedeckt
  - `scripts/performance/baseline.json` — LCP/CLS-Budgets ergaenzt (initial 5s, tighten nach 10+ CI-Runs)
  - `scripts/performance/validate-status.mjs` — LCP- und CLS-Budget-Checks pro Route/Viewport implementiert

### Phase-4 Slice 1: React Performance (2026-05-07)

- ✅ Recipe-List-Derivationslogik aus dem Renderpfad gezogen:
  - `mobile/utils/recipe-list-screen-data.ts`
  - deferred search / deferred ingredient input in `mobile/app/(tabs)/index.tsx`
- ✅ Deterministischer Large-Fixture-Harness fuer 300-1000 Rezepte:
  - `mobile/test/fixtures/recipe-performance-fixture.ts`
  - `mobile/test/recipe-list-screen-data.test.ts`
- ✅ Low-risk Render-Hotspots in Shopping und Recipe Detail reduziert:
  - weniger wiederholte Ableitungen in `mobile/app/(tabs)/shopping.tsx`
  - vorberechnete Anzeige-/QR-Daten in `mobile/app/recipe/[id].tsx`
- ✅ Verifiziert mit fokussierten Mobile-Tests und kompletter Mobile-Suite

### Phase-3 empirisch abgeschlossen (2026-05-08)

- ✅ 10 lokale `perf:audit` + `perf:validate` Runs gegen frischen Web-Export
- ✅ `artifacts/performance/readiness.json` zeigt `ready=true`:
  - `minRunsMet`: 10/10 Runs im Window
  - `warningRateMet`: 0/90 Lighthouse-Runs warnten
  - `fullCoverageMet`: alle Runs `lighthouse=ok` mit voller Route-/Viewport-Matrix
  - `metricStabilityMet`: LCP/CLS-Spread auf allen drei Routen (`mobile-375x812`) <= 2%
- ✅ Run-Window: 2026-05-08T16:33:02Z – 2026-05-08T16:49:42Z, ~111s pro Iteration, total ~18,5 Min
- ✅ `history.json` + `readiness.json` jetzt versioniert (`.gitignore` erweitert um Negation-Pattern), CI baut darauf auf
- ⚠ Historischer Befund, spaeter durch Phase 4c geloest: LCP auf `/` = ~902 ms, aber `/shopping` und `/recipe/1` jeweils ~25 s. Der API-Mock-Fix war notwendig, aber nicht ausreichend; der finale LCP-Fix ist die statische App-Shell aus Phase 4c.

### Phase-4b/4c Performance-Gate-Abschluss (2026-05-11)

- ✅ Phase-4b: `shopping.tsx` und `recipe/[id].tsx` rendern Header-Shell + Skeleton-Container ab erstem React-Frame; Real-Device-UX verbessert, Lighthouse-LCP blieb ohne 4c aber bei ~25s.
- ✅ Phase-4c Tooling: `LIGHTHOUSE_THROTTLING=simulate|devtools`, `perf:lighthouse:compare`, methodenfaehige Budgets, gzip-JS-Metriken und JS-Ausfuehrungszeit-Budget implementiert.
- ✅ Phase-4c Bundle-Slice: PDF-Export wird in Recipe List und Recipe Detail erst bei Export/PDF-Aktion dynamisch importiert. Entry-Chunk sank von 4,614,669 Bytes auf 4,156,752 Bytes; `pdf-export` liegt als eigener 459,615-Bytes-Chunk vor.
- ✅ Phase-4c LCP-Fix: `mobile/app/+html.tsx` rendert eine route-aware statische `rd-audit-shell` vor dem Expo-Root. Mobile p50 LCP nach `perf:lighthouse:compare`: `/` 903/1450 ms, `/shopping` 902/1448 ms, `/recipe/1` 1052/1414 ms (`simulate`/`devtools`).
- ✅ Aktuelle Performance-Verifikation: `npm run perf:bundle`, `npm run perf:lighthouse:compare`, `npm run perf:validate` gruen; `gzipJsBytes=1,036,737` unter Startlimit `1,400,000`.
- ✅ Strict-Hardening-Tooling-Slice: `perf:stability:seed` automatisiert 10 echte Runs ueber `perf:lighthouse` + `perf:validate`, `validate-status` schreibt eindeutige methodenmarkierte History-Eintraege, `perf:budget:suggest` berechnet p50/p75/p95 plus `p95 * 1.10`-Budgetvorschlaege.
- ✅ Strict-Hardening-Seed (2026-05-12): `npm run perf:stability:seed` lief nicht-sandboxiert vollstaendig durch; `perf:budget:suggest` wertete ein komplettes `10/10`-Window fuer `simulate/mobile-375x812` aus.
- ✅ `scripts/performance/baseline.json` geschaerft: gzip-JS und groesstes JS-Asset nach belastbaren Vorschlaegen gesenkt, `maxJsBytes` bei der bestehenden strengeren 5.2-MB-Grenze belassen, LCP/CLS/JS-Ausfuehrung fuer `simulate/mobile-375x812` aktualisiert. Der einzelne `/`-LCP-Cold-Run-Ausreisser (22378 ms) wurde nicht als 24616-ms-Budget uebernommen.
- ✅ Folgehaertung nach Outlier-Review: `perf:stability:seed` bekommt einen verworfenen Warm-up-Lauf vor dem ersten validierten Lighthouse-Run, damit First-Sample-Artefakte nicht in `history.json` landen.
- ✅ CI-Enforcement konservativ gehalten: `schedule` laeuft `strict`, `push`/`pull_request` bleiben `warn`, `workflow_dispatch` bleibt wahlweise `warn` oder `strict`.
- ✅ Beobachtungs-Gate operationalisiert: `perf:validate` schreibt `artifacts/performance/observation.json`; der erste manuelle `strict`-Probe-Run wurde danach freigegeben und ist abgeschlossen. Aktuelle Policy: `schedule` strict, `push`/`pull_request` warn, `workflow_dispatch` wahlweise.
- ✅ Fokussierte Tests fuer den Tooling-Slice: `npx vitest run test/unit/budget-suggestions.test.ts test/unit/stability-seed.test.ts test/unit/validate-status-performance-budgets.test.ts test/unit/bundle-report-gzip.test.ts` gruen, 4 Dateien, 14 Tests.
- ⏳ Breitere Strict-Gates bleiben offen, bis mehrere weitere Nightly-Strict-Runs ohne Regressionsrauschen bestehen.

### Phase-4 Slice 2: Planner-Hotspot + Backend-Follow-up (2026-05-07)

- ✅ Planner-Screen-Data als pure Utility extrahiert:
  - `mobile/utils/planner-screen-data.ts` mit `groupEntriesByDay`, `filterPickerRecipes`, `buildRecipeIdMap`, `pickRecipesByIds`
  - `mobile/test/planner-screen-data.test.ts` deckt alle vier Funktionen ab inkl. Performance-Smoke gegen 1000 Rezepte / 50 Entries
- ✅ `mobile/app/(tabs)/planner.tsx` integriert:
  - `useDeferredValue` + `useMemo` im RecipePickerModal (statt Filter-`useEffect` + Doppel-State)
  - `useMemo`-gestuetztes `entriesByDay` (statt 7-fachem `mealPlan.filter` pro Render)
  - `React.memo` auf `DayColumn` mit stabiler `useCallback`-Ref fuer `handleRemoveEntry`
- ✅ Backend/Search Follow-up fuer Zutaten-Suche im Plan dokumentiert: bei realistischem Datensatz (10–300 Rezepte) ist `searchRecipesByIngredientsAdvanced` (`src/db-react.ts:133-181`) keine Performance-Bremse; kein Backend-Refactor gerechtfertigt
- ✅ Phase 4 damit als abgeschlossen markiert (Acceptance Criteria erfuellt: dokumentierter Backend-Follow-up + messbare Render-Reduktion)
- ✅ Mobile-Suite damals: `83/83` Tests gruen, Mobile-Typecheck clean. Aktueller Stand siehe oben: `87/87`.

### Hinweise

- Der fruehere SDK-55-Blocker fuer `react-native-reanimated`/`react-native-worklets` ist mit dem Expo-SDK-56-Core-Slice geloest; beide Pakete wurden zusammen auf die SDK-56-kompatible Linie gehoben.
- NativeWind 5/Tailwind 4 wurde nicht mit dem SDK-Core-Slice vermischt und bleibt als separater Styling-Track offen.
- Ein Build-Blocker wurde behoben: `mobile/assets/images/favicon.png` war zuvor inhaltlich eine ICO-Datei mit falscher `.png`-Endung.
