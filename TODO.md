
## Phase 9 — Quality & Stability (Branch: phase-9-quality-stability → gemergt main 2026-04-16)

### ✅ Abgeschlossen
- **Chefkoch tags bug:** `recipeCategory`/`recipeCuisine` als `string | string[]` typisiert, vor Spread normalisiert — kein Buchstaben-Splitting mehr
- **Connection pool:** `connect_timeout: 10, idle_timeout: 30` in `src/db-react.ts`
- **postbuild:mobile:** `public/changelog.json` wird nach Expo-Export wiederhergestellt
- **CLAUDE.md:** Architektur auf PostgreSQL/Supabase aktualisiert
- **QR-Scanner (9d):** jsQR-Fallback für Firefox/Safari + Autofokus via `applyConstraints`

### ⚠️ Noch nicht getestet
- **QR-Scanner auf Handy (Chrome):** Autofokus + BarcodeDetector-Pfad — bitte auf mobilem Chrome testen

### ❌ Offen (nächste Sessions — brauchen mehr Budget)
- **9b** ✅ — `db-react.test.ts` neugeschrieben: `detectCategory` + `CATEGORY_KEYWORDS` (pure, 19 Tests); DB-Integration-Tests mit `describe.skipIf(!TEST_DATABASE_URL)` (4 Tests); `.github/workflows/ci.yml` mit `postgres:15` service + `drizzle-kit push --force`
- **9f** ✅ — `youtube.test.ts` (10 Tests), `schema-org.test.ts` (22 Tests), `chefkoch.test.ts` (14 Tests); Fix: `parseGermanPortions` jetzt auch "für 1 Person" (Singular)
- **9e** ✅ — `user_id` UUID nullable in recipes, shoppingList, mealPlan, apiKeys; `db:push` auf Supabase deployed; `src/auth.ts` Stub mit `getCurrentUserId()` + `isAuthenticated()`
- **9c** ✅ — React Query v5 + AsyncStorage-Persistenz: `PersistQueryClientProvider` in `_layout.tsx`; `useRecipes` + `useRecipe` + `useUpdateRecipe` + `useDeleteRecipe` Hooks; `OfflineBanner` (web: navigator.onLine); `index.tsx` auf `useRecipes` umgestellt (stale-while-revalidate, kein manuelles loading-State mehr)

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

## Nächste große Phase — Multi-User Login

- Supabase Auth (JWT/Session), `user_id` in allen Tabellen, RLS, Auth-Middleware
- Rezept-Sharing via Link (ersetzt QR-Code-JSON-Sharing)
- **Vorarbeit (9e):** `user_id` nullable UUID ins Schema — erleichtert späteren Auth-Umbau

---

## Test-Status (2026-04-16)

- Unit Tests: 287 bestanden + 4 skipped (DB-Integration: laufen in CI mit postgres:15)
- E2E Tests: skippen graceful ohne laufenden Server
- `npm test -- --run --exclude="test/e2e/**"`
