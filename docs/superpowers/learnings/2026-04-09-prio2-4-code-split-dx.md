# Learnings: Prio 2–4 — Code-Split, BYOK-DB, Tests, DX (2026-04-09)

## Code-Split (api-react.ts)

- 1001-Zeilen-Monolith in 5 Router-Dateien aufgeteilt → `src/routes/`
- `src/api-react.ts` ist jetzt reiner Assembler (21 Zeilen): importiert alle Router, ruft `app.route("/", router)` auf
- Hono: `app.route("/", subRouter)` — subRouter behält seine eigenen Pfade (kein Prefix nötig wenn Pfade vollständig definiert)

## BYOK Key-Hash in DB

- Drizzle `onConflictDoUpdate` für Upsert bei doppeltem Key-Hash
- `ensureReactSchema()` erweitert — `ALTER TABLE` via `db.$client.exec()` für neue Spalten
- Schema-Migration: immer `IF NOT EXISTS` / `IF NOT EXISTS` Guards, da Tabelle schon existieren kann

## Expo Web Build — Fallstricke

- `mobile/package.json` war in Commit `0798a11` gelöscht worden → Build schlägt mit `ConfigError` fehl
  - Fix: `git checkout <hash> -- mobile/package.json`
- `mobile/public/Logo.png` muss existieren — Pfad in `_layout.tsx`: `require('../../public/Logo.png')` → löst zu `mobile/public/Logo.png` auf
  - Logo lag nur in Worktrees, nicht in main → manuell kopiert + ins Repo committed
- Build-Befehl: `cd mobile && CI=1 npx expo export --platform web --output-dir ../public`

## Vitest: `expect.anything()` schließt `undefined` aus

- `expect.anything()` matcht nur nicht-null, nicht-undefined Werte
- Wenn ein Argument `undefined` sein kann (z.B. fehlender `User-Agent`-Header in Tests), direkt `undefined` verwenden:
  ```typescript
  expect(mockFn).toHaveBeenCalledWith(expect.stringContaining('foo'), undefined)
  ```

## E2E Tests ohne laufenden Server

- Top-level `await isServerAvailable()` + `describe.skipIf(!serverAvailable)` — Tests skippen graceful
- `isServerAvailable()` mit `AbortSignal.timeout(2000)` — schnell, kein Hängenbleiben

## hint-Propagation durch den Stack

```
pipeline.ts → toUserFriendlyError() → PipelineResult.hint
    → extraction.ts → failJob(jobId, message, hint)
    → job-manager.ts → JobEvent.hint
    → polling response → extract.tsx → errorHint state
    → UI: "API-Key hinzufügen"-Button
```

- `types.ts`: `hint?: string` zu `PipelineResult` hinzugefügt
- `job-manager.ts`: DB-Migration `ALTER TABLE extraction_jobs ADD COLUMN hint TEXT` + `stmtFail` + `deserializeJob`

## Frontend: mobile/app Quelle wiederherstellen

Wenn `mobile/app/` aus main fehlt (wie nach Commit `0798a11`):
```bash
git checkout <letzter-guter-commit> -- mobile/app/ mobile/components/ mobile/utils/ mobile/constants/ mobile/db/ mobile/app.json mobile/babel.config.js mobile/metro.config.js mobile/tsconfig.json mobile/tailwind.config.js mobile/global.css mobile/nativewind-env.d.ts mobile/eas.json
```
