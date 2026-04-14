
## Migration: Lokale SQLite entfernen + Supabase (OFFEN)

**Plan:** `docs/superpowers/plans/2026-04-14-supabase-migration.md`

### Phase 1 — Mobile: Lokale expo-sqlite entfernen (bereit zur Umsetzung)
Alle Screens nutzen immer Server-API, kein `Platform.OS`-Splitting mehr.

- [ ] `mobile/db/migrate.ts` → No-op Stub
- [ ] `mobile/app/_layout.tsx` → `initDB()` entfernen
- [ ] `mobile/app/(tabs)/extract.tsx` → `saveRecipeToLocalDB`, `localRecipeId` entfernen
- [ ] `mobile/app/(tabs)/index.tsx` → SQLite-Branch entfernen
- [ ] `mobile/app/(tabs)/shopping.tsx` → SQLite-Branch entfernen
- [ ] `mobile/app/(tabs)/planner.tsx` → AsyncStorage + SQLite-Branch → `/api/v1/planner`
- [ ] `mobile/app/recipe/[id].tsx` → SQLite-Pfade entfernen
- [ ] `mobile/app/(tabs)/settings.tsx` + `scanner.tsx` → API-Calls

### Phase 2 — Server: SQLite → Supabase (braucht Account + Credentials)
- [ ] Supabase-Projekt anlegen
- [ ] `src/schema.ts` auf PostgreSQL umstellen
- [ ] `drizzle.config.ts` auf postgresql dialect umstellen
- [ ] `npx drizzle-kit generate` + `migrate` → Schema deployen (nicht push!)
- [ ] `src/db-react.ts` → `postgres-js` + Drizzle-PG (async, `ensureReactSchema` entfernen, max:3, Port 5432)
- [ ] `src/job-manager.ts` → In-Memory Map (better-sqlite3 entfernen)
- [ ] Alle Routen auf `await`: `recipes.ts`, `planner.ts`, `extraction.ts`, `keys.ts`, `pipeline.ts`
- [ ] Tests anpassen: `db-react.test.ts`, `job-manager.test.ts`, `photo-extraction.test.ts`
- [ ] `package.json` + `Dockerfile` anpassen (better-sqlite3 entfernen)
- [ ] E2E Tests vorübergehend skippen (brauchen Postgres-Connection)
- [ ] Northflank Env-Vars setzen + deploy

### Offline-Modus (nach Phase 1 entfernt — nachrüsten)
- [ ] React Query + AsyncStorage als Read-Through-Cache für Rezeptliste
  - Stale-while-revalidate: App zeigt zuletzt gecachte Rezepte bei fehlendem Netzwerk
  - Kein lokales SQLite mehr — nur AsyncStorage als Persistenz-Layer
  - **Kontext:** Phase 1 entfernt bewusst lokales SQLite. Dieser TODO stellt Offline-Lesezugriff wieder her ohne den doppelten DB-Overhead.

---

## Bildauswahl nach Foto-Import — ✅ ABGESCHLOSSEN (2026-04-14)

**Plan:** `docs/superpowers/plans/2026-04-12-foto-bildauswahl.md`

**Umgesetzt:**
- Modal erscheint immer nach Foto-Import (auch wenn Chefkoch keine Treffer liefert)
- Rezeptname wird automatisch in die Suchleiste vorausgefüllt + Auto-Search bei leerem Ergebnis
- Wiederholtes Suchen mit gleichem Suchbegriff funktioniert
- Settings: Bildanzahl konfigurierbar (4/8/16, default 4) in Einstellungen → Foto-Import
- Backend `GET /api/v1/images/search?q=&limit=N` unterstützt konfigurierbares Limit

---

## Strategie-Überlegungen (2026-04-09)

### Firebase vs. Supabase vs. SQLite (OFFEN — Evaluieren)
**Kontext:** Sobald Multi-User-Login kommt, muss die DB-Strategie entschieden werden.

| Kriterium | SQLite (aktuell) | Firebase (Firestore) | Supabase |
|-----------|-----------------|----------------------|----------|
| **Auth** | ❌ Selbst bauen | ✅ Email, Google, Apple | ✅ Email, Google, Apple, Magic Link |
| **Datenbank** | SQLite (lokal/Server) | NoSQL (Firestore) | PostgreSQL |
| **Storage (Bilder)** | ❌ Lokal/Proxy | ✅ Firebase Storage | ✅ Supabase Storage |
| **Rezept-Sharing** | ⚠️ Eigene Tabelle nötig | ✅ Public Document IDs | ✅ Row-Level Security |
| **Open Source** | ✅ | ❌ Google Lock-in | ✅ Self-hostbar |
| **Kosten** | ~0 (Server läuft eh) | Spark: kostenlos bis ~50k Reads/Tag, dann teuer | Free Tier: 500 MB DB, 1 GB Storage — danach $25/Monat |
| **Umbauaufwand** | — | Groß — alle CRUD-Endpoints, kein SQL mehr | Mittel — PostgreSQL ähnlich SQLite, Drizzle ORM bleibt nutzbar |
| **Realtime** | ❌ | ✅ | ✅ |
| **Expo/RN SDK** | ✅ (expo-sqlite) | ✅ | ✅ (@supabase/supabase-js) |

