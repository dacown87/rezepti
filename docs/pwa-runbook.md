# PWA Runbook

RecipeDeck's Progressive Web App setup — installable shell with offline-read capability.

**Status:** Phase 6 completed (2026-06-13). Service Worker deployed in production. Offline-read hardening landed 2026-06-14 (PRs #11/#12): build-independent recipe data cache, cold-start React Query restore, and a persisted SW user hash.

## Overview

The PWA implementation consists of:

1. **Manifest & Installation** — `mobile/public/manifest.webmanifest` declares the app (name: "RecipeDeck", start URL: `/`, standalone display mode).
2. **Web App Metadata** — Apple iOS, Android Chrome metadata in `mobile/app/+html.tsx`.
3. **Service Worker** — `mobile/sw/sw.ts` (bundled to `public/sw.js`) handles offline navigation, caching, and per-user recipe cache management.
4. **Icons** — Four assets in `mobile/public/`:
   - `icon-192.png` — Android launcher icon
   - `icon-512.png` — Universal 512×512 fallback (purpose: "any")
   - `icon-512-maskable.png` — Adaptive icon for Android 13+ (purpose: "maskable")
   - `apple-touch-icon-180.png` — iOS homescreen icon (180×180)

### Capabilities

- **Offline read** — Recipe list and detail pages are served without network (after first load). The **list** comes from the per-user React Query persistence (AsyncStorage); recipe **detail** pages come from the SW `rd-user-<hash>` cache. Both survive app updates and SW cold starts (see hardening notes below).
- **Homescreen install** — Android: standard beforeinstallprompt UX; iOS: manual "Add to Home Screen" (see Install Hints section).
- **Update detection** — UI notifies when a new SW is ready; user can opt-in to reload. No banner appears when an update activates silently on relaunch (no waiting worker) — that is expected. No banner appears at all for server-only deploys (identical frontend → identical content-hash → byte-identical `sw.js`).
- **Per-user caching** — Recipe API responses cached separately per logged-in user (SHA-256-hashed user ID); automatically cleared on logout.
- **Session recovery** — `apiFetch` refreshes the Supabase token + retries once on a 401 (e.g. token lapsed while the PWA was backgrounded); a genuine auth failure shows a tappable "Sitzung abgelaufen" re-login banner, not the offline/WifiOff framing.

## Service Worker Architecture

The bundled SW (`public/sw.js`) implements these cache families:

| Cache Name | Strategy | Content | Lifecycle |
|-----------|----------|---------|-----------|
| `rd-shell-v<hash>` | NetworkFirst (3s timeout) | Navigation requests, /index.html precache fallback | **Build-scoped** — orphaned on new build |
| `rd-assets-v<hash>` | CacheFirst | Hash-named JS/CSS chunks from `_expo/static/` | **Build-scoped** — orphaned on new build (not hand-deleted) |
| `rd-user-<sha256-userId>` | StaleWhileRevalidate | GET /api/v1/recipes/* (read-only) | **Build-INDEPENDENT** — survives app updates; deleted on logout (CLEAR_USER) |
| `rd-user-meta` | — (plain Cache entry) | Persisted SHA-256 user hash (RC2) | Survives SW restart; deleted on logout (matches `rd-user-*`) |

**Why the data cache is build-independent:** Recipe data is not tied to the frontend build. When the data cache was build-scoped (`rd-user-<hash>-v<build>`), the `activate` GC wiped it on **every** deploy, blanking offline-read after each update. The current format (`rd-user-<hash>`, no `-v` suffix) survives deploys.

**Build Hash Rotation**

The `<hash>` suffix (8 hex chars, derived from the precache manifest) rotates on every `npm run build:mobile`, but **only the shell/asset caches carry it**. This orphans old shell/asset caches:
- On next app start, old shell/asset caches (e.g., `rd-shell-voldHash`) remain but are no longer served.
- The `activate` event handler runs `clearLegacyUserCaches()`, which deletes only **legacy** build-scoped `rd-user-*-v<build>` orphans (one-time migration from before the data cache became build-independent). Current-format `rd-user-<hash>` data caches and `rd-user-meta` are kept.
- Shell and asset caches from old builds are left untouched (low storage cost, safe fallback if new build fails).

**Per-User Authentication Boundary**

- When the user logs in, the React app posts a `SET_USER` message with the user's UUID.
- The SW asynchronously computes a SHA-256 hash (64 hex chars), stores it in `currentUserHash`, and **persists it** to `rd-user-meta` (RC2) so a restarted SW can resolve the bucket before the next SET_USER.
- Subsequent GET requests to `/api/v1/recipes/*` are cached in `rd-user-<sha256-userId>`. `getUserHash` falls back to the persisted hash (`currentUserHash ?? readPersistedUserHash(caches)`) when the in-memory value is still null after an SW restart.
- On logout or user switch, the React app posts a `CLEAR_USER` message.
- The SW deletes ALL `rd-user-*` caches synchronously (data + meta) and sets `currentUserHash = null`.
- Unknown/null user: requests fall through to network (no cache).

**Cold-start list restore (React Query):** The recipe **list** is restored offline by `mobile/utils/query-client.ts`, not the SW. On cold start `restoreClient()` resolves the signed-in user from the stored Supabase session and restores the per-user query cache (`recipedeck-query-cache-<userId>`) — not the empty `anon` slot — so the list shows offline even when the SW cache is cold. `watchAuthQueryCache` compares the incoming session against the key actually restored, so the cross-user clear (privacy boundary) still fires on a mismatch.

## Rebuilding the Service Worker

The build flow is automatic:

```bash
npm run build:mobile
```

This runs Expo web export, then the `postbuild:mobile` npm hook automatically:
1. Restores `public/changelog.json` (so it doesn't get lost during export).
2. Runs `npx tsx scripts/pwa/build-sw.ts` to rebuild `public/sw.js`.

**Manual rebuild** (if you need to regenerate `public/sw.js` without a full Expo export):

```bash
npx tsx scripts/pwa/build-sw.ts
```

This:
- Globs all JS/CSS from `_expo/static/` (written by a previous `npm run build:mobile`).
- Verifies total JS size is under 6 MB (configured cap; see follow-up below).
- Derives a build hash from the precache manifest.
- Bundles `mobile/sw/sw.ts` with esbuild (IIFE, minified), injecting the manifest and hash.
- Writes `public/sw.js` (~20 KB minified + Workbox).

**Common issues:**

- **"Precached JS exceeds 6 MB limit"** — The current Expo export is ~5.26 MB. If you see this error, reduce the bundle size (tracked follow-up: drop cap back to 5 MB once optimized).
- **Manifest mismatch** — If you manually edit `public/`, you must re-run `build-sw.ts`. The precache is only read during the build step, not dynamically.

## Regenerating Icons

Icons are generated once and committed. To regenerate (e.g., after design changes):

```bash
npm i sharp --no-save  # Install Sharp (not in committed deps)
npx tsx scripts/pwa/generate-icons.ts
```

This reads `mobile/public/source-icon.png` (or the configured source path) and outputs:
- `icon-192.png`
- `icon-512.png`
- `icon-512-maskable.png`
- `apple-touch-icon-180.png`

After running, commit the new icons:

```bash
git add mobile/public/icon-*.png mobile/public/apple-touch-icon-*.png
git commit -m "icons: regenerate from source"
```

Sharp is NOT a committed dependency (removed after use). Do not include it in package-lock.json.

## Cache Versions & User Isolation

### Build Hash Rotation

Every `npm run build:mobile`:
- The precache manifest changes (new or modified assets).
- A new build hash is derived (SHA-256 of the manifest, first 8 hex chars).
- **Only shell/asset** cache names change: `rd-shell-v<newHash>`, `rd-assets-v<newHash>`. The recipe data cache (`rd-user-<userId>`) and `rd-user-meta` are build-independent and unchanged.
- The activate event runs `clearLegacyUserCaches()` — it deletes only legacy `rd-user-*-v<build>` orphans (one-time migration), never current-format data caches.

**Example:**
- Build 1: caches named `rd-shell-vABCD1234`, `rd-assets-vABCD1234`, `rd-user-<alice>` (data, build-independent).
- Build 2 (new assets): caches named `rd-shell-vEFGH5678`, `rd-assets-vEFGH5678`, `rd-user-<alice>` (same data cache — **kept**, so offline-read survives the update).
- On first visit in Build 2, `activate` GCs any leftover legacy `rd-user-<alice>-vABCD1234` cache (from before the build-independent migration) but keeps `rd-user-<alice>`.

### CLEAR_USER Message

When the user logs out or switches account, the React app (in `mobile/utils/query-client.ts`) posts:

```javascript
navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_USER' });
```

The SW:
1. Sets `currentUserHash = null`.
2. Asynchronously deletes ALL `rd-user-*` caches — data caches AND the `rd-user-meta` persisted-hash cache (across all users and all builds).
3. Subsequent requests fall through to network.

### Multi-Tab / Multi-Account Limitation

A single SW instance serves all tabs for the same origin. `currentUserHash` holds the hash of the LAST user who posted `SET_USER`. If two different user accounts are open in parallel tabs:
- The last `SET_USER` wins.
- Requests from the other tab may be served from or written to the wrong user's cache bucket during the switch window.

This is acceptable for the current single-tenant deployment (one user per device). If multi-account support is added later (e.g., family accounts), this limitation must be revisited.

## Verifying the Service Worker

A sandbox test verifies cache naming and CLEAR_USER behavior without running a full browser:

```bash
node scripts/pwa/verify-sw-sandbox.mjs
```

This:
1. Loads `public/sw.js` in a Node VM with fake caches and crypto.
2. Sends `SET_USER` for a test user ID.
3. Waits for SHA-256 computation.
4. Confirms the expected (build-independent) cache name format: `rd-user-<64hexchars>`.
5. Sends `CLEAR_USER` and verifies all user caches are deleted.

Expected output:

```
=== SW Cache Boundary Verification Sandbox ===
Step 1: Firing activate event (legacy cache GC)…
…
=== SUMMARY ===
  SW evaluation:        PASS (no throw)
  SHA-256 hash length:  PASS (64 hex chars)
  Cache name format:    PASS (rd-user-<64hex>, build-independent)
  CLEAR_USER cleanup:   PASS (user cache deleted)
…
All sandbox checks PASSED.
```

## Emergency: Deregister All Service Workers

If you need to remove or disable the SW across all user devices:

### Option 1: Disable Registration in Code (Recommended)

In `mobile/app/+html.tsx`, the `swRegistrationScript` is conditional on `NODE_ENV === 'production'`. To emergency-disable:

1. Edit `mobile/app/+html.tsx`.
2. Change the SW registration script to always unregister:
   ```javascript
   const swRegistrationScript = `if ('serviceWorker' in navigator) {
     navigator.serviceWorker.getRegistrations().then(registrations => {
       registrations.forEach(r => r.unregister());
     });
   }`;
   ```
3. Build and deploy: `npm run build:mobile && git push`.

This leaves the old SW on user devices but prevents it from being re-registered.

### Option 2: User-Facing Deregistration Snippet

If you need users to manually clear the SW (e.g., in the browser console during support):

```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(r => r.unregister());
}).then(() => {
  console.log('All service workers unregistered.');
});
```

### Option 3: Clear Browser Site Data

Users can manually clear the SW by:
1. Opening DevTools → Application → Service Workers.
2. Clicking "Unregister" next to the RecipeDeck registration.
3. Or: Settings → Privacy → Clear browsing data → (check "Cookies and other site data") → Clear data.

## Installation Hints (iOS/Android)

### Android

Android (Chrome 77+) fires `beforeinstallprompt` automatically when certain conditions are met:
- Manifest present with valid name, icons, start URL.
- HTTPS or localhost.
- Minimum 40 KB icons.

The `usePwaInstall` hook in `mobile/hooks/usePwaInstall.ts` catches this event and shows a prompt when tapped. No additional setup needed.

### iOS

iOS (Safari 15+) requires manual "Add to Home Screen" (no beforeinstallprompt). The `usePwaInstall` hook detects iOS via user-agent and shows an "iOS Hint" UI:

```
1. Tap Share (bottom toolbar)
2. Scroll to "Add to Home Screen"
3. Tap
```

The hint is shown only when:
- User-agent matches iPhone/iPad/iPod.
- Not already in standalone mode (i.e., not already installed).

## Testing

### Unit Tests

The PWA setup is covered by two hook test files:

- `mobile/test/usePwaUpdate.test.ts` — Tests update detection, waiting-worker state, and listener cleanup.
- `mobile/test/usePwaInstall.test.ts` — Tests beforeinstallprompt handling and iOS hint detection.

Run with:

```bash
npm run test:mobile
```

Both should pass GREEN.

### Integration

After `npm run build:mobile` and deploying:
1. Open the app in a new browser session (no cache).
2. Wait for the SW to register (check DevTools → Application → Service Workers).
3. Open a recipe, then go offline (DevTools → Network → Offline).
4. Reload the page — the recipe should still display (cached).
5. Log out and log back in as a different user — the previous user's cached recipes should be cleared.

## Offline-Mutations-Queue

Implementiert in Phase 2 (2026-06-13). Shopping-List- und Planner-Mutationen, die offline oder bei transienten Serverfehlern (5xx / 429 / Netzwerkfehler) scheitern, werden in IndexedDB gepuffert und beim naechsten Online-Ereignis FIFO abgearbeitet.

**Speicher:**
- IndexedDB-Datenbank: `recipedeck-offline`
- Object Store: `mutation-queue`
- Schluessel: `queue` (einzelner Eintrag, haelt ein Array von `QueuedMutation`-Objekten)

**Datenstruktur** (`mobile/offline/types.ts`):
```typescript
interface QueuedMutation {
  opId: string;       // Client-generierte UUID
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  createdAt: number;
  attempts: number;
}
```

**Ablauf:**
1. `queuedMutate()` (`mobile/offline/queued-mutate.ts`) versucht die Mutation direkt abzusetzen.
2. Ist das Geraet offline oder antwortet der Server mit einem Retry-wuerdigen Status, wird die Mutation ans Ende des Arrays angehaengt und `registerBackgroundFlush()` registriert einen Background-Sync-Tag.
3. Beim Flush dreht `MutationQueue.flush()` FIFO durch das Array: `'ok'` / `'drop'` → entfernen; `'retry'` → Verarbeitung stoppen (Item bleibt an erster Stelle).

**Idempotenz:** POST-Bodies erhalten automatisch ein `client_op_id`-Feld (die `opId` der Mutation). Server-seitig:
- `meal_plan`: dedupliziert ueber den partiellen Unique-Index `meal_plan_household_opid_uidx (household_id, client_op_id) WHERE client_op_id IS NOT NULL` (Migration `20260613120000`). Ein wiederholter POST mit derselben `client_op_id` trifft auf `ON CONFLICT DO NOTHING`.
- `shopping_list`: dedupliziert ueber den bestehenden Index `(household_id, recipe_id, canonical_name)` — kein `client_op_id` noetig.

**Reconciliation:** Last-write-wins by refetch — nach einem erfolgreichen Flush rufen die betroffenen Screens `load()` neu auf (`setOnFlushed(load)`). Kein feldweises Merging.

**Optimistische UI:** Neu hinzugefuegte Elemente erhalten vor der Serverbestaetigung eine temporaere String-ID (`tmp-<uuid>`) ueber `newTempId()` aus `mobile/offline/temp-id.ts`. Nach dem Flush ersetzt der Refetch die Temp-ID durch die echte Server-ID.

**Quellcode:**
- `mobile/offline/idb-store.ts` — IndexedDB-Adapter
- `mobile/offline/mutation-queue.ts` — `MutationQueue` (FIFO-Flush)
- `mobile/offline/queued-mutate.ts` — `queuedMutate()` (Entscheidung online/offline)
- `mobile/offline/temp-id.ts` — `newTempId()` / `isTempId()`
- `mobile/offline/types.ts` — `QueuedMutation`, `classifyResponse()`, `classifyError()`
- `mobile/offline/queue-singleton.ts` — `offlineQueue` + `flushOnce()`

## Background Sync

Implementiert in Phase 2 (2026-06-13). Registriert den Browser-Background-Sync-Tag `flush-mutations` nach jedem Enqueue, damit der Browser die Mutation spaetestens beim naechsten Netzwerkereignis — auch nach einem Tab-Neustart — abschickt.

**Technisches Design:**

Der SW kann selbst keine authentifizierten Anfragen stellen (das Supabase-Auth-Token lebt in der Session der Browser-Seite). Stattdessen gilt:

```
Browser fires sync(tag='flush-mutations')
  → SW: clients.matchAll() → postMessage({type:'FLUSH_QUEUE'}) an alle offenen Window-Clients
  → Seite (_layout.tsx): ruft flushOnce() auf → entleert die Queue mit dem aktuellen Session-Token
```

**Bekannte Einschraenkung:** Wenn kein Tab/PWA-Fenster offen ist, kann der Flush nicht durchgefuehrt werden (Token-loses Replay ist Out-of-Scope). Der Browser wiederholt den Sync-Versuch beim naechsten Opportunity. Der prim&auml;re Fallback ist der **Foreground-Listener** in `mobile/offline/network-status.ts` (`online`-Event + `visibilitychange` auf `visible && navigator.onLine`), der `flushOnce()` direkt im Tab aufruft.

**Safari:** Kein Background Sync API → der Foreground-Listener ist hier der einzige Sync-Pfad. Das ist akzeptabel; der Flush findet statt, sobald der Nutzer die App erneut oeffnet und online ist.

**Quellcode:**
- `mobile/offline/background-sync.ts` — `registerBackgroundFlush()` (registriert den Sync-Tag; no-op wenn API fehlt)
- `mobile/offline/network-status.ts` — `onReconnect()` (Foreground-Listener)
- `mobile/sw/sw.ts` — `sync`-Event-Handler
- `mobile/app/_layout.tsx` — `FLUSH_QUEUE`-Message-Handler → `flushOnce()`

## Push-Setup (Operator)

Implementiert in Phase 3 (2026-06-13). VAPID-basierte Web-Push-Benachrichtigungen, ausgeloest durch `completeJob()` im Job-Manager.

### VAPID-Keys generieren

```bash
npx web-push generate-vapid-keys
```

Das ergibt:
```
Public Key:  <base64url-string>
Private Key: <base64url-string>
```

### Umgebungsvariablen setzen

**KRITISCH (X1): `VAPID_PUBLIC_KEY` (Server) und `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (Client) MUESSEN denselben Wert haben** — einmal generieren, zweimal eintragen.

| Variable | Wert | Ort |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Public Key (von oben) | Northflank Runtime Secret |
| `VAPID_PRIVATE_KEY` | Private Key (von oben) | Northflank Runtime Secret |
| `VAPID_SUBJECT` | `mailto:deine@email.de` | Northflank Runtime Secret |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | **derselbe** Public Key | Docker Build-Arg (`--build-arg`) |

**Warum Build-Arg?** `EXPO_PUBLIC_*`-Variablen werden von Expo zur Build-Zeit statisch in das JavaScript-Bundle inliniert. Ein Northflank-Runtime-Secret erreicht das Bundle nicht. Das bedeutet:

1. Den Key als `EXPO_PUBLIC_VAPID_PUBLIC_KEY`-Build-Arg im GitHub-Actions-Workflow setzen (Repository Secret → Build-Arg-Uebergabe an `docker build`).
2. `npm run build:mobile` (bzw. den `web-builder`-Docker-Stage) **mit diesem Build-Arg** ausfuehren.
3. Das Dockerfile hat den `ARG EXPO_PUBLIC_VAPID_PUBLIC_KEY` bereits im `web-builder`-Stage verdrahtet (seit 2026-06-13).

Wenn der Key beim Build fehlt (leerer String), kompiliert der Bundle trotzdem; der Settings-Toggle zeigt Push als "nicht unterstuetzt" an und sendet keine Subscriptions ab.

### Datenbank

Die `push_subscriptions`-Tabelle (Migration `20260613130000_push_subscriptions.sql`) speichert Endpoint und VAPID-Keys pro User:
- Owner-only RLS: `auth.uid() = user_id` fuer SELECT und ALL.
- Subscriptions werden automatisch geloescht wenn der Server 410 (Gone) oder 404 vom Push-Dienst erhaelt.

### Betrieb

- **Job-Fertigstellung → Push:** `completeJob()` in `src/job-manager.ts` loest `sendPushToUser()` aus, wenn `configureVapid()` true ist und die Job-Owner-UserId bekannt ist. Payload: `{title:'Rezept fertig 🍳', body:<Rezeptname>, url:'/recipe/<recipeId>'}`.
- **SW Push-Handler:** `mobile/sw/sw.ts` empfaengt das Push-Event und ruft `self.registration.showNotification()` auf. Hilfsfunktionen in `mobile/sw/push-handler.ts` (`buildNotification()`, `resolveClickUrl()`).
- **Notification-Click:** SW fokussiert ein bestehendes Fenster oder oeffnet ein neues auf der Rezept-URL.
- **Client Opt-in:** Settings-Toggle ueber `usePushSubscription(vapidKey)` in `mobile/hooks/usePushSubscription.ts` — vollstaendiger Lifecycle: Berechtigung anfragen, bestehende Subscription pruefen, subscribe/unsubscribe, denied-sticky, iOS-needs-install (Push erfordert PWA-Installation auf iOS).

### Notfall-Deaktivierung

VAPID-Keys aus den Northflank Runtime Secrets entfernen (oder leer setzen). `configureVapid()` gibt dann `false` zurueck und loggt einmalig:

```
[push] VAPID keys not set — notifications disabled (configureVapid=false)
```

Alle weiteren `sendPushToUser()`-Aufrufe werden zu No-Ops. **Kein Neustart des Servers noetig** — der Warn-Log erscheint beim naechsten Job-Abschluss.

### Operator-Logs

| Log-Zeile | Bedeutung |
|---|---|
| `[push] VAPID keys not set — notifications disabled` | VAPID-Keys fehlen → Push deaktiviert |
| `[push] send failed { endpoint, status: 410 }` | Subscription abgelaufen → wird automatisch geloescht |
| `[push] send failed { endpoint, status: 404 }` | Endpoint nicht gefunden → wird automatisch geloescht |
| `[push] send failed { endpoint, status: 429 }` | Rate-Limit → Fehler wird geschluckt (best-effort) |

## X3 — Migrations-Reihenfolge vor dem Deploy

Northflank deployt automatisch nach einem Image-Push. Die Supabase-Migrationen muessen **vor** dem Image-Deploy auf Prod angewendet werden, da der neue Code sofort auf die neuen Tabellen/Indizes zugreift:

| PR | Migration | Grund |
|---|---|---|
| **PR2** (Offline-Queue) | `supabase/migrations/20260613120000_offline_idempotency_keys.sql` | Ohne den partiellen Unique-Index `meal_plan_household_opid_uidx` schlaegt der neue `ON CONFLICT … WHERE` INSERT fuer `meal_plan` mit "no unique constraint matching given ON CONFLICT specification" fehl. |
| **PR3** (Push) | `supabase/migrations/20260613130000_push_subscriptions.sql` | Ohne die `push_subscriptions`-Tabelle schlaegt `POST /api/v1/push/subscribe` mit einem DB-Fehler fehl. |

**Anwenden via Supabase Dashboard:**
1. Dashboard → SQL Editor → Prod-Projekt auswaehlen.
2. Inhalt der SQL-Datei einfuegen und ausfuehren.
3. Erst danach das Docker-Image pushen / Northflank-Redeploy ausloesen.

## X4 — Push-Smoke-Test

Ohne eine vollstaendige Extraktion ausfuehren zu muessen:

**Primaerer Pfad (UI):**
1. App oeffnen → Settings → Push-Benachrichtigungen aktivieren.
2. Browser fragt nach Berechtigung → "Zulassen".
3. Supabase Dashboard → Table Editor → `push_subscriptions` → eine Zeile fuer die eigene `user_id` ist vorhanden.
4. Eine Extraktion starten und auf Fertigstellung warten → Notification erscheint.
5. Auf die Notification klicken → App oeffnet `/recipe/<id>`.

**Fallback-Pfad (manuell, ohne UI):**

Voraussetzung: eine gueltige Subscription in `push_subscriptions` fuer die eigene User-ID.

```javascript
// Node-Snippet (einmalig ausfuehren):
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:deine@email.de',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const sub = {
  endpoint: '<endpoint aus push_subscriptions.endpoint>',
  keys: JSON.parse('<keys aus push_subscriptions.keys>'), // { p256dh, auth }
};

await webpush.sendNotification(sub, JSON.stringify({
  title: 'Test-Push',
  body: 'Manueller Smoke-Test',
  url: '/',
}));
```

**Erwartetes Ergebnis:** Notification erscheint im Browser/OS, Klick oeffnet die App.

**Operator-Logs beobachten:**
- `[push] VAPID keys not set …` → Keys fehlen oder wurden falsch gesetzt.
- `[push] send failed { endpoint, status }` → Delivery-Problem; bei 410/404 automatische Bereinigung.

## X5 — VAPID-Key-Rotation

**Wichtig:** Eine Key-Rotation invalidiert **alle bestehenden Subscriptions**, da deren verschluesselte Verbindung an den alten Public-Key gebunden ist.

**Ablauf:**
1. Neue Keys generieren: `npx web-push generate-vapid-keys`.
2. `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` auf Northflank ersetzen.
3. `EXPO_PUBLIC_VAPID_PUBLIC_KEY` als Build-Arg setzen und `npm run build:mobile` + Docker-Build neu ausfuehren.
4. Deploy ausloesen.

**Konsequenz:** Alle bestehenden Push-Subscriptions werden beim naechsten Sendeversuch mit 4xx-Fehlern beantwortet und automatisch aus `push_subscriptions` geloescht. Nutzer muessen den Push-Toggle in den Settings einmal deaktivieren und neu aktivieren, um eine neue Subscription zu registrieren.

Eine koordinierte Rotation (z.B. gleichzeitiger Hinweis in der App) ist sinnvoll, wenn die Nutzerbasis gross genug ist.

## Follow-up Tasks

Tracked in `TODO.md`:

- [ ] **Reduce Precache Cap from 6 MB to 5 MB** — Bundle optimization needed; current export is ~5.26 MB.
- [x] **Background Sync / Push Notifications** — Delivered 2026-06-13 (Phase 3). See sections above.
- [x] **Offline Mutations Queue** — Delivered 2026-06-13 (Phase 2). See sections above.
- [ ] **Multi-Tab SW Limitation** — Document and consider workarounds if family/multi-account support is added.

## References

- **Manifest:** `mobile/public/manifest.webmanifest`
- **HTML Head Tags:** `mobile/app/+html.tsx`
- **Service Worker Source:** `mobile/sw/sw.ts`
- **Cache Helpers:** `mobile/sw/cache-names.ts` (naming, `persistUserHash`/`readPersistedUserHash`, `clearLegacyUserCaches`)
- **Recipe Cache Handler:** `mobile/sw/recipe-cache-handler.ts`
- **Push Handler (SW):** `mobile/sw/push-handler.ts` (`buildNotification()`, `resolveClickUrl()`)
- **SW Router:** `mobile/sw/routing.ts`
- **Build Script:** `scripts/pwa/build-sw.ts`
- **Verification Sandbox:** `scripts/pwa/verify-sw-sandbox.mjs`
- **Install Hook:** `mobile/hooks/usePwaInstall.ts`
- **Update Hook:** `mobile/hooks/usePwaUpdate.ts`
- **Push Subscription Hook:** `mobile/hooks/usePushSubscription.ts` (`usePushSubscription`, `enablePushNotifications`, `disablePushNotifications`)
- **Query Client (User Messages + cold-start restore):** `mobile/utils/query-client.ts` (`SET_USER`/`CLEAR_USER`/`SKIP_WAITING` posts; `restoreClient` per-user cold-start restore)
- **API + 401 recovery:** `mobile/utils/api.ts` (`apiFetch` refresh+retry), `mobile/utils/protected-access.ts` (re-login CTA mapping), `mobile/components/OfflineBanner.tsx` (offline vs. session-expired variants)
- **Offline Queue:** `mobile/offline/` — `idb-store.ts`, `mutation-queue.ts`, `queued-mutate.ts`, `queue-singleton.ts`, `background-sync.ts`, `network-status.ts`, `temp-id.ts`, `types.ts`
- **Server Push:** `src/push.ts` (`configureVapid()`, `sendPushToUser()`)
- **Job-Manager Push trigger:** `src/job-manager.ts` (`completeJob()`)
- **Migrations:** `supabase/migrations/20260613120000_offline_idempotency_keys.sql`, `supabase/migrations/20260613130000_push_subscriptions.sql`
- **Plan (Shell + Offline-Read):** `docs/superpowers/plans/2026-06-12-pwa-installable-shell-plan.md`
- **Plan (Offline-Writes, Background Sync, Push):** `docs/superpowers/plans/2026-06-13-pwa-followups-plan.md`
