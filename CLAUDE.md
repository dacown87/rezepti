# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RecipeDeck is a TypeScript web service that extracts recipes from URLs (YouTube, Instagram, TikTok, web pages), free text, and photo uploads, then saves them to Supabase PostgreSQL. Recipes are processed and output in German. It uses Groq API (Llama models) for extraction/translation, with fallback paths through schema.org parsing, audio transcription, and vision models.

The product is called **RecipeDeck**; the repository, Docker image and Northflank service are still named `rezepti`. Both names refer to the same thing.

Multi-user since June 2026: Supabase Auth with a login-first gate, Row Level Security on every user table, and an explicit owner model (`user` **or** `household`) on every user-owned row.

## Commands

- `npm run dev` — Start dev server with hot reload (tsx watch)
- `npm start` — Start production server
- `npm run dev:mobile` — API server + Expo web dev server
- `npm run build:mobile` — Export Expo web app into `public/`
- `npm run build:mobile:docker` — Expo web export command ohne Git-Abhaengigkeit
- `npm run mobile:typecheck` — Mobile TypeScript check
- `npm run test:mobile` — Mobile Vitest suite
- `npm run test:mobile:rntl-guard` — Guard gegen neue direkte `react-test-renderer`-Imports in Mobile-Tests
- `npm run perf:bundle` — Analyze the current `public/` Expo export, including raw/gzip JS totals
- `npm run perf:lighthouse:compare` — Run Lighthouse with `simulate` and `devtools`, then write p50/p75 comparison artifacts
- `npm run perf:validate` — Validate Lighthouse/bundle status against warn-only budgets and update performance history/readiness
- `npm run perf:stability:seed` — Seed 10 real Lighthouse/validate runs for Strict-Hardening without directly editing history
- `npm run perf:budget:suggest` — Compute p50/p75/p95 and p95+10% budget suggestions from method-marked complete history runs
- `npm test` — Run tests (Vitest)
- `npx tsc` — Type-check (noEmit, strict mode)
- `npm run lint:dead` — knip report (dead files, unused/unlisted dependencies, unused exports), never fails
- `npm run lint:dead:ci` — gated subset (files/dependencies/unlisted/unresolved/binaries), currently green
- `npm run mobile:release-gate` — the exact composite script CI runs; run this whole, not its parts

Test suite: Vitest for unit/e2e tests. Mobile UI-near tests import `@testing-library/react-native`; under Vitest this resolves through `mobile/test/testing-library-rn-real.ts`, a thin wrapper around real RNTL that keeps `screen` live and widens the temporary string-based `UNSAFE_*ByType` transition types.

## Docker

- `docker compose up rezepti` — Dev-Modus starten (tsx watch, src/ + public/ als Volume, Änderungen sofort live)
- `docker compose up --build rezepti` — Dev-Image neu bauen und starten
- `docker compose --profile react-prod up rezepti-react-prod` — Production-Modus lokal aus dem aktuellen `Dockerfile` bauen
- `docker compose --profile prod up rezepti-prod` — Production-Modus mit `dacown/rezepti:latest` von Docker Hub
- `docker compose down` — Container stoppen

**Image:** `dacown/rezepti:latest` auf Docker Hub — wird automatisch via GitHub Actions gebaut und gepusht bei jedem Merge auf `main`.

**Stages:** `base` (Node 24.15.0 + yt-dlp + ffmpeg) → `builder` (tsc) → `web-builder` (Expo Web Export aus `mobile/`) → `production` (node dist/index.js) + `dev` (tsx watch)

**Volumes:**
- `./data:/app/data` — local runtime data such as cookies and export artifacts
- `./src:/app/src` — Hot-Reload für Server-Code (nur Dev-Modus)
- `./public:/app/public` — Hot-Reload für Frontend (nur Dev-Modus)

**Wichtig:** `./node_modules` nie als Volume mounten. Ursprünglich wegen `better-sqlite3` (host-spezifisch kompiliert, inkompatibel mit Linux im Container); das Paket ist weg, die Regel bleibt richtig, weil native Module im Container anders gebaut werden als auf dem Host.

**Nicht in dieser Compose-Datei:** der `cf-clearance-scraper` (Port 3001, für Cookidoo) läuft als eigener Container. `CF_SCRAPER_URL` zeigt darauf, Default `http://localhost:3001`.

Die drei Services binden alle Port 3000 — es kann immer nur einer laufen.

**GitHub Secrets (einmalig im Repo setzen):**
- `DOCKERHUB_USERNAME` = `dacown`
- `DOCKERHUB_TOKEN` = Access Token von hub.docker.com → Account Settings → Personal access tokens

## Production

**URL:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

**Deployment:** GitHub Actions → Docker Hub (`dacown/rezepti:latest`) → Northflank (automatic redeploy)

## Architecture

**Request flow:** HTTP request → Pipeline → Classifier → Fetcher → Processor → Supabase PostgreSQL save

The server (`src/index.ts`) serves the Expo web export from `public/` (with SPA fallback) and mounts the API router.

**Pipeline stages**: classifying → fetching → transcribing → analyzing_image → extracting → exporting → done/error

**Key modules:**
- `src/pipeline.ts` — Orchestrator that routes through the extraction workflow; saves to Supabase-backed React DB and accepts per-job LLM options
- `src/classifier.ts` — Determines URL source type; regexes are tried in order (youtube, instagram, tiktok, cookidoo, chefkoch, pinterest, facebook) and fall through to `web`
- `src/fetchers/` — Source-specific content downloaders (yt-dlp for video; cheerio for web)
  - `web/base.ts` — shared extraction utilities + `WebScraperPlugin` interface
  - `web/index.ts` — generic `fetchWeb` dispatcher; Chefkoch ist hier nicht mehr registriert
  - `web.ts` — thin re-export (keeps existing imports stable)