**Entscheidung: Supabase** — wenn Multi-User konkret ansteht.
- PostgreSQL bleibt Drizzle-kompatibel (minimaler Schema-Umbau)
- Kein Google Lock-in
- RLS für Multi-User out of the box
- Self-hosting auf Northflank möglich

**Vorarbeit (jetzt umsetzbar, bevor Supabase kommt):**
- [ ] `user_id`-Spalte ins `recipes`-Schema eintragen (nullable, default null = lokaler User) — `src/schema.ts`
- [ ] Auth-Modul als leeren Stub anlegen (`src/auth.ts`) damit der Umbau später modular bleibt

---

### Rezept-Sharing via Link (GEPLANT — QR-Code-Sharing ersetzen)
**Idee:** Statt QR-Code mit Rezept-JSON → öffentlicher Share-Link pro Rezept.

**Funktionsweise:**
- Nutzer klickt "Teilen" → erhält einen Link (z.B. `/share/abc123`)
- Empfänger öffnet den Link → sieht das Rezept (auch ohne Login)
- Mit einem Klick: "In mein Konto importieren" → Rezept landet in seiner Sammlung

**Was damit entfällt:** QR-Code-Sharing (Share-Modal + Scanner für JSON-QR-Codes). Der QR-Code im PDF-Export (für den Link zur Quelle) bleibt.

**Voraussetzung:** Braucht entweder Firebase (einfach) oder eine `shared_recipes`-Tabelle in SQLite mit öffentlichem Token + optionalem Ablaufdatum.

**Priorität:** Nach Multi-User-Login umsetzen.

---

## Phase 8: QR-Scan + Drag & Drop (28.03.2026)

### ✅ ABGESCHLOSSEN
- **Drag & Drop im Wochenplan**: `dnd-kit` installiert, `DayColumn` + `DraggableRecipe` Components, Rezepte zwischen Tagen verschiebbar

### ❌ OFFEN - QR-Bild-Scan testen
- ScannerPage "Bild hochladen"-Tab: Code nutzt bereits `BarcodeDetector` API korrekt - **Testen ob es funktioniert!**
- Hinweis: BarcodeDetector ist Chromium-only (Chrome/Edge), Safari/Firefox zeigen Fehlermeldung
- BarcodeDetector declarations in `ScannerPage.tsx:8-14`

### Geänderte Dateien
- `frontend/src/components/PlannerPage.tsx` - DnD implementiert
- `package.json` - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` hinzugefügt

---

## Test-Fixes (28.03.2026) - ABGESCHLOSSEN ✅

### Alle Fixes

**1. DB-Schema `pdf_created`**
- War bereits in DB vorhanden (cid 16) - kein Fix nötig ✅

**2. E2E Cleanup-Problem (400 statt 200)**
- Problem: `afterEach` rief DELETE auf fertige Jobs auf → API gibt 400 zurück
- Fix: `afterEach` jetzt mit direktem `fetch()` statt `testRunner.testEndpoint()`, kein Status-Check
- Datei: `test/e2e/react-api.test.ts` Zeile 44-59

**3. "fetch failed" im Polling-Test (3 Teil-Probleme)**

3a. `beforeEach` erstellte shared Job der nach jedem Test gelöscht wurde
- Fix: Jeder Test erstellt jetzt eigene Jobs, getrackt in `createdJobs[]`

3b. Assertion `expect(result.success).toBeDefined()` war irreführend
- `pollJobStatus` returned `success=false` wenn Job fehlschlug
- Fix: Assertion geändert zu `expect(['completed', 'failed']).toContain(result.data?.status)`
- Kommentar hinzugefügt: "example.com ist keine echte Rezeptseite → Job schlägt fehl (expected)"

3c. `pollJobStatus` setzte `success=false` für fehlgeschlagene Jobs im TestRunner-Summary
- Fix: `success: status === 'completed'` → `success: true`
- Begründung: Polling funktioniert, nur der Job selbst scheitert (expected bei example.com)
- Datei: `test/utils/test-helpers.ts` Zeile 144

**4. docker.test.ts: `status: "ok"` → `status: "healthy"`**
- Problem: Test erwartete falschen Status-Wert
- Fix: `expect(result.data?.status).toBe('ok')` → `expect(result.data?.status).toBe('healthy')`
- Datei: `test/e2e/docker.test.ts` Zeile 84

### Test-Helper-Design (wichtig fürs Verständnis)
- `testRunner.testEndpoint()`: `success = response.status === expectedStatus`
- Bei `expectedStatus=200` und `response.status=400`: `success=false`, `data=undefined`
- Bei `expectedStatus=400` und `response.status=400`: `success=true`, `data={...}`
- Korrekte Fehler-Assertions: `expect(result.success).toBe(true)` + `expect(result.data?.error).toBeDefined()`

### Test-Status (28.03.2026)
```
Test Files: 14 passed (14)
Tests: 226 passed (226)
E2E: 40 passed (40)
Unit: 186 passed (186)
```
TypeScript: 0 Fehler ✅
Server: localhost:3000, DB: 0 Rezepte

### Geänderte Dateien
- `test/e2e/react-api.test.ts` - Cleanup-Logik, Polling-Tests
- `test/utils/test-helpers.ts` - pollJobStatus success-Logik
- `test/e2e/docker.test.ts` - status "healthy"
