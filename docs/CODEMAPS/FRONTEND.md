# Frontend Codemap

**Last Updated:** 2026-08-07 (v1.0.196)

`mobile/` is the **only** frontend source — web, iOS and Android.

> There is no Vite/React SPA any more. The `frontend/` directory in the repo is
> an empty, untracked leftover; it is neither built nor tested.

## Stack

Expo ~56.0.19 · React Native 0.85.3 · React 19.2.3 · Expo Router ~56.2.18 ·
NativeWind 4 on Tailwind 3.4 · TanStack Query 5 · Supabase JS 2

`mobile/` is its **own npm package** with its own `package.json`, `tsconfig.json`
and bundler (Metro) — hence `npm --prefix mobile ...` for everything mobile.

## Routing (`mobile/app/`, Expo Router, file-based)

```
app/
├── _layout.tsx              Root: fonts, theme, query-client persistence,
│                            auth observer, login-first guard, offline flush,
│                            bug-report modal, PWA update
├── +html.tsx                Route-aware static app shell (LCP before hydration)
├── +not-found.tsx
├── modal.tsx
├── account.tsx              Login / signup / workspace — reachable anonymously
├── recipe/[id].tsx          Detail: ingredients, steps, scaling, cook mode, inline edit
├── collections.tsx          Collection overview
├── collection/[id].tsx      Collection contents
├── share-invite/[token].tsx View and accept an invite
├── admin/index.tsx          Admin hub
├── admin/bug-reports.tsx
├── admin/byok-validation-policy.tsx
└── (tabs)/
    ├── index.tsx            Recipe list, search, ingredient search, categories
    ├── extract.tsx          URL / text / photo import
    ├── scanner.tsx          QR scanner / generator
    ├── planner.tsx          7-day meal planner
    ├── shopping.tsx         Shopping list
    └── settings.tsx         BYOK, Cookidoo, push opt-in, app status
```

**Login-first gate:** a guard in the root layout redirects anonymous access to
`/account` with a matching `returnTo`; only `/account` itself stays directly
reachable. Toggle: `EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE`.

**Performance note:** the auth observer and workspace watcher are loaded
**lazily** in the root layout so they do not sit on the first web render.
`+html.tsx` emits a route-dependent static shell before hydration — without it
Lighthouse has no LCP candidate (Phase 4c).

## `mobile/utils/` — the logic layer

| File | Purpose |
|------|---------|
| `api.ts` | `apiFetch` — auth header, **one** forced token refresh + retry on 401 |
| `auth.ts`, `auth-storage.ts` | Supabase client, session in `expo-secure-store` |
| `account-bootstrap.ts` | Calls `/auth/bootstrap` after first sign-in |
| `protected-access.ts` | `mapProtectedApiError` → `token_expired` / `auth_invalid` / offline |
| `login-first-routing.ts` | Which route is allowed anonymously |
| `query-client.ts` | QueryClient + **per-user persistence**; posts `SET_USER` / `CLEAR_USER` / `SKIP_WAITING` to the SW |
| `server-url.ts` | `getServerUrl()` — AsyncStorage override, else `''` (web, relative) or `PRODUCTION_URL` (native) |
| `recipe-mapper.ts` | Row (snake_case) → UI model (camelCase) |
| `recipe-list-screen-data.ts`, `planner-screen-data.ts`, `shopping-service.ts` | Screen logic, separately testable |
| `scaling.ts` | `parseServingsNumber`, `scaleIngredient` — 100% test coverage |
| `ingredient-category-domain.ts` | **byte-identical duplicate** of `src/ingredient-category-domain.ts`, guarded by a drift test |
| `pdf-export*.ts` | Base + `.native` (expo-print) + `.web` (jsPDF download) |
| `recipe-qr.ts` | QR payload (offline JSON) |
| `image-compress.ts` | `compressIfNeeded` — JPEG requantisation in up to 4 steps down to ≤ 256,000 bytes. **Native only**; on web the URI is returned unchanged |
| `bug-reporting.ts` | Modal controller + last-failure snapshot |
| `admin.ts`, `cookidoo-settings.ts`, `use-theme.ts` | Admin calls, Cookidoo UI state, theme |

## `mobile/hooks/`

`useRecipes`, `useRecipe`, `useCollections` (TanStack Query) · `useOfflineQueue` ·
`usePushSubscription` (full opt-in lifecycle including denied-sticky and
iOS-needs-install) · `usePwaInstall` · `usePwaUpdate`.

