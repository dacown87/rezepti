
## 🎯 Aktueller Stand (2026-05-13)

**Strict-Performance-Gate live, Aufräumtasks (M3, P1) durch.** Nächste größere Arbeit ist Multi-User Login.

### Erledigt 2026-05-13

- [x] **2. Strict-Probe-Run** ✅ — Run `25781366107`, performance-audit grün in 7m39s, `enforcement=strict`, `lighthouse=ok`, `readiness ready=true 10/10`.
- [x] **Strict-Schedule eskaliert** — `.github/workflows/ci.yml`: `schedule` (nightly cron 02:00 UTC) läuft jetzt `strict`; `push`/`pull_request` bleiben `warn`; `workflow_dispatch` wahlweise. Runbook + CLAUDE.md aktualisiert. (Commit `7bf820e`)
- [x] **Supabase RLS aktiviert** — RLS auf 5 Tabellen + REST-Grants für anon/authenticated entzogen + `rls_auto_enable()` REST-EXECUTE revoked. Supabase Advisor clean.
- [x] **M3 — Dockerfile changelog-Stage** — `COPY public/changelog.json` durch BuildKit-`RUN --mount=type=bind` mit JSON-Fallback (`{"version":"0.0.0","entries":[]}`) ersetzt. Squash-Merge ohne `public/changelog.json` rötet den Docker-Build nicht mehr. Lokal mit beiden Szenarien verifiziert. (Commit `0642e8c`)
- [x] **P1 — Pre-commit-Hook gegen Phantom-Submodule** — `scripts/hooks/pre-commit` blockt Mode-160000-Entries ohne `.gitmodules`-Eintrag. Aktivierung via `npm install` (`prepare`-Script setzt `core.hooksPath`). Mit 3 Szenarien lokal verifiziert. (Commit `75c5482`)

### Offen / Folgearbeit

- [ ] **Nightly-Strict-Beobachtung** (passiv) — Erste 1–2 Wochen Nightly-Runs auf Drift/Flakes beobachten. Wenn stabil grün: nächste Eskalation `pull_request` strict erwägen. Wenn rote Runs: Root-Cause-Analyse + ggf. Budget-Anpassung via `perf:budget:suggest`.
- [ ] **Multi-User Login** (nächste große Phase) — Supabase Auth + echte RLS-Policies mit `auth.uid() = user_id`, App auf `authenticated`-Key umstellen. Siehe Abschnitt „Nächste große Phase — Multi-User Login" weiter unten.

---

## 🚨 Sicherheit — RLS aktivieren ✅ ABGESCHLOSSEN (2026-05-13)

