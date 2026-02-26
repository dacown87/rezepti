# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rezepti is a TypeScript web service that extracts recipes from URLs (YouTube, Instagram, TikTok, web pages) and exports them to Notion. Recipes are processed and output in German. It uses local Ollama LLM models for extraction/translation, with fallback paths through schema.org parsing, audio transcription, and vision models.

## Commands

- `npm run dev` — Start dev server with hot reload (tsx watch)
- `npm start` — Start production server
- `npx tsc` — Type-check (noEmit, strict mode)
- `npx tsx scripts/create-db.ts` — Create Notion database
- `npx tsx scripts/check-db.ts` — Inspect Notion database schema
- `npx tsx scripts/fix-db.ts` — Fix Notion database properties

No test suite exists.

## Architecture

**Request flow:** HTTP request → Pipeline → Classifier → Fetcher → Processor → Notion export

The server (`src/index.ts`) exposes `GET /api/extract?url=...` which streams progress via SSE.

**Pipeline stages** (SSE events): classifying → fetching → transcribing → analyzing_image → extracting → exporting → done/error

**Key modules:**
- `src/pipeline.ts` — Orchestrator that routes through the extraction workflow
- `src/classifier.ts` — Determines URL source type (youtube/instagram/tiktok/web)
- `src/fetchers/` — Source-specific content downloaders (web.ts uses cheerio; others use yt-dlp)
- `src/processors/llm.ts` — Ollama integration for recipe extraction and refinement
- `src/processors/schema-org.ts` — Fast path: parses schema.org/Recipe JSON-LD
- `src/processors/whisper.ts` — Audio transcription via whisper-cpp CLI
- `src/notion.ts` — Notion API client for creating recipe pages
- `src/types.ts` — Core types and Zod schemas (RecipeData, ContentBundle, SchemaOrgRecipe)

**Extraction paths** (tried in order):
1. schema.org/Recipe JSON-LD (web only, fastest)
2. LLM text extraction from subtitles or page text
3. Audio transcription (whisper-cpp) → LLM extraction
4. Vision model on images (fallback)

**Frontend:** Single-page vanilla JS app (`public/index.html`) with Tailwind CSS CDN, no build step.

## External CLI Dependencies

These must be installed on the host: `yt-dlp`, `ffmpeg`, `whisper-cpp`, `ollama`

Whisper model path: `~/.cache/whisper-cpp/models/ggml-large-v3-turbo.bin`

## Configuration

Copy `.env.example` to `.env`. Required: `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID` (or `NOTION_DATABASE_ID`), Ollama running locally.

## Conventions

- ES modules throughout (`.js` extensions in imports for ESM compatibility)
- German for user-facing content and recipe output; English for code
- Zod schema (`RecipeDataSchema` in `types.ts`) validates all recipe output at runtime
- Async/await for all async operations
- No barrel exports; direct module imports
