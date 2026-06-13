# PWA Folge-Slices — Design (Offline-Writes, Background Sync, Push)

- **Datum:** 2026-06-13
- **Status:** Design abgenommen, Implementierung offen
- **Branch-Basis:** `feat/pwa-installable-shell` (PWA Phase 6 abgeschlossen)
- **Quelle:** TODO.md — drei deferred Folge-Slices nach PWA Phase 6
  - `PWA: Precache-Cap von 6 MB zurueck auf 5 MB`
  - `PWA: Schreibender Offline-Pfad`
  - `PWA: Background Sync / Push Notifications`

## Ziel & Abgrenzung

Drei nach PWA Phase 6 zurückgestellte Slices in **einem sequenzierten Plan** zusammenführen.
Reihenfolge entlang der Abhängigkeiten:

1. **Phase 1 — Precache-Cap 6→5 MB** (isoliert, kleinster Slice)
2. **Phase 2 — Schreibender Offline-Pfad** (persistente Mutations-Queue + Idempotenz)
3. **Phase 3 — Background Sync + Push** (Sync baut auf der Queue auf; Push ist eigene Infra)

**Getroffene Scoping-Entscheidungen (Brainstorming 2026-06-13):**

| Frage | Entscheidung |
|-------|--------------|
| Plan-Schnitt | Ein kombinierter, sequenzierter Plan |
| Push-Scope | Push voll mitplanen (VAPID + Subscription-Store + web-push) |
| Konfliktlösung | Last-Write-Wins + Idempotenz |
| Queue-Architektur | Standalone persistente Queue um `apiFetch` (kein React-Query-Mutations-Refactor) |

**Nicht in Scope:** Feld-Merge/echte Konflikterkennung; token-loses Background-Replay ohne offenen Tab; React-Query-Migration der Shopping/Planner-Screens.

## Ausgangslage (verifiziert 2026-06-13)

- **Mutationen heute:** Shopping/Planner nutzen **kein** React Query für Writes. Die Screens
  rufen direkt `apiFetch` mit lokalem `useState` + manuellem Rollback bei Fehler auf
  (`mobile/app/(tabs)/shopping.tsx`, `mobile/app/(tabs)/planner.tsx`).
- **API-Layer:** `mobile/utils/api.ts` → `apiFetch(path, init)` hängt Bearer-Token via
  `getAuthHeaders()` (`mobile/utils/auth.ts`) an.
- **Persistenz heute:** nur der React-Query-Cache-Persister (`mobile/utils/query-client.ts`,
  AsyncStorage, user-scoped Key `recipedeck-query-cache-<userId>`). **Keine** bestehende
  Queue / IndexedDB / Background-Sync-Infrastruktur.
- **Service Worker:** `mobile/sw/sw.ts` akzeptiert `SET_USER` / `CLEAR_USER` / `SKIP_WAITING`.
  **Kein** `sync`- oder `push`-Event. Gebündelt via `scripts/pwa/build-sw.ts` → `public/sw.js`.
- **Datenformen:**
  - `ShoppingListItem`: `id, recipe_id|null, canonical_name, quantity|null, unit|null, checked(0|1), created_at`
  - `MealPlanEntry`: `id, recipe_id, day_of_week(0=Mo..6=So), week_start, created_at`
  - Server ergänzt `household_id`, `user_id` (siehe `src/schema.ts`).

---

## Phase 1 — Precache-Cap 6→5 MB

### Problem
`scripts/pwa/build-sw.ts` cappt precachtes JS aktuell bei **6 MB** (`JS_SIZE_LIMIT_BYTES`,
Zeile 41), weil der Juni-Export ~5.26 MB über 6 JS-Chunks liegt. Spec-Ziel ist 5 MB.

