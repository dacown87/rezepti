
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

### Backlog (interessant für später)
- Supadata.ai API für Instagram-Transkripte (kostenloses Free-Tier)
- OpenRouter als BYOK-LLM-Alternative (1B Token/Monat gratis, Llama 4 Scout, DeepSeek V3)
- Ollama als lokaler LLM-Fallback für Self-Hosted-User
- Llama 4 Scout auch für Textextraktion (bereits für Vision: 1.5× günstiger — nur `.env`-Änderung)
- Bild-Optimierung beim Import: WebP-Konvertierung + Resizing (Mealie-Pattern, braucht Sharp)
- Vision-basierte Rezeptkarten-Erkennung via Llama 4 Scout (Pinterest-Karten, Buchseiten)
- Rezept-Qualitäts-Scoring: automatischer Score → LLM-Refinement nur wenn Score < Threshold

---

## Nächste große Phase — Multi-User Login

- Supabase Auth (JWT/Session), `user_id` in allen Tabellen, RLS, Auth-Middleware
- Rezept-Sharing via Link (ersetzt QR-Code-JSON-Sharing)
- **Vorarbeit (9e):** `user_id` nullable UUID ins Schema — erleichtert späteren Auth-Umbau

---

## Test-Status (2026-04-16)

- Unit Tests: 287 bestanden + 4 skipped (DB-Integration: laufen in CI mit postgres:15)
- E2E Tests: skippen graceful ohne laufenden Server
- `npm test -- --run --exclude="test/e2e/**"`
