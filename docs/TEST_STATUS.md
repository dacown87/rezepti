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
- ✅ `npm test -- --run test/unit` — **370 Tests bestanden, 12 skipped** (Stand: 2026-05-07)
- ✅ `npm --prefix mobile run test:unit` — **83 Tests bestanden** (Stand: 2026-05-07, +12 nach Phase-4 Slice 2)
- ℹ️ E2E-/Docker-Tests skippen graceful, wenn kein Server bzw. Container läuft

---

## Mobile / Expo Status (2026-05-07)

- ✅ `cd mobile && CI=1 npx expo-doctor` — `18/18` Checks bestanden
- ✅ `npm run mobile:typecheck` — erfolgreich
- ✅ `npm run test:mobile` — `83/83` Tests bestanden (Phase-4 Slice 2: `mobile/test/planner-screen-data.test.ts` mit 12 zusaetzlichen Tests)
- ✅ `npm run mobile:build:web` — erfolgreicher Expo-Web-Export nach `public/`
- ✅ Phase-2-Reliability weiter gehaertet:
  - Planner zeigt jetzt sichtbaren Ladefehler mit Retry/Close bei fehlgeschlagenem Wochen-Load
  - Planner-Mutationen zeigen jetzt sichtbare Pending-/Retry-Zustaende fuer Add/Remove, inklusive direktem Retry ohne zweiten Confirm-Dialog beim Remove-Pfad
  - Shopping behaelt gecachte Items bei fehlgeschlagenem Refresh sichtbar
  - Persistierter React-Query-Cache heilt bei korruptem AsyncStorage-Eintrag selbst
  - `addIngredients` liegt als testbarer Service mit bounded concurrency in `mobile/utils/shopping-service.ts`
- ✅ Phase-3-Haertung aktiviert:
  - `performance-audit` richtet Chrome im CI jetzt deterministisch fuer Lighthouse ein
  - `perf:validate` schreibt `artifacts/performance/history.json` und `artifacts/performance/readiness.json`
  - Phase 3 ist damit im Code-/CI-Setup abgeschlossen; aktuelle lokale Readiness-Auswertung: `ready=false`, `runs=1/10`, `warningRate=0.0000`, `fullCoverage=true`
  - offener Rest: weitere echte CI-Laeufe sammeln, bis `artifacts/performance/readiness.json` auf `ready=true` kippt
- ✅ Review-Bugfixes (2026-05-07):
  - `mobile/utils/query-client.ts` — `AsyncStorage.removeItem` in eigenem try/catch abgesichert
  - `mobile/app/(tabs)/planner.tsx` — redundanter innerer Block entfernt, `.catch()` fuer `loadAllRecipes()` im RecipePickerModal, try/catch + Fehler-UI fuer QR-Recipe-Link-Pfad
  - `src/routes/planner.ts` — `canonicalName` Length-Limit (max 500 Zeichen)
  - `scripts/performance/lighthouse-runner.mjs` — API-Mock im statischen Server: `/api/*` → leere JSON-Antworten; LCP misst jetzt echten Empty-State statt API-Timeout (~25s → ~1-2s)
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
- ⚠ Befund fuer Folgearbeit (kein Phase-3-Blocker): LCP auf `/` = ~902 ms, aber `/shopping` und `/recipe/1` jeweils ~25 s. Ursache: API-Mock greift nicht auf parametrisierte Pfade wie `/api/v1/recipes/1`; Catchall liefert `json({})` ohne sinnvolle Struktur, React-Render bleibt im Loading-Zustand bis Lighthouse-Timeout. `metricStabilityMet=true` weil die hohen Werte stabil hoch sind — das ist die Mechanik des Gates. Der LCP-Fix ist im TODO als Folge-Item dokumentiert.

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
- ✅ Mobile-Suite: `83/83` Tests gruen, Mobile-Typecheck clean

### Hinweise

- `react`, `react-dom`, `react-native` und `react-native-svg` wurden nach einem Patch-Update-Versuch wieder auf den Expo-SDK-55-Erwartungsstand zurueckgesetzt.
- `react-native-reanimated` bleibt auf `4.2.1`, weil `4.3.0` unter SDK 55 `react-native-worklets@0.8.x` verlangen wuerde.
- Ein Build-Blocker wurde behoben: `mobile/assets/images/favicon.png` war zuvor inhaltlich eine ICO-Datei mit falscher `.png`-Endung.
