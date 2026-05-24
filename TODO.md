
## 🎯 Aktueller Stand (2026-05-24)

**Coverage-/JobManager-Remediation, Supabase-Data-API-Readiness und die Nightly-Strict-Code-Remediation sind durch. Als Nächstes läuft die neue Nightly-Beobachtungsperiode, bevor Multi-User Login wieder nach oben rückt.**

### Naechste Reihenfolge (priorisiert, Stand 2026-05-24)

1. **Nightly-Strict-Beobachtungsperiode neu starten** — [docs/superpowers/plans/2026-05-24-nightly-strict-remediation-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-24-nightly-strict-remediation-plan.md): nach dem `performance-history-v5`-Reset jetzt Baseline-Dispatch + 3 Nightlies beobachten, bevor Strict wieder als belastbares Betriebssignal gilt.
2. Multi-User Login umsetzen (Auth + RLS + App auf `authenticated`-Key).
3. Northflank-Deploy-Pfad separat neu bewerten (eigener Infra-Track).
4. Test-Infra-Migration von `react-test-renderer` auf `@testing-library/react-native`.
5. Batch 4 (Expo-/Styling-Track) weiter vertagt bis Leitplanken stabil sind.

### Erledigt 2026-05-24

- [x] **Nightly-Strict-Code-Remediation umgesetzt** — `mobile-release-gate` wieder auf Expo-SDK-55-Stand gebracht (`expo-doctor` 19/19, `expo install --check` gruen, Mobile-Typecheck/Web-Build/Coverage lokal gruen); `validate-status.mjs` wertet Strict-Findings jetzt typisiert aus und stuft `ready=false` als `observation_blocked` statt pauschal als Nightly-Fail ein; Performance-History-Cache in `.github/workflows/ci.yml` auf `performance-history-v5` angehoben und per Unit-Test abgesichert.
- [x] **GitHub Docker-Build repariert (Node-Engine-Mismatch)** — `Dockerfile` `base` und `web-builder` auf `node:24.15.0-slim` angehoben, damit `mobile/package.json`-Engines (`node >=24.15.0`, `npm >=11`) mit dem Build-Container uebereinstimmen. Lokaler Gegencheck: `npm --prefix mobile ci` laeuft wieder sauber. (Commit `1a142da`)
- [x] **Next-Priority-Plan erstellt und umgesetzt** — [docs/superpowers/plans/2026-05-24-next-priority-work-plan.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-24-next-priority-work-plan.md) fuehrt Coverage, `JobManager` und Supabase-Readiness zusammen.
- [x] **Coverage-Gates nach Vitest-4-Migration wieder angezogen** — Root und Mobile stehen wieder auf Mindest-Floors `30` fuer lines/statements/functions/branches; `COVERAGE_RATCHET_MIN` bleibt als Anhebungsmechanismus aktiv. Verifiziert mit `npm run test:coverage` und `npm run test:mobile:coverage`.
- [x] **`JobManager`-Tests auf reale Laufzeitlogik umgestellt** — `test/unit/job-manager.test.ts` prueft jetzt echte Methodenpfade aus `src/job-manager.ts` inkl. `create/start/update/complete/fail`, Event-Polling, `getRecentJobs`, `getActiveJobs`, `isUrlProcessing` und Cleanup. Fokustest und Root-Coverage gruen.
- [x] **Supabase Data API Readiness fuer Multi-User konkretisiert** — [docs/supabase-data-api-readiness.md](/home/patrick/Projekte/rezepti/docs/supabase-data-api-readiness.md) enthaelt jetzt eine konkrete RLS-/Grant-Matrix; [db/templates/public-multi-user-data-api-rls.sql](/home/patrick/Projekte/rezepti/db/templates/public-multi-user-data-api-rls.sql) ist als reviewbarer SQL-Draft angelegt. Keine DB-Migration ausgefuehrt.

### Erledigt 2026-05-13

