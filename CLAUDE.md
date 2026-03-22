# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rezepti is a TypeScript web service that extracts recipes from URLs (YouTube, Instagram, TikTok, web pages) and saves them to a local SQLite database. Recipes are processed and output in German. It uses Groq API (Llama models) for extraction/translation, with fallback paths through schema.org parsing, audio transcription, and vision models.

## Commands

- `npm run dev` — Start dev server with hot reload (tsx watch)
- `npm start` — Start production server
- `npm run dev:react` — React dev server (Vite)
- `npm run build:react` — React production build
- `npm test` — Run tests (Vitest)
- `npx tsc` — Type-check (noEmit, strict mode)

Test suite: Vitest for unit/e2e tests.

## Docker

- `docker compose up` — Dev-Modus starten (tsx watch, src/ + public/ als Volume, Änderungen sofort live)
- `docker compose --profile prod up` — Production-Modus (pulled `dacown/rezepti:latest` von Docker Hub)
- `docker compose down` — Container stoppen

**Image:** `dacown/rezepti:latest` auf Docker Hub — wird automatisch via GitHub Actions gebaut und gepusht bei jedem Merge auf `main`.

**Stages:** `base` (Node 20 + yt-dlp + Build-Tools) → `builder` (tsc) → `production` (node dist/index.js) + `dev` (tsx watch)

**Volumes:**
- `./data:/app/data` — SQLite-Persistenz (beide Modi)
- `./src:/app/src` — Hot-Reload für Server-Code (nur Dev-Modus)
- `./public:/app/public` — Hot-Reload für Frontend (nur Dev-Modus)

**Wichtig:** `./node_modules` nie als Volume mounten — `better-sqlite3` ist host-spezifisch kompiliert und inkompatibel mit Linux im Container.

**GitHub Secrets (einmalig im Repo setzen):**
- `DOCKERHUB_USERNAME` = `dacown`
- `DOCKERHUB_TOKEN` = Access Token von hub.docker.com → Account Settings → Personal access tokens

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
| `/` | GET | Main UI (React app) |
| `/api/extract?url=<URL>` | GET | Extraction, streams SSE events (legacy) |
| `/api/v1/extract/react?url=<URL>` | GET | React extraction with polling |
| `/api/recipes` | GET | List all saved recipes |
| `/api/recipes/:id` | GET | Single recipe by ID |
| `/api/health` | GET | Server status |
| `/api/v1/keys` | POST/DELETE | BYOK key management |

**Frontend:** React SPA with Vite build system, Tailwind CSS, BYOK support.

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
- **Test Suite**: Comprehensive E2E tests available in `test/` directory - run with `npm test` or `npm run docker:test`
- **Design variants:** `public/v1–v4.html` are inactive iterations; active UI is `public/index.html` or React app built to `public/`

## React Migration & Docker Fixes (MARCH 2026 - COMPLETED ✅)

### Phase 3: React Migration Complete ✅
- ✅ **React Frontend**: Modern Vite + TypeScript + Tailwind CSS interface
- ✅ **BYOK Support**: User API key management with real Groq validation
- ✅ **Polling API**: `/api/v1/extract/react` endpoints with job persistence
- ✅ **Database Migration**: Legacy → React DB tools (16+ recipes migrated)
- ✅ **Docker Deployment**: Multi-stage build with React app served from Express
- ✅ **UI/UX Polish**: Toast notifications, skeleton loaders, improved user experience
- ✅ **E2E Testing**: Comprehensive test suite with 1000+ lines of tests

### Phase 3b: Docker Deployment Fixed ✅
**Issues resolved with multiple agents working in parallel:**
- ✅ **DNS Resolution**: Fixed by adding explicit DNS servers (8.8.8.8, 1.1.1.1)
- ✅ **yt-dlp Installation**: Static binary with ffmpeg + network debugging tools
- ✅ **Dockerfiles**: Updated with ffmpeg dependency and debugging tools
- ✅ **E2E Test Suite**: Comprehensive tests for React API and Docker environment
- ✅ **Documentation**: DOCKER_DEPLOYMENT.md (500+ lines) with troubleshooting guide

