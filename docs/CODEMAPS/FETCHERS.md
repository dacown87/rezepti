# Fetchers Codemap

**Last Updated:** 2026-03-28

## Overview

Fetchers are source-specific content downloaders. Each fetcher returns a `ContentBundle` containing raw data for recipe extraction.

```typescript
interface ContentBundle {
  url: string;
  type: SourceType;
  title?: string;
  description?: string;
  textContent?: string;
  subtitles?: string;
  imageUrls: string[];
  audioPath?: string;
  schemaRecipe?: SchemaOrgRecipe | null;
}
```

## Web Fetcher

**Location:** `src/fetchers/web.ts`

**Purpose:** Generic web page scraping

**Strategy:**
1. Fetch HTML with User-Agent header
2. Extract Schema.org JSON-LD (`@type: Recipe`)
3. Extract main text content via Cheerio selectors
4. Extract images from `<img>` tags

**Key Functions:**
- `extractJsonLdRecipes($)` - Parse JSON-LD script tags
- `findRecipeInJsonLd(data)` - Recursively find Recipe type
- `extractMainText($)` - Extract readable content
- `extractImages($, baseUrl)` - Get image URLs

**Cheerio Selectors:**
```
[itemtype*="schema.org/Recipe"], .recipe, .recipe-content, #recipe, 
article, main, .post-content, .entry-content
```

## YouTube Fetcher

**Location:** `src/fetchers/youtube.ts`

**Purpose:** YouTube video content extraction

**Strategy:**
1. Use `yt-dlp` to download best audio + subtitles
2. Extract video metadata (title, description)
3. Return subtitles for LLM extraction

**Output:**
- `subtitles` - Full transcript text
- `imageUrls` - Video thumbnail
- `audioPath` - Local path to downloaded audio

## Instagram Fetcher

**Location:** `src/fetchers/instagram.ts`

**Purpose:** Instagram post/reel extraction

**Strategy:**
- Uses `yt-dlp` for video download
- Extracts description as text content

**Status:** 70% - Works via yt-dlp

## TikTok Fetcher

**Location:** `src/fetchers/tiktok.ts`

**Purpose:** TikTok video extraction

**Strategy:**
- Uses `yt-dlp` for video download
- Extracts caption as text content

**Status:** 70% - Works via yt-dlp

## Cookidoo Fetcher

**Location:** `src/fetchers/cookidoo.ts`

**Purpose:** Cookidoo.de recipe extraction via OAuth2

**Auth Flow:**
- ROPC (Resource Owner Password Credentials) flow
- Hardcoded client credentials (public in app binary)
- Token refresh on 401/403

**Endpoints:**
- Auth: `POST https://eu.tmmobile.vorwerk-digital.com/ciam/auth/token`
- Recipes: `GET https://eu.tmmobile.vorwerk-digital.com/api/v1/recipes/{id}`

**Session Management:**
- Stored in `data/cookidoo-session.json`
- Auto-refresh 60 seconds before expiry

**Strategy:**
1. Fast path: Schema.org JSON-LD in response
2. Fallback: Cheerio selectors (`.recipe-card`, `.recipe-detail`)

**Status:** 100% - Fully implemented

## Pinterest Fetcher

**Location:** `src/fetchers/pinterest.ts`

**Purpose:** Pinterest pin extraction

**Status:** 0% - Not implemented

## Facebook Fetcher

**Location:** `src/fetchers/facebook.ts`

**Purpose:** Facebook post/reel extraction

**Status:** 0% - Not implemented

## Dependencies

All fetchers depend on:
- `src/types.ts` - `ContentBundle`, `SourceType`, `SchemaOrgRecipe`
- External CLI: `yt-dlp` (installed on host)

## Adding a New Fetcher

1. Create `src/fetchers/{source}.ts`
2. Export function: `export async function fetch{Source}(url: string, tempDir?: string): Promise<ContentBundle>`
3. Add case in `src/pipeline.ts` switch statement
4. Add regex pattern in `src/classifier.ts`
5. Add type to `SourceType` in `src/types.ts`