- [x] **2. Strict-Probe-Run** ✅ — Run `25781366107`, performance-audit grün in 7m39s, `enforcement=strict`, `lighthouse=ok`, `readiness ready=true 10/10`.
- [x] **Strict-Schedule eskaliert** — `.github/workflows/ci.yml`: `schedule` (nightly cron 02:00 UTC) läuft jetzt `strict`; `push`/`pull_request` bleiben `warn`; `workflow_dispatch` wahlweise. Runbook + CLAUDE.md aktualisiert. (Commit `7bf820e`)
- [x] **Supabase RLS aktiviert** — RLS auf 5 Tabellen + REST-Grants für anon/authenticated entzogen + `rls_auto_enable()` REST-EXECUTE revoked. Supabase Advisor clean.
- [x] **M3 — Dockerfile changelog-Stage** — `COPY public/changelog.json` durch BuildKit-`RUN --mount=type=bind` mit JSON-Fallback (`{"version":"0.0.0","entries":[]}`) ersetzt. Squash-Merge ohne `public/changelog.json` rötet den Docker-Build nicht mehr. Lokal mit beiden Szenarien verifiziert. (Commit `0642e8c`)
- [x] **P1 — Pre-commit-Hook gegen Phantom-Submodule** — `scripts/hooks/pre-commit` blockt Mode-160000-Entries ohne `.gitmodules`-Eintrag. Aktivierung via `npm install` (`prepare`-Script setzt `core.hooksPath`). Mit 3 Szenarien lokal verifiziert. (Commit `75c5482`)
- [x] **Mobile-Plan Code-Review-Findings (alle 6) abgearbeitet** — Plan-Sektionen "Findings — Phase 1–3" jetzt alle `RESOLVED`:
    - **P2 canonicalName Length-Limit** — war schon umgesetzt (`src/routes/planner.ts:53-55`), nur Plan-Status nachgezogen.
    - **P3 `^`-Constraints React/RN pinnen** — `mobile/package.json`: react/react-dom/react-native/react-native-svg/react-test-renderer auf exakte Expo-SDK-55-Versionen gepinnt. `expo-doctor` weiter 18/18.
    - **P3 Chrome-Versions-Pin in CI** — `.github/workflows/ci.yml:193`: `chrome-version: '150'` (Major-Pin, weil beide grünen Strict-Probes auf Chromium 150 liefen).
    - **P3 Coverage-Schwellenwert effektiv 1%** — `vitest.config.ts` + `mobile/vitest.config.ts`: per-Metrik-Floors statt globaler 1% (Root lines/statements/functions=30, branches=60; Mobile lines/statements=30, functions=35, branches=55). Beide Coverage-Runs grün.
    - **P3 Perf-History-Cache Cross-Branch** — durch früheren `v4-`-Cache-Umstieg + Strict-nur-auf-Schedule bereits entschärft; nur Plan-Status korrigiert.
    - **Info E2E ohne `continue-on-error`** — empirisch resolved: 30/30 E2E-Runs grün; alle 5 Failures lagen in `test`/`performance-audit`.

### Offen / Folgearbeit

- [ ] **Nightly-Strict-Beobachtung nach Remediation** (aktiv, P0-Follow-up) — Code-Fixes sind lokal umgesetzt: Expo-SDK-55-Doctor wieder gruen, Strict-Validator-Policy repariert, History-Cache auf `v5` umgestellt. Offen bleibt der neue Beobachtungszyklus: 1x manueller Baseline-Dispatch und danach 3 Nightlies beobachten. Keine PR-Strict-Eskalation vor stabiler Nightly-Serie.
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
- **Phase 5 Trigger praezisieren (deferred)** — Web Vitals bleiben ausdruecklich **nicht** Teil des Performance-Strict-Gates. Phase 4c liefert jetzt Lab-Daten; ein sinnvoller Trigger waere nur noch: Feldmetrik starten, wenn CI-/Lab-Daten und echte Nutzerberichte auseinanderlaufen oder `simulate`/`devtools` nach 10 stabilen Runs wieder stark divergieren. Aktuell kein Blocker. _Plan: Phase 5 (deferred)_
- **Code-Hygiene: `mobile/app/recipe/[id].tsx` (1092 Zeilen) modularisieren** — `CookModal` (line 127-225), `DeleteModal` (line 104-126), `StarRow`, `normalizeRecipe`, `parseJSON`, `splitIngredientDisplay` in eigene Dateien unter `mobile/components/recipe/` ziehen. Pattern existiert bereits (`ImagePickerModal.tsx`, 160 Zeilen, eigene Datei). Vorteil: Wartbarkeit und Test-Granularitaet. Nach Phase 4c ist das kein Performance-Blocker mehr, weil Outcome Z den LCP geloest hat. _Plan: „Additional Improvements" / Screen-Refactoring nach Messwerten_
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
## Mobile Testing & Performance

