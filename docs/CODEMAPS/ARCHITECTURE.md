# Architecture Codemap

**Last Updated:** 2026-04-02

## System Overview

RecipeDeck is a full-stack recipe extraction and management application:

1. **Backend:** Hono/Node.js server with REST API
2. **Extraction Pipeline:** Multi-stage recipe extraction from URLs
3. **Database:** Local SQLite with Drizzle ORM
4. **Frontend:** React Native (Expo) — Web + Android/iOS from single codebase

## Request Flow

```
┌─────────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Expo Web /    │────▶│   Hono      │────▶│   Pipeline       │
│   Native App    │     │   Server    │     │   Orchestrator   │
└─────────────────┘     └─────────────┘     └──────────────────┘
       │                       │                      │
       │ GET/POST              │                      │
       │ /api/v1/*             │                      │
       │                       ▼                      ▼
       │         ┌─────────────────────────────────────────────┐
       │         │           API Layer (api-react.ts)          │
       │         │  recipes │ extraction │ shopping │ planner  │
       │         │  cookidoo │ keys │ proxy │ health           │
       │         └─────────────────────────────────────────────┘
       │                            │
       │                            ▼
       │         ┌─────────────────────────────────────────────┐
       └────────▶│          Database (db-react.ts)             │
                 │   recipes │ shopping │ meal_plan │ jobs      │
                 └─────────────────────────────────────────────┘
```

## Pipeline Stages

| Stage | Description | Progress |
|-------|-------------|----------|
| `classifying` | URL type detection | 20% |
| `fetching` | Content download | 35% |
| `transcribing` | Audio → text (Whisper) | 50% |
| `analyzing_image` | Vision model analysis | 60% |
| `extracting` | LLM recipe extraction | 75% |
| `exporting` | Save to database | 90% |
| `done` | Complete | 100% |

## Extraction Priority

```
URL Input
    │
    ▼
┌─────────────────┐
│  Fetch Content  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  1. Schema.org JSON-LD?             │────Yes──▶ Fast path ──▶ Save
│     (web/chefkoch/cookidoo, fastest)│
└────────────────┬────────────────────┘
                 │ No
                 ▼
┌─────────────────────────────────────┐
│  2. Text content available?         │────Yes──▶ LLM text extraction
│     (subtitles, page text)          │
└────────────────┬────────────────────┘
                 │ No
                 ▼
┌─────────────────────────────────────┐
│  3. Audio available?                │────Yes──▶ Whisper ──▶ LLM
│     (YouTube, TikTok, Instagram)    │
└────────────────┬────────────────────┘
                 │ No
                 ▼
┌─────────────────────────────────────┐
│  4. Images available?               │────Yes──▶ Vision model (Llama 4 Scout)
└────────────────┬────────────────────┘
                 │ No
                 ▼
         Error: No content
```

## Job Polling Pattern

Frontend creates extraction job and polls for status:

```typescript
// 1. Create job
POST /api/v1/extract/react
{ url: "https://..." }
// Response: { jobId: "job_123_abc", status: "pending" }

// 2. Poll for status
GET /api/v1/extract/react/job_123_abc
// Response: { status: "running", progress: 35, currentStage: "fetching" }

// 3. On completion
GET /api/v1/extract/react/job_123_abc
// Response: { status: "completed", progress: 100, result: { recipeId: 42 } }
```

## Key Design Decisions

### Why Polling Instead of SSE?
- Works through load balancers/proxies
- Client controls poll interval, retry-friendly
- Simpler state management in React Native

### Why SQLite?
- Zero configuration, single file storage
- WAL mode for concurrent reads
- Works on-device for future offline use

### Why Groq?
- Free tier available, fast inference
- Vision models competitive (Llama 4 Scout)
- OpenAI-compatible API

### Why BYOK (Bring Your Own Key)?
- Users can override with their own Groq key
- Per-job override possible via API

## External Dependencies

| Dependency | Purpose |
|------------|---------|
| `hono` | HTTP framework |
| `better-sqlite3` | SQLite driver |
| `drizzle-orm` | ORM |
| `openai` | Groq API client (compatible) |
| `cheerio` | HTML parsing |
| `expo` | React Native framework |
| `dnd-kit` | Drag & drop (web) |
| `tailwindcss` | Styling (web) |

## CLI Dependencies

| Tool | Purpose |
|------|---------|
| `yt-dlp` | Video/audio download (YouTube, TikTok, Instagram, Facebook) |

## File Structure

```
recipedeck/
├── src/                          # Backend source
│   ├── index.ts                  # Server entry
│   ├── api-react.ts              # API routes
│   ├── pipeline.ts               # Extraction orchestrator
│   ├── classifier.ts             # URL classifier
│   ├── db-react.ts               # Database operations
│   ├── job-manager.ts            # Job persistence
│   ├── config.ts                 # Configuration
│   ├── schema.ts                 # Drizzle schema
│   ├── types.ts                  # TypeScript types
│   ├── fetchers/                 # Source-specific fetchers
│   │   ├── web.ts, youtube.ts, instagram.ts
│   │   ├── tiktok.ts, chefkoch.ts, cookidoo.ts
│   │   ├── pinterest.ts, facebook.ts, photo.ts
│   └── processors/
│       ├── llm.ts, schema-org.ts, whisper.ts
│
├── frontend/                     # React Native (Expo)
│   ├── src/
│   │   ├── components/           # Screens & UI components
│   │   └── utils/               # Scaling, PDF, QR utilities
│   └── app.json / eas.json      # Expo + EAS config
│
├── public/                       # Expo Web build output (served by backend)
├── data/                         # SQLite database
└── docs/CODEMAPS/               # This documentation
```

## Environment Variables

```bash
# Required
GROQ_API_KEY=...

# Optional
PORT=3000
REACT_SQLITE_PATH=data/rezepti-react.db
COOKIDOO_EMAIL=...
COOKIDOO_PASSWORD=...
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
JOB_CLEANUP_DAYS=7
MAX_CONCURRENT_JOBS=5
```
