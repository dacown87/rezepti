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
- `./data:/app/data` — SQLite-Persistenz
- `./src:/app/src` — Hot-Reload für Server-Code (nur Dev-Modus)
- `./public:/app/public` — Hot-Reload für Frontend (nur Dev-Modus)

**Wichtig:** `./node_modules` nie als Volume mounten — `better-sqlite3` ist host-spezifisch kompiliert und inkompatibel mit Linux im Container.

**GitHub Secrets (einmalig im Repo setzen):**
- `DOCKERHUB_USERNAME` = `dacown`
- `DOCKERHUB_TOKEN` = Access Token von hub.docker.com → Account Settings → Personal access tokens

## Architecture

**Request flow:** HTTP request → Pipeline → Classifier → Fetcher → Processor → SQLite save

The server (`src/index.ts`) serves the React app and mounts the React API router.

**Pipeline stages**: classifying → fetching → transcribing → analyzing_image → extracting → exporting → done/error

**Key modules:**
- `src/pipeline.ts` — Orchestrator that routes through the extraction workflow; always saves to React DB
- `src/classifier.ts` — Determines URL source type (youtube/instagram/tiktok/web)
- `src/fetchers/` — Source-specific content downloaders (web.ts uses cheerio; others use yt-dlp)
- `src/processors/llm.ts` — Groq API via OpenAI SDK for recipe extraction and refinement
- `src/processors/schema-org.ts` — Fast path: parses schema.org/Recipe JSON-LD
- `src/processors/whisper.ts` — Audio transcription via Groq Whisper API
- `src/db-react.ts` — SQLite connection (better-sqlite3 + Drizzle ORM), CRUD functions for React DB
- `src/api-react.ts` — All `/api/v1/*` endpoints (recipes, extraction jobs, BYOK, health)
- `src/job-manager.ts` — Job persistence for polling-based extraction
- `src/schema.ts` — Drizzle table schema for `recipes`
- `src/types.ts` — Core types and Zod schemas (RecipeData, ContentBundle, SchemaOrgRecipe)

**Database:** Single SQLite DB at `./data/rezepti-react.db`. Legacy `rezepti.db` and `db.ts`/`db-manager.ts` have been removed.

**Extraction paths** (tried in order):
1. schema.org/Recipe JSON-LD (web only, fastest)
2. LLM text extraction from subtitles or page text (Groq Llama 3.3 70B)
3. Audio transcription (Groq Whisper) → LLM extraction
4. Vision model on images (Groq Llama 4 Scout, fallback)

**API Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Main UI (React app) |
| `/api/v1/recipes` | GET/POST | List / create recipes |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | Single recipe CRUD |
| `/api/v1/extract/react` | POST | Start extraction job (polling) |
| `/api/v1/extract/react/:jobId` | GET/DELETE | Poll / cancel job |
| `/api/v1/extract/jobs` | GET | List recent jobs |
| `/api/v1/keys/validate` | POST | Validate BYOK API key |
| `/api/v1/keys` | POST | Store API key |
| `/api/v1/keys/:keyHash` | DELETE | Remove API key |
| `/api/v1/health` | GET | Server + DB status |

**Frontend:** React SPA (Vite + TypeScript + Tailwind CSS), built to `public/`. Key components:
- `ExtractionPage` — URL input, job polling, progress display
- `RecipeList` — List/grid view toggle (default: list), persisted in localStorage
- `RecipeDetail` — Single recipe view with inline edit mode, serving size scaler, source link
- `SettingsPage` — BYOK key management, App Status with Roadmap modal
- `frontend/src/utils/scaling.ts` — `parseServingsNumber`, `scaleIngredient` for portion scaling

## External CLI Dependencies

These must be installed on the host: `yt-dlp`

Audio transcription uses the Groq Whisper API (`whisper-large-v3-turbo`) — no local `whisper-cpp` or `ffmpeg` required.

## Configuration

Copy `.env.example` to `.env`. Required: `GROQ_API_KEY` (get free at console.groq.com). SQLite DB is created automatically at `./data/rezepti-react.db`.

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

- **Active branch:** `feature/react-migration` — all commits go here, never directly to `main`
- **Origin:** Project was AI-generated — code may be inconsistent, pay attention to quality when touching it
- **Test Suite**: Unit tests run with `npm test`. E2E tests (`test/e2e/`) require a running server.
- **After frontend changes:** Always run `npm run build:react` to update `public/`

## Cleanup (March 2026) ✅

Legacy code removed in this session:
- ❌ `src/db.ts` — deleted (replaced by `src/db-react.ts`)
- ❌ `src/db-manager.ts` — deleted (dual-DB abstraction no longer needed)
- ❌ `src/react-job-manager.ts` — deleted (superseded by `job-manager.ts`)
- ❌ SSE endpoint `/api/extract` — removed
- ❌ Legacy `/api/recipes` and `/api/health` routes — removed
- ❌ Design variants `public/v1–v4.html`, `public/legacy-index.html` — removed
- ❌ `test/unit/db-manager.test.ts` — removed

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
- Recipe list & detail view: 50% — list/grid toggle implemented
- Ingredients & steps displayed separately (à la Dr. Oetker): 90% ✅ — 2-column layout on desktop, single-column on mobile
- Adjustable serving size + scaling: 80% ✅ — ×0.5–×4 stepper with ingredient quantity scaling
- Fix one ingredient as quantity → scale the rest: 0%
- Fullscreen cook mode: 0%
- Original recipe link: 100% ✅ — prominent button in action area + source box at bottom
- Recipe as separate page (not modal): 100% ✅ — implemented via /recipe/:id route
- Recipe inline editing: 100% ✅ — name, emoji, tags, duration, calories, ingredients, steps editable in-place; saves via PATCH /api/v1/recipes/:id

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
- Android app (Flutter): 0%

## Testing

**Unit tests (no server needed):**
- `npm test -- --run --exclude="test/e2e/**"` — run only unit tests (130+)
- `npm test` — all tests (E2E tests will fail without a running server)

**Test Coverage:**
| Area | Tests | Files |
|------|-------|-------|
| API Layer (client, services, types) | 91 | `test/api/` |
| UI Components (Toast, SkeletonLoader) | 70 | `frontend/src/components/` |
| Main Components (Extraction, RecipeList, RecipeDetail) | 41 | `frontend/src/components/` |
| Scaling utilities | 10 | `frontend/src/utils/` |
| Backend Services (job-manager, byok-validator, db) | ~43 | `src/*.test.ts` |

**E2E Tests (require running server):**
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