> **Plan:** [`docs/superpowers/plans/2026-05-06-mobile-testing-and-performance-plan.md`](docs/superpowers/plans/2026-05-06-mobile-testing-and-performance-plan.md) (Stand 2026-05-13). Items unten = Umsetzung der Plan-Phasen.

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
- [x] **Performance Strict-Probe freigeben** ✅ (2026-05-12 + 2026-05-13) — beide Probe-Runs grün (`25742783313`, `25781366107`). Nightly-Schedule danach auf `strict` eskaliert. _Plan-Phase 3 + Strict-Probe-Gate_
- [ ] Test-Infra-Migration von `react-test-renderer` auf `@testing-library/react-native` (verschoben: aktueller Vitest/RN-Runtime-Blocker; stabile Uebergangsloesung mit `react-test-renderer` aktiv). _Plan: Phase 2 Follow-up_
- [x] Coverage-Thresholds schrittweise anheben — Start-Gate 1% am 2026-05-13 auf per-Metrik-Floors angehoben (Root lines/statements/functions=30, branches=60; Mobile lines/statements=30, functions=35, branches=55). Weitere Ratchet-Schritte manuell über `COVERAGE_RATCHET_MIN`-Env oder Baseline-Anhebung in den Config-Files.
- [x] Lighthouse/Bundles Baseline stabilisieren und Enforce-Pfad schrittweise scharf schalten (warn auf push/PR, strict auf nightly/dispatch)
- [x] Runtime-/Toolchain-Upgrade abgeschlossen: Node 24.15.0 (Projekt/CI-Pinning), Expo SDK 55, React 19.2, React Native 0.83
- [x] Expo-Konfigurationshygiene abgeschlossen: `expo-doctor` 18/18 gruen, `.expo/` korrekt ignoriert, App-Assets fuer Icon/Splash/Favicon vorhanden

## Dependency-Update-Status (2026-05-13)

- Vollstaendige Zielmatrix und Upgrade-Reihenfolge: [docs/superpowers/plans/2026-05-13-full-stack-upgrade-target-matrix.md](/home/patrick/Projekte/rezepti/docs/superpowers/plans/2026-05-13-full-stack-upgrade-target-matrix.md)
- Entscheidungsregel: so modern wie sinnvoll, aber nur auf stabilen Linien und nie gegen Expo-/SDK-Support oder Major-Migrationsrisiken.

### Umsetzung des Upgrade-Plans

- [x] **Batch 0 — CI Runtime Hygiene** teilweise abgeschlossen (2026-05-14) — `.github/workflows/docker-publish.yml` und `.github/workflows/changelog-update.yml` angehoben: `actions/checkout`/`actions/setup-node` bewusst auf `v5` (niedrigeres Migrationsrisiko als `v6` bei gleichem Node-24-Ziel), `docker/login-action` auf `v4`, `docker/build-push-action` auf `v7`. **Restoffen:** `.github/workflows/ci.yml` nutzt weiterhin alte Action-Majors; die Node-20-Deprecation kann daher nicht nur von Northflank kommen. `northflank/deploy-to-northflank@v1` bleibt zusaetzlich als gesonderter Upstream-Sonderfall offen.
- [x] **Batch 1 — Kleinster Code-Track** abgeschlossen (2026-05-14, Mobile-Nachkorrektur 2026-05-24) — `@hono/node-server` `^1.19.14 -> ^2.0.2`; der zwischenzeitliche Mobile-Compiler-Schritt auf TypeScript 6 wurde fuer Expo-SDK-55-Kompatibilitaet wieder auf die Doctor-kompatible 5.9-Linie zurueckgenommen. Verifiziert mit Mobile-Typecheck und `expo-doctor`.
- [x] **Batch 2 — Tooling-Welle** abgeschlossen (2026-05-14 / nachgezogen 2026-05-24) — Root/Mobile `vitest` und `@vitest/coverage-v8` auf `4.1.6`, Root `@vitest/ui` auf `4.1.6`. Test-Mocks fuer Vitest-4-Konstruktorverhalten repariert, Mobile-Resolver fuer `@`-Aliases und `*.native/* .web`-Dateien gehaertet. API-E2E-Contract-Gate wurde am 2026-05-15 echt gebootet; Coverage-Floors wurden am 2026-05-24 wieder auf mindestens `30` angezogen.
- [x] **Batch 3 — Mobile Persistenz** technisch abgeschlossen (2026-05-14, SDK-55-Nachkorrektur 2026-05-24) — der zwischenzeitliche Schritt auf `@react-native-async-storage/async-storage` `3.0.2` wurde fuer Expo-SDK-55-Doctor-Kompatibilitaet wieder auf `2.2.0` zurueckgenommen. Persistenztests, UI-Workflow-Regressionen und Mobile-Coverage bleiben gruen. **Restoffen:** manuelle App-Neustart-Pruefung fuer Settings/Theme/PDF bleibt ausstehend; Batch 3 ist damit dokumentarisch nur technisch fertig, aber noch nicht voll abgenommen.
- [ ] **Batch 4 — Expo-/Styling-Track spaeter** — Expo-SDK-Sprung, `react-native-web`, `react-native-*`, `tailwindcss 4`, `nativewind 5`, `react-native-worklets`/`reanimated` bleiben bewusst vertagt, bis die jeweilige Leitplanke stabil ist.

