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
- Zwei Supabase-Projekte anlegen auf supabase.com: `rezepti-dev` (lokal/testing) und `rezepti-prod` (Northflank)
- `.env` zeigt auf `rezepti-dev`, Northflank-Env-Vars zeigen auf `rezepti-prod`
- Umgebungsvariablen bereitstellen: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` (PostgreSQL Connection String)

### Tech-Entscheidung
**Drizzle ORM behalten**, aber PostgreSQL-Adapter (`drizzle-orm/postgres-js`) statt SQLite-Adapter. So bleiben Query-Syntax und Schema-Definitionen weitgehend gleich.

⚠️ **Wichtige Änderung:** `better-sqlite3` ist synchron, `postgres-js` ist async. Alle Funktionen in `src/db-react.ts` werden **async**. Das erfordert `await` in allen Routen die DB-Funktionen aufrufen.

### Betroffene Dateien

| Datei | Änderung |
|-------|---------|
| `src/schema.ts` | SQLite-Typen → PostgreSQL-Typen (INTEGER Timestamps → `timestamp`, JSON TEXT → `text` oder `jsonb`) |
| `src/db-react.ts` | `better-sqlite3` → `postgres-js` + Drizzle PostgreSQL; alle Exports werden `async` |
| `src/routes/recipes.ts` | `await` vor allen `db-react`-Aufrufen |
| `src/routes/planner.ts` | `await` vor allen `db-react`-Aufrufen |
| `src/routes/extraction.ts` | `await saveRecipeToReactDb(...)` |
| `src/index.ts` | DB-Init-Logik anpassen (kein lokales SQLite mehr) |
| `package.json` | `better-sqlite3` + `@types/better-sqlite3` entfernen; `postgres` + `@supabase/supabase-js` hinzufügen |
| `Dockerfile` | Build-Tools für better-sqlite3 entfernen (`python3`, `make`, `g++` in Stage `base`) |
| `.env.example` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` ergänzen |

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
  1. Supabase-Projekt anlegen, Schema deployen
  2. schema.ts auf PostgreSQL umstellen
  3. db-react.ts auf postgres-js/Drizzle-PG umstellen (async)
  4. Alle Routen auf await aktualisieren
  5. package.json + Dockerfile anpassen
  6. .env mit Supabase-Credentials befüllen
  7. Datenmigration (optional)
  8. Northflank Env-Vars setzen + deploy
```

---

## Verifikation nach Phase 1

1. `npx tsc --noEmit` — 0 Fehler
2. `npm run build:mobile` — Build erfolgreich
3. App testen: Rezept extrahieren, in Liste sehen, editieren, löschen; Einkaufsliste; Wochenplaner; QR-Scan

## Verifikation nach Phase 2

1. `npx tsc --noEmit` — 0 Fehler
2. Server starten, alle API-Endpoints prüfen (`/api/v1/health`, `/api/v1/recipes`)
3. Supabase-Dashboard: Daten erscheinen in Tabellen
4. Docker-Build erfolgreich (ohne native Build-Tools)
5. Northflank-Deploy: App läuft ohne lokales Volume
