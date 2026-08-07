# Architecture Codemap

**Last Updated:** 2026-08-07 (v1.0.196)

## System Overview

RecipeDeck is a full-stack recipe extraction and management application:

1. **Backend:** Hono/Node.js server with a REST API under `/api/v1/*`
2. **Extraction pipeline:** multi-stage recipe extraction from URLs, text and photos
3. **Database:** Supabase PostgreSQL with Drizzle ORM (postgres-js driver)
4. **Frontend:** Expo React Native (`mobile/`) — one codebase for web and native
5. **Auth:** Supabase Auth with Row Level Security and a `user` / `household` owner model

## Request Flow

```
┌───────────────────────────────────────────────────────────────┐
│  Clients — one codebase: mobile/                              │
│  Expo Web (browser / PWA)      Expo Native (iOS, Android)     │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS, Supabase user JWT in the header
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  Hono server — src/index.ts                                   │
│  · compress() + cors() on /api/*                              │
│  · static serving of public/ (the Expo web export)            │
│  · SPA fallback to index.html                                 │
│  · mounts the API router                                      │
└───────────────────────────┬───────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  API — src/api-react.ts mounts eleven routers in src/routes/  │
│  auth · recipes · recipe-collections · recipe-share-invites   │
│  extraction · keys · planner · platforms · push · admin       │
│  bug-reports        [auth middleware: src/auth.ts]            │
└───────────────┬───────────────────────────────┬───────────────┘
                │ extraction                    │ CRUD
                ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│  job-manager.ts (in-memory)   │   │  db-react.ts              │
│  job ids, polling, events     │   │  postgres-js + Drizzle    │
│  → Web Push on completion     │   │  → Supabase PostgreSQL    │
└───────────────┬───────────────┘   └───────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────┐
│  pipeline.ts — orchestrator                                   │
│  classifier.ts → fetchers/* → processors/* → db-react.ts      │
└───────────────────────────────────────────────────────────────┘
```

## Layering Rules

| Layer | May call | Must **not** |
|-------|----------|--------------|
| `routes/*` | `db-react`, `job-manager`, `pipeline`, `auth`, domain modules | `fetchers/*` or `processors/*` directly |
| `pipeline.ts` | `classifier`, `fetchers/*`, `processors/*`, `db-react` | know about the HTTP `Context` |
| `fetchers/*` | `types`, `config`, `fetchers/web/base` | touch the database |
| `processors/*` | `config`, `types` | touch the database |
| `db-react.ts` | `schema`, `config`, `ingredient-dictionary` | know about Hono / HTTP |

Rule of thumb: **only `routes/*` knows HTTP, only `db-react.ts` knows SQL.**

## Two Trust Boundaries

1. **The server API** — the primary boundary. `requireUserAuth` / `requireAuth`
   in `src/auth.ts` verify the Supabase JWT and resolve the workspace.
2. **Row Level Security** — the second boundary, inside Postgres. It must
   **never allow more** than the API does. Verified by
   `npm run supabase:rls-smoke` and the `supabase-rls-smoke` CI job.

Deliberate, documented exceptions: `/api/v1/health`, `GET /api/v1/dictionary`,
`GET /api/v1/dictionary/match`, `/api/v1/proxy/image` (SSRF-guarded, needed for
PDF export) and `GET /api/v1/share-invites/:token` (the token *is* the credential).

## Extraction Control Flow

```
POST /extract/react | /extract/text | /extract/photo
  └─ routes/extraction.ts
       ├─ requireUserAuth → snapshot userId + active householdId
       ├─ jobManager.createJob(...)          → jobId returned immediately
       └─ async: pipeline.processURL(...)
            ├─ classifier.classifyURL(url)   → SourceType
            ├─ switch(type) → fetchers/*     → ContentBundle
            ├─ processors/schema-org         → fastest path, no LLM call
            ├─ processors/whisper            → audio → text (Groq)
            ├─ processors/llm                → text/image → RecipeData (Zod)
            └─ db-react.saveRecipeToReactDb  → Postgres
       └─ jobManager.completeJob → push.sendPushToUser(owner)
```

The job carries the auth scope as a **snapshot**: the later async run has no
request context, so `userId` and `householdId` are frozen at creation time.

## Pipeline Stages

