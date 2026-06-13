# PWA Runbook

RecipeDeck's Progressive Web App setup — installable shell with offline-read capability.

**Status:** Phase 6 completed (2026-06-13). Service Worker deployed in production.

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

- **Offline read** — Recipe list and detail pages are served from cache even without network (after first load).
- **Homescreen install** — Android: standard beforeinstallprompt UX; iOS: manual "Add to Home Screen" (see Install Hints section).
- **Update detection** — UI notifies when a new SW is ready; user can opt-in to reload.
- **Per-user caching** — Recipe API responses cached separately per logged-in user (SHA-256-hashed user ID); automatically cleared on logout.

## Service Worker Architecture

The bundled SW (`public/sw.js`) implements three cache families:

| Cache Name | Strategy | Content | Lifecycle |
|-----------|----------|---------|-----------|
| `rd-shell-v<hash>` | NetworkFirst (3s timeout) | Navigation requests, /index.html precache fallback | Cleared on new build |
| `rd-assets-v<hash>` | CacheFirst | Hash-named JS/CSS chunks from `_expo/static/` | Cleared on new build (not hand-deleted) |
| `rd-user-<sha256-userId>-v<hash>` | StaleWhileRevalidate | GET /api/v1/recipes/* (read-only) | Deleted on logout (CLEAR_USER message) |

**Build Hash Rotation**

The `<hash>` suffix (8 hex chars, derived from the precache manifest) rotates on every `npm run build:mobile`. This automatically orphans old caches:
- On next app start, the old caches (e.g., `rd-shell-voldHash`) remain but are no longer served.
- The `activate` event handler runs `clearStaleUserCaches()`, which deletes all `rd-user-*` caches from previous builds.
- Shell and asset caches from old builds are left untouched (low storage cost, safe fallback if new build fails).

**Per-User Authentication Boundary**

- When the user logs in, the React app posts a `SET_USER` message with the user's UUID.
- The SW asynchronously computes a SHA-256 hash (64 hex chars) and stores it in `currentUserHash`.
- Subsequent GET requests to `/api/v1/recipes/*` are cached in `rd-user-<sha256-userId>-v<hash>`.
- On logout or user switch, the React app posts a `CLEAR_USER` message.
- The SW deletes ALL `rd-user-*` caches synchronously and sets `currentUserHash = null`.
- Unknown/null user: requests fall through to network (no cache).

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
- Cache names change: `rd-shell-v<newHash>`, `rd-assets-v<newHash>`, `rd-user-<userId>-v<newHash>`.
- The activate event clears all `rd-user-*` caches from builds other than the current one.

**Example:**
- Build 1: caches named `rd-shell-vABCD1234`, `rd-assets-vABCD1234`, `rd-user-<alice>-vABCD1234`.
- Build 2 (new assets): caches named `rd-shell-vEFGH5678`, `rd-assets-vEFGH5678`, `rd-user-<alice>-vEFGH5678`.
- On first visit in Build 2, `activate` deletes the old `rd-user-<alice>-vABCD1234` cache.

### CLEAR_USER Message

When the user logs out or switches account, the React app (in `mobile/utils/query-client.ts`) posts:

```javascript
navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_USER' });
```

The SW:
1. Sets `currentUserHash = null`.
2. Asynchronously deletes ALL `rd-user-*` caches (across all users and all builds).
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
4. Confirms the expected cache name format: `rd-user-<64hexchars>-v<8hexchars>`.
5. Sends `CLEAR_USER` and verifies all user caches are deleted.

Expected output:

```
=== SW Cache Boundary Verification Sandbox ===
Step 1: Firing activate event (stale cache GC)…
…
=== SUMMARY ===
  SW evaluation:        PASS (no throw)
  SHA-256 hash length:  PASS (64 hex chars)
  Cache name format:    PASS (rd-user-<64hex>-v<build>)
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

## Follow-up Tasks

Tracked in `TODO.md`:

- [ ] **Reduce Precache Cap from 6 MB to 5 MB** — Bundle optimization needed; current export is ~5.26 MB.
- [ ] **Background Sync / Push Notifications** — Enable offline writes (mutations queue + conflict resolution) and push notifications. Deferred after Phase 6.
- [ ] **Offline Mutations Queue** — Shopping list and planner edits offline, sync on reconnect. Deferred after Phase 6.
- [ ] **Multi-Tab SW Limitation** — Document and consider workarounds if family/multi-account support is added.

## References

- **Manifest:** `mobile/public/manifest.webmanifest`
- **HTML Head Tags:** `mobile/app/+html.tsx`
- **Service Worker Source:** `mobile/sw/sw.ts`
- **Cache Helpers:** `mobile/sw/cache-names.ts`
- **Recipe Cache Handler:** `mobile/sw/recipe-cache-handler.ts`
- **SW Router:** `mobile/sw/routing.ts`
- **Build Script:** `scripts/pwa/build-sw.ts`
- **Verification Sandbox:** `scripts/pwa/verify-sw-sandbox.mjs`
- **Install Hook:** `mobile/hooks/usePwaInstall.ts`
- **Update Hook:** `mobile/hooks/usePwaUpdate.ts`
- **Query Client (User Messages):** `mobile/utils/query-client.ts` (see `SET_USER`, `CLEAR_USER`, `SKIP_WAITING` posts)
- **Plan:** `docs/superpowers/plans/2026-06-12-pwa-installable-shell-plan.md`