- `src/processors/llm.ts` — Groq API via OpenAI SDK for recipe extraction, refinement, image analysis, and nutrition estimates; creates clients per call so BYOK jobs do not mutate server env
- `src/processors/schema-org.ts` — Fast path: parses schema.org/Recipe JSON-LD
- `src/processors/whisper.ts` — Audio transcription via Groq Whisper API; supports per-job BYOK
- `src/processors/ingredient-parser.ts` — `parseIngredient(raw)` → `{amount, unit, food, note?}`; ephemeral (no DB field)
- `src/db-react.ts` — PostgreSQL connection (postgres-js + Drizzle ORM) and **all** data access; ~2,750 lines, 86 exports. Every recipe query goes through the internal `recipeVisibilityForAuth(auth)` clause — never query `recipes` without it
- `src/api-react.ts` — Mount point only. The eleven routers live in `src/routes/`: `auth`, `recipes`, `recipe-collections`, `recipe-share-invites`, `extraction`, `keys`, `planner`, `platforms`, `push`, `admin`, `bug-reports`
- `src/job-manager.ts` — Job tracking for polling-based extraction. **In-memory `Map`, no DB persistence** — a restart or redeploy loses running jobs, and horizontal scaling would break polling. `createJob` snapshots `userId`/`householdId` because the async run has no request context. `completeJob` fires the Web Push notification
- `src/auth.ts` — `requireUserAuth` / `requireAuth` middleware, Supabase JWT verification, uniform `AuthFlowError` payloads
- `src/schema.ts` — Drizzle table schema, 17 tables (recipes, collections, invites, households, memberships, shopping, planner, dictionary, cookidoo, bug reports, push, BYOK)
- `src/types.ts` — Core types and Zod schemas (RecipeData, ContentBundle, SchemaOrgRecipe)
- `src/mail.ts` — the single provider boundary for invite emails (Brevo)
- `src/push.ts` — VAPID Web Push fan-out with 410/404 auto-prune
- `src/gmail-monitor.ts` — internal delivery monitor for the operator mailbox. **No HTTP endpoint** — never expose it as one

**Database:** PostgreSQL via Supabase. Connection via `DATABASE_URL` env var (postgres-js + Drizzle ORM). Legacy SQLite (`rezepti-react.db`, `better-sqlite3`) and `db.ts`/`db-manager.ts` have been removed.

**Extraction paths** (tried in order):
1. schema.org/Recipe JSON-LD (web only, fastest)
2. LLM text extraction from subtitles or page text (Groq Llama 3.3 70B)
3. Audio transcription (Groq Whisper) → LLM extraction
4. Vision model on images (Groq Llama 4 Scout, fallback)

**API Endpoints** (complete as of 2026-08-07; source of truth is `src/routes/*.ts`):

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Main UI (Expo web export), open |
| `/api/v1/auth/me` | GET | Current user + workspace, `requireUserAuth` |
| `/api/v1/recipes` | GET/POST | List / create recipes, `requireUserAuth` |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | Single recipe CRUD inside the caller's owner scope, `requireUserAuth` |
| `/api/v1/recipes/:id/image` | GET | Fetch recipe image, `requireUserAuth` |
| `/api/v1/recipes/:id/share` | POST | Copy recipe to/from household (share private→household or copy household→private), `requireUserAuth` |
| `/api/v1/recipes/:id/favorite` | POST/DELETE | Add/remove recipe from the caller's favorites collection, `requireUserAuth` |
| `/api/v1/recipe-collections` | GET/POST | List / create recipe collections (private or household-scoped), `requireUserAuth` |
| `/api/v1/recipe-collections/:id` | PATCH/DELETE | Rename / delete a collection (owner only), `requireUserAuth` |
| `/api/v1/recipe-collections/:id/items` | GET/POST | List recipes in a collection / add a recipe (recipe-level visibility re-applied), `requireUserAuth` |
| `/api/v1/recipe-collections/:id/items/reorder` | PATCH | Set explicit item order, `requireUserAuth` |
| `/api/v1/recipe-collections/:id/items/bulk-remove` | POST | Remove several items at once, `requireUserAuth` |
| `/api/v1/recipe-collections/:id/items/bulk-copy` | POST | Copy several items into another collection, `requireUserAuth` |
| `/api/v1/recipe-collections/:id/items/:recipeId` | DELETE | Remove a recipe from a collection, `requireUserAuth` |
| `/api/v1/recipes/:id/share-invites` | POST | Create an email-bound invite; response carries `shareUrl` **and** `delivery`, `requireUserAuth` |
| `/api/v1/share-invites/:token` | GET | Preview an invite by token (token is the credential, no middleware) |
| `/api/v1/share-invites/:token/accept` | POST | Accept → private copy for the recipient; idempotent, wrong account fails, `requireUserAuth` |
| `/api/v1/extract/react` | POST | Start URL extraction job (polling), `requireUserAuth` |
| `/api/v1/extract/react/:jobId` | GET/DELETE | Poll / cancel a job, only visible to the owning user (inline user check, no middleware) |
| `/api/v1/extract/text` | POST | Start free-text extraction job (polling, min 50 chars), `requireUserAuth` |
| `/api/v1/extract/photo` | POST | Start photo extraction job (multipart, polling), `requireUserAuth` |
| `/api/v1/extract/jobs` | GET | List recent jobs for the authenticated user, `requireUserAuth` |
| `/api/v1/keys/validate` | POST | Validate BYOK API key, `requireUserAuth` |
| `/api/v1/health` | GET | Server + DB status, open by design |
| `/api/v1/images/search` | GET | Search recipe image suggestions, `requireUserAuth` |
| `/api/v1/cookidoo/status` | GET | Cookidoo connection status, `requireUserAuth` |
| `/api/v1/cookidoo/credentials` | POST/DELETE | Store/remove the caller's private Cookidoo credentials, `requireUserAuth` |
| `/api/v1/cookidoo/credentials/share` | POST/DELETE | Share/unshare the caller's private Cookidoo credentials with the active household, `requireUserAuth` (owner-only mutation) |
| `/api/v1/pinterest/*` | GET/POST/DELETE | Pinterest connector (not implemented — returns 501), `requireUserAuth` |
| `/api/v1/facebook/*` | GET/POST/DELETE | Facebook connector (not implemented — returns 501), `requireUserAuth` |
| `/api/v1/push/subscribe` | POST/DELETE | Register/remove a Web Push subscription, `requireUserAuth` |
| `/api/v1/proxy/image` | GET | Image proxy for PDF export (unauthenticated by design, SSRF-guarded) |
| `/api/v1/shopping` | GET/POST/PATCH/DELETE | Shopping list CRUD, `requireAuth` (household-scoped) |
| `/api/v1/dictionary` | GET | Ingredient dictionary read (open, global read-only) |
| `/api/v1/dictionary` | POST | Add dictionary entry, `requireAuth` |
| `/api/v1/dictionary/match` | GET | Match ingredient against dictionary (open, global read-only) |
| `/api/v1/planner` | GET/POST/DELETE | Meal planner CRUD, `requireAuth` (household-scoped) |
| `/api/v1/auth/bootstrap` | POST | Bootstrap user account after first sign-in, `requireUserAuth` |
| `/api/v1/bug-reports` | POST | Submit a report incl. `lastFailureSnapshot`, `requireUserAuth` (5 per 60 min) |
| `/api/v1/bug-reports/me` | GET | The caller's own reports, `requireUserAuth` |
| `/api/v1/admin/bug-reports` | GET | All reports, admin only — otherwise `403 admin_required` |
| `/api/v1/admin/bug-reports/:id` | GET/PATCH | Report detail / change status, admin only |
| `/api/v1/admin/byok-validation-policy` | GET/PUT | Shared BYOK rate-limit policy, admin only |

