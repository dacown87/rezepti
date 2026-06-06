# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rezepti is a TypeScript web service that extracts recipes from URLs (YouTube, Instagram, TikTok, web pages), free text, and photo uploads, then saves them to Supabase PostgreSQL. Recipes are processed and output in German. It uses Groq API (Llama models) for extraction/translation, with fallback paths through schema.org parsing, audio transcription, and vision models.

## Commands

- `npm run dev` — Start dev server with hot reload (tsx watch)
- `npm start` — Start production server
- `npm run dev:mobile` — API server + Expo web dev server
- `npm run build:mobile` — Export Expo web app into `public/`
- `npm run build:mobile:docker` — Expo web export command ohne Git-Abhaengigkeit
- `npm run mobile:typecheck` — Mobile TypeScript check
- `npm run test:mobile` — Mobile Vitest suite
- `npm run test:mobile:rntl-guard` — Guard gegen neue direkte `react-test-renderer`-Imports in Mobile-Tests
- `npm run perf:bundle` — Analyze the current `public/` Expo export, including raw/gzip JS totals
- `npm run perf:lighthouse:compare` — Run Lighthouse with `simulate` and `devtools`, then write p50/p75 comparison artifacts
- `npm run perf:validate` — Validate Lighthouse/bundle status against warn-only budgets and update performance history/readiness
- `npm run perf:stability:seed` — Seed 10 real Lighthouse/validate runs for Strict-Hardening without directly editing history
- `npm run perf:budget:suggest` — Compute p50/p75/p95 and p95+10% budget suggestions from method-marked complete history runs
- `npm test` — Run tests (Vitest)
- `npx tsc` — Type-check (noEmit, strict mode)

Test suite: Vitest for unit/e2e tests. Mobile UI-near tests import `@testing-library/react-native`; under Vitest this resolves through `mobile/test/testing-library-rn-real.ts`, a thin wrapper around real RNTL that keeps `screen` live and widens the temporary string-based `UNSAFE_*ByType` transition types.

## Docker

- `docker compose up rezepti` — Dev-Modus starten (tsx watch, src/ + public/ als Volume, Änderungen sofort live)
- `docker compose up --build rezepti` — Dev-Image neu bauen und starten
- `docker compose --profile react-prod up rezepti-react-prod` — Production-Modus lokal aus dem aktuellen `Dockerfile` bauen
- `docker compose --profile prod up rezepti-prod` — Production-Modus mit `dacown/rezepti:latest` von Docker Hub
- `docker compose down` — Container stoppen

**Image:** `dacown/rezepti:latest` auf Docker Hub — wird automatisch via GitHub Actions gebaut und gepusht bei jedem Merge auf `main`.

**Stages:** `base` (Node 24.15.0 + yt-dlp + ffmpeg) → `builder` (tsc) → `web-builder` (Expo Web Export aus `mobile/`) → `production` (node dist/index.js) + `dev` (tsx watch)

**Volumes:**
- `./data:/app/data` — local runtime data such as cookies and export artifacts
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

**Request flow:** HTTP request → Pipeline → Classifier → Fetcher → Processor → Supabase PostgreSQL save

The server (`src/index.ts`) serves the React app and mounts the React API router.

**Pipeline stages**: classifying → fetching → transcribing → analyzing_image → extracting → exporting → done/error

**Key modules:**
- `src/pipeline.ts` — Orchestrator that routes through the extraction workflow; saves to Supabase-backed React DB and accepts per-job LLM options
- `src/classifier.ts` — Determines URL source type (youtube/instagram/tiktok/web)
- `src/fetchers/` — Source-specific content downloaders (yt-dlp for video; cheerio for web)
  - `web/base.ts` — shared extraction utilities + `WebScraperPlugin` interface
  - `web/index.ts` — generic `fetchWeb` dispatcher; Chefkoch ist hier nicht mehr registriert
  - `web.ts` — thin re-export (keeps existing imports stable)
- `src/processors/llm.ts` — Groq API via OpenAI SDK for recipe extraction, refinement, image analysis, and nutrition estimates; creates clients per call so BYOK jobs do not mutate server env
- `src/processors/schema-org.ts` — Fast path: parses schema.org/Recipe JSON-LD
- `src/processors/whisper.ts` — Audio transcription via Groq Whisper API; supports per-job BYOK
- `src/processors/ingredient-parser.ts` — `parseIngredient(raw)` → `{amount, unit, food, note?}`; ephemeral (no DB field)
- `src/db-react.ts` — PostgreSQL connection (postgres-js + Drizzle ORM), CRUD functions for React DB
- `src/api-react.ts` — All `/api/v1/*` endpoints (recipes, extraction jobs, BYOK, health)
- `src/job-manager.ts` — Job persistence for polling-based extraction
- `src/schema.ts` — Drizzle table schema for `recipes`
- `src/types.ts` — Core types and Zod schemas (RecipeData, ContentBundle, SchemaOrgRecipe)

