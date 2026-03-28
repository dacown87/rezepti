# Backend Codemap

**Last Updated:** 2026-03-28

## Entry Point

**Location:** `src/index.ts`

Main HTTP server using Hono framework. Serves:
- Static files from `public/`
- React SPA fallback for all non-API routes
- Mounts React API at root

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Main UI (React app) |
| `/api/v1/recipes` | GET | List all recipes |
| `/api/v1/recipes` | POST | Create recipe |
| `/api/v1/recipes/:id` | GET | Get single recipe |
| `/api/v1/recipes/:id` | PATCH | Update recipe |
| `/api/v1/recipes/:id` | DELETE | Delete recipe |
| `/api/v1/extract/react` | POST | Start extraction job |
| `/api/v1/extract/react/:jobId` | GET | Poll job status |
| `/api/v1/extract/react/:jobId` | DELETE | Cancel job |
| `/api/v1/extract/jobs` | GET | List recent jobs |
| `/api/v1/extract/photo` | POST | Extract from image upload |
| `/api/v1/keys/validate` | POST | Validate BYOK API key |
| `/api/v1/keys` | POST | Store API key |
| `/api/v1/keys/:keyHash` | DELETE | Remove API key |
| `/api/v1/shopping` | GET/POST | Shopping list CRUD |
| `/api/v1/shopping/:id` | PATCH/DELETE | Toggle/delete item |
| `/api/v1/shopping/checked` | DELETE | Clear checked items |
| `/api/v1/shopping/all` | DELETE | Clear all items |
| `/api/v1/dictionary` | GET/POST | Ingredient dictionary |
| `/api/v1/dictionary/match` | GET | Match ingredient by similarity |
| `/api/v1/planner` | GET/POST | Meal plan CRUD |
| `/api/v1/planner/:id` | DELETE | Remove from meal plan |
| `/api/v1/planner/week/:weekStart` | DELETE | Clear week |
| `/api/v1/cookidoo/status` | GET | Cookidoo connection status |
| `/api/v1/cookidoo/credentials` | POST/DELETE | Store/remove credentials |
| `/api/v1/health` | GET | Server + DB status |

## Pipeline Module

**Location:** `src/pipeline.ts`

**Purpose:** Orchestrates the complete extraction workflow

**Key Functions:**
- `processURL(rawUrl: string, onEvent: EventCallback): Promise<PipelineResult>` - Main entry point

**Flow:**
1. Classify URL → 2. Fetch content → 3. Extract recipe → 4. Save to DB

**Extraction Priority:**
1. Schema.org JSON-LD (fastest)
2. LLM text extraction from subtitles/page text
3. Audio transcription (Whisper) → LLM extraction
4. Vision model on images (fallback)

## Classifier Module

**Location:** `src/classifier.ts`

**Purpose:** Determines URL source type

**Exports:**
- `classifyURL(rawUrl: string): ClassifiedURL` - Returns `{ url, type }`

**Supported Types:**
- `youtube` - youtube.com, youtu.be
- `instagram` - instagram.com
- `tiktok` - tiktok.com
- `cookidoo` - cookidoo.de
- `pinterest` - pinterest.com, pinterest.de
- `facebook` - facebook.com
- `web` - default for any other URL

## Job Manager

**Location:** `src/job-manager.ts`

**Purpose:** Persistent job tracking for extraction polling

**Key Classes:**
- `JobManager` - Singleton with SQLite persistence

**Key Methods:**
- `createJob(url, userAgent?, apiKeyHash?)` - Create new job
- `startJob(jobId)` - Mark job as running
- `updateJob(jobId, updates)` - Update progress
- `completeJob(jobId, result)` - Mark success
- `failJob(jobId, error)` - Mark failure
- `getJob(jobId)` - Get job status
- `isUrlProcessing(url)` - Check if URL already processing

**Job States:** `pending` → `running` → `completed` | `failed`

## Processors

### LLM Processor

**Location:** `src/processors/llm.ts`

**Purpose:** Groq API integration for recipe extraction

**Exports:**
- `extractRecipeFromText(text, existingImageUrl?)` - Text-based extraction
- `extractRecipeFromImage(imageUrl, additionalText?)` - Vision model extraction
- `refineRecipe(partial)` - Translate/refine schema.org recipes

**Models:**
- Text: `llama-3.3-70b-versatile` (configurable)
- Vision: `meta-llama/llama-4-scout-17b-16e-instruct` (configurable)

### Schema-Org Processor

**Location:** `src/processors/schema-org.ts`

**Purpose:** Fast path extraction from JSON-LD

**Exports:**
- `schemaToRecipeData(schema: SchemaOrgRecipe)` - Convert to RecipeData

### Whisper Processor

**Location:** `src/processors/whisper.ts`

**Purpose:** Audio transcription via Groq Whisper API

**Exports:**
- `transcribeAudio(audioPath: string, tempDir: string)` - Transcribe audio file

## Configuration

**Location:** `src/config.ts`

**Exports:**
```typescript
config = {
  groq: { apiKey, textModel, visionModel, whisperModel },
  sqlite: { path, reactPath },
  cookidoo: { email, password },
  port,
  jobs: { cleanupDays, maxConcurrent, pollInterval }
}
```

## Dependencies

```
src/
├── api-react.ts      → db-react, job-manager, pipeline, byok-validator, cookidoo
├── pipeline.ts       → classifier, fetchers/*, processors/*, db-react
├── classifier.ts     → types
├── db-react.ts       → schema, config, ingredient-dictionary
├── job-manager.ts    → config, types
├── config.ts         → dotenv
└── processors/
    ├── llm.ts        → config, types
    ├── schema-org.ts → types
    └── whisper.ts    → config
```