BYOK extraction requests accept `x-groq-key` or an `apiKey` JSON body field where the route has a JSON body. The key is validated and passed explicitly into URL, text, photo, Whisper, Vision, nutrition, and TikTok OCR paths. No server-side key storage (the api_keys store was removed). If no user BYOK key is supplied, Groq calls continue to fall back to the server-side `GROQ_API_KEY`.

## Route Auth Inventory (S3, 2026-06-19 — extended 2026-08-07)

| Surface | Layer | Owner Model | Auth | Read Boundary | Write Boundary | Risk | Action |
|---------|-------|-------------|------|---------------|----------------|------|--------|
| `recipes` | Server + RLS | user/household | `requireUserAuth` + `recipeVisibilityForAuth` | owner | owner | low | — |
| `recipe_collections` / `_items` | Server + RLS | user/household | `requireUserAuth` | visible collections | owner/manager role | low | adding a private recipe to a household collection creates a household copy |
| `recipe_share_invites` create/accept | Server + RLS | user-scoped, email-bound | `requireUserAuth` | inviter and invited account | inviter creates, invited account accepts | low | accept is idempotent; wrong account cannot accept |
| `share-invites/:token` preview | Server | token-scoped | **none — the token is the credential** | anyone holding the token | — | medium | only `token_hash` is stored. Preview returns `status`, `recipeName`, `senderEmail`, `recipientEmail`, `expiresAt` — **two email addresses**, no recipe body. Do not widen this payload |
| `planner` / `shopping` | Server + RLS | household-scoped | `requireAuth` | household | household | low | — |
| `auth/bootstrap` | Server + DB | user-scoped bootstrap with household side-effect | `requireUserAuth` | caller | caller | low | — |
| extraction jobs create/list | Server | user-scoped | `requireUserAuth` | user | user | low | — |
| extraction job poll/cancel | Server | user-scoped | inline ownership check | owner | owner | medium | middleware-free by design |
| `cookidoo/credentials` | Server + Postgres | user-default with optional household-share | `requireUserAuth` | resolved scope (`user > household`) | private row by caller; household share by active-household owner only | low | implemented 2026-06-15; legacy disk singleton removed |
| `cookidoo/status` | Server + Postgres | user-default with optional household-share | `requireUserAuth` | caller sees resolved scope + share flag | — | low | returns `scope`, `connected`, `sharedByCurrentHousehold`, `canManageHouseholdShare` |
| Pinterest / Facebook routes | Server | disabled | `requireUserAuth` + 501 | — | — | low | — |
| `/api/v1/proxy/image` | Server | open-by-design | none | public | — | low | SSRF-guarded, needed for PDF export |
| `/api/v1/health` | Server | open-by-design | none | public | — | low | — |
| `ingredient_dictionary` GET | Server | global read-only | none | public | — | low | intentional public read |
| `ingredient_dictionary/match` GET | Server | global read-only | none | public | — | low | intentional public read |
| `ingredient_dictionary` POST | Server | admin-only global mutation | `requireAuth` + admin gate | — | admin only | medium | unauth + non-admin contract tests present |
| `/api/v1/images/search` | Server | user-scoped | `requireUserAuth` | — | — | low | added auth 2026-06-12 — prevents unauthenticated Unsplash credit drain |
| `api_keys` table | DB | deleted | — | — | — | — | dropped in migration 20260609143000 |
| `push_subscriptions` | Server + RLS | user-scoped | `requireUserAuth` | owner | owner | low | — |
| `bug_reports` submit/list-own | Server + RLS | user-scoped | `requireUserAuth` | own reports | own reports | low | rate-limited, 5 per 60 min |
| `admin/bug-reports` | Server | admin-only | `requireUserAuth` + admin gate | all reports | status/notes | medium | non-admin gets `403 admin_required` |
| `admin/byok-validation-policy` | Server | global, admin-only | `requireUserAuth` + admin gate | admin | admin | medium | policy applies to every user's `/keys/validate` |

**Frontend:** Expo React Native (`mobile/`) — **the only frontend source**, for web *and* native. Expo Router (file-based), NativeWind 4 on Tailwind 3.4, TanStack Query with per-user persistence. The web build is `npm run build:mobile` → `public/`.

> There is no Vite/React SPA any more. `frontend/` is an empty, untracked leftover — it is neither built nor tested. Anything that used to live under `frontend/src/` is now under `mobile/`.

**⚠️ `public/` ist seit 2026-08-07 ein reines Build-Artefakt und nicht mehr eingecheckt.** Im Repo liegen nur noch handgepflegte Quell-Assets (`Logo.png`, Icons, `manifest.webmanifest`); der Expo-Web-Export (`_expo/`, `*.html`, `sw.js`, `assets/`) entsteht erst durch `npm run build:mobile` bzw. den `web-builder`-Stage im Dockerfile. Konsequenzen:

- Nach einem frischen Clone liefert `npm start` kein Frontend, bis einmal gebaut wurde.
- Tests, die den Export voraussetzen, muessen das pruefen — `test/unit/static-assets.test.ts` skippt den Hashed-Asset-Fall ohne Export.
- CI-Jobs, die einen echten Server starten, bauen den Export vorher (`e2e-legacy-soak`); `performance-audit` baut ihn ueber `perf:audit` selbst.
- `public/changelog.json` wird vom Workflow `changelog-update.yml` erzeugt; der Dockerfile faellt auf einen Minimal-Stub zurueck, wenn die Datei fehlt.

