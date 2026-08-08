# RecipeDeck Codemaps

**Last Updated:** 2026-08-07 (v1.0.196)

## Overview

RecipeDeck extracts recipes from URLs (YouTube, Instagram, TikTok, Cookidoo,
Chefkoch, generic web pages), free text and photo uploads, and stores them in
**Supabase PostgreSQL**. Recipes are processed and output in German. Groq
(Llama models) does extraction and translation, with fallback paths through
schema.org parsing, audio transcription and vision models.

The frontend is Expo React Native (`mobile/`) — one codebase for Web, Android
and iOS. Since June 2026 the app is multi-user: Supabase Auth with a
login-first gate, Row Level Security on every user table, and an explicit
owner model (`user` **or** `household`).

The repository, Docker image and Northflank service are still named `rezepti`.

## Architecture Map

```
┌───────────────────────────────────────────────────────────────┐
│  Clients — one codebase: mobile/                              │
│  Expo Web (browser / PWA)      Expo Native (iOS, Android)     │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS + Supabase user JWT
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  Hono server — src/index.ts                                   │
│  CORS · compress · static public/ · SPA fallback · API mount  │
└───────────────────────────┬───────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  API — src/api-react.ts mounts eleven routers in src/routes/  │
│  auth · recipes · recipe-collections · recipe-share-invites   │
│  extraction · keys · planner · platforms · push · admin       │
│  bug-reports          [auth middleware: src/auth.ts]          │
└───────────────┬───────────────────────────────┬───────────────┘
                │ extraction                    │ CRUD
                ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────┐
│  job-manager.ts (in-memory!)  │   │  db-react.ts              │
│  job ids, polling, cancel     │   │  postgres-js + Drizzle    │
│  → Web Push on completion     │   │  → Supabase PostgreSQL    │
└───────────────┬───────────────┘   └───────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────┐
│  pipeline.ts — orchestrator                                   │
│  classifier → fetchers/* → processors/* → db-react            │
└───────────────────────────────────────────────────────────────┘
```

## Codemaps

- [Architecture](ARCHITECTURE.md) — system boundaries, layering rules, control flow
- [Backend](BACKEND.md) — `src/` in detail: server, routers, pipeline, processors, auth
- [Database](DATABASE.md) — `src/schema.ts` + `src/db-react.ts`, owner model in code
- [Fetchers](FETCHERS.md) — source-specific downloaders and per-platform status
- [Frontend](FRONTEND.md) — `mobile/`: routes, hooks, offline layer, service worker

## Key Modules

| Module | Purpose | Location |
|--------|---------|----------|
| Server | HTTP server, static serving, SPA fallback | `src/index.ts` |
| API mount | Mounts the routers — no route logic of its own | `src/api-react.ts` |
| Routers | The actual REST endpoints | `src/routes/*.ts` |
| Auth | JWT verification, `requireUserAuth` / `requireAuth` | `src/auth.ts` |
| Pipeline | Orchestrates the extraction workflow | `src/pipeline.ts` |
| Classifier | URL → source type | `src/classifier.ts` |
| Database | All data access, PostgreSQL via Drizzle | `src/db-react.ts` |
| Job Manager | Extraction job tracking (in-memory, bounded concurrency, cancellation, cleanup timer) | `src/job-manager.ts` |
| Credential Crypto | AES-256-GCM at-rest encryption for stored credentials | `src/credential-crypto.ts` |

## Data Flow

1. **Request** — client posts a URL to `/api/v1/extract/react` with a user JWT
2. **Job creation** — `jobManager.createJob` returns a `jobId` and snapshots the
   caller's `userId` / `householdId` (the async run has no request context)
3. **Classification** — youtube / instagram / tiktok / cookidoo / chefkoch /
   pinterest / facebook, falling through to `web`
4. **Fetching** — the source-specific fetcher returns a `ContentBundle`
5. **Extraction** — schema.org JSON-LD → LLM text → Whisper audio → vision model
6. **Saving** — recipe written to Supabase, job marked complete
7. **Notification** — `completeJob` sends a Web Push to the job owner
8. **Polling** — client polls `/api/v1/extract/react/:jobId`

## Code Size (lines, excluding tests)

| Area | Largest modules |
|------|-----------------|
| Database | `db-react.ts` 2809 — by far the largest module |
| Fetchers | `cookidoo.ts` 576, `pinterest.ts` 434, `instagram.ts` 324 |
| Routes | `extraction.ts` 554, `recipe-collections.ts` 457, `planner.ts` 271 |
| Core | `pipeline.ts` 447, `schema.ts` 338, `auth.ts` 284 |

`src/` totals roughly 11,000 lines of TypeScript.

## External Dependencies

- **Groq API** — LLM extraction (Llama 3.3 70B, Llama 4 Scout, Whisper turbo)
- **Supabase** — PostgreSQL, Auth, Row Level Security
- **yt-dlp** — YouTube / Instagram / TikTok / Facebook downloading (required)
- **ffmpeg** — optional, only for TikTok frame OCR
- **Cheerio** — HTML parsing for the web fetcher
- **Brevo** — transactional email (recipe invites + Supabase auth SMTP)
- **cf-clearance-scraper** — Cloudflare bypass for Cookidoo, separate container on port 3001

## What is documented elsewhere

- **Route auth matrix** (owner, read/write boundary, risk): `CLAUDE.md`,
  section "Route Auth Inventory" — that is the authoritative source
- **Known pitfalls:** `docs/PROJECT_LEARNINGS.md`
- **Runbooks:** `docs/pwa-runbook.md`, `docs/auth-runbook-route-privacy.md`,
  `docs/gmail-production-monitor-runbook.md`
- **Operative task list:** `TODO.md`

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) — main project documentation
- [TODO.md](../../TODO.md) — current work list
- Obsidian vault → `Projekte/RecipeDeck/` — linked long-form version of these maps
