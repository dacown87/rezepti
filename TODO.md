
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
- **9b** — `test/unit/db-react.test.ts` neu schreiben gegen echtes Postgres; CI: `services: postgres:15` in `.github/workflows/ci.yml`
- **9f** — Neue Unit-Tests: `youtube.test.ts`, `schema-org.test.ts`, `chefkoch.test.ts`
- **9e** — `user_id` UUID nullable in alle Tabellen (recipes, shoppingList, mealPlan, apiKeys) via Drizzle Migration
- **9c** — React Query v5 + Offline-Modus (AsyncStorage-Persistenz, Mutations-Queue, kein Delete offline)

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

- Unit Tests: 222 (db-react.test.ts mockt noch better-sqlite3 — vacuous, aber grün)
- E2E Tests: skippen graceful ohne laufenden Server
- `npm test -- --run --exclude="test/e2e/**"`