Routes (`mobile/app/`, Expo Router):

| Path | Purpose |
|------|---------|
| `(tabs)/index.tsx` | Recipe list, search, ingredient search, category filter |
| `(tabs)/extract.tsx` | URL / free-text / photo import with job polling |
| `(tabs)/scanner.tsx` | QR scanner + generator (BarcodeDetector, `jsQR` fallback) |
| `(tabs)/planner.tsx` | 7-day meal planner with drag & drop |
| `(tabs)/shopping.tsx` | Shopping list |
| `(tabs)/settings.tsx` | BYOK, Cookidoo, push opt-in, app status |
| `recipe/[id].tsx` | Detail view: ingredients, steps, scaling, cook mode, inline edit |
| `account.tsx` | Login / signup / workspace — reachable anonymously |
| `collections.tsx`, `collection/[id].tsx` | Collection list and contents |
| `share-invite/[token].tsx` | View and accept an invite |
| `admin/index.tsx`, `admin/bug-reports.tsx`, `admin/byok-validation-policy.tsx` | Admin surfaces |
| `+html.tsx` | Route-aware static app shell (LCP candidate before hydration) |
| `_layout.tsx` | Root: fonts, theme, query persistence, auth observer, login-first guard, offline-queue flush, bug-report modal, PWA update |

**Login-first gate:** a guard redirects anonymous access to `/account` with a matching `returnTo`; only `/account` itself stays directly reachable. Toggle: `EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE`.

Key modules: `mobile/utils/scaling.ts` (`parseServingsNumber`, `scaleIngredient`), `mobile/utils/api.ts` (`apiFetch` with one forced token refresh + retry on 401), `mobile/utils/query-client.ts` (per-user query persistence, SW messages), `mobile/offline/` (IndexedDB mutation queue), `mobile/sw/` (service worker source).

**There is no local SQL database on the client.** `mobile/db/schema.ts` is a pure type file mirroring the backend tables; `expo-sqlite` is a dependency but is never imported. Client persistence is exactly three layers: per-user TanStack Query persistence (list offline-read), the SW `rd-user-*` cache (detail offline-read), and the IndexedDB mutation queue (offline write).

## PWA (Progressive Web App)

