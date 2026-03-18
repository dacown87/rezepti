# Cookidoo Integration Design

**Date:** 2026-03-18
**Status:** Approved

## Overview

Add support for extracting recipes from cookidoo.de. Cookidoo is a login-protected recipe platform (Thermomix). The integration follows the existing fetcher pattern and is designed to be portable to Android (no headless browser, pure HTTP).

## Goals

- Extract recipes from cookidoo.de URLs
- Authenticate via HTTP login using credentials from `.env`
- Cache the session cookie in memory to avoid repeated logins
- Return a standard `ContentBundle` so the existing pipeline handles the rest unchanged

## Non-Goals

- No headless browser (Playwright/Puppeteer)
- No persistent cookie storage to disk
- No changes to the LLM processing, DB, or frontend

## Architecture

Four files modified, one new file added:

| File | Change |
|---|---|
| `src/types.ts` | Add `"cookidoo"` to `SourceType` union |
| `src/classifier.ts` | Add regex pattern for `cookidoo.de` |
| `src/config.ts` | Add `cookidoo.email` and `cookidoo.password` from env |
| `src/pipeline.ts` | Add cookidoo case to fetcher routing |
| `src/fetchers/cookidoo.ts` | **New** — HTTP login, session cache, scraping |

## Fetcher Design (`src/fetchers/cookidoo.ts`)

### Session Management

A module-level variable holds the cached session cookie. On each request:

1. If cookie exists → use it
2. If request returns 401/403 → invalidate cache, re-login, retry once
3. If no cookie yet → login first

Concurrent requests with stale cookie: accept the race (both re-login, last write wins) — acceptable for single-user local use.

### Login Flow

**Prerequisite:** Before coding, reverse-engineer the login endpoint using browser DevTools (Network tab while logging in on cookidoo.de). Determine the endpoint URL, request body format, and which cookie(s) are returned.

- **If simple JSON POST → Set-Cookie:** POST credentials, store returned session cookie, retry on 401/403
- **If OAuth or multi-step CSRF flow:** The 401 retry strategy does not apply — the full token chain must be re-acquired. Adapt auth logic accordingly; the rest of the fetcher stays the same.

### Recipe Extraction

1. Fetch the recipe page via `fetch()` with the session cookie as `Cookie` header
2. Parse HTML with Cheerio
3. **Fast path:** Look for `<script type="application/ld+json">` with `@type: "Recipe"` — Cookidoo embeds schema.org markup
4. **Fallback:** Scrape DOM elements for title, ingredients, and steps using Cookidoo-specific CSS selectors
5. Return `ContentBundle` with `schemaRecipe` (if found) or `textContent` (fallback)

### ContentBundle Output

```typescript
{
  url,
  type: "cookidoo",
  title,
  description,
  textContent,       // fallback: scraped text
  imageUrls,
  schemaRecipe       // fast path: JSON-LD Recipe object
}
```

Note: `subtitles` and `audioPath` are optional fields on `ContentBundle` and intentionally omitted — no interface changes needed.

## Configuration

New entries in `.env` and `.env.example`:

```
COOKIDOO_EMAIL=your@email.com
COOKIDOO_PASSWORD=yourpassword
```

Full updated `src/config.ts` (preserving `as const`):

```typescript
export const config = {
  groq: {
    apiKey:        process.env.GROQ_API_KEY || "",
    textModel:     process.env.GROQ_TEXT_MODEL    || "llama-3.3-70b-versatile",
    visionModel:   process.env.GROQ_VISION_MODEL  || "meta-llama/llama-4-scout-17b-16e-instruct",
    whisperModel:  process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo",
  },
  sqlite: {
    path: process.env.SQLITE_PATH || join(process.cwd(), "data", "rezepti.db"),
  },
  cookidoo: {
    email:    process.env.COOKIDOO_EMAIL    || "",
    password: process.env.COOKIDOO_PASSWORD || "",
  },
  port: parseInt(process.env.PORT || "3000", 10),
} as const;
```

## Classifier

Insert into the existing `patterns` array in `classifier.ts`, before the `web` fallback entry:

```typescript
["cookidoo", /cookidoo\.de\//i],
```

## Pipeline Routing

Insert before line 60 (`case "web":`) in `pipeline.ts`. The `"web"` and `default:` cases are merged — inserting after them would be unreachable:

```typescript
case "cookidoo":
  bundle = await fetchCookidoo(classified.url);
  break;
case "web":
default:
  bundle = await fetchWeb(classified.url);
  break;
```

Also add the import at the top of `pipeline.ts`:

```typescript
import { fetchCookidoo } from "./fetchers/cookidoo.js";
```

## Error Handling

- Missing credentials → throw descriptive error before attempting login
- Login failure (wrong password, account locked) → throw with HTTP status code
- Recipe not found (404) → throw with message
- Session expiry retry: provisional — one automatic retry if auth flow is simple cookie-based; adapt after reverse-engineering confirms the flow

## Android Compatibility

The implementation uses only `fetch()` (native in Node.js 18+) and `cheerio`. Both are portable to React Native / Android environments. No Node.js-specific APIs (fs, child_process) are used.
