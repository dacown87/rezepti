# Architecture Codemap

**Last Updated:** 2026-03-28

## System Overview

Rezepti is a full-stack recipe extraction and management application:

1. **Backend:** Hono/Node.js server with REST API
2. **Extraction Pipeline:** Multi-stage recipe extraction from URLs
3. **Database:** Local SQLite with Drizzle ORM
4. **Frontend:** React SPA with Vite

## Request Flow

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Browser   │────▶│   Hono      │────▶│   Pipeline       │
│   (React)   │     │   Server    │     │   Orchestrator   │
└─────────────┘     └─────────────┘     └──────────────────┘
       │                   │                      │
       │ GET/POST          │                      │
       │ /api/v1/*         │                      │
       │                   │                      │
       ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (api-react.ts)                 │
│  recipes | extraction | shopping | planner | cookidoo       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (db-react.ts)                         │
│         recipes | shopping | meal_plan | jobs               │
└─────────────────────────────────────────────────────────────┘
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
│     (web only, fastest)             │
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
│  3. Audio available?                 │────Yes──▶ Whisper ──▶ LLM
│     (YouTube, TikTok, Instagram)   │
└────────────────┬────────────────────┘
                 │ No
                 ▼
┌─────────────────────────────────────┐
│  4. Images available?              │────Yes──▶ Vision model
│                                      │
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
// Response: { jobId: "job_123_abc", status: "pending", pollUrl: "/api/v1/extract/react/job_123_abc" }

// 2. Poll for status
GET /api/v1/extract/react/job_123_abc?since=0
// Response: { status: "running", progress: 35, currentStage: "fetching", message: "..." }

// 3. On completion
GET /api/v1/extract/react/job_123_abc
// Response: { status: "completed", progress: 100, result: { success: true, recipeId: 42 } }
```

## Key Design Decisions

### Why Polling Instead of SSE?

- Simpler to implement (no WebSocket server)
- Works through load balancers/proxies
- Client controls poll interval
- Retry-friendly

### Why SQLite?

- Zero configuration
- Single file storage
- Good for local app use case
- WAL mode for concurrent reads

### Why Groq?

- Free tier available
- Fast inference
- Vision models competitive
- OpenAI-compatible API

### Why BYOK (Bring Your Own Key)?

- Users can use their own Groq API key
- Default: app's shared API key
- Per-job override possible

## External Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| `hono` | HTTP framework | ^4.x |
| `better-sqlite3` | SQLite driver | ^11.x |
| `drizzle-orm` | ORM | ^0.x |
| `openai` | Groq API client | ^4.x |
| `cheerio` | HTML parsing | ^1.x |
| `react` | UI framework | ^18.x |
| `react-router` | Routing | ^6.x |
| `dnd-kit` | Drag & drop | ^6.x |
| `tailwindcss` | Styling | ^3.x |

## CLI Dependencies

| Tool | Purpose |
|------|---------|
| `yt-dlp` | Video/audio download (YouTube, TikTok, Instagram) |

## File Structure

```
rezepti/
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
│   │   ├── web.ts
│   │   ├── youtube.ts
│   │   ├── instagram.ts
│   │   ├── tiktok.ts
│   │   ├── cookidoo.ts
│   │   ├── pinterest.ts
│   │   └── facebook.ts
│   └── processors/               # Content processors
│       ├── llm.ts               # Groq API
│       ├── schema-org.ts        # JSON-LD
│       └── whisper.ts           # Audio transcription
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── main.tsx             # Entry point
│   │   ├── App.tsx             # Routes
│   │   ├── components/          # React components
│   │   └── utils/              # Utilities
│   └── public/                 # Built output
│
├── public/                       # Served static files
├── data/                         # SQLite database
├── docs/CODEMAPS/               # This documentation
└── package.json
```

## Environment Variables

```bash
# Required
GROQ_API_KEY=...

# Optional
PORT=3000
SQLITE_PATH=data/rezepti.db
SQLITE_REACT_PATH=data/rezepti-react.db
COOKIDOO_EMAIL=...
COOKIDOO_PASSWORD=...
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
JOB_CLEANUP_DAYS=7
MAX_CONCURRENT_JOBS=5
```
