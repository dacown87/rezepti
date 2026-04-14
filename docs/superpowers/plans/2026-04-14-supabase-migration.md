# Plan: Lokale SQLite entfernen + Supabase-Migration

## Überblick

Zwei sequenzielle Phasen:
1. **Phase 1:** Lokale expo-sqlite aus Mobile-App entfernen → immer Server-API
2. **Phase 2:** Server-SQLite (better-sqlite3) durch Supabase (PostgreSQL) ersetzen

Warum diese Reihenfolge: Phase 1 schafft die saubere Trennung `Mobile → Server-API → DB`. Phase 2 tauscht nur die DB aus. Mobile-Code bleibt in Phase 2 komplett unberührt.

---

## Phase 1: Mobile — Lokale SQLite entfernen

### Ziel
Mobile App kommuniziert ausschließlich über Server-REST-API. Kein lokales expo-sqlite mehr auf Native.

### Betroffene Dateien

| Datei | Änderung |
|-------|---------|
| `mobile/app/_layout.tsx` | `initDB()` entfernen |
| `mobile/db/migrate.ts` | Durch No-op Stub ersetzen (gleiche Exports, tut nichts) |
| `mobile/app/(tabs)/extract.tsx` | `saveRecipeToLocalDB`, `localRecipeId`, `getDB`-Calls entfernen; `navRecipeIdRef` = Server-`recipeId` (immer) |
| `mobile/app/(tabs)/index.tsx` | Native SQL-Branch entfernen, immer `fetch(/api/v1/recipes)` |
| `mobile/app/(tabs)/shopping.tsx` | Native SQLite-Branch entfernen, immer Server-API |
| `mobile/app/(tabs)/planner.tsx` | `webLoadEntries/Add/Remove` (AsyncStorage) + SQLite-Branch entfernen, immer `/api/v1/planner` |
| `mobile/app/recipe/[id].tsx` | `sqlitePatch`/`sqliteDelete`/SQLite-loadRecipe entfernen, immer Server |
| `mobile/app/(tabs)/settings.tsx` | `getDB`-Call entfernen, `recipeCount` aus `/api/v1/health` lesen |
| `mobile/app/(tabs)/scanner.tsx` | QR-Import: `POST /api/v1/recipes`; Duplikatcheck via Server-API |

### Nicht ändern in Phase 1
- `mobile/db/schema.ts` — Interfaces werden noch als Typen genutzt
- `mobile/db/migrate.web.ts` — passt bereits (No-op)
- `expo-sqlite` Package — vorerst lassen, No-op Stub genügt

---

## Phase 2: Server — SQLite durch Supabase ersetzen

### Voraussetzung
- Supabase-Projekt anlegen auf supabase.com
- Umgebungsvariablen bereitstellen: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` (PostgreSQL Connection String)

### Tech-Entscheidung
**Drizzle ORM behalten**, aber PostgreSQL-Adapter (`drizzle-orm/postgres-js`) statt SQLite-Adapter. So bleiben Query-Syntax und Schema-Definitionen weitgehend gleich.

⚠️ **Wichtige Änderung:** `better-sqlite3` ist synchron, `postgres-js` ist async. Alle Funktionen in `src/db-react.ts` werden **async**. Das erfordert `await` in allen Routen die DB-Funktionen aufrufen — inkl. `pipeline.ts` und `routes/keys.ts` (waren bisher nicht in der Dateiliste, müssen aber auch angepasst werden).

### Schema-Deployment
`ensureReactSchema()` entfernen (better-sqlite3-spezifisches API `db.$client.exec()`). Stattdessen Migration-Workflow:
1. `drizzle.config.ts` auf PostgreSQL umstellen
2. `npx drizzle-kit generate` — erzeugt SQL-Migrations-Dateien in `drizzle/`
3. Supabase-Backup machen (Dashboard → Database → Backups)
4. `npx drizzle-kit migrate` — wendet Migrationen gegen `DATABASE_URL` an
5. Supabase-Dashboard bestätigt, dass alle Tabellen angelegt wurden

Die `drizzle/`-Ordner-Dateien committen → versionierte Migration-History.

### Betroffene Dateien

| Datei | Änderung |
|-------|---------|
| `src/schema.ts` | SQLite-Typen → PostgreSQL-Typen (INTEGER Timestamps → `timestamp`, JSON TEXT → `text` oder `jsonb`) |
| `src/db-react.ts` | `better-sqlite3` → `postgres-js` + Drizzle PostgreSQL; alle Exports werden `async`; `ensureReactSchema()` entfernen |
| `src/job-manager.ts` | better-sqlite3 DB → In-Memory `Map<string, ExtractionJob>`; kein persistenter Storage mehr (Jobs sind ephemer) |
| `src/routes/recipes.ts` | `await` vor allen `db-react`-Aufrufen |
| `src/routes/planner.ts` | `await` vor allen `db-react`-Aufrufen |
| `src/routes/extraction.ts` | `await saveRecipeToReactDb(...)` |
| `src/routes/keys.ts` | `await storeApiKey(...)` und `await removeApiKey(...)` |
| `src/pipeline.ts` | `await saveRecipeToReactDb(...)` (Zeile 139) |
| `src/index.ts` | DB-Init-Logik anpassen (kein lokales SQLite mehr; `ensureReactSchema()` entfernen) |
| `drizzle.config.ts` | `dialect: 'postgresql'`; `dbCredentials.url = process.env.DATABASE_URL` |
| `package.json` | `better-sqlite3` + `@types/better-sqlite3` entfernen; `postgres` hinzufügen |
| `Dockerfile` | Build-Tools für better-sqlite3 entfernen (`python3`, `make`, `g++` in Stage `base`) |
| `.env.example` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` ergänzen |