### Follow-up aus Eng-Review (2026-05-14)

- [x] **Root-API-E2E-Contract-Gate in CI echt booten** abgeschlossen (2026-05-15) — `.github/workflows/ci.yml` startet im `e2e`-Job den Root-Server mit `npm start`, wartet aktiv auf `/api/v1/health` und failt bei Timeout hart. Contract-Gate läuft jetzt über `npm run test:e2e:contract`; Server-Log wird immer als Artifact hochgeladen.
- [x] **Historische Root-E2E-Suite aufräumen und Pflicht-Gate vom Soak-Test trennen** abgeschlossen (2026-05-15) — Pflicht-Gate nutzt nur noch den stabilen Contract-Slice (`test/e2e/contract-api.test.ts`). Legacy-Suite läuft separat über `test:e2e:legacy*`; in CI wurde dafür `e2e-legacy-soak` als separater Nightly-/manueller Soak-Job ergänzt.
- [x] **Legacy-Soak Reporting standardisiert** abgeschlossen (2026-05-15) — CI-Soak nutzt jetzt `npm run test:e2e:legacy:ci` mit Vitest-`junit`-Reporter und schreibt `artifacts/test-reports/e2e-legacy-junit.xml`; Server-Log + Testreport werden als Artifact hochgeladen. Flake-Triage bleibt als laufende Betriebsroutine aktiv.
- [x] **P1 (sofort) Legacy-E2E Polling stabilisieren** abgeschlossen (2026-05-15) — `test/e2e/react-api.test.ts` nutzt jetzt gruppenweit zentrale Polling-Parameter (`LEGACY_E2E_POLLING`) und robuste Endzustands-Assertions (`completed|failed` plus Fehlerkontext), statt fragiler impliziter Erwartungen.
- [x] **P1 (sofort) Performance-Soak als Signal entkoppeln** abgeschlossen (2026-05-15) — Legacy-Performance-Checks sind als non-gating Signal mit Soft-Budgets und Spike-Erkennung umgesetzt (kein harter Merge-Blocker durch einzelne Runner-Latenzspitzen).
- [x] **P2a Legacy-Server-Skip-Welle klassifizieren (Prozess eingefuehrt)** — Owner: TBD (rotierend, jeweils On-Call der Woche). Umgesetzt: deterministisches Skip-Signal aus CI (`artifacts/test-reports/e2e-legacy-skip-signal.json`) + verbindlicher Tagesablauf inkl. SLA (`Start bis 12:00 CET`, `finale Klassifikation bis 18:00 CET`) in `docs/testing/e2e-legacy-flake-inventory.md` und `docs/e2e-legacy-modernization-plan.md`. Abnahmekriterium: jeder Nightly-Lauf mit Skips wird innerhalb eines Arbeitstags als `infra` oder `test` klassifiziert und mit Repro-Hinweis dokumentiert.
- [x] **P2 Legacy-DB-Mutationen testisoliert machen** abgeschlossen (2026-05-15) — Legacy-CRUD-Pfade in `test/e2e/react-api.test.ts` nutzen jetzt deterministische, pro Test isolierte Fixtures (scoped URLs/Recipe-Metadaten), expliziten Recipe-Cleanup-Lifecycle (`register...`/`mark...`) und Cleanup-Diagnostik pro Testlauf. Abnahmekriterium verifiziert: `test:e2e:legacy:db` lief lokal 10/10 hintereinander gruen.
- [x] **P3a Docker-/Umgebungsdiagnostik vom Legacy-API-Vertrag trennen** abgeschlossen (2026-05-15) — Runbook/Doku in `docs/TEST_STATUS.md`, `docs/testing/e2e-legacy-flake-inventory.md` und `docs/e2e-legacy-modernization-plan.md` geschaerft: verbindliche Klassifikationsregeln (`infra` first fuer Docker/Host), Erst-15-Minuten-Checklist und Pflichtformulierung gegen False-Positive-Labeling (`keine Produktregression vor abgeschlossener Environment-Diagnostik`).
- [x] **`JobManager`-Tests wieder auf reale Laufzeitlogik ziehen** — abgeschlossen 2026-05-24: `test/unit/job-manager.test.ts` prueft echte Runtime-Pfade ueber einen expliziten Test-Seam in `src/job-manager.ts`; Fokustest und Root-Coverage gruen.
- [x] **Coverage-Gates nach Vitest-4-Migration wieder anziehen** — abgeschlossen 2026-05-24: Root und Mobile stehen wieder auf Mindest-Floors `30`; Root-Coverage und Mobile-Coverage gruen.
- [ ] **Northflank-Deploy-Pfad separat neu bewerten** — Der Review-Plan hat den Northflank-Sonderfall bewusst **nicht** in die aktuelle Remediation gezogen. Kontext: `docker-publish.yml` ist bereits auf der Node-24-kompatiblen Linie, `northflank/deploy-to-northflank@v1` bleibt aber ein Upstream-Sonderfall. Wenn später Handlungsdruck entsteht, braucht das einen eigenen Infra-Track statt stillen Scope-Creep in Upgrade-PRs.

