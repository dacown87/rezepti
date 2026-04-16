
## Phase 9 — Quality & Stability ✅ ABGESCHLOSSEN (2026-04-16)

- **9a** — CLAUDE.md auf PostgreSQL/Supabase aktualisiert
- **9b** — `db-react.test.ts` neugeschrieben: `detectCategory` pure tests (19), DB-Integration-Tests mit `skipIf(!TEST_DATABASE_URL)` (4); `.github/workflows/ci.yml` mit `postgres:15` + `drizzle-kit push --force`
- **9c** — React Query v5 + AsyncStorage-Persistenz (`PersistQueryClientProvider`); `useRecipes`/`useRecipe`/`useUpdateRecipe`/`useDeleteRecipe` Hooks; `OfflineBanner`; `index.tsx` auf stale-while-revalidate umgestellt
- **9d** — QR-Scanner: jsQR-Fallback für Firefox/Safari; dreistufiger Autofokus (getUserMedia + onloadeddata-Timing + direct applyConstraints)
- **9e** — `user_id` UUID nullable in recipes/shoppingList/mealPlan/apiKeys; `src/auth.ts` Stub (`getCurrentUserId`/`isAuthenticated`)
- **9f** — `youtube.test.ts` (10), `schema-org.test.ts` (22), `chefkoch.test.ts` (14); Fix: `parseGermanPortions` Regex für "1 Person" (Singular)
- **Chefkoch tags bug** — `recipeCategory`/`recipeCuisine` als `string | string[]` typisiert, vor Spread normalisiert
- **Connection pool** — `connect_timeout: 10, idle_timeout: 30` in `src/db-react.ts`

### ⚠️ Noch zu testen
- **QR-Scanner Autofokus auf mobilem Chrome** — BarcodeDetector-Pfad + Autofokus bitte auf echtem Android-Chrome testen

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