| Stage | Description | Progress |
|-------|-------------|----------|
| `classifying` | URL type detection | 20% |
| `fetching` | Content download | 35% |
| `transcribing` | Audio → text (Whisper) | 50% |
| `analyzing_image` | Vision model analysis | 60% |
| `extracting` | LLM recipe extraction | 75% |
| `exporting` | Image search + save to database | 90% |
| `done` / `error` | Complete | 100% |

Job states: `pending` → `running` → `completed` | `failed`.

## Extraction Priority

```
Content fetched
    │
    ▼
1. Schema.org JSON-LD present?        ──Yes──▶ fast path (no LLM) ──▶ save
    │ No
    ▼
2. Text available (subtitles, page)?  ──Yes──▶ LLM text extraction
    │ No
    ▼
3. Audio available?                   ──Yes──▶ Groq Whisper ──▶ LLM
    │ No
    ▼
4. Images available?                  ──Yes──▶ vision model
    │ No
    ▼
   Error: no content
```

## Jobs Live Only in Process Memory

`JobManager` (`src/job-manager.ts`) keeps every job in a `Map` inside the
process — **no DB persistence**. Consequences:

- A restart or redeploy loses running jobs; the client polls into the void.
- Horizontal scaling is off the table: with more than one instance, polling
  can land on a process that does not know the job. Moving job state into the
  database is a prerequisite for any scale-out.
- Cleanup runs from `config.jobs.cleanupDays` (default 7 days), process-local.

## Job Polling Pattern

```typescript
// 1. Create job
POST /api/v1/extract/react
// Authorization: Bearer <Supabase access token>
{ url: "https://..." }
// → { jobId: "job_123_abc", status: "pending", pollUrl: "/api/v1/extract/react/job_123_abc" }

// 2. Poll
GET /api/v1/extract/react/job_123_abc?since=0
// Authorization: Bearer <same user's token — inline ownership check, no middleware>
// → { status: "running", progress: 35, currentStage: "fetching", message: "..." }

// 3. Completion
// → { status: "completed", progress: 100, result: { success: true, recipeId: 42 } }
```

## Enforced Duplication Between `src/` and `mobile/`

`mobile/` is its own npm package with its own bundler, and the Docker
`web-builder` stage copies **only** `mobile/`. Sharing code would require Metro
`watchFolders`, path aliases in both tsconfigs and an extra COPY line. Two
duplicates are therefore **guarded by tests instead of shared**:

| Duplicate | Guard |
|-----------|-------|
| `ingredient-category-domain.ts` (byte-identical) | `test/unit/ingredient-category-domain-drift.test.ts` |
| Bug report enums | `test/unit/bug-report-enums-contract.test.ts` |

Always change **both** files — otherwise the guards fail.

## Key Design Decisions

Full ADRs with rationale and consequences live in the Obsidian vault under
`Projekte/RecipeDeck/Entscheidungen.md`. Short version:

### Why polling instead of SSE?
Simpler (no WebSocket server), survives load balancers and proxies, the client
controls the interval, and it is retry-friendly.

### Why Supabase PostgreSQL (not SQLite)?
`better-sqlite3` is compiled host-specifically and did not behave in the
container, and a local file cannot support multi-user with RLS. The switch
happened on 2026-04-16; `src/db.ts` and `src/db-manager.ts` were deleted.

### Why "sharing = copying"?
Shared mutation of one row would have complicated RLS, CHECK constraints and
the visibility logic. Copies keep `recipeVisibilityForAuth` the single
visibility rule. Trade-off: edits to the original do not propagate.

### Why Groq?
Free tier, fast inference, competitive vision models, OpenAI-compatible API —
which also makes a local Ollama fallback a one-variable change (`GROQ_BASE_URL`).

### Why BYOK?
Users can supply their own Groq key per request (`x-groq-key` header or `apiKey`
in the body). Nothing is stored server-side — the `api_keys` table was dropped
in migration `20260609143000`. `processors/llm.ts` creates the client per call
so a BYOK job cannot mutate the server env.

## External Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| `hono` | HTTP framework | ^4.12 |
| `@hono/node-server` | Node adapter | ^2.0 |
| `postgres` | postgres-js driver | ^3.4 |
| `drizzle-orm` | ORM | ^0.45 |
| `@supabase/supabase-js` | Auth / JWT verification | ^2.108 |
| `openai` | Groq API client | ^6.42 |
| `cheerio` | HTML parsing | ^1.0 |
| `zod` | Runtime validation of recipe output | ^4.4 |
| `web-push` | VAPID Web Push | ^3.6 |
| `googleapis` | Gmail delivery monitor | ^173 |
| `dotenv` | Env loading | ^17.4 |