**Status:** PWA follow-up slices **shipped to production 2026-06-14 (v1.0.163)** — offline write path, Background Sync, and Web Push are live. Earlier: Phase 6 (2026-06-13) installable shell + offline-read caching; offline-read hardening (2026-06-14, PRs #11/#12) made the recipe data cache build-independent, restored the signed-in user's React Query cache on cold start, and persisted the SW user hash. The follow-ups landed as three PRs — #14 (precache cap → 5 MB via PDF-chunk exclusion), #15 (offline mutation queue + `client_op_id` idempotency), #17 (Background Sync + Web Push; replaced the auto-closed #16). Plan + as-built notes: `docs/superpowers/plans/2026-06-13-pwa-followups-plan.md`. Details below.

**Source files:**
- Manifest & icons: `mobile/public/manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon-180.png`
- HTML head tags (SW registration, iOS metadata): `mobile/app/+html.tsx`
- Service Worker source: `mobile/sw/sw.ts` (bundled to `public/sw.js` via `scripts/pwa/build-sw.ts`)
- Cache helpers: `mobile/sw/cache-names.ts` (SHA-256 user hashing, cache naming, persisted user hash)
- Recipe cache handler: `mobile/sw/recipe-cache-handler.ts` (StaleWhileRevalidate for GET /api/v1/recipes/*)
- SW router: `mobile/sw/routing.ts` (navigation vs asset request detection)
- Install hook: `mobile/hooks/usePwaInstall.ts` (beforeinstallprompt + iOS hint)
- Update hook: `mobile/hooks/usePwaUpdate.ts` (waiting-worker detection + reload prompt)
- User messages: `mobile/utils/query-client.ts` (SET_USER, CLEAR_USER, SKIP_WAITING posts; per-user query-cache persistence + cold-start restore)

**Build flow:** `npm run build:mobile` runs Expo export, then `postbuild:mobile` hook automatically regenerates `public/sw.js` via `npx tsx scripts/pwa/build-sw.ts`. Manual rebuild: `npx tsx scripts/pwa/build-sw.ts`.

**Precache cap (5 MB):** `build-sw.ts` enforces `JS_SIZE_LIMIT_BYTES = 5 MB` and **excludes the PDF-export-only chunks** (`pdf-export`, `html2canvas`, `purify`) from the precache manifest (`PRECACHE_EXCLUDE`) — PDF export is an online-only action, so those chunks are served by the runtime `rd-assets` CacheFirst handler on first use instead of bloating the precache (total ≈ 4.6 MB).

**Cache families:**
- `rd-shell-v<buildHash>` — NetworkFirst navigations (3s timeout, /index.html fallback). Build-scoped.
- `rd-assets-v<buildHash>` — CacheFirst for `/_expo/static/**` JS/CSS (content-hashed filenames). Build-scoped.
- `rd-user-<sha256-userId>` — StaleWhileRevalidate for GET recipe list/detail/image (per-user, cleared on logout). **Build-INDEPENDENT** (no `-v<buildHash>` suffix) so recipe data survives app updates; recipe data is not tied to the frontend build.
- `rd-user-meta` — holds the persisted SHA-256 user hash (RC2) so a restarted SW resolves the per-user bucket before the next SET_USER. Wiped on logout (matches `rd-user-*`).

**Auth boundary:** Per-user SHA-256-named caches; CLEAR_USER message deletes all `rd-user-*` caches (data + meta). Null/unknown user = network-only (no cache). The `activate` handler GCs only legacy build-scoped `rd-user-*-v<build>` orphans (`clearLegacyUserCaches`), never current-format data caches. Multi-tab limitation: single SW serves all tabs; last SET_USER wins (acceptable for single-tenant deployment).

**Offline read (two layers):** The recipe **list** is restored offline from the per-user React Query persistence (`mobile/utils/query-client.ts` — `restoreClient` resolves the signed-in user from the stored Supabase session on cold start, so it loads the user's key, not `anon`). Recipe **detail** pages (`mobile/app/recipe/[id].tsx`, raw `apiFetch` + state, not React Query) are served from the SW `rd-user-<hash>` cache.

**Session / 401 handling:** `apiFetch` (`mobile/utils/api.ts`) forces one Supabase token refresh + a single retry on a 401 before surfacing the error (recovers a token that lapsed while the PWA was backgrounded). A genuine auth failure maps to a re-login CTA (`mapProtectedApiError` → `token_expired`/`auth_invalid`/any-401 fallback) and the `OfflineBanner` shows a tappable "Sitzung abgelaufen" variant instead of the offline/WifiOff framing.

**Offline writes (Phase 2, 2026-06-13):** Shopping-list and planner mutations that fail while offline (or return 5xx/network error) are queued in IndexedDB (`recipedeck-offline` / `mutation-queue` store) and flushed FIFO on reconnect. POST bodies carry `client_op_id` for server-side idempotency (`meal_plan` only — unique partial index `meal_plan_household_opid_uidx`; shopping_list dedupes via its existing `(household_id, recipe_id, canonical_name)` index). Reconciliation is last-write-wins by refetch (`setOnFlushed(load)` in the affected screens).

**Background Sync (Phase 2, 2026-06-13):** SW tag `flush-mutations`. When the browser fires the sync event the SW cannot run authenticated requests directly (auth token lives in the page's Supabase session), so it `postMessage({type:'FLUSH_QUEUE'})` to all open window clients; the root layout (`mobile/app/_layout.tsx`) calls `flushOnce()`. Limitation: if no tab/PWA window is open the background flush cannot run — the browser retries on the next sync opportunity and the foreground `online`/visibility listener (`onReconnect` in `mobile/offline/network-status.ts`) is the reliable fallback. Safari lacks Background Sync → foreground listener covers it.

**Web Push (Phase 3, 2026-06-13):** VAPID-based job-completion notifications. Server: `src/push.ts` (`configureVapid()`, `sendPushToUser()` best-effort fan-out, 410/404 auto-prune). `completeJob` in `src/job-manager.ts` fires a `{title:'Rezept fertig 🍳', body:<recipe name>, url:'/recipe/<recipeId>'}` push to the job owner. DB: `push_subscriptions` table with owner-only RLS (migration `20260613130000`). Routes: `POST/DELETE /api/v1/push/subscribe` (`requireUserAuth`). Client opt-in via Settings toggle (`mobile/hooks/usePushSubscription.ts` — full lifecycle: subscribe/unsubscribe, denied-sticky, iOS-needs-install). SW `push` + `notificationclick` handlers in `mobile/sw/sw.ts` (helpers: `mobile/sw/push-handler.ts`). See runbook for VAPID setup, Dockerfile build-arg requirement, and rotation notes.

**Operations:** See `docs/pwa-runbook.md` for rebuild procedures, icon regeneration, cache verification, emergency deregistration, offline queue ops, and Push/VAPID setup.

## External CLI Dependencies

Required on the host: `yt-dlp` (included in the Docker image). `npx tsx scripts/ytdlp-health-check.ts` checks the version — an outdated yt-dlp has repeatedly been the cause of "import suddenly stopped working".

Audio transcription uses the Groq Whisper API (`whisper-large-v3-turbo`) — no local `whisper-cpp` required.

`ffmpeg` is **optional**: it is only used to cut frames for TikTok OCR (`extractTextFromVideoFrames`). Without it, OCR is silently skipped and everything else keeps working. It is installed in the Docker image anyway.

## Configuration

Copy `.env.example` to `.env`. Required: `GROQ_API_KEY` (get free at console.groq.com) and `DATABASE_URL` (PostgreSQL connection string, e.g. from Supabase).

## Git / SSH

Remote is configured via SSH (`git@github.com:dacown87/rezepti.git`).
SSH key is at `~/.ssh/id_rezepti`, GitHub host is registered in `~/.ssh/known_hosts`.

**⚠️ Merge-Regel: NIEMALS eigenständig mergen.** Branches erstellen, committen und pushen ist erlaubt. Aber nur mergen wenn der User es explizit sagt.

If push fails:
```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts   # register host key
ssh -T git@github.com                           # test connection
```

If SSH key is missing (e.g. new machine):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_rezepti -N ""
# Add public key (~/.ssh/id_rezepti.pub) to GitHub under Settings → SSH keys
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

SSH config (`~/.ssh/config`):
```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rezepti
```

### Git Hooks

`scripts/hooks/pre-commit` blockiert Phantom-Submodule (Mode-160000-Entries ohne `.gitmodules`-Eintrag). Aktivierung erfolgt automatisch ueber `npm install` (`prepare`-Script setzt `core.hooksPath=scripts/hooks`). Bypass mit `git commit --no-verify` ist moeglich, sollte aber die Ausnahme bleiben.

## Working Notes (Claude)

- **Origin:** Project was AI-generated — code may be inconsistent, pay attention to quality when touching it
- **Test Suite**: Unit tests run with `npm test`. E2E tests (`test/e2e/`) require a running server.
- **After frontend changes:** Bei Bedarf zuerst `npm --prefix mobile ci`, dann `npm run build:mobile` zum Aktualisieren von `public/`. Der Expo-Export kann nach erfolgreichem `Exported: ../public` lokal haengen; nicht mehrfach parallel starten. Das Ergebnis wird **nicht** committet (siehe Frontend-Abschnitt) — `git status` darf nach einem Build keine `public/_expo/`-Eintraege zeigen.
- **After mobile test changes:** `npm run test:mobile:rntl-guard` ausfuehren. Neue Mobile-Tests duerfen `react-test-renderer` nicht direkt importieren; `renderAsync` ist in Testdateien abgebaut. Verbleibende `UNSAFE_queryAllByType`-Altfaelle sind in `docs/testing/rntl-migration-phase-0-inventory.md` dokumentiert.
- **After performance-sensitive mobile changes:** `npm run perf:bundle`, bei LCP-/Shell-/Routing-Aenderungen zusaetzlich `npm run perf:lighthouse:compare` und `npm run perf:validate`. Phase 4c ist abgeschlossen: `mobile/app/+html.tsx` liefert eine route-aware statische App-Shell, damit `/shopping` und `/recipe/*` vor Expo-Web-Hydration einen stabilen LCP-Kandidaten haben.
- **Strict performance hardening:** Fuer die 10er-Messreihe `npm run perf:stability:seed` verwenden. Das Script editiert `history.json` nicht selbst; nur `perf:validate` schreibt echte Run-Eintraege. Danach `npm run perf:budget:suggest` ausfuehren und Vorschlaege pruefen. Stand 2026-06-08: `schedule` (nightly cron 02:00 UTC) startet weiter `strict`, `push`/`pull_request` bleiben `warn`, `workflow_dispatch` weiter wahlweise `warn` oder `strict`. Der Juni-Export nutzt lazy geladene Auth-Observer/-Watcher im mobilen Root-Layout, damit Auth/Workspace-Code nicht mehr als statischer Einstiegspfad am ersten Web-Render haengt. Die Bundle-Baselines wurden dazu auf `maxJsBytes=5,550,000` und `maxLargestJsAssetBytes=4,620,000` nachgezogen. `npm run perf:validate:strict` ist damit wieder budget-clean, kann aber aktuell als `observation_blocked` enden, solange das 10er-Readiness-Fenster historische Mai-Runs mit dem frischen Juni-Run mischt.
- **Supabase RLS CI gate:** `.github/workflows/ci.yml` prefetcht die benoetigten Supabase-Images aus `public.ecr.aws`-Mirrors und startet `npx supabase start -x studio -x imgproxy -x edge-runtime -x vector -x supavisor`. Wenn der RLS-Gate in CI rot wird, zuerst Mirror-/Container-Verfuegbarkeit und den reduzierten Service-Satz pruefen, bevor an Policies oder Tests gedreht wird.
- **GitHub Actions Node runtime:** Repo-/Job-Node laeuft bereits ueber `actions/setup-node@v5` und die Engine-Files auf `24.15.0`. Zusaetzlich wurden die Marketplace-Actions auf Node-24-deklarierende Majors gehoben: `actions/upload-artifact@v7`, `actions/cache/restore@v5`, `actions/cache/save@v5`, `browser-actions/setup-chrome@v2`. Der fruehere Northflank-Sonderfall `northflank/deploy-to-northflank@v1` wurde am 2026-06-08 aus `.github/workflows/docker-publish.yml` entfernt; der Deploy-Step ruft Northflank jetzt direkt per `curl` gegen `/v1/projects/{projectId}/services/{serviceId}/deployment` auf. Wenn kuenftig wieder Node-20-Deprecation-Warnings auftauchen, zuerst die betroffene Action-Version pruefen, nicht die Projekt-Engine.
- **Dead-code checks (knip, seit 2026-08-07):** `knip.json` konfiguriert Root und `mobile` als getrennte Workspaces — ohne die Entry-Points (expo-router, Service Worker, Vitest, Metro-Platform-Suffixe) meldet knip die komplette Expo-App als ungenutzt (156 statt 13 Dateien). Die Kategorie *unused exports* misst **Export-Oberflaeche, nicht toten Code**: die meisten Treffer sind modulintern in Gebrauch und nur unnoetig exportiert. Deshalb gated `lint:dead:ci` sie bewusst nicht — die RNTL-Fassade in `mobile/test/testing-library-rn-real.ts` und die Scraper-Helfer in `src/fetchers/web/base.ts` sind absichtlich breit exportiert. Jede Meldung gegen den Code pruefen, bevor geloescht wird.
- **Erzwungene Duplikate zwischen `src/` und `mobile/`:** `mobile/` ist ein eigenes npm-Paket mit eigenem Bundler, und die Docker-Stage `web-builder` kopiert nur `mobile/` — geteilter Code braeuchte Metro-`watchFolders`, Pfad-Aliase in beiden tsconfigs und eine zusaetzliche COPY-Zeile. Zwei Duplikate sind deshalb per Test abgesichert statt geteilt: `ingredient-category-domain.ts` (byte-identisch, `test/unit/ingredient-category-domain-drift.test.ts`) und die Bug-Report-Enums (`test/unit/bug-report-enums-contract.test.ts`). Aenderungen immer in beide Dateien; die Tests schlagen sonst fehl.
- **Verifikation vor dem Push:** Wenn CI ein zusammengesetztes Script faehrt (`mobile:release-gate` = `&&`-Kette aus sechs Schritten), lokal genau dieses Script ausfuehren — nicht einzelne Bestandteile. Und Verifikationslaeufe **nicht pipen**: `cmd | tail` liefert den Exit-Code von `tail`. Stattdessen `cmd > run.log 2>&1; echo "EXIT=$?"`.
- **New web scraper plugin:** The plugin registry (`PLUGINS` array) was removed in the May 2026 cleanup. The `WebScraperPlugin` interface still exists in `src/fetchers/web/base.ts`. To add a new domain-specific scraper, re-add the plugin registry in `web/index.ts` and implement the interface in `src/fetchers/web/[domain].ts`. Chefkoch bleibt dedizierter Fetcher in `pipeline.ts`.
- **Fetcher code duplication:** Before adding utility functions to a fetcher (extractJsonLdRecipes, resolveSchemaImage, extractImages etc.), check `src/fetchers/web/base.ts` first — these are already exported there.

## Planning Documents

**Wo steht die Wahrheit?** Für den Tagesbetrieb `TODO.md` **in diesem Repo**. Für Routen, Owner und Boundaries das „Route Auth Inventory" oben. Für Strategie und Historie der Obsidian-Phasenplan.

- **TODO (operativ, maßgeblich):** `TODO.md` — ganz oben „Naechste Schritte" mit aktueller Reihenfolge und Runbook-Links
- **Master Plan (Strategie/Historie):** Obsidian Vault → `Projekte/RecipeDeck/Phasenplan.md` — oben der Plan von März 2026 (teils überholt), unten die Konsolidierung bis 2026-08-07. **Keine** operative Arbeitsliste.
- **Legacy Plan:** `docs/superpowers/plans/2026-03-26-master-phasenplan.md` — Veraltet, nur als Archiv. Nicht mehr maßgeblich.
- **Autoplan-Review:** `~/.claude/plans/joyful-kindling-anchor.md` — Vollständiger Projektstand-Review (2026-04-09) mit offenen Punkten
- **Codemaps:** `docs/CODEMAPS/` — Index, Architecture, Backend, Database, Fetchers, Frontend (nachgezogen 2026-08-07). Ausführlichere, verlinkte Fassung im Vault unter `Projekte/RecipeDeck/Codemaps/`.
- **ADRs:** Obsidian Vault → `Projekte/RecipeDeck/Entscheidungen.md` — Architektur-Entscheidungen inkl. Begründung und Konsequenzen
- **Project Learnings:** `docs/PROJECT_LEARNINGS.md` — Aggregierte Pitfalls/Operationals aus gstack-Sessions. Bei neuen Aufgaben hier zuerst nachsehen, ob ein bekannter Stolperstein dokumentiert ist. Updates ueber `/learn` (zeigt aktuelle) — neue Eintraege werden automatisch von `/review`, `/ship`, `/investigate` etc. ergaenzt.
- **RNTL Migration Inventory:** `docs/testing/rntl-migration-phase-0-inventory.md` — aktueller Mobile-Test-Migrationsstand, Real-RNTL-Runtime-Fix, abgebauter `UNSAFE_queryAllByType`-Rest und verbleibende Warnklassen.
- **RNTL Authoring Checklist:** `docs/testing/rntl-migration-authoring-checklist.md` — Regeln fuer neue Mobile-Tests nach Entfernung des Compat-Layers.
- **Supabase Advisor Plan:** `docs/SupaBase/supabase-advisor-remediation-plan.md` — reviewed SQL/Ops-Plan fuer `function_search_path_mutable`, FK-Indexes, RLS-ohne-Policy-Klassifizierung und Grants-Audit.
- **Performance Analysis:** `docs/performance/throttling-analysis.md` — Phase-4c Throttling-Vergleich, App-Shell-LCP-Fix, Bundle-Gzip-Zahlen und Strict-Gate-Regeln.
- **Strict Probe Runbook:** `docs/performance/strict-probe-runbook.md` — Archiv/Runbook fuer Strict-Probe-Freigabe und spaetere Enforcement-Eskalationen.

## Cleanup (March 2026) ✅

Legacy code and dead files removed:
- ❌ `src/db.ts` — deleted (replaced by `src/db-react.ts`)
- ❌ `src/db-manager.ts` — deleted (dual-DB abstraction no longer needed)
- ❌ `src/react-job-manager.ts` — deleted (superseded by `job-manager.ts`)
- ❌ SSE endpoint `/api/extract` — removed
- ❌ Legacy `/api/recipes` and `/api/health` routes — removed
- ❌ Design variants `public/v1–v4.html`, `public/legacy-index.html` — removed
- ❌ `AGENTS.md`, `REACT_API.md`, `components.md`, `DOCKER_DEPLOYMENT.md` — outdated docs removed
- ❌ `scripts/migrate-to-react-db.ts` — one-time migration script removed
- ❌ `test/unit/key-manager.test.ts`, `test/react-components/`, `test/utils/performance-test.ts`, `test/setup-react.ts` — dead test files removed
- ❌ Implemented plan/spec docs (Cookidoo, Docker) removed from `docs/superpowers/`
- ❌ Dead `src/interfaces/` — removed
- ❌ `check-dbs.js`, `test-react-endpoints.ts` — orphan root scripts removed
- ❌ `scripts/test-migration.ts`, `scripts/verify-migration.js` — dual-DB migration scripts removed
- ❌ `src/fetchers/cobalt.placeholder.ts` — unimplemented fetcher removed
- ❌ `vitest.react.config.ts`, `frontend-vitest.config.ts` — redundant vitest configs removed
- ❌ `docs/database-migration.md`, `PROGRESS.md` — stale docs removed
- ❌ Frontend `.d.ts` stub files — removed (auto-generated, not hand-written)
- ❌ `test/scripts/run-tests.ts`, `test/utils/test-setup.ts` — broken test utilities removed
- ✅ `frontend/src/components/ChangelogModal.tsx` — extracted as shared component (no longer duplicated in Layout + SettingsPage)

> Historical section — kept for context. The whole `frontend/` tree was removed in April 2026 when `mobile/` became the only frontend source, so the paths above no longer exist.

## Roadmap

Planned features and current implementation status (reviewed 2026-08-07, v1.0.196):

### Import & Extraction
- Websites (general): 80% — works, gaps on uncommon sites
- YouTube: 80% — audio, subtitles, vision fallback
- TikTok: 70% — via yt-dlp, plus optional frame OCR
- Instagram: 70% — yt-dlp, then Cobalt, then plain web scraping
- Chefkoch: 40% — Schema.org partially works; dedicated fetcher wired in `pipeline.ts`
- Cookidoo: 100% — **form-based web login** against Vorwerk CIAM (`login-srv/login`) with a CF-clearance bootstrap via `CF_SCRAPER_URL`. Not OAuth2, not ROPC, no Playwright. Sessions are stored per scope in `cookidoo_credentials.session_*`
- Pinterest: 0% — Pinterest serves no pin data to anonymous requests any more (measured 2026-08-07: ~1.08 MB app shell, no `og:` tags, `__PWS_DATA__` without pin content, yt-dlp `403`). The fetcher still follows an outbound article link when it finds one and otherwise fails with a clear hint. The global disk credentials were removed on 2026-08-07; `/api/v1/pinterest/*` returns `501`
- Facebook: 0% — fetcher exists and `pipeline.ts` calls it, `/api/v1/facebook/*` returns `501`, and cookies can only be placed in `data/facebook-cookies.txt` by hand. Deliberately left that way until the encrypted per-user path exists — see `TODO.md`
- Photo import (camera/gallery): 100% ✅ — Phase 3b delivered

### Recipe Display & Navigation
- Recipe list & detail view: 100% ✅ — list/grid toggle, /recipe/:id route
- Ingredients & steps displayed separately (à la Dr. Oetker): 100% ✅ — 2-column layout on desktop, single-column on mobile
- Adjustable serving size + scaling: 100% ✅ — ×0.5–×4 stepper with ingredient quantity scaling
- Fullscreen cook mode: 100% ✅ — Phase 2 delivered with wakeLock
- Original recipe link: 100% ✅ — prominent button in action area + source box at bottom
- Recipe inline editing: 100% ✅ — name, emoji, tags, duration, calories, ingredients, steps editable in-place; saves via PATCH /api/v1/recipes/:id

### Shopping & Planning
- Shopping list: 100% ✅ — Phase 3c delivered with multi-recipe aggregation, check-off, clipboard export
- Meal planner: 100% ✅ — Phase 5 + Phase 8 delivered (7-day view, recipe assignment, Drag & Drop between days)
- Ingredient-based recipe search: 100% ✅ — Phase 4 delivered
- Enter available ingredients → get recipe suggestions: 0%

### Community & Social
- User login (incl. "stay logged in"): 100% ✅ — Supabase Auth, login-first gate, RLS on every user table, `user`/`household` owner model (June 2026)
- Households (default household on first sign-in, memberships): 100% ✅
- Recipe invites by email: 100% ✅ code-side — email-bound, only `token_hash` stored, accept creates a private copy. Delivery is live in code but the Brevo secrets are not set in production, so `delivery.status=skipped` and the manual share link is the fallback
- Rating system (stars): 100% ✅ — Phase 3a delivered
- Personal notes: 100% ✅ — Phase 3a delivered
- Comment function: 0%
- Share recipe via QR code: 100% ✅ — Phase 4/5 delivered (offline JSON in QR)
- Favorites (toggle, filter in list): 100% ✅ — first slice merged via PR #28; Whole-Branch-Review, DB/browser smoke and final remote CI complete
- Recipe sharing (copy private→household, copy household→private): 100% ✅ — first slice merged via PR #28; user-to-user invites and multi-household target selection remain separate follow-ups
- Private and household-scoped collections (incl. collection-contents view + add/remove): 100% ✅ — first slice merged via PR #28; deferred enhancements: bulk ops, Collection-Sortierung, Rollenfeinheit, Offline-Schreibpfad

### Export & Print
- Recipe card as PDF: 100% ✅ — Phase 4 delivered with QR code

### Mobile & Responsive Design
- Mobile first approach: 100% ✅ — Expo React Native, one codebase for web and native
- PWA (Homescreen install): 100% ✅ — Phase 2 delivered
- PWA offline write path (mutation queue + idempotency): 100% ✅ — delivered 2026-06-14 (v1.0.163)
- PWA Background Sync (flush queue on reconnect): 100% ✅ — delivered 2026-06-14 (v1.0.163)
- Web Push (job-completion notifications, opt-in): 100% ✅ — delivered 2026-06-14 (v1.0.163)
- Media queries for typical screen sizes: 100% ✅ — responsive via NativeWind/Tailwind
- Android / iOS app: in progress — EAS Build profiles exist in `mobile/eas.json`, triggered locally via the EAS CLI. The former `eas-build.yml` GitHub workflow **no longer exists**. (The old "Flutter" plan was dropped when the app moved to Expo.)

## Testing

**Unit tests (no server needed):**
- `npm test -- --run --exclude="test/e2e/**"` — run only unit tests
- `npm test` — all tests (E2E tests fail if server not running)

**Test Status (2026-08-07, lokal gemessen):**
- Root Unit (`--exclude test/e2e/**`): 626 bestanden, 28 uebersprungen (57 Dateien)
- Mobile Unit: 389 bestanden (51 Dateien)
- Der uebersprungene `static-assets.test.ts`-Fall („serves an existing Expo hashed logo asset") braucht ein vorheriges `npm run build:mobile` — siehe `public/`-Abschnitt
- Mobile RNTL guard: `npm run test:mobile:rntl-guard` blockiert neue direkte `react-test-renderer`-Imports
- E2E contract gate: CI startet echten Server und fuehrt `npm run test:e2e:contract` aus
- Details und Historie: `docs/TEST_STATUS.md`

**CI-Jobs (`.github/workflows/ci.yml`):** `test`, `e2e`, `supabase-rls-smoke`, `e2e-legacy-soak`, `mobile-release-gate`, `performance-audit`. Weitere Workflows: `changelog-update.yml`, `docker-publish.yml`, `supabase-auth-config.yml` (*Sync Supabase Auth Config*), `supabase-db-push.yml` (*Apply Supabase Migrations* — der einzige vorgesehene Weg fuer Production-Migrationen).

**Test Coverage:**
| Area | Tests | Files |
|------|-------|-------|
| scaling.ts | 100% | parseServingsNumber, scaleIngredient, splitIngredient |
| ingredient-dictionary.ts | 100% | all 7 matching paths |
| Shopping API | CRUD + Negativfälle | planner-routes.test.ts |
| Dictionary API | POST/match + Validierung | planner-routes.test.ts |
| Ingredient Search | OR/AND/threshold/limit | recipes-routes.test.ts |
| PDF Helpers | alle Exports | pdf-export-helpers.test.ts |
| Static Assets | hashed/fallback/404 | static-assets.test.ts |
| TikTok OCR | plaintext helper, Fehlerfälle | tiktok.test.ts |
| Chefkoch Routing | classifyURL + dedizierter Fetcher | pipeline-chefkoch.test.ts |
| src/mobile Drift-Guards | Duplikat-Gleichheit + Enum-Contract | ingredient-category-domain-drift.test.ts, bug-report-enums-contract.test.ts |

## Conventions

- ES modules throughout (`.js` extensions in imports for ESM compatibility)
- German for user-facing content and recipe output; English for code
- Zod schema (`RecipeDataSchema` in `types.ts`) validates all recipe output at runtime
- Async/await for all async operations
- No barrel exports; direct module imports
- JSON arrays (tags, ingredients, steps) are stored in PostgreSQL columns through Drizzle helpers in `src/db-react.ts`
- Obsidian Vault liegt unter `/home/patrick/Vault/`. Local REST API PATCH works when targeting the exact heading from the document map; nested headings use `::`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming -> invoke /office-hours
- Strategy/scope -> invoke /plan-ceo-review
- Architecture -> invoke /plan-eng-review
- Design system/plan review -> invoke /design-consultation or /plan-design-review
- Full review pipeline -> invoke /autoplan
- Bugs/errors -> invoke /investigate
- QA/testing site behavior -> invoke /qa or /qa-only
- Code review/diff check -> invoke /review
- Visual polish -> invoke /design-review
- Ship/deploy/PR -> invoke /ship or /land-and-deploy
- Save progress -> invoke /context-save
- Resume context -> invoke /context-restore
- Author a backlog-ready spec/issue -> invoke /spec
