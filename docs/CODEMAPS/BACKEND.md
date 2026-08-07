# Backend Codemap

**Last Updated:** 2026-08-07 (v1.0.196)

Roughly 11,000 lines of TypeScript. ES modules throughout (`.js` extensions in
imports). No barrel exports — every module is imported directly.

## Entry Point

**Location:** `src/index.ts` (155 lines)

Hono server on `PORT` (default 3000):

- `compress()` globally, `cors()` on `/api/*`
- `GET /` → `public/index.html`
- static serving of `public/` (`/public/*`, `/assets/*`, `/Logo.png`, `/vite.svg`)
- `GET /changelog.json` — from `public/`, with a stub fallback
- `app.route("/", reactApi)` — mounts the API
- `GET *` — SPA fallback: try a file from `public/` first, then `index.html`

> Since 2026-08-07 `public/` is a **build artefact** and no longer checked in.
> After a fresh clone `npm start` serves no frontend until `npm run build:mobile`
> has run once.

## Routers

`src/api-react.ts` is a **mount point only** since the router split. Eleven
routers are mounted at `/`; the full paths live in the route files themselves.

| File | Lines | Contents |
|------|-------|----------|
| `routes/extraction.ts` | 494 | URL / text / photo jobs, polling, cancel, image search |
| `routes/recipe-collections.ts` | 457 | Collections, favorites, sharing, reorder, bulk ops |
| `routes/planner.ts` | 271 | Shopping list, dictionary, meal plan |
| `routes/bug-reports.ts` | 241 | Bug reporting + admin view |
| `routes/recipes.ts` | 228 | Recipe CRUD, image endpoint, `/health` |
| `routes/platforms.ts` | 204 | Cookidoo credentials, Pinterest/Facebook (501), image proxy |
| `routes/admin.ts` | 109 | BYOK validation policy |
| `routes/recipe-share-invites.ts` | — | Create, preview and accept invites |
| `routes/auth.ts` | — | `/auth/me`, `/auth/bootstrap` |
| `routes/keys.ts` | — | `/keys/validate` |
| `routes/push.ts` | — | Web Push subscriptions |