⚠️ **Connection Pooling:** `postgres(DATABASE_URL, { max: 3 })` setzen — verhindert Connection-Exhaustion bei Northflank-Skalierung (Supabase Free Tier: 60 Verbindungen max).

⚠️ **PgBouncer:** Supabase Port 5432 (direkt) verwenden, **nicht** Port 6543 (PgBouncer Transaction Mode). Drizzle benutzt Prepared Statements — diese sind mit PgBouncer Transaction Mode inkompatibel.

⚠️ **E2E Tests:** Die 40 E2E Tests laufen gegen einen echten Server + DB. Nach Phase 2 brauchen sie entweder einen Supabase-Test-Projekt oder einen lokalen PostgreSQL-Container. Im CI vorerst deaktivieren (`test.skip`) bis eine Lösung steht.

### Schema-Änderungen (schema.ts)

```
SQLite                          → PostgreSQL
─────────────────────────────────────────────
integer('created_at')           → timestamp('created_at').defaultNow()
integer('id').primaryKey()      → serial('id').primaryKey()  
text('ingredients')             → text('ingredients')  [JSON-String bleibt TEXT]
```

### Datenmigration (optional)
Bestehende Rezepte aus `data/rezepti-react.db` nach Supabase exportieren:
```bash
# Export als JSON via GET /api/v1/recipes (während alter Server noch läuft)
# Import via POST /api/v1/recipes auf neuem Server
```

### Northflank-Deployment
- Neue Env-Vars in Northflank setzen: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`
- `./data`-Volume wird nicht mehr benötigt (kein lokales SQLite)

---

## Reihenfolge der Implementierung

```
Phase 1 (diese Session):
  1. mobile/db/migrate.ts → No-op Stub
  2. mobile/app/_layout.tsx → initDB entfernen
  3. extract.tsx → SQLite-Code entfernen
  4. index.tsx, shopping.tsx, planner.tsx → Platform-Guards entfernen
  5. recipe/[id].tsx → SQLite-Pfade entfernen
  6. settings.tsx, scanner.tsx → API-Calls
  7. tsc + build:mobile + commit

Phase 2 (separate Session — braucht Supabase-Account + Credentials):
  1. Supabase-Projekt anlegen
  2. schema.ts auf PostgreSQL umstellen
  3. drizzle.config.ts auf postgresql dialect umstellen (DATABASE_URL)
  4. npx drizzle-kit generate → SQL-Migrations-Dateien in drizzle/ committen
  5. Supabase-Backup + npx drizzle-kit migrate → Schema deployen
  6. db-react.ts auf postgres-js/Drizzle-PG umstellen (async, ensureReactSchema entfernen, max:3)
  7. job-manager.ts auf In-Memory Map umstellen (better-sqlite3 entfernen)
  8. Alle Routen auf await aktualisieren: recipes.ts, planner.ts, extraction.ts, keys.ts, pipeline.ts
  9. Tests anpassen: db-react.test.ts, job-manager.test.ts, photo-extraction.test.ts
  10. package.json + Dockerfile anpassen (better-sqlite3 entfernen)
  11. .env mit Supabase-Credentials befüllen (PORT 5432, nicht 6543)
  12. Datenmigration (optional — Timestamps gehen verloren, Reihenfolge ändert sich)
  13. Northflank Env-Vars setzen + deploy
```

---

## Verifikation nach Phase 1

1. `npx tsc --noEmit` — 0 Fehler
2. `npm run build:mobile` — Build erfolgreich
3. App testen: Rezept extrahieren, in Liste sehen, editieren, löschen; Einkaufsliste; Wochenplaner; QR-Scan

## Verifikation nach Phase 2

1. `npx tsc --noEmit` — 0 Fehler (alle await korrekt gesetzt)
2. `npm test -- --run` — alle Unit-Tests grün (inkl. neue Mocks)
3. Server starten, alle API-Endpoints prüfen (`/api/v1/health`, `/api/v1/recipes`)
4. Supabase-Dashboard: Daten erscheinen in Tabellen
5. Docker-Build erfolgreich (ohne native Build-Tools — better-sqlite3 entfernt)
6. Northflank-Deploy: App läuft ohne lokales Volume

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (2026-03-26) | 16 proposals, 13 accepted, 3 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 2 | issues_found | Outside Voice: 9 Punkte, 2 Cross-Model-Entscheidungen |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 10 | CLEAR (PLAN) | 9 issues, 1 critical gap — alle resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL:** Beide Modelle einig bei: job-manager in-memory, drizzle-kit generate+migrate, E2E-Tests-Problem. Disagreement aufgelöst: drizzle-kit push → generate+migrate (Outside Voice hatte recht).

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — Plan reviewt und bereit zur Implementierung. Phase 1 sofort umsetzbar. Phase 2 braucht Supabase-Account.
