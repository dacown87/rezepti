# RecipeDeck Codemaps

**Last Updated:** 2026-04-02

## Overview

RecipeDeck is a TypeScript web service that extracts recipes from URLs (YouTube, Instagram, TikTok, web pages) and saves them to a local SQLite database. Recipes are processed and output in German. It uses Groq API (Llama models) for extraction/translation, with fallback paths through schema.org parsing, audio transcription, and vision models.

The frontend is built with React Native (Expo) — targeting Web, Android, and iOS from a single codebase.

## Architecture Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RecipeDeck Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐     ┌─────────────────────────────┐   │
│   │  Expo Web    │  │  Expo Native │────▶│      Hono Server            │   │
│   │  (Browser)   │  │  (Android/   │     │      (index.ts)             │   │
│   └──────────────┘  │   iOS)       │     └─────────────────────────────┘   │
│                     └──────────────┘                  │                    │
│                                               Pipeline Orchestrator        │
│                                                (pipeline.ts)               │
│                                                        │                   │
│                          ┌─────────────────────────────┘                   │
│                          ▼                                                  │
│   ┌────────────────────────────────────────────────────┐                   │
│   │                   Fetchers Layer                    │                   │
│   │  Web │ YouTube │ TikTok │ Instagram │ Cookidoo      │                   │
│   │  Chefkoch │ Pinterest │ Facebook │ Photo           │                   │
│   └────────────────────────────────────────────────────┘                   │
│                          │                                                  │
│                          ▼                                                  │
│   ┌────────────────────────────────────────────────────┐                   │
│   │                  Processors Layer                   │                   │
│   │  Schema-Org (fast) │ LLM (Groq) │ Whisper (Audio)  │                   │
│   └────────────────────────────────────────────────────┘                   │
│                          │                                                  │
│                          ▼                                                  │
│   ┌────────────────────────────────────────────────────┐                   │
│   │              Database Layer (SQLite)                │                   │
│   │  recipes │ shopping_list │ meal_plan                │                   │
│   │  ingredient_dictionary │ extraction_jobs           │                   │
│   └────────────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Modules

| Module | Purpose | Location |
|--------|---------|----------|
| Server | HTTP server, static file serving, SPA fallback | `src/index.ts` |
| API | All REST endpoints (recipes, extraction, shopping, planner) | `src/api-react.ts` |
| Pipeline | Orchestrates extraction workflow | `src/pipeline.ts` |
| Classifier | Determines URL source type | `src/classifier.ts` |
| Database | SQLite CRUD with Drizzle ORM | `src/db-react.ts` |
| Job Manager | Extraction job persistence | `src/job-manager.ts` |

## Data Flow

1. **Request:** Client sends URL → `/api/v1/extract/react`
2. **Job Creation:** Job manager creates polling job, returns `jobId`
3. **Classification:** URL classified (youtube/instagram/tiktok/cookidoo/chefkoch/pinterest/facebook/web)
4. **Fetching:** Source-specific fetcher downloads content
5. **Extraction:** Try schema.org → LLM text → Whisper audio → Vision model
6. **Saving:** Recipe saved to SQLite, job marked complete
7. **Polling:** Client polls `/api/v1/extract/react/:jobId` for status

## External Dependencies

- **Groq API** - LLM extraction (Llama 3.3 70B, Llama 4 Scout, Whisper)
- **yt-dlp** - YouTube/Instagram/TikTok video downloading
- **SQLite** - Local database (better-sqlite3 + Drizzle)
- **Cheerio** - HTML parsing for web fetcher

## Codemaps

- [Architecture](ARCHITECTURE.md) - High-level system overview
- [Backend](BACKEND.md) - API routes, pipeline, processors
- [Frontend](FRONTEND.md) - React Native / Expo components and pages
- [Database](DATABASE.md) - Schema and queries
- [Fetchers](FETCHERS.md) - Source-specific content downloaders

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Main project documentation
- [Master Plan](../../docs/superpowers/plans/2026-03-26-master-phasenplan.md) - Strategic roadmap