Frontend dependencies live in `mobile/package.json` — see [FRONTEND.md](FRONTEND.md).

## CLI Dependencies

| Tool | Purpose | Required? |
|------|---------|-----------|
| `yt-dlp` | Video/audio download (YouTube, TikTok, Instagram, Facebook) | yes |
| `ffmpeg` | Frame extraction for TikTok OCR | optional |

Audio transcription runs against the Groq Whisper API — no local `whisper-cpp`.

## File Structure

```
rezepti/
├── src/                          # Backend source
│   ├── index.ts                  # Server entry, static serving, SPA fallback
│   ├── api-react.ts              # Mount point for the routers
│   ├── routes/                   # The actual REST endpoints (11 routers)
│   │   ├── auth.ts               recipes.ts        recipe-collections.ts
│   │   ├── recipe-share-invites.ts                 extraction.ts
│   │   ├── keys.ts               planner.ts        platforms.ts
│   │   └── push.ts               admin.ts          bug-reports.ts
│   ├── auth.ts                   # JWT verification + middleware
│   ├── pipeline.ts               # Extraction orchestrator
│   ├── classifier.ts             # URL → SourceType
│   ├── db-react.ts               # All data access
│   ├── job-manager.ts            # Job tracking (in-memory)
│   ├── config.ts                 # Env config
│   ├── schema.ts                 # Drizzle schema, 17 tables
│   ├── types.ts                  # Core types + Zod schemas
│   ├── mail.ts                   # Brevo provider boundary
│   ├── push.ts                   # VAPID Web Push
│   ├── gmail-monitor.ts          # Delivery monitor (no HTTP endpoint)
│   ├── bug-reports.ts            # Enums, rate-limit constants, guards
│   ├── byok-validator.ts         # Groq key validation
│   ├── byok-policy.ts            # Rate-limit policy enforcement
│   ├── ingredient-dictionary.ts  # Fuzzy ingredient matching
│   ├── ingredient-category-domain.ts   # DUPLICATED in mobile/ — see guards
│   ├── middleware/               # facebook-rate-limit.ts
│   ├── utils/                    # image-search.ts
│   ├── fetchers/                 # Source-specific fetchers
│   │   ├── web/base.ts           # Shared extraction helpers (check here first!)
│   │   ├── web/index.ts          # fetchWeb dispatcher
│   │   ├── web.ts                # Thin re-export
│   │   ├── youtube.ts  instagram.ts  tiktok.ts  cobalt.ts
│   │   └── cookidoo.ts chefkoch.ts   pinterest.ts facebook.ts
│   └── processors/
│       ├── llm.ts                # Groq API
│       ├── schema-org.ts         # JSON-LD → RecipeData
│       ├── whisper.ts            # Audio transcription
│       └── ingredient-parser.ts  # parseIngredient (ephemeral, no DB field)
│
├── mobile/                       # THE frontend — Expo, web + native
│   ├── app/                      # Expo Router routes
│   ├── components/  hooks/  utils/  offline/  sw/  db/  test/
│   └── package.json              # own package, own bundler
│
├── public/                       # BUILD ARTEFACT — not checked in (except changelog.json)
├── supabase/migrations/          # The authoritative schema
├── scripts/                      # pwa/, performance/, supabase/, security/, hooks/
├── test/                         # unit/ + e2e/
├── data/                         # Runtime artefacts (cookies, exports)
├── docs/CODEMAPS/                # This documentation
└── package.json
```

> `frontend/` is an empty, untracked leftover of the old Vite SPA. It is neither
> built nor tested.

## Environment Variables

Required for a working server: `GROQ_API_KEY` and `DATABASE_URL` (Supabase,
**pooler format** — the direct host gives ENOTFOUND from Northflank).
The client additionally needs `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **at build time** (they are Docker build
args, not runtime env).

The full list — LLM models, jobs, VAPID, Brevo, Gmail monitor, TikTok/Cobalt,
staging smokes, performance pipeline — lives in `.env.example` and in the
Obsidian note `Projekte/RecipeDeck/Umgebungsvariablen.md`.

> `SQLITE_PATH`, `SQLITE_REACT_PATH` and `REACT_APP_API_URL` no longer exist.
