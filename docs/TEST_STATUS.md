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

1. **Einkaufsliste:**
   - [ ] Einkaufsliste laden via API
   - [ ] "Aus Rezept hinzufügen" — funktioniert der Flow?
   - [ ] Zutaten-Suche matcht korrekt mit Dictionary?

2. **Dictionary:**
   - [ ] Keine UI zum Anzeigen/Verwalten des Dictionaries
   - [ ] Matching via `/api/v1/dictionary/match` nicht getestet

3. **Zutaten-Suche:**
   - [ ] Suche nach "ei" → Rezepte mit "Ei" oder "Eier"
   - [ ] Mehrere Suchbegriffe (OR-Logik)

4. **PDF-Export:**
   - [ ] PDF-Download bei Rezepten ohne source_url
   - [ ] QR-Code wird korrekt generiert
   - [ ] Umlaute/Sonderzeichen in Rezepten

---

## Durchgeführte Tests

- ✅ `npm run build:mobile` — baut die Expo-Web-App nach `public/`
- ✅ `npx tsc --noEmit` — TypeScript-Check (Root + Mobile)
- ✅ `npm run test:unit` — **438 Tests bestanden, 13 skipped** (Stand: 2026-05-13)
- ✅ `npm --prefix mobile run test:unit` — **86 Tests bestanden** (Stand: 2026-05-13)
- ℹ️ E2E-/Docker-Tests skippen graceful, wenn kein Server bzw. Container läuft

---

## Mobile / Expo Status (2026-05-13)

- ✅ `cd mobile && CI=1 npx expo-doctor` — `18/18` Checks bestanden
- ✅ `npm run mobile:typecheck` — erfolgreich
- ✅ `npm run test:mobile` — `86/86` Tests bestanden
- ✅ `npm run mobile:build:web` — erfolgreicher Expo-Web-Export nach `public/`
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
  - offener Rest: 10 stabile vollstaendige Runs sammeln, bevor Strict-Gates aktiviert werden
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
- ✅ CI-Enforcement konservativ gehalten: `performance-audit` bleibt auf `warn` by default; `strict` wird nur noch per explizitem `workflow_dispatch` aktiviert.
- ✅ Beobachtungs-Gate operationalisiert: `perf:validate` schreibt jetzt `artifacts/performance/observation.json` und markiert den ersten manuellen `strict`-Probe-Run erst dann als freigabefaehig, wenn `5` aufeinanderfolgende gruene CI-Warn-Runs, ein gueltiger Warm-up-Seed und `readiness.ready=true` gleichzeitig vorliegen.
- ✅ Fokussierte Tests fuer den Tooling-Slice: `npx vitest run test/unit/budget-suggestions.test.ts test/unit/stability-seed.test.ts test/unit/validate-status-performance-budgets.test.ts test/unit/bundle-report-gzip.test.ts` gruen, 4 Dateien, 14 Tests.
- ⏳ Strict-Gates bleiben warn-only, bis die geschaerften Budgets mehrere CI-Runs ohne Regressionsrauschen bestehen.

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
- ✅ Mobile-Suite damals: `83/83` Tests gruen, Mobile-Typecheck clean. Aktueller Stand siehe oben: `86/86`.

### Hinweise

- `react`, `react-dom`, `react-native` und `react-native-svg` wurden nach einem Patch-Update-Versuch wieder auf den Expo-SDK-55-Erwartungsstand zurueckgesetzt.
- `react-native-reanimated` bleibt auf `4.2.1`, weil `4.3.0` unter SDK 55 `react-native-worklets@0.8.x` verlangen wuerde.
- Ein Build-Blocker wurde behoben: `mobile/assets/images/favicon.png` war zuvor inhaltlich eine ICO-Datei mit falscher `.png`-Endung.
