
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
- **13g** — Freitext-Import: `POST /api/v1/extract/text` + dritter Tab in `extract.tsx` (URL > Text > Foto, Icon: `Type`); min 50 Zeichen Validation; CLAUDE.md ergänzen
- **13d** — Ingredient-Parser `src/processors/ingredient-parser.ts`: `"200 g Mehl"` → `{amount, unit, food, note}`; **ephemer** (kein DB-Feld); koordinieren mit `scaling.ts`; Tests in `ingredient-parser.test.ts`
- **13i** — Nutrition-Auto-Detection in `src/pipeline.ts`: LLM schätzt Nährwerte wenn `calories` leer; `nutritionEstimated: true` im Response; Frontend: `~` vor Werten

### Welle 4 — Komplexe Features
- **13j** ← ZUERST — Domain-spezifische Scraper-Module: `src/fetchers/web/base.ts` + `chefkoch.ts` + `index.ts`; vor Merge: `grep -r "from.*fetchers/web" src/`
- **13h** ← NACH 13j — ML-Fallback: DOM-Block-Cap max 10; Feature-Flag `ENABLE_ML_FALLBACK=true`; nur wenn alle anderen Stufen scheitern

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

---

## Nächste große Phase — Multi-User Login

- Supabase Auth (JWT/Session), `user_id` in allen Tabellen, RLS, Auth-Middleware
- Rezept-Sharing via Link (ersetzt QR-Code-JSON-Sharing)
- **Vorarbeit (9e):** `user_id` nullable UUID ins Schema — erleichtert späteren Auth-Umbau

---

## Test-Status (2026-04-30)

- Unit Tests: 297 bestanden + 9 skipped (DB-Integration: laufen in CI mit postgres:15)
- E2E Tests: skippen graceful ohne laufenden Server
- Regressions-Tests: `TEST_NETWORK=1 npx vitest run test/unit/web-regression.test.ts`
- `npm test -- --run --exclude="test/e2e/**"`