## `mobile/components/`

`AddToCollectionModal`, `BugReportModal`, `BugReportHeaderAction`,
`ImagePickerModal`, `OfflineBanner`, `ProtectedAccessNotice`, `StepText`,
`StyledText`, `Themed`, `ExternalLink`, `useColorScheme`,
`ScannerCamera.{native,web}`, plus `admin/AdminBugReportsScreen` and
`settings/MyBugReportsSection`.

## `mobile/offline/` — the write path

| File | Purpose |
|------|---------|
| `idb-store.ts` | IndexedDB `recipedeck-offline` / store `mutation-queue` |
| `mutation-queue.ts` | FIFO queue, flushed on reconnect |
| `queued-mutate.ts` | Wrapper: enqueue instead of failing when offline / 5xx / network error |
| `network-status.ts` | `onReconnect` — `online` and visibility listeners |
| `background-sync.ts` | SW tag `flush-mutations` |
| `queue-singleton.ts`, `temp-id.ts`, `types.ts` | Infrastructure |

Affected surfaces: shopping list and meal planner. Planner POSTs carry
`client_op_id` for server-side idempotency; the shopping list dedupes via its
`(household_id, recipe_id, canonical_name)` index. Reconciliation is
last-write-wins by refetch (`setOnFlushed(load)`).

## `mobile/sw/` — service worker

TypeScript source, bundled to `public/sw.js` by `scripts/pwa/build-sw.ts`
(runs automatically as `postbuild:mobile`).

| File | Purpose |
|------|---------|
| `sw.ts` | Entry: install / activate / fetch / push / notificationclick / sync |
| `cache-names.ts` | SHA-256 user hashing, cache naming, persisted user hash |
| `recipe-cache-handler.ts` | StaleWhileRevalidate for `GET /api/v1/recipes/*` |
| `routing.ts` | Navigation vs asset request detection |
| `push-handler.ts` | Push payload → notification |

Cache families:

- `rd-shell-v<buildHash>` — NetworkFirst for navigations (3 s timeout)
- `rd-assets-v<buildHash>` — CacheFirst for `/_expo/static/**`
- `rd-user-<sha256(userId)>` — recipe data, deliberately **without** a build
  suffix so it survives app updates
- `rd-user-meta` — persisted user hash

`CLEAR_USER` deletes all `rd-user-*`. Unknown user = network-only. The precache
is capped at 5 MB; the PDF-export chunks (`pdf-export`, `html2canvas`, `purify`)
are excluded on purpose and served at runtime from `rd-assets`.

## There Is No Local SQL Database

A common misconception from older notes: **`mobile/db/schema.ts` is a pure type
file** mirroring the backend tables. `expo-sqlite` is in the dependencies but is
**never imported**. Client persistence is exactly three things:

1. Per-user TanStack Query persistence (AsyncStorage) — offline read of the list
2. Service worker cache `rd-user-*` — offline read of detail pages
3. IndexedDB mutation queue — offline write

## Platform Splits

Metro resolves `.native.*` / `.web.*` automatically. There are exactly three:

| Module | Native | Web |
|--------|--------|-----|
| `ScannerCamera` | `expo-camera` | BarcodeDetector API, `jsQR` fallback |
| `pdf-export` | `expo-print` + jsPDF | Browser download (jsPDF) |
| `useColorScheme` | React Native | `useColorScheme.web.ts` |

## Tests

55 files under `mobile/test/`, Vitest. UI-near tests import
`@testing-library/react-native`, which under Vitest resolves through the facade
`mobile/test/testing-library-rn-real.ts`. `react-test-renderer` must **not** be
imported directly — `npm run test:mobile:rntl-guard` blocks it. Rules:
`docs/testing/rntl-migration-authoring-checklist.md`.

## Build

```bash
npm run build:mobile        # Expo web export → public/ (+ SW rebuild)
npm run mobile:typecheck
npm run test:mobile
npm run mobile:release-gate # exactly what CI runs — run it whole
```

`mobile:release-gate` is an `&&` chain of six steps. Run the **complete** script
before pushing, not individual parts — and do not pipe it, or you lose the exit
code (`cmd > run.log 2>&1; echo "EXIT=$?"`).

## Web Export in Docker

The `web-builder` stage copies **only** `mobile/` and takes
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE` and `EXPO_PUBLIC_VAPID_PUBLIC_KEY` as
**build args**. Setting them only as Northflank runtime secrets produces an
image where they are missing — login and Web Push then do not work.