**Database:** PostgreSQL via Supabase. Connection via `DATABASE_URL` env var (postgres-js + Drizzle ORM). Legacy SQLite (`rezepti-react.db`, `better-sqlite3`) and `db.ts`/`db-manager.ts` have been removed.

**Extraction paths** (tried in order):
1. schema.org/Recipe JSON-LD (web only, fastest)
2. LLM text extraction from subtitles or page text (Groq Llama 3.3 70B)
3. Audio transcription (Groq Whisper) → LLM extraction
4. Vision model on images (Groq Llama 4 Scout, fallback)

**API Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Main UI (React app) |
| `/api/v1/recipes` | GET/POST | List / create recipes, requires Supabase bearer auth |
| `/api/v1/recipes/:id` | GET/PATCH/DELETE | Single recipe CRUD inside the caller's owner scope |
| `/api/v1/extract/react` | POST | Start URL extraction job (polling), requires Supabase bearer auth |
| `/api/v1/extract/react/:jobId` | GET/DELETE | Poll / cancel a job, only visible to the owning user |
| `/api/v1/extract/text` | POST | Start free-text extraction job (polling, min 50 chars), requires Supabase bearer auth |
| `/api/v1/extract/photo` | POST | Start photo extraction job (multipart, polling), requires Supabase bearer auth |
| `/api/v1/extract/jobs` | GET | List recent jobs for the authenticated user |
| `/api/v1/keys/validate` | POST | Validate BYOK API key |
| `/api/v1/keys` | POST | Store API key |
| `/api/v1/keys/:keyHash` | DELETE | Remove API key |
| `/api/v1/health` | GET | Server + DB status |
| `/api/v1/images/search` | GET | Search recipe image suggestions |
| `/api/v1/cookidoo/status` | GET | Cookidoo connection status |
| `/api/v1/cookidoo/credentials` | POST/DELETE | Store/remove Cookidoo credentials |

BYOK extraction requests accept `x-groq-key` or an `apiKey` JSON body field where the route has a JSON body. The key is validated, stored only as a hash on the job, and passed explicitly into URL, text, photo, Whisper, Vision, nutrition, and TikTok OCR paths.

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

Copy `.env.example` to `.env`. Required: `GROQ_API_KEY` (get free at console.groq.com) and `DATABASE_URL` (PostgreSQL connection string, e.g. from Supabase).

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

### Git Hooks

`scripts/hooks/pre-commit` blockiert Phantom-Submodule (Mode-160000-Entries ohne `.gitmodules`-Eintrag). Aktivierung erfolgt automatisch ueber `npm install` (`prepare`-Script setzt `core.hooksPath=scripts/hooks`). Bypass mit `git commit --no-verify` ist moeglich, sollte aber die Ausnahme bleiben.

## Working Notes (Claude)

- **Origin:** Project was AI-generated — code may be inconsistent, pay attention to quality when touching it
- **Test Suite**: Unit tests run with `npm test`. E2E tests (`test/e2e/`) require a running server.
- **After frontend changes:** Bei Bedarf zuerst `npm --prefix mobile ci`, dann `npm run build:mobile` zum Aktualisieren von `public/`. Der Expo-Export kann nach erfolgreichem `Exported: ../public` lokal haengen; nicht mehrfach parallel starten.
- **After mobile test changes:** `npm run test:mobile:rntl-guard` ausfuehren. Neue Mobile-Tests duerfen `react-test-renderer` nicht direkt importieren; `renderAsync` ist in Testdateien abgebaut. Verbleibende `UNSAFE_queryAllByType`-Altfaelle sind in `docs/testing/rntl-migration-phase-0-inventory.md` dokumentiert.
- **After performance-sensitive mobile changes:** `npm run perf:bundle`, bei LCP-/Shell-/Routing-Aenderungen zusaetzlich `npm run perf:lighthouse:compare` und `npm run perf:validate`. Phase 4c ist abgeschlossen: `mobile/app/+html.tsx` liefert eine route-aware statische App-Shell, damit `/shopping` und `/recipe/*` vor Expo-Web-Hydration einen stabilen LCP-Kandidaten haben.
- **Strict performance hardening:** Fuer die 10er-Messreihe `npm run perf:stability:seed` verwenden. Das Script editiert `history.json` nicht selbst; nur `perf:validate` schreibt echte Run-Eintraege. Danach `npm run perf:budget:suggest` ausfuehren und Vorschlaege pruefen. Aktuelle CI-Policy (seit 2026-05-13, nach 2 gruenen Strict-Probes): `schedule` (nightly cron 02:00 UTC) laeuft `strict`, `push`/`pull_request` bleiben `warn`. `workflow_dispatch` weiter wahlweise `warn` oder `strict`. Erste Eskalation auf `pull_request` strict bleibt offen.
- **New web scraper plugin:** The plugin registry (`PLUGINS` array) was removed in the May 2026 cleanup. The `WebScraperPlugin` interface still exists in `src/fetchers/web/base.ts`. To add a new domain-specific scraper, re-add the plugin registry in `web/index.ts` and implement the interface in `src/fetchers/web/[domain].ts`. Chefkoch bleibt dedizierter Fetcher in `pipeline.ts`.
- **Fetcher code duplication:** Before adding utility functions to a fetcher (extractJsonLdRecipes, resolveSchemaImage, extractImages etc.), check `src/fetchers/web/base.ts` first — these are already exported there.

