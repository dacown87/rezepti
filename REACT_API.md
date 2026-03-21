# React API Endpoints Documentation

## Overview

This document describes the new React API endpoints for polling-based recipe extraction with BYOK (Bring Your Own Key) support.

## Job-Based Extraction Flow

### 1. Start Extraction Job
```http
POST /api/v1/extract/react
Content-Type: application/json

{
  "url": "https://chefkoch.de/rezepte/12345",
  "apiKey": "gsk_..." // Optional: user's Groq API key
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "job_1700509200000_abc123xyz",
  "status": "pending",
  "message": "Extraction job created",
  "pollUrl": "/api/v1/extract/react/job_1700509200000_abc123xyz"
}
```

### 2. Poll Job Status
```http
GET /api/v1/extract/react/{jobId}
```

**Query Parameters:**
- `since` (optional): Timestamp in milliseconds. Returns 204 No Content if no updates since.

**Response:**
```json
{
  "id": "job_1700509200000_abc123xyz",
  "status": "running",
  "progress": 35,
  "currentStage": "fetching",
  "message": "Inhalte werden abgerufen...",
  "updatedAt": 1700509210000
}
```

**Polling Strategies:**
1. **Simple Polling:** Call every 2-3 seconds
2. **Long Polling:** Use `since` parameter to avoid redundant transfers
3. **WebSocket/SSE:** Consider for real-time updates in future

### 3. Job Completion
**Successful Response:**
```json
{
  "id": "job_1700509200000_abc123xyz",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "recipe": {
      "name": "Spaghetti Carbonara",
      "ingredients": [...],
      "steps": [...]
    },
    "recipeId": 123
  },
  "updatedAt": 1700509235000
}
```

**Error Response:**
```json
{
  "id": "job_1700509200000_abc123xyz",
  "status": "failed",
  "progress": 100,
  "error": "No recipe content found in URL",
  "updatedAt": 1700509220000
}
```

### 4. Cancel Job
```http
DELETE /api/v1/extract/react/{jobId}
```

## BYOK (Bring Your Own Key) Endpoints

### 1. Validate API Key
```http
POST /api/v1/keys/validate
Content-Type: application/json

{
  "apiKey": "gsk_..."
}
```

**Response:**
```json
{
  "valid": true,
  "model": "llama-3.3-70b-versatile"
}
```

### 2. Store API Key (Hashed)
```http
POST /api/v1/keys
Content-Type: application/json

{
  "apiKey": "gsk_..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key validated and stored (hashed)",
  "keyHash": "a1b2c3d4...",
  "model": "llama-3.3-70b-versatile"
}
```

### 3. Remove API Key
```http
DELETE /api/v1/keys/{keyHash}
```

## Job Management Endpoints

### List Recent Jobs
```http
GET /api/v1/extract/jobs?limit=50
```

**Response:**
```json
{
  "jobs": [
    {
      "id": "job_...",
      "url": "https://...",
      "status": "completed",
      "progress": 100,
      "createdAt": 1700509200000,
      "updatedAt": 1700509235000
    }
  ],
  "total": 25
}
```

## Database Schema

### Extraction Jobs Table (`extraction_jobs`)
```sql
CREATE TABLE extraction_jobs (
  id            TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  status        TEXT NOT NULL, -- pending, running, completed, failed
  progress      INTEGER NOT NULL DEFAULT 0,
  current_stage TEXT,
  message       TEXT,
  result        TEXT,
  error         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  started_at    INTEGER,
  completed_at  INTEGER,
  api_key_hash  TEXT,
  user_agent    TEXT
);

-- Indexes
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status, updated_at);
CREATE INDEX idx_extraction_jobs_created ON extraction_jobs(created_at DESC);
CREATE INDEX idx_extraction_jobs_url ON extraction_jobs(url);
```

## Job Status Lifecycle

```
[Pending] → [Running] → [Completed]
                  ↓
               [Failed]
```

**States:**
- `pending`: Job created, not yet started
- `running`: Currently processing
- `completed`: Successfully finished with result
- `failed`: Error occurred

## Progress Mapping

| Stage | Progress | Description |
|-------|----------|-------------|
| classifying | 20% | Analyzing URL type |
| fetching | 35% | Downloading content |
| transcribing | 50% | Audio transcription |
| analyzing_image | 60% | Vision model analysis |
| extracting | 75% | LLM recipe extraction |
| exporting | 90% | Saving to database |
| done | 100% | Completed successfully |
| error | 100% | Failed with error |

## Error Handling

**Common Errors:**
- `400`: Invalid request (missing URL, invalid API key)
- `404`: Job not found
- `409`: URL already being processed
- `500`: Internal server error

## Rate Limiting

Jobs are automatically cleaned up after 7 days (configurable via `JOB_CLEANUP_DAYS`).

BYOK keys are subject to Groq API rate limits. The system provides basic validation but users should monitor their own usage.

## Integration with Existing Pipeline

The new React endpoints use the existing `processURL` function from `pipeline.ts` but wrap it with:

1. **Job Tracking:** Persistent job state in SQLite
2. **Polling Interface:** RESTful polling instead of SSE
3. **BYOK Support:** User-provided API key validation
4. **Progress Tracking:** Real-time progress updates

## Environment Variables

```bash
# Job management
JOB_CLEANUP_DAYS=7
MAX_CONCURRENT_JOBS=5
POLL_INTERVAL_MS=2000

# Groq API (fallback)
GROQ_API_KEY=your_key_here
GROQ_TEXT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_WHISPER_MODEL=whisper-large-v3-turbo
```

## Usage Example (Frontend)

```javascript
// Start extraction
const response = await fetch('/api/v1/extract/react', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://chefkoch.de/rezepte/12345',
    apiKey: userApiKey // Optional
  })
});

const { jobId, pollUrl } = await response.json();

// Poll for updates
async function pollJobStatus(jobId) {
  const response = await fetch(`/api/v1/extract/react/${jobId}`);
  const job = await response.json();
  
  if (job.status === 'completed') {
    console.log('Recipe extracted:', job.result.recipe);
  } else if (job.status === 'failed') {
    console.error('Extraction failed:', job.error);
  } else {
    // Still processing, show progress
    console.log(`Progress: ${job.progress}% - ${job.message}`);
    setTimeout(() => pollJobStatus(jobId), 2000);
  }
}

pollJobStatus(jobId);
```

## Migration Notes

1. React database (`rezepti-react.db`) is separate from legacy database
2. Job persistence survives server restarts
3. BYOK keys are never stored in plaintext (only hashes)
4. Backward compatible with existing SSE endpoint
