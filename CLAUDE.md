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

**Stages:** `base` (Node 20 + yt-dlp + Build-Tools) → `builder` (tsc) → `frontend-builder` (Vite build) → `production` (node dist/index.js) + `dev` (tsx watch)

**Volumes:**
- `./data:/app/data` — SQLite-Persistenz
- `./src:/app/src` — Hot-Reload für Server-Code (nur Dev-Modus)
- `./public:/app/public` — Hot-Reload für Frontend (nur Dev-Modus)

**Wichtig:** `./node_modules` nie als Volume mounten — `better-sqlite3` ist host-spezifisch kompiliert und inkompatibel mit Linux im Container.

**GitHub Secrets (einmalig im Repo setzen):**
- `DOCKERHUB_USERNAME` = `dacown`
- `DOCKERHUB_TOKEN` = Access Token von hub.docker.com → Account Settings → Personal access tokens

## Production

**URL:** https://p01--rezepti-app--2s7hvlwm5zc5.code.run

**Deployment:** GitHub Actions → Docker Hub (`dacown/rezepti:latest`) → Northflank (automatic redeploy)

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
| `/api/v1/cookidoo/status` | GET | Cookidoo connection status |
| `/api/v1/cookidoo/credentials` | POST/DELETE | Store/remove Cookidoo credentials |

**Frontend:** React SPA (Vite + TypeScript + Tailwind CSS), built to `public/`. Key components:
- `ExtractionPage` — URL input, job polling, progress display
- `RecipeList` — List/grid view toggle (default: list), persisted in localStorage
- `RecipeDetail` — Single recipe view with inline edit mode, serving size scaler, source link
- `PlannerPage` — 7-day meal planner with Drag & Drop (dnd-kit) for recipe assignment
- `ScannerPage` — QR code scanner/generator (BarcodeDetector API)
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

## Working Notes (Claude)

- **Origin:** Project was AI-generated — code may be inconsistent, pay attention to quality when touching it
- **Test Suite**: Unit tests run with `npm test`. E2E tests (`test/e2e/`) require a running server.
- **After frontend changes:** Always run `npm run build:react` to update `public/`

## Planning Documents

- **Master Plan:** `docs/superpowers/plans/2026-03-26-master-phasenplan.md` — Strategischer Phasenplan (Phase 1–8), CEO-Review, Scope-Entscheidungen
- **Codemaps:** `docs/CODEMAPS/` — Architecture, Backend, Fetchers, Database, Frontend
- **TODO:** `TODO.md` — Aktuelle Aufgaben und offene Bugs

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

## Roadmap

Planned features and current implementation status (as of March 2026):

### Import & Extraction
- Websites (general): 80% — works, gaps on uncommon sites
- YouTube: 80% — audio, subtitles, vision fallback
- TikTok: 70% — via yt-dlp
- Instagram: 70% — via yt-dlp
- Chefkoch: 40% — Schema.org partially works
- Cookidoo: 100% — OAuth2 ROPC flow implemented in `src/fetchers/cookidoo.ts`
- Pinterest: 0%
- Facebook: 0%
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
- User login (incl. "stay logged in"): 0%
- Rating system (stars): 100% ✅ — Phase 3a delivered
- Personal notes: 100% ✅ — Phase 3a delivered
- Comment function: 0%
- Share recipe via QR code: 100% ✅ — Phase 4/5 delivered (offline JSON in QR)

### Export & Print
- Recipe card as PDF: 100% ✅ — Phase 4 delivered with QR code

### Mobile & Responsive Design
- Mobile first approach: 100% ✅ — React frontend with mobile-ready interfaces
- PWA (Homescreen install): 100% ✅ — Phase 2 delivered
- Media queries for typical screen sizes: 100% ✅ — React app responsive with Tailwind CSS
- Android app (Flutter): 0%

## Testing

**Unit tests (no server needed):**
- `npm test -- --run --exclude="test/e2e/**"` — run only unit tests
- `npm test` — all tests (E2E tests fail if server not running)

**Test Status (2026-03-28):**
- Unit Tests: 226 bestanden
- E2E Tests: 40 bestanden
- Cookidoo Credentials: 21 Unit-Tests bestanden

**Test Coverage:**
| Area | Tests | Files |
|------|-------|-------|
| scaling.ts | 100% | parseServingsNumber, scaleIngredient, splitIngredient |
| ingredient-dictionary.ts | 100% | all 7 matching paths |
| Shopping API | CRUD roundtrip | GET/POST/DELETE |

## Conventions

- ES modules throughout (`.js` extensions in imports for ESM compatibility)
- German for user-facing content and recipe output; English for code
- Zod schema (`RecipeDataSchema` in `types.ts`) validates all recipe output at runtime
- Async/await for all async operations
- No barrel exports; direct module imports
- JSON arrays (tags, ingredients, steps) serialized as TEXT in SQLite