## Planning Documents

- **Master Plan (kanonisch):** Obsidian Vault → `Projekte/RecipeDeck/Phasenplan.md` — Immer aktuellster Stand. Zuerst hier nachschlagen.
- **Legacy Plan:** `docs/superpowers/plans/2026-03-26-master-phasenplan.md` — Veraltet, nur als Archiv. Nicht mehr maßgeblich.
- **Autoplan-Review:** `~/.claude/plans/joyful-kindling-anchor.md` — Vollständiger Projektstand-Review (2026-04-09) mit offenen Punkten
- **Codemaps:** `docs/CODEMAPS/` — Architecture, Backend, Fetchers, Database, Frontend
- **TODO:** `TODO.md` — Aktuelle Aufgaben und offene Bugs
- **Project Learnings:** `docs/PROJECT_LEARNINGS.md` — Aggregierte Pitfalls/Operationals aus gstack-Sessions (41 Eintraege, Stand 2026-05-31). Bei neuen Aufgaben hier zuerst nachsehen, ob ein bekannter Stolperstein dokumentiert ist. Updates ueber `/learn` (zeigt aktuelle) — neue Eintraege werden automatisch von `/review`, `/ship`, `/investigate` etc. ergaenzt.
- **RNTL Migration Inventory:** `docs/testing/rntl-migration-phase-0-inventory.md` — aktueller Mobile-Test-Migrationsstand, Real-RNTL-Runtime-Fix, abgebauter `UNSAFE_queryAllByType`-Rest und verbleibende Warnklassen.
- **RNTL Authoring Checklist:** `docs/testing/rntl-migration-authoring-checklist.md` — Regeln fuer neue Mobile-Tests nach Entfernung des Compat-Layers.
- **Supabase Advisor Plan:** `docs/SupaBase/supabase-advisor-remediation-plan.md` — reviewed SQL/Ops-Plan fuer `function_search_path_mutable`, FK-Indexes, RLS-ohne-Policy-Klassifizierung und Grants-Audit.
- **Performance Analysis:** `docs/performance/throttling-analysis.md` — Phase-4c Throttling-Vergleich, App-Shell-LCP-Fix, Bundle-Gzip-Zahlen und Strict-Gate-Regeln.
- **Strict Probe Runbook:** `docs/performance/strict-probe-runbook.md` — Archiv/Runbook fuer Strict-Probe-Freigabe und spaetere Enforcement-Eskalationen.

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

**Test Status (2026-05-31):**
- Root unit tests: zuletzt dokumentiert `448 passed`, `13 skipped`
- Mobile unit tests: zuletzt dokumentiert `87 passed`
- Mobile RNTL guard: `npm run test:mobile:rntl-guard` blockiert neue direkte `react-test-renderer`-Imports
- E2E contract gate: CI startet echten Server und fuehrt `npm run test:e2e:contract` aus

**Test Coverage:**
| Area | Tests | Files |
|------|-------|-------|
| scaling.ts | 100% | parseServingsNumber, scaleIngredient, splitIngredient |
| ingredient-dictionary.ts | 100% | all 7 matching paths |
| Shopping API | CRUD + Negativfälle | planner-routes.test.ts |
| Dictionary API | POST/match + Validierung | planner-routes.test.ts |
| Ingredient Search | OR/AND/threshold/limit | recipes-routes.test.ts |
| PDF Helpers | alle Exports | pdf-export-helpers.test.ts |
| Static Assets | hashed/fallback/404 | static-assets.test.ts |
| TikTok OCR | plaintext helper, Fehlerfälle | tiktok.test.ts |
| Chefkoch Routing | classifyURL + dedizierter Fetcher | pipeline-chefkoch.test.ts |

## Conventions

- ES modules throughout (`.js` extensions in imports for ESM compatibility)
- German for user-facing content and recipe output; English for code
- Zod schema (`RecipeDataSchema` in `types.ts`) validates all recipe output at runtime
- Async/await for all async operations
- No barrel exports; direct module imports
- JSON arrays (tags, ingredients, steps) are stored in PostgreSQL columns through Drizzle helpers in `src/db-react.ts`
- Obsidian Vault liegt unter `/home/patrick/Vault/`. Local REST API PATCH works when targeting the exact heading from the document map; nested headings use `::`.
