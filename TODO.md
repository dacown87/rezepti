
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

## Phase 10 — ingredientGroups + universelle Bild-Auswahl

### Phase 10a — Datenmodell & Backend-Persistenz
- `src/types.ts`: `ingredientGroups?: { heading: string; items: string[] }[]` zu `RecipeDataSchema` hinzufügen; `ContentBundle` um `ingredientGroups?` erweitern
- `src/schema.ts`: Spalte `ingredient_groups text` (nullable) in `recipes` table
- DB-Migration: `npx drizzle-kit generate && npx drizzle-kit push`
- `src/db-react.ts`:
  - `saveRecipeToReactDb`: flat `ingredients` aus Groups ableiten wenn vorhanden; `ingredient_groups` als JSON speichern
  - `updateRecipeInReactDb`: bei `ingredientGroups`-Update → flat `ingredients` re-ableiten + `ingredient_groups` schreiben; bei reinem `ingredients`-Update → `ingredient_groups = null`
  - Deserialisierung: `ingredient_groups` aus DB-Row parsen und als `ingredientGroups` zurückgeben

### Phase 10b — LLM-Extraktion
- `src/processors/llm.ts`:
  - SYSTEM_PROMPT: `ingredientGroups`-Beispiel hinzufügen; Regel: Sektionen vorhanden → nur `ingredientGroups` zurückgeben; sonst nur `ingredients`
  - Vor `RecipeDataSchema.parse(raw)`: flat `ingredients` aus `ingredientGroups` ableiten falls LLM nur Groups lieferte

### Phase 10c — Cookidoo-Gruppen-Extraktion
- `src/fetchers/cookidoo.ts`: DOM nach `rdp-ingredient-group`/`recipe-ingredient-group` + Überschriften (`.rdp-ingredient-group__title`) walkern; `{ heading, items }[]` bauen (nur wenn ≥2 Gruppen)
- `src/pipeline.ts`: Cookidoo-Groups aus `ContentBundle` in Recipe injizieren (wie Equipment-Injection)

### Phase 10d — Anzeige & Edit-Modus (mobile/app/recipe/[id].tsx)
- **Anzeige**: Branching-Renderer — `ingredientGroups` vorhanden → Abschnitts-Überschriften (grau, uppercase) + Items; Item mit `\n` → Hauptzeile + graue Unterzeile; Fallback auf flat `ingredients`
- **Edit-Modus**: `editDraft` um `ingredientGroups` erweitern; Gruppen-Editor (Überschrift editierbar, Zutaten add/remove/edit pro Gruppe, Gruppe add/remove); flat mode unverändert; `handleSave`: flat ableiten vor PATCH
- **Bild-ändern-Button**: "Bild ändern"-Pressable overlay am Hero-Bild; öffnet `<ImagePickerModal>` mit `initialQuery={recipe.name}`; bei select: PATCH `imageUrl` + reload

### Phase 10e — Universelle Post-Import Bildauswahl
- `mobile/app/(tabs)/extract.tsx` Zeile 165: Bedingung vereinfachen
  - Von: `if (recipeId && (submittedModeRef.current === 'photo' || suggestions.length > 0))`
  - Zu: `if (recipeId)`
  - ImagePickerModal sucht automatisch via `initialQuery` wenn `imageSuggestions` leer ist

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