## API Endpoints

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/` | GET | open | Main UI (Expo web export) |
| `/api/v1/auth/me` | GET | `requireUserAuth` | Current user + workspace |
| `/api/v1/auth/bootstrap` | POST | `requireUserAuth` | Profile, default household, membership on first sign-in |
| `/api/v1/recipes` | GET | `requireUserAuth` | List; `?ingredients=` (comma-separated, max 500 chars / 20 items) plus `match=and\|or`, `threshold=`, `limit=` for ingredient search |
| `/api/v1/recipes` | POST | `requireUserAuth` | Create for the user or one of their households |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | `requireUserAuth` | Single recipe inside the caller's owner scope |
| `/api/v1/recipes/:id/image` | GET | `requireUserAuth` | Image bytes, `Cache-Control: immutable` |
| `/api/v1/recipes/:id/share` | POST | `requireUserAuth` | Copy private→household or household→private |
| `/api/v1/recipes/:id/favorite` | POST/DELETE | `requireUserAuth` | Caller's favorites collection |
| `/api/v1/recipes/:id/share-invites` | POST | `requireUserAuth` | Email-bound invite; response has `shareUrl` **and** `delivery` |
| `/api/v1/share-invites/:token` | GET | **token only** | Preview: status, recipe name, sender/recipient email, expiry |
| `/api/v1/share-invites/:token/accept` | POST | `requireUserAuth` | Accept → private copy; idempotent, wrong account fails |
| `/api/v1/recipe-collections` | GET/POST | `requireUserAuth` | List / create (private or household) |
| `/api/v1/recipe-collections/:id` | PATCH/DELETE | `requireUserAuth` | Rename / delete (owner role) |
| `/api/v1/recipe-collections/:id/items` | GET/POST | `requireUserAuth` | List contents / add a recipe |
| `/api/v1/recipe-collections/:id/items/reorder` | PATCH | `requireUserAuth` | Set explicit order |
| `/api/v1/recipe-collections/:id/items/bulk-remove` | POST | `requireUserAuth` | Remove several |
| `/api/v1/recipe-collections/:id/items/bulk-copy` | POST | `requireUserAuth` | Copy several into another collection |
| `/api/v1/recipe-collections/:id/items/:recipeId` | DELETE | `requireUserAuth` | Remove one |
| `/api/v1/extract/react` | POST | `requireUserAuth` | Start URL job → `{jobId, pollUrl}` |
| `/api/v1/extract/react/:jobId` | GET/DELETE | inline owner check | Poll (`?since=`) / cancel |
| `/api/v1/extract/text` | POST | `requireUserAuth` | Free-text job (min 50 chars) |
| `/api/v1/extract/photo` | POST | `requireUserAuth` | Photo upload (multipart) |
| `/api/v1/extract/jobs` | GET | `requireUserAuth` | Caller's recent jobs |
| `/api/v1/images/search` | GET | `requireUserAuth` | Image suggestions (auth added 2026-06-12) |
| `/api/v1/keys/validate` | POST | `requireUserAuth` | Validate a Groq key; DB-backed rate limit |
| `/api/v1/shopping` | GET/POST | `requireAuth` | Household shopping list |
| `/api/v1/shopping/:id` | PATCH/DELETE | `requireAuth` | Toggle / delete item |
| `/api/v1/shopping/checked`, `/shopping/all` | DELETE | `requireAuth` | Clear checked / clear all |
| `/api/v1/dictionary` | GET | **open** | All entries (global read-only) |
| `/api/v1/dictionary` | POST | `requireAuth` + admin | Add entry |
| `/api/v1/dictionary/match` | GET | **open** | Fuzzy match `?name=tomate` |
| `/api/v1/planner` | GET/POST | `requireAuth` | Household meal plan |
| `/api/v1/planner/:id`, `/planner/week/:weekStart` | DELETE | `requireAuth` | Remove entry / whole week |
| `/api/v1/cookidoo/status` | GET | `requireUserAuth` | `scope`, `connected`, `sharedByCurrentHousehold`, `canManageHouseholdShare` |
| `/api/v1/cookidoo/credentials` | POST/DELETE | `requireUserAuth` | Caller's private credentials |
| `/api/v1/cookidoo/credentials/share` | POST/DELETE | `requireUserAuth` | Share with active household, owner only |
| `/api/v1/pinterest/*`, `/api/v1/facebook/*` | GET/POST/DELETE | `requireUserAuth` | ⚠ return `501` — not implemented |
| `/api/v1/proxy/image` | GET | **open by design** | SSRF-guarded image proxy for PDF export |
| `/api/v1/push/subscribe` | POST/DELETE | `requireUserAuth` | Register / remove a push subscription |
| `/api/v1/bug-reports` | POST | `requireUserAuth` | Submit report incl. `lastFailureSnapshot` |
| `/api/v1/bug-reports/me` | GET | `requireUserAuth` | Caller's own reports |
| `/api/v1/admin/bug-reports` | GET | admin | All reports, else `403 admin_required` |
| `/api/v1/admin/bug-reports/:id` | GET/PATCH | admin | Detail / change status |
| `/api/v1/admin/byok-validation-policy` | GET/PUT | admin | Shared rate-limit policy |
| `/api/v1/health` | GET | **open by design** | Server + DB status incl. `recipeCount` |

The authoritative owner/boundary matrix is the "Route Auth Inventory" table in
`CLAUDE.md`.

## Auth

**Location:** `src/auth.ts` (284 lines) — the central trust boundary.

- `resolveUserAuthContext(header)` — extract bearer token, verify the Supabase
  JWT, build a `UserAuthContext` (user + memberships + active household)
- `requireUserAuth()` — middleware, scope is the user
- `requireAuth()` — additionally resolves the household scope
- `AuthFlowError` + `authErrorPayload` / `authErrorResponse` — uniform error
  shape: `401 auth_missing`, `401 auth_invalid`, `401 token_expired`
- `configureAuthForTests` / `resetAuthAdaptersForTests` — test injection

Error codes are a contract with the client: `mobile/utils/protected-access.ts`
maps them onto UI states. Changing a code means changing both sides.

## Pipeline

**Location:** `src/pipeline.ts` (447 lines)

Orchestrates the extraction. `switch (classified.type)` dispatches into the
fetchers; Chefkoch is wired in directly (no plugin registry any more). Accepts
per-job LLM options so BYOK jobs do not mutate the server env.

Extraction priority: schema.org JSON-LD → LLM text → Whisper audio → vision model.

## Classifier

**Location:** `src/classifier.ts` (29 lines)

`classifyURL(rawUrl)` → `{ url, type }`. **Regex order matters**:

```
youtube · instagram · tiktok · cookidoo · chefkoch · pinterest · facebook → else "web"
```

Chefkoch only matches `chefkoch.de/rezepte/…`; other Chefkoch pages go through
the generic web fetcher. An invalid URL throws `Ungültige URL: …`.

## Job Manager

**Location:** `src/job-manager.ts` (189 lines)

`JobManager` as a singleton (`jobManager`), jobs in a **`Map` inside the
process** — **no database**.

**Methods:** `createJob(url, userAgent?, apiKeyHash?, userId?, householdId?)`,
`startJob`, `updateJob`, `completeJob`, `failJob`, `getJob`, `isUrlProcessing`,
cleanup after `config.jobs.cleanupDays`.

`createJob` freezes `userId` and `householdId` because the async run has no
request context. `completeJob` fires the Web Push notification to the job owner.

**Job states:** `pending` → `running` → `completed` | `failed`

⚠️ A restart or redeploy loses running jobs, and horizontal scaling would break
polling. Moving job state into the DB is a prerequisite for any scale-out.

## Processors

| Module | Lines | Exports |
|--------|-------|---------|
| `processors/llm.ts` | 261 | `extractRecipeFromText`, `extractRecipeFromImage(s)`, `refineRecipe`, `estimateNutrition`, `extractVisibleTextFromImages` |
| `processors/schema-org.ts` | 207 | `schemaToRecipeData` — JSON-LD → `RecipeData`, no LLM |
| `processors/whisper.ts` | — | `transcribeAudio` — Groq Whisper, BYOK-capable |
| `processors/ingredient-parser.ts` | 141 | `parseIngredient(raw)` → `{amount, unit, food, note?}`, ephemeral (no DB field) |

`llm.ts` creates the OpenAI-SDK client **per call**, so a BYOK job cannot
overwrite the server key. Models come from `config.groq`.

## Domain and Operations Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| `db-react.ts` | 2758 | All data access — see [DATABASE.md](DATABASE.md) |
| `schema.ts` | 338 | Drizzle tables (17) |
| `types.ts` | 123 | `RecipeData`, `ContentBundle`, `SchemaOrgRecipe` + Zod schemas |
| `config.ts` | — | Env loader: `groq`, `supabase`, `cookidoo`, `tiktok`, `cobalt`, `web`, `port`, `jobs` |
| `byok-validator.ts` | 214 | `BYOKValidator` — check a Groq key against the API |
| `byok-policy.ts` | — | `enforceByokValidation` — DB-backed rate limit, logs a fallback if the table is missing |
| `ingredient-dictionary.ts` | — | `extractIngredientName`, `isSimilar`, `parseIngredientFull` |
| `ingredient-category-domain.ts` | 173 | Ingredient categories — **byte-identical duplicate** of `mobile/utils/ingredient-category-domain.ts` |
| `bug-reports.ts` | 209 | Enums, rate-limit constants (5 reports / 60 min), type guards |
| `push.ts` | — | `configureVapid`, `sendPushToUser` — best-effort fan-out, 410/404 auto-prune |
| `mail.ts` | 141 | `sendRecipeInviteEmail` — the **only** provider boundary (Brevo) |
| `gmail-monitor.ts` | — | Delivery monitor for the operator mailbox; fail-closed on 0 or >1 hits. **No HTTP endpoint** |
| `utils/image-search.ts` | — | `searchRecipeImages` |
| `middleware/facebook-rate-limit.ts` | — | 1 request/minute on the Facebook path |

## Configuration

**Location:** `src/config.ts`

```typescript
config = {
  groq:     { apiKey, baseUrl, textModel, visionModel, whisperModel },
  supabase: { url, anonKey },
  cookidoo: { email, password },
  tiktok:   { ocrEnabled, maxOcrFrames, proxyUrl },
  cobalt:   { apiUrl, apiKey },
  web:      { mlFallback },
  port,
  jobs:     { cleanupDays, maxConcurrent, pollInterval },
}
```

> There is no `config.sqlite` any more.

## Dependency Direction

```
routes/*      → db-react, job-manager, pipeline, auth, bug-reports, byok-*, push, mail
pipeline      → classifier, fetchers/*, processors/*, db-react
db-react      → schema, config, ingredient-dictionary
fetchers/*    → types, config, fetchers/web/base
processors/*  → config, types
```

Only `routes/*` knows HTTP, only `db-react.ts` knows SQL.
