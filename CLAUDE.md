# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rezepti is a TypeScript web service that extracts recipes from URLs (YouTube, Instagram, TikTok, web pages) and saves them to a local SQLite database. Recipes are processed and output in German. It uses Groq API (Llama models) for extraction/translation, with fallback paths through schema.org parsing, audio transcription, and vision models.

## Commands

- `npm run dev` — Start dev server with hot reload (tsx watch)
- `npm start` — Start production server
- `npx tsc` — Type-check (noEmit, strict mode)

No test suite exists.

## Docker

- `docker compose up` — Production-Container starten (kompiliertes JS, schlankes Image)
- `docker compose up --build` — Neu bauen und starten (nach Code-Änderungen nötig)
- `docker compose --profile dev up` — Dev-Modus mit Hot-Reload (tsx watch, src/ als Volume)
- `docker compose down` — Container stoppen

**Stages:** `base` (Node 20 + yt-dlp + Build-Tools) → `builder` (tsc) → `production` (node dist/index.js) + `dev` (tsx watch)

**Volumes:**
- `./data:/app/data` — SQLite-Persistenz (beide Modi)
- `./src:/app/src` — Hot-Reload (nur Dev-Modus)

**Wichtig:** `./node_modules` nie als Volume mounten — `better-sqlite3` ist host-spezifisch kompiliert und inkompatibel mit Linux im Container.

## Architecture

**Request flow:** HTTP request → Pipeline → Classifier → Fetcher → Processor → SQLite save

The server (`src/index.ts`) exposes `GET /api/extract?url=...` which streams progress via SSE.

**Pipeline stages** (SSE events): classifying → fetching → transcribing → analyzing_image → extracting → exporting → done/error

**Key modules:**
- `src/pipeline.ts` — Orchestrator that routes through the extraction workflow
- `src/classifier.ts` — Determines URL source type (youtube/instagram/tiktok/web)
- `src/fetchers/` — Source-specific content downloaders (web.ts uses cheerio; others use yt-dlp)
- `src/processors/llm.ts` — Groq API via OpenAI SDK for recipe extraction and refinement
- `src/processors/schema-org.ts` — Fast path: parses schema.org/Recipe JSON-LD
- `src/processors/whisper.ts` — Audio transcription via whisper-cpp CLI (local)
- `src/db.ts` — SQLite connection (better-sqlite3 + Drizzle ORM), CRUD functions
- `src/schema.ts` — Drizzle table schema for `recipes`
- `src/types.ts` — Core types and Zod schemas (RecipeData, ContentBundle, SchemaOrgRecipe)

**Extraction paths** (tried in order):
1. schema.org/Recipe JSON-LD (web only, fastest)
2. LLM text extraction from subtitles or page text (Groq Llama 3.3 70B)
3. Audio transcription (whisper-cpp) → LLM extraction
4. Vision model on images (Groq Llama 4 Scout, fallback)

**API Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Main UI (index.html) |
| `/api/extract?url=<URL>` | GET | Extraction, streams SSE events |
| `/api/recipes` | GET | List all saved recipes |
| `/api/recipes/:id` | GET | Single recipe by ID |
| `/api/health` | GET | Server status |

**Frontend:** Single-page vanilla JS app (`public/index.html`) with Tailwind CSS CDN, no build step.

## External CLI Dependencies

These must be installed on the host: `yt-dlp`

Audio transcription uses the Groq Whisper API (`whisper-large-v3-turbo`) — no local `whisper-cpp` or `ffmpeg` required.

## Configuration

Copy `.env.example` to `.env`. Required: `GROQ_API_KEY` (get free at console.groq.com). SQLite DB is created automatically at `./data/rezepti.db`.

## Git / SSH

Remote is configured via SSH (`git@github.com:dacown87/rezepti.git`).
SSH key is at `~/.ssh/id_rezepti`, GitHub host is registered in `~/.ssh/known_hosts`.

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

## Working Notes (Claude)

- **Active branch:** `ph/Test` — all commits go here, never directly to `main`
- **Origin:** Project was AI-generated — code may be inconsistent, pay attention to quality when touching it
- **No test suite** — test manually via browser / health endpoint
- **Design variants:** `public/v1–v4.html` are inactive iterations; active UI is `public/index.html`

## Language

Communicate with the user in **German**.
All code comments, inline documentation, and commit messages in **English**.

## Conventions

- ES modules throughout (`.js` extensions in imports for ESM compatibility)
- German for user-facing content and recipe output; English for code
- Zod schema (`RecipeDataSchema` in `types.ts`) validates all recipe output at runtime
- Async/await for all async operations
- No barrel exports; direct module imports
- JSON arrays (tags, ingredients, steps) serialized as TEXT in SQLite