- [x] **Supabase Advisor-Warnung: `rls_disabled_in_public`** behoben — `db/migrations/2026-05-12-enable-rls.sql` über SQL Editor ausgeführt: RLS auf `recipes`, `ingredient_dictionary`, `shopping_list`, `meal_plan`, `api_keys` aktiviert + REST-Grants für anon/authenticated entzogen.
- [x] **Zusatz-Advisor `rls_auto_enable` SECURITY DEFINER** behoben — `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public` ausgeführt. Event-Trigger-Funktion bleibt funktional (läuft via DDL, nicht REST). Statement im Migration-File ergänzt.
- Backend nutzt weiter `DATABASE_URL` mit postgres-Superuser → RLS wird automatisch umgangen, App-Funktion unverändert.
- **Spätere Multi-User-Phase:** echte Policies mit `auth.uid() = user_id` schreiben und App auf `authenticated`-Key umstellen (siehe „Nächste große Phase — Multi-User Login" unten)

---

## Phase 9 — Quality & Stability ✅ ABGESCHLOSSEN (2026-04-16)

- **9a** — CLAUDE.md auf PostgreSQL/Supabase aktualisiert
- **9b** — `db-react.test.ts` neugeschrieben: `detectCategory` pure tests (19), DB-Integration-Tests mit `skipIf(!TEST_DATABASE_URL)` (4); `.github/workflows/ci.yml` mit `postgres:15` + `drizzle-kit push --force`
- **9c** — React Query v5 + AsyncStorage-Persistenz (`PersistQueryClientProvider`); `useRecipes`/`useRecipe`/`useUpdateRecipe`/`useDeleteRecipe` Hooks; `OfflineBanner`; `index.tsx` auf stale-while-revalidate umgestellt
- **9d** — QR-Scanner: jsQR-Fallback für Firefox/Safari; dreistufiger Autofokus (getUserMedia + onloadeddata-Timing + direct applyConstraints)
- **9e** — `user_id` UUID nullable in recipes/shoppingList/mealPlan/apiKeys; `src/auth.ts` Stub (`getCurrentUserId`/`isAuthenticated`)
- **9f** — `youtube.test.ts` (10), `schema-org.test.ts` (22), `chefkoch.test.ts` (14); Fix: `parseGermanPortions` Regex für "1 Person" (Singular)
- **Chefkoch tags bug** — `recipeCategory`/`recipeCuisine` als `string | string[]` typisiert, vor Spread normalisiert
- **Connection pool** — `connect_timeout: 10, idle_timeout: 30` in `src/db-react.ts`

---

## Bugfixes nach Phase 9 ✅ (2026-04-16)

- **QR-PDF nicht scannbar** — `width: 80→400px` + `errorCorrectionLevel: L`; QR enkodiert jetzt URL (`<serverUrl>/recipe/<id>`) statt JSON → Version 2 statt 20+, trivial scannbar
- **QR-Scan öffnet Rezept direkt** — Scanner erkennt URL-Muster `/recipe/<id>` und navigiert direkt; Legacy-JSON-Format als Fallback
- **Planer komplett leer** — zwei Bugs: Client sendete `?weekStart=` statt `?week=`; Server-Response `{ entries }` wurde als Array geparsed → beide Fixes in `planner.tsx`
- **Planer TS-Fehler** — doppeltes `showsHorizontalScrollIndicator` Attribut entfernt

---

## Migration: SQLite → Supabase — ✅ ABGESCHLOSSEN (2026-04-16)

Phase 1 (Mobile: expo-sqlite entfernt) und Phase 2 (Server: PostgreSQL via Supabase) sind vollständig umgesetzt und in Produktion.

---

## Bildauswahl nach Foto-Import — ✅ ABGESCHLOSSEN (2026-04-14)

- Modal erscheint immer nach Foto-Import
- Rezeptname wird automatisch in Suchleiste vorausgefüllt + Auto-Search
- Settings: Bildanzahl konfigurierbar (4/8/16, default 4)
- Backend `GET /api/v1/images/search?q=&limit=N`

---

## Phase 10 — ingredientGroups + universelle Bild-Auswahl ✅ ABGESCHLOSSEN (2026-04-25)

- **10a** — Datenmodell: `ingredientGroups` in `RecipeDataSchema` + `ContentBundle`; Spalte `ingredient_groups text` in DB; Supabase-Migration deployed; Save/Update/Deserialize in `db-react.ts`
- **10b** — LLM: SYSTEM_PROMPT + `normalizeGroupsToIngredients` in `llm.ts`
- **10c** — Cookidoo DOM-Extraktion + `pipeline.ts`-Injection
- **10d** — Gruppenanzeige + Edit-Modus + „Bild ändern"-Overlay in `mobile/app/recipe/[id].tsx`
- **10e** — Universelle Bildauswahl nach jedem Import (Bedingung vereinfacht)
- **Bugfix** — `onSkip`-Prop in `ImagePickerModal` auf Rezeptdetailseite (`74c5413`, v1.0.95)

---

## Phase 11 + Social-Media-Fixes — ✅ ABGESCHLOSSEN (2026-04-29)

- **11a** ✅ HTML-Cleanup in `extractMainText()`: Ads/Kommentare/Social/Newsletter entfernt; WPRM + Tasty-Recipes als Priorität; 6000 Zeichen Limit
- **11b** ✅ `parseNutritionInfo()` war bereits implementiert; `SchemaOrgRecipe.nutrition`-Typ auf alle Felder erweitert (kein Cast mehr)
- **11c** ✅ `decodeHtmlEntities()` für named/dezimale/hex Entities; Zutaten + Schritte werden dekodiert
- **11d** ✅ `twitter:image` als drittes Bild-Fallback mit URL-Auflösung
- **Instagram** ✅ Web-Scraping-Fallback: mehr Selektoren + Embedded-JSON-Extraktion
- **TikTok** ✅ ffmpeg-Verfügbarkeits-Check; OCR auf `extractRecipeFromText()` umgestellt
- **Pinterest** ✅ `findOriginalUrl()` sucht in `__PWS_DATA__`, Script-Tags und `"link"`-Regex

## Phase 12 — Social Media Erweiterungen

- **12a** ✅ Facebook als Quelltype: `classifier.ts`, `src/fetchers/facebook.ts` (yt-dlp + OG-Fallback + Cookie-Management), Pipeline-Case — bereits vollständig implementiert
- **12b** ✅ Cobalt.tools als Fallback zu yt-dlp für Instagram/TikTok/Facebook — `src/fetchers/cobalt.ts`; API `api.cobalt.tools`; `COBALT_API_URL` + `COBALT_API_KEY` in `.env`; öffentliche Instanz funktioniert ohne Key (Turnstile-Fehler werden still ignoriert)

---

## Phase 13 — Import-Qualität (reviewed 2026-04-29, Plan: `docs/phase-13-reviewed.md`)

> Review-Entscheidungen: 13j zuerst in Welle 4 · parsedIngredients ephemer · Sample-Test vor 13a · ReDoS-Schutz + Block-Cap eingebaut

### Vorarbeit (vor 13a)
- **Sample-Test** ✅ ABGESCHLOSSEN (2026-04-29) — 19 URLs getestet. Ergebnisse: `scripts/sample-test-analysis.md`, Rohdaten: `scripts/sample-test-results.json`
  - **53%** JSON-LD vollständig (ohne LLM nutzbar)
  - **26%** CSS-Fallback nötig (LLM-Extraktion aus Text)
  - **16%** HTTP 403 (Bot-Schutz — kein Schema-Problem)
  - **5%** Body-Fallback (lidl-kochen.de, kein strukturierter Inhalt)
  - **Befund:** ichkoche.at hat **Microdata** (kein JSON-LD) → 13b hat klaren ROI
  - **Befund:** Wild-Mode (13e) — 0 Kandidaten im Sample → niedrigere Priorität
  - **Befund:** Bot-403 → neue Fehlerkategorie für 13c: "Website erlaubt kein Abrufen (Bot-Schutz)"
  - **Prioritätsänderung:** 13b als erste Priorität in Wave 2; 13e nachrangig

### Vorarbeit ✅ ABGESCHLOSSEN (2026-04-30)
- **Regressions-Unit-Tests aus DB-Rezepten** ✅ — `test/unit/web-regression.test.ts` + `scripts/generate-regression-fixtures.ts`; läuft mit `TEST_NETWORK=1`

### Welle 1 — Sofort-Wins ✅ ABGESCHLOSSEN (2026-04-30)
- **13a** ✅ — CSS-Selektor-Erweiterung in `src/fetchers/web.ts:extractMainText()`: 30+ Klassen (Mediavine, Food Network, hrecipe, Wildcard-Selektoren)
- **13c** ✅ — Fehlermeldungen in `toUserFriendlyError()`: Bot-403, HTTP 404, YouTube ohne Untertitel, TikTok privat, Instagram/TikTok kein Login, Timeout mit Sekunden
- **13f** ✅ — `PipelineResult.qualityWarnings?: string[]`; Pipeline prüft name/ingredients/steps; dismissibler gelber Badge in `extract.tsx`

### Welle 2 — Schema-Erweiterungen ✅ ABGESCHLOSSEN (2026-04-30 / 13e: 2026-04-30)
- **13b** ✅ — `extractMicrodataRecipe()` in `src/fetchers/web.ts`: itemprop-Parsing (HowToStep, meta/datetime attrs, img src); Fallback nach JSON-LD; 6 Tests in `test/unit/web.test.ts`
- **13e** ✅ — `extractWildJsonLd()` in `src/fetchers/web.ts`: Script-Tags ohne korrekten type + `window.__NUXT__/__NEXT_DATA__`; `deepFindRecipe()` für beliebig verschachteltes JSON; **ReDoS-Schutz: `html.slice(0, 100_000)`**; 4 Tests in `web.test.ts`

### Welle 3 — Neue Features
- **13g** ✅ — `POST /api/v1/extract/text`; dritter Tab in `extract.tsx` (URL · Text · Foto, Icon: `Type`); multiline TextInput mit Zeichen-Zähler; min 50 Zeichen Validation
- **13d** ✅ — Ingredient-Parser `src/processors/ingredient-parser.ts`: `parseIngredient()` → `{amount, unit, food, note}`; Unicode-Brüche (½¼¾⅓...), gemischte Zahlen (1 1/2), Ranges (3-4 → note), Klammer- und Komma-notes; 23 Tests in `ingredient-parser.test.ts`
- **13i** ✅ — `estimateNutrition()` in `llm.ts`; Pipeline schätzt Kalorien nach Extraktion wenn leer; `nutritionEstimated: true` im Job-Result (kein DB-Feld); Frontend: `~X kcal (KI-Schätzung)` auf Bild-Review- + Success-Screen

### Welle 4 — Komplexe Features
- **13j** ✅ — Plugin-Architektur: `web/base.ts` (Utilities + `WebScraperPlugin`), `web/chefkoch.ts` (Domain-Override), `web/index.ts` (Registry + Dispatcher); `web.ts` → Re-Export; Code-Duplikation in `chefkoch.ts` eliminiert
- **13h** ✅ — ML-Fallback: `extractDomBlocks()` mit DOM-Block-Cap max 10; Feature-Flag `ENABLE_ML_FALLBACK=true`; nur aktiv bei Body-Fallback; Tests in `test/unit/web.test.ts`

### Backlog (interessant für später)
- Supadata.ai API für Instagram-Transkripte (kostenloses Free-Tier)
- OpenRouter als BYOK-LLM-Alternative (1B Token/Monat gratis, Llama 4 Scout, DeepSeek V3)
- Ollama als lokaler LLM-Fallback für Self-Hosted-User
- Llama 4 Scout auch für Textextraktion (bereits für Vision: 1.5× günstiger — nur `.env`-Änderung)
- Bild-Optimierung beim Import: WebP-Konvertierung + Resizing (Mealie-Pattern, braucht Sharp)
- Vision-basierte Rezeptkarten-Erkennung via Llama 4 Scout (Pinterest-Karten, Buchseiten)
- Rezept-Qualitäts-Scoring: automatischer Score → LLM-Refinement nur wenn Score < Threshold
- **Open Food Facts Barcode-API** — EAN/UPC scannen → Produktname + Nährwerte + Bild via `openfoodfacts.org/api/v2/product/{barcode}`; QR-Scanner-Erweiterung
- **PDF-Import** — PDF hochladen → Text extrahieren (pdf-parse) → LLM → Rezept; wir haben die LLM-Pipeline schon
- **Format-Import** — Paprika (.paprikarecipes = ZIP mit JSON), Nextcloud Cookbook (JSON-LD-Dateien) als Upload-Formate für Migrations-Usecase
- **Bessere Bildauswahl** — mehrere Bild-Kandidaten nach Auflösung/Größe ranken statt erstes nehmen (recipe-scrapers `BEST_IMAGE_SELECTION`-Pattern)
- **AI-Schritt-Sortierung** — LLM prüft ob Zubereitungsschritte in logischer Reihenfolge sind und sortiert ggf. um (Tandoor-Pattern)
- **Cooklang-Import** — `.cook`-Dateien hochladen und importieren; einfaches Format, kleine aber treue Community
- **Weitere Migrations-Formate** — Copy Me That, Pepperplate, Evernote, Cookmate als Import-Formate (über Paprika/Nextcloud hinaus, RecipeSage-Pattern)
- **CSV-Export** — Rezept-Sammlung als Tabelle exportieren (Spreadsheets, Backup)
- **Markdown-Export** — einzelnes Rezept als `.md`-Datei (Obsidian, Notion, etc.)
- **Phase 5 Trigger praezisieren (deferred)** — Web Vitals bleiben ausdruecklich **nicht** Teil des Performance-Strict-Gates. Phase 4c liefert jetzt Lab-Daten; ein sinnvoller Trigger waere nur noch: Feldmetrik starten, wenn CI-/Lab-Daten und echte Nutzerberichte auseinanderlaufen oder `simulate`/`devtools` nach 10 stabilen Runs wieder stark divergieren. Aktuell kein Blocker.
- **Code-Hygiene: `mobile/app/recipe/[id].tsx` (1092 Zeilen) modularisieren** — `CookModal` (line 127-225), `DeleteModal` (line 104-126), `StarRow`, `normalizeRecipe`, `parseJSON`, `splitIngredientDisplay` in eigene Dateien unter `mobile/components/recipe/` ziehen. Pattern existiert bereits (`ImagePickerModal.tsx`, 160 Zeilen, eigene Datei). Vorteil: Wartbarkeit und Test-Granularitaet. Nach Phase 4c ist das kein Performance-Blocker mehr, weil Outcome Z den LCP geloest hat.

---

## Offene Punkte nach QA + Code-Review (2026-05-01)

- **Cleanup-Plan:** `docs/superpowers/plans/2026-05-05-cleanup-punkte-3-4-5-6-7-8-9-12-13.md`
- **Stand 2026-05-06:** Code-Punkte 3, 4, 5, 6, 7, 8, 9 und 12 committed (5617a12); Punkt 13 wurde als separater manueller Supabase-Ops-Schritt gegen die konfigurierte `rezepti-dev`-Datenbank ausgefuehrt.
- **Punkt 13 Ergebnis:** Vorab-Pruefung fuer `recipes.id = 36` ergab bereits keinen Datensatz mehr; `meal_plan` und `shopping_list` standen ebenfalls auf `0`. Der transaktionale Delete lief damit als verifizierter No-Op, die Nachpruefung blieb bei `0/0/0`.

### Erledigte/veraltete QA-Punkte (geprüft 2026-05-05)

- **Frontend-Build fehlt** — überholt: `npm run build:mobile` wurde laut `docs/TEST_STATUS.md` am 2026-05-04 erfolgreich ausgeführt; `public/` enthält den Expo-Web-Build inklusive `extract.html`.
- **Phase-13-Plan gegenlesen** — erledigt: 13g Freitext-Tab, 13h ML-Fallback und 13i Nährwert-Anzeige sind im Code vorhanden; Restpunkte bleiben separat als Chefkoch-Plugin-Dead-Code und TikTok-OCR-Optimierung stehen.
- **Logo-Asset 404** — im Workspace behoben: enger `/assets/Logo*.png`-Fallback, vorhandene hashed Assets bleiben direkt erreichbar, fremde fehlende Assets liefern weiter 404.
- **chefkoch Plugin dead code** — im Workspace behoben: unerreichbares Plugin entfernt, Chefkoch bleibt dedizierter Fetcher-Pfad.
- **TikTok OCR doppelter LLM-Aufruf** — im Workspace behoben: Plaintext-Vision-Helper statt Recipe-Schema-Extraktion fuer OCR-Frames.

---

## Nächste große Phase — Multi-User Login

- Supabase Auth (JWT/Session), `user_id` in allen Tabellen, RLS, Auth-Middleware
- Rezept-Sharing via Link (ersetzt QR-Code-JSON-Sharing)
- **Vorarbeit (9e):** `user_id` nullable UUID ins Schema — erleichtert späteren Auth-Umbau

---

## Test-Status (2026-05-06)

- Unit Tests: 366 bestanden + 12 skipped
- Cleanup-Commit (5617a12): Planner-Routes, Shopping-Vertrag, PDF-Helper, Native-PDF-Wiring, Static Assets, TikTok-OCR, Chefkoch-Routing — alle grün
- DB-Integration: weiter unter `TEST_DATABASE_URL`, im lokalen Default-Lauf geskippt
- E2E Tests: skippen graceful ohne laufenden Server
- Regressions-Tests: `TEST_NETWORK=1 npx vitest run test/unit/web-regression.test.ts`
- `npm test -- --run --exclude="test/e2e/**"`
## Aktueller Fokus — Mobile Testing & Performance (2026-05-07)

- [x] Mobile Release Gate + CI-Job stabil (`mobile:typecheck`, `build:web`, `test:unit`)
- [x] Phase-2 Reliability-Basis (Hooks/Contracts/QueryClient) steht
- [x] UI-Fallback-Tests für Recipe List, Shopping und Recipe Detail ergänzt
- [x] Shopping-Screen: sichtbarer Error + Retry statt stillem Empty-State bei API-Fehler
- [x] UI-naher End-to-End-Workflow-Test `list -> detail -> shopping` (screennah, interaktionsgetrieben)
- [x] Planner-/Shopping-Recovery weiter ausgebaut: Planner-Load-Retry sichtbar, Shopping-Refresh hält gecachte Items nutzbar
- [x] Query-Cache-Recovery gehärtet: korruptes AsyncStorage-Persist wird verworfen statt den App-Start zu kippen
- [x] `addIngredients` in testbaren Service mit bounded concurrency verschoben (`mobile/utils/shopping-service.ts`)
- [x] Phase-4 Slice 1: Recipe-List-Derived-Data entkoppelt (`mobile/utils/recipe-list-screen-data.ts`, `useDeferredValue`, stabilere `FlatList`-Configs)
- [x] Phase-4 Slice 1: deterministischer 300-1000-Rezepte-Fixture-Harness (`mobile/test/fixtures/recipe-performance-fixture.ts`)
- [x] Phase-4 Slice 1: Shopping-/Recipe-Detail-Hotspots reduziert (vorbereitete Anzeige-Daten, weniger wiederholte Ableitungen)
- [x] Phase 2 Restlücken final geschlossen: Planner-Mutationsstates (`add/remove pending`) und sichtbare Rescue-Pfade
- [x] Phase 3 Code-Härtung abgeschlossen: echter Chrome im CI, History-/Readiness-Auswertung und cache-basierte Run-Historie aktiv
- [x] Review-Bugfixes Phase 1–3 gefixt (2026-05-07): `canonicalName`-Length-Limit, `planner.tsx`-Fehlerbehandlung, `query-client`-cleanup-guard, Lighthouse-API-Mock fuer parametrisierte Pfade, LCP/CLS-Budget-Checks in `validate-status.mjs`
- [x] Phase-4 Slice 2 abgeschlossen (2026-05-07): `mobile/utils/planner-screen-data.ts` (pure Utility), `mobile/test/planner-screen-data.test.ts` (12 Tests), Integration in `planner.tsx` (`useDeferredValue`, `useMemo`-`entriesByDay`, `React.memo` auf `DayColumn`, `useCallback` fuer `handleRemoveEntry`)
- [x] Phase-4 Backend/Search-Follow-up dokumentiert: bei realistischem Datensatz (10–300 Rezepte) ist `searchRecipesByIngredientsAdvanced` (`src/db-react.ts:133-181`) keine Performance-Bremse — kein Backend-Refactor gerechtfertigt; Phase 4 damit erfuellt
- [x] Phase 3 empirisch abgeschlossen (2026-05-08): 10 lokale Runs geseedet, `artifacts/performance/readiness.json` auf `ready=true` mit allen 4 Checks gruen (`minRunsMet`, `warningRateMet`, `fullCoverageMet`, `metricStabilityMet`). LCP-Spread <= 2% pro Route. `history.json` + `readiness.json` jetzt versioniert (siehe `.gitignore`).
- [x] Folgearbeit API-Mock erledigt (Commit `3c2c7fd`, 2026-05-09): `matchApiRoute()` extrahiert, `/api/v1/recipes/:id` + `/api/v1/shopping/:id|checked|all` abgedeckt, 17 Unit-Tests. Mock antwortet korrekt — aber LCP-Befund war tiefer (siehe naechster Punkt).
- [x] Phase-4b Spinner-zu-Skelett-Refactor erledigt (Commit `04ca16e`, 2026-05-09): `shopping.tsx` + `recipe/[id].tsx` rendern Header-Shell + Skelett-Container ab erstem React-Frame. Real-Device-UX verbessert; Lighthouse-LCP unveraendert (~25 s) — Bottleneck ist Bundle-Hydration, nicht Render-Pattern.
- [x] **Phase 4c — Throttling Validation + One Optimization Slice** abgeschlossen (2026-05-11): `LIGHTHOUSE_THROTTLING=simulate|devtools`, `perf:lighthouse:compare`, `throttling-comparison.json`, methodenfaehige Budgets, gzip-JS-Metriken und JS-Ausfuehrungszeit-Budget umgesetzt. Outcome Y als Bundle-Slice erledigt (PDF-Export lazy-loaded); Outcome Z als finaler LCP-Fix validiert (`mobile/app/+html.tsx` rendert route-aware statische App-Shell). Mobile p50 LCP nach Vergleich: `/` 903/1450 ms, `/shopping` 902/1448 ms, `/recipe/1` 1052/1414 ms (`simulate`/`devtools`). Kanonisch: `docs/performance/throttling-analysis.md` und `docs/superpowers/plans/2026-05-06-mobile-testing-and-performance-plan.md`.
- [x] **Performance Strict-Hardening Tooling-Slice (2026-05-11):** `perf:stability:seed` automatisiert die 10 echten Runs, `validate-status` schreibt eindeutige methodenmarkierte History-Eintraege, `perf:budget:suggest` berechnet Budget-Vorschlaege aus vollstaendigen Runs (`p95 * 1.10`). Fokussierte Tests gruen.
- [ ] **Performance Strict-Probe freigeben:** `performance-audit` in CI bei `warn` belassen, `5` aufeinanderfolgende gruene CI-Warn-Runs sammeln, danach einen frischen `npm run perf:stability:seed` als Warm-up-Nachweis verifizieren. Erst wenn `artifacts/performance/observation.json` `strictProbeEligible=true` meldet, ist ein einzelner manueller `workflow_dispatch` mit `perf_enforcement=strict` als Probe erlaubt.
- [ ] Test-Infra-Migration von `react-test-renderer` auf `@testing-library/react-native` (verschoben: aktueller Vitest/RN-Runtime-Blocker; stabile Uebergangsloesung mit `react-test-renderer` aktiv)
- [x] Coverage-Thresholds schrittweise anheben (Start-Gate 1% -> ratcheting via `COVERAGE_RATCHET_MIN`)
- [x] Lighthouse/Bundles Baseline stabilisieren und Enforce-Pfad schrittweise scharf schalten (warn auf push/PR, strict auf nightly/dispatch)
- [x] Runtime-/Toolchain-Upgrade abgeschlossen: Node 24.15.0 (Projekt/CI-Pinning), Expo SDK 55, React 19.2, React Native 0.83
- [x] Expo-Konfigurationshygiene abgeschlossen: `expo-doctor` 18/18 gruen, `.expo/` korrekt ignoriert, App-Assets fuer Icon/Splash/Favicon vorhanden

## Dependency-Update-Status (2026-05-07)

### Patch-safe (jetzt updatebar; innerhalb `wanted`)

- Root: `@types/node`, `dotenv`, `drizzle-orm`, `hono`, `openai`, `typescript`, `vite`, `zod`, `@hono/node-server` (v1.x)
- Mobile: `@tanstack/query-async-storage-persister`, `@tanstack/react-query`, `@tanstack/react-query-persist-client`, `lucide-react-native`, `react`, `react-dom`, `react-native` (0.83.x), `react-native-reanimated`, `react-native-svg`, `react-test-renderer`
- **Umsetzung 2026-05-07:** Root-Updates vollstaendig eingespielt. Mobile-Patch-Updates fuer `@tanstack/*` und `lucide-react-native` bleiben aktiv; die SDK-gebundenen Pakete `react`, `react-dom`, `react-native` und `react-native-svg` wurden bewusst auf Expo-Expected zurueckgesetzt (`19.2.0`, `19.2.0`, `0.83.6`, `15.15.3`). `react-test-renderer` wurde dazu passend wieder auf `19.2.0` ausgerichtet.
- **Peer-/SDK-Blocker:** `react-native-reanimated@4.3.0` verlangt `react-native-worklets@0.8.x`; `expo install react-native-reanimated react-native-worklets` unter SDK 55 hat keine Aenderung vorgenommen (weiter `reanimated@4.2.1`, `worklets@0.7.4`).
- **Aktueller Compatibility-Status (`expo-doctor`):** wieder `18/18` Checks gruen.
- **Build-Fix:** `mobile/assets/images/favicon.png` war inhaltlich eine ICO-Datei mit falscher `.png`-Endung und blockierte `expo export` mit `Unsupported MIME type: image/x-icon`; Asset wurde durch eine echte PNG-Datei ersetzt, `npm run mobile:build:web` laeuft wieder erfolgreich.

### SDK-gebunden (nur mit Expo-Kompatibilitätscheck)

- `react`, `react-dom`, `react-native` sowie `react-native-*` Kernpakete nur im Rahmen der Expo-SDK-Kompatibilität aktualisieren (`expo install`/`expo-doctor` als Gate)
- Alle `expo*` Pakete bleiben SDK-geführt und werden nicht separat "hochgezogen"
- `expo-doctor` ist Teil des CI-Release-Gates; SDK-/Asset-/Config-Drift blockiert damit nicht mehr nur lokal, sondern auch im Mobile-Job.

### Major / später (bewusst vertagt)

- Root: `@hono/node-server` 1 -> 2, `vitest` 3 -> 4, `@vitest/coverage-v8` 3 -> 4, `@vitest/ui` 3 -> 4
- Mobile: `vitest` 3 -> 4, `@vitest/coverage-v8` 3 -> 4, `tailwindcss` 3 -> 4, `typescript` 5 -> 6, `react-native` 0.83 -> 0.85, `@react-native-async-storage/async-storage` 2 -> 3, `react-native-worklets` 0.7 -> 0.8