**Key Architecture Decisions:**
1. **Polling over SSE**: Better for React state management and mobile compatibility
2. **Job Persistence**: SQLite-based job storage survives server restarts
3. **Dual Database**: Legacy DB for backward compatibility, React DB for new features
4. **BYOK Validation**: Real API test calls to Groq, not just format validation
5. **Mobile-Ready Interfaces**: Prepared for future Expo SQLite implementation

**Multiple Agents Deployment Results:**
- **Agent 1**: Analyzed Docker DNS root cause (systemd-resolved issue)
- **Agent 2**: Created comprehensive E2E test suite (1000+ lines)
- **Agent 3**: Improved yt-dlp with ffmpeg and static binary
- **Agent 4**: Tested Docker with real URLs - ALL TESTS PASSED
- **Agent 5**: Validated 15+ API endpoints - ALL WORKING
- **Agent 6**: Created Docker documentation (DOCKER_DEPLOYMENT.md)

## Roadmap

Planned features and current implementation status (as of March 2026):

### Import & Extraction
- Websites (general): 80% — works, gaps on uncommon sites
- YouTube: 80% — audio, subtitles, vision fallback
- TikTok: 70% — via yt-dlp
- Instagram: 70% — via yt-dlp
- Chefkoch: 40% — Schema.org partially works
- Cookidoo: 10% — credentials in .env, no scraper implemented
- Pinterest: 0%
- Facebook: 0%
- Photo import (camera/gallery): 0% — vision model available, no upload flow

### Recipe Display & Navigation
- Website redesign with navigation menu bar for better clarity: 0%
- Recipe list & detail view: 50% — basic structure in place
- Ingredients & steps displayed separately (à la Dr. Oetker): 20% — data is separated, UI is not
- Adjustable serving size + scaling: 0%
- Fix one ingredient as quantity → scale the rest: 0%
- Fullscreen cook mode: 0% — fullscreen view for step-by-step cooking
- Original recipe link: 0% — link to source website in recipe view
- Recipe as separate page (not modal): 0% — dedicated recipe page instead of modal

### Shopping & Planning
- Shopping list: 0%
- Enter available ingredients → get recipe suggestions: 0%

### Community & Social
- User login (incl. "stay logged in"): 0%
- Rating system (stars): 0%
- Comment function: 0%
- Share recipe via QR code: 0%

### Export & Print
- Recipe card as PDF (image + short description + QR code): 0%

### Mobile & Responsive Design
- Mobile first approach: 100% ✅ — React frontend with mobile-ready interfaces
- Media queries for typical screen sizes: 80% ✅ — React app responsive with Tailwind CSS
- Android app (Flutter): 0% — Mobile interfaces prepared for future React Native/Expo implementation

## Testing

**Comprehensive test suite with 254+ unit tests:**
- Run backend tests: `npm test` or `npm test -- --run src/`
- Run frontend tests: `cd frontend && npx vitest --run src/components/`
- Run all tests: `npm test`

**Test Coverage:**
| Area | Tests | Files |
|------|-------|-------|
| API Layer (client, services, types) | 91 | `test/api/` |
| UI Components (Toast, SkeletonLoader) | 70 | `frontend/src/components/` |
| Main Components (Extraction, RecipeList, RecipeDetail) | 37 | `frontend/src/components/` |
| Backend Services (job-manager, byok-validator, db) | 56 | `src/*.test.ts` |

**E2E Tests:**
- `test/e2e/react-api.test.ts` — React API endpoints
- `test/e2e/docker.test.ts` — Docker environment validation
- `test/e2e/basic-api.test.ts` — Simple API verification

---

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