### Schritte
1. **Bundle unter 5 MB drücken.**
   - Baseline: `npm run perf:bundle` (raw/gzip JS-Totals).
   - Größte Chunks identifizieren; gezielt lazy-laden. Kandidaten: dnd-kit (Planner),
     QR-Libs (Scanner), PDF-Export, Vision/Camera-Pfade.
   - Nach jeder Maßnahme neu messen.
   - Bundle-Baselines konsistent halten: `maxJsBytes` / `maxLargestJsAssetBytes`
     (siehe CLAUDE.md „Strict performance hardening").
2. **Cap zurückfahren.**
   - `JS_SIZE_LIMIT_BYTES` → `5 * 1024 * 1024` (`build-sw.ts:41`).
   - Throw-Message (`build-sw.ts:69`) parametrisieren — sie kodiert „6 MB" hart;
     aus `JS_SIZE_LIMIT_BYTES` ableiten statt String-Literal.
   - Erklärenden Kommentar `build-sw.ts:37-40` entfernen.
   - TODO.md-Eintrag „Precache-Cap … 6 MB zurueck auf 5 MB" schließen.

### Verifikation
- `npx tsx scripts/pwa/build-sw.ts` läuft grün (kein Throw) mit reduziertem Bundle.
- `npm run perf:bundle` zeigt JS < 5 MB.
- Bei LCP-/Shell-/Routing-relevanten Änderungen zusätzlich
  `npm run perf:lighthouse:compare` + `npm run perf:validate`.

### Risiko
Niedrig, aber isoliert: kann Tage vor den anderen Phasen landen. Lazy-Loading darf den
route-aware App-Shell-LCP (`mobile/app/+html.tsx`, Phase 4c) nicht regressieren.

---

## Phase 2 — Schreibender Offline-Pfad

### Architektur: standalone persistente Mutations-Queue

Neue Module (web/PWA-fokussiert):

| Modul | Zweck |
|-------|-------|
| `mobile/offline/idb.ts` | Minimaler IndexedDB-Wrapper (robuster als AsyncStorage/localStorage für eine Queue) |
| `mobile/offline/mutation-queue.ts` | Persistente FIFO-Queue + Flush-Logik |
| `mobile/offline/network-status.ts` | `online`/`offline`-Events + Foreground-Detection |
| `mobile/hooks/useOfflineQueue.ts` | Pending-Count + manueller Flush-Trigger für UI |

**Queue-Eintrag:**
```ts
{
  opId: string;        // client-generierte uuid (Idempotenz-Schlüssel)
  endpoint: string;    // z.B. "/api/v1/shopping"
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'inflight' | 'failed';
}
```

### Ablauf (`queuedMutate()`)
1. Netzwerk zuerst versuchen (`apiFetch`).
2. Bei Offline / Netzfehler / 5xx / 429 → Eintrag enqueuen **und** optimistisches lokales
   State-Update (Screens haben bereits lokalen State + Rollback).
3. Flush FIFO bei: `online`-Event, App-Foreground, (Phase 3) SW-`sync`-Wake.
4. Nach erfolgreichem Flush: **Refetch vom Server = Last-Write-Wins** (Server-State gewinnt);
   Temp-Client-IDs werden durch Server-IDs ersetzt.
5. Permanente Fehler (4xx außer 408/429) → Eintrag verwerfen + Fehler surfacen.

### Idempotenz (Server-Slice — nötig für POST)
PATCH/DELETE auf Server-ID sind natürlich idempotent. `POST /shopping` und `POST /planner`
brauchen einen Dedupe-Key, damit ein retryter Create kein Duplikat erzeugt.

- **Supabase-Migration:** Spalte `client_op_id` (uuid, nullable) auf `shopping_list` und
  `meal_plan`; Unique-Index pro `(household_id, client_op_id)`.
- **Routen** (`src/routes/planner.ts`): `client_op_id` aus dem Body lesen, Insert
  dedupliziert (`ON CONFLICT DO NOTHING` bzw. Existenz-Check). Fehlender Key = normales
  Insert (Rückwärtskompatibilität).

### Screen-Integration (minimaler Eingriff)
- Shopping: `addManualItem` / `toggleItem` / `deleteItem` (`mobile/app/(tabs)/shopping.tsx`)
  auf `queuedMutate()` umstellen.
- Planner: Add / Delete (`mobile/app/(tabs)/planner.tsx`) ebenso.
- Kein Umbau auf React-Query-Mutationen.

### UI
Sync-Indikator: „N Änderungen werden synchronisiert" / „offline"; verschwindet, wenn Queue leer.

### Tests
- Queue: enqueue, flush, persist über Reload, permanent-drop bei 4xx.
- Idempotenz-Servertest: doppelter POST mit gleicher `client_op_id` → genau 1 Row.
- Optimistisches Update + Rollback bei permanentem Fehler.

### Risiko
Mittel. Hauptfallen: Temp-ID↔Server-ID-Reconciliation, doppelte Inserts ohne Idempotenz,
Queue-Konsistenz über Reload. Idempotenz-Migration ist die kritische Server-Abhängigkeit.

---

## Phase 3 — Background Sync + Push

### 3a — Background Sync (baut auf Phase-2-Queue)
- SW (`mobile/sw/sw.ts`) bekommt `sync`-Listener (Tag `flush-mutations`).
- Page ruft `registration.sync.register('flush-mutations')` beim Enqueue im Offline-Zustand.
- **Designentscheidung / bewusste Limitation:** Der Auth-Token lebt in der Supabase-Session
  der Page, nicht im SW. **Primärmechanismus:** SW-`sync` → `postMessage('FLUSH_QUEUE')` an
  offene Clients; die Page flusht mit ihrem Token. Echtes Replay **ohne offenen Tab**
  (SW liest Token aus Storage + Refresh) ist wegen Token-Refresh-Komplexität und Security
  **als Follow-up vermerkt, nicht in diesem Slice**. Der `online`-Listener aus Phase 2
  deckt den Hauptfall (App offen, kommt zurück online) bereits ab.

### 3b — Push Notifications (Job-Fertigstellung)
**Server:**
- VAPID-Keypair; Env `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`; Dependency `web-push`.
- Supabase-Migration: Tabelle `push_subscriptions` (`user_id`, `endpoint`, `keys`,
  `created_at`; RLS owner-only).
- Endpoints `POST /api/v1/push/subscribe` und `DELETE /api/v1/push/subscribe`
  (`requireUserAuth`).
- Bei Job-Completion (`src/job-manager.ts`) → web-push „Rezept fertig: <Name>" an die
  Subscriptions des Owners.

**Client:**
- Opt-in-Permission-UX in `SettingsPage` (kein Auto-Prompt).
- `pushManager.subscribe(VAPID)`; Subscription an Server.
- SW `push`-Handler zeigt Notification; `notificationclick` öffnet/fokussiert `/recipe/:id`.

**Tests:**
- Subscription-CRUD + Unauth-Denied-Contract.
- Push-Payload-Build (Server).
- SW-`push`-Handler + `notificationclick`.

### Route-Auth-Inventur (Ergänzung)
`push_subscriptions` user-scoped, `requireUserAuth`, Read/Write-Boundary = owner.
Nach Implementierung in die Route-Auth-Inventory-Tabelle in CLAUDE.md aufnehmen.

### Risiko
Push: mittel-hoch (Server-Infra, VAPID-Key-Management, Browser-Permission-UX,
iOS-PWA-Push-Eigenheiten). Background Sync: niedrig-mittel innerhalb der gewählten Limitation.

---

## Build- & Verifikations-Hinweise (alle Phasen)

- SW-Änderungen: nach `npm run build:mobile` regeneriert `postbuild:mobile` automatisch
  `public/sw.js`; manuell `npx tsx scripts/pwa/build-sw.ts`.
- Neue Mobile-Tests: `react-test-renderer` nicht direkt importieren; danach
  `npm run test:mobile:rntl-guard`.
- Server-/Migrations-Slices: lokaler Supabase-RLS-Smoke + `npx tsc --noEmit`.
- Operatives: `docs/pwa-runbook.md` nach jeder Phase aktualisieren (neue Cache-Familien,
  Message-Typen, Push-Setup).

## Offene Punkte für die Implementierungsplanung

- IndexedDB-Wrapper selbst schreiben vs. minimale Dependency (`idb` / `idb-keyval`) —
  in der Plan-Phase entscheiden (Dependency-Drift-Regeln beachten).
- Sync-Indikator-Platzierung (globaler Statusbalken vs. pro-Screen).
- web-push-Versand synchron im Job-Pfad vs. Best-Effort-Fire-and-Forget.
- Migrationsreihenfolge: Idempotenz-Keys (Phase 2) vor push_subscriptions (Phase 3).