### Patch-safe (jetzt updatebar; innerhalb `wanted`)

- Root: sichere Root-Patches sind eingespielt; uebrig sind derzeit keine offenen Low-Risk-`wanted`-Updates mehr.
- Mobile: sichere Mobile-Patches fuer `@tanstack/*` sind eingespielt; `@react-navigation/native` wurde fuer Expo-SDK-55 wieder auf die Doctor-kompatible Linie `^7.1.33` zurueckgenommen.
- **Umsetzung 2026-05-13 / Nachkorrektur 2026-05-24:** sichere Root-Patches eingespielt (`@types/node`, `lighthouse`, `openai`, `vite`); Mobile-Patches bleiben innerhalb der Expo-SDK-55-Kompatibilitaet.
- **Peer-/SDK-Blocker:** `react-native-reanimated@4.3.0` verlangt `react-native-worklets@0.8.x`; `expo install react-native-reanimated react-native-worklets` unter SDK 55 hat keine Aenderung vorgenommen (weiter `reanimated@4.2.1`, `worklets@0.7.4`).
- **Aktueller Compatibility-Status (`expo-doctor`):** wieder `19/19` Checks gruen.
- **Build-Fix:** `mobile/assets/images/favicon.png` war inhaltlich eine ICO-Datei mit falscher `.png`-Endung und blockierte `expo export` mit `Unsupported MIME type: image/x-icon`; Asset wurde durch eine echte PNG-Datei ersetzt, `npm run mobile:build:web` laeuft wieder erfolgreich.

### SDK-gebunden (nur mit Expo-Kompatibilitätscheck)

- `react`, `react-dom`, `react-native` sowie `react-native-*` Kernpakete nur im Rahmen der Expo-SDK-Kompatibilität aktualisieren (`expo install`/`expo-doctor` als Gate)
- Alle `expo*` Pakete bleiben SDK-geführt und werden nicht separat "hochgezogen"
- `expo-doctor` ist Teil des CI-Release-Gates; SDK-/Asset-/Config-Drift blockiert damit nicht mehr nur lokal, sondern auch im Mobile-Job.

### Major / später (bewusst vertagt)

- Root: `@hono/node-server` 1 -> 2, `vitest` 3 -> 4, `@vitest/coverage-v8` 3 -> 4, `@vitest/ui` 3 -> 4
- Mobile: `vitest` 3 -> 4, `@vitest/coverage-v8` 3 -> 4; `typescript` 5 -> 6 und `@react-native-async-storage/async-storage` 2 -> 3 bleiben bis zu einer Expo-kompatiblen Linie vertagt
- Mobile, Expo-/SDK-gebunden: `react-native` 0.83 -> 0.85, `react` 19.2.0 -> 19.2.6, `react-dom` 19.2.0 -> 19.2.6, `react-native-gesture-handler` 2.30 -> 2.31, `react-native-safe-area-context` 5.6 -> 5.7, `react-native-screens` 4.23 -> 4.25, `react-native-svg` 15.15.3 -> 15.15.5, `react-test-renderer` 19.2.0 -> 19.2.6
- Mobile, Styling-Track: `tailwindcss` 3 -> 4 bleibt bis zu einer stabilen `NativeWind`-v5-Linie vertagt.
- Mobile, harter Blocker: `react-native-worklets` 0.7 -> 0.8 und damit indirekt `react-native-reanimated` 4.2 -> 4.3 bleiben bis zu einem passenden Expo-SDK vertagt.
