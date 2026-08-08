# Fetchers Codemap

**Last Updated:** 2026-08-07 (v1.0.196)

A fetcher downloads source-specific raw content and returns a `ContentBundle`.
It does **not** know about the database and makes no extraction decision — that
is `pipeline.ts`.

## The Contract

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
  isCarousel?: boolean;    // Instagram
  carouselCount?: number;  // Instagram
}
```

If a fetcher sets `schemaRecipe`, the pipeline takes the fast path with no LLM
call. Otherwise it escalates through `textContent` / `subtitles` / `audioPath` /
`imageUrls`.

## Dispatch

`pipeline.ts` branches in a `switch (classified.type)`. **There is no plugin
registry any more** — the `PLUGINS` array was removed in the May 2026 cleanup.
The `WebScraperPlugin` interface still lives in `src/fetchers/web/base.ts` in
case it is worth reintroducing.

## Overview

| Source | File | Lines | Technique | Status |
|--------|------|-------|-----------|--------|
| Web (generic) | `web/index.ts` + `web/base.ts` | 309 | fetch + cheerio | ~80%, gaps on uncommon sites |
| YouTube | `youtube.ts` | — | yt-dlp (audio + subtitles) | ~80% |
| Instagram | `instagram.ts` | 324 | yt-dlp → Cobalt → web scraping | ~70% |
| TikTok | `tiktok.ts` | 266 | yt-dlp + frame OCR | ~70% |
| Cookidoo | `cookidoo.ts` | 576 | web-login session | 100% |
| Chefkoch | `chefkoch.ts` | 183 | dedicated scraper | ~40% |
| Pinterest | `pinterest.ts` | 391 | outbound-link handoff to `fetchWeb` | 0% — anonymous access closed |
| Facebook | `facebook.ts` | 300 | yt-dlp + **global** cookie file | 0% — no supported credential path |
| Cobalt | `cobalt.ts` | 128 | helper service, only used by Instagram | — |

## Web — `web/base.ts` + `web/index.ts`

`fetchWeb(url)` is the dispatcher. **All extraction helpers live in `base.ts`**
and are exported — check there before writing a new helper:

| Export | Purpose |
|--------|---------|
| `extractJsonLdRecipes($)` | Parse `<script type="application/ld+json">` |
| `findRecipeInJsonLd(data)` | Recursively find `@type: Recipe` |
| `deepFindRecipe(data)` | Deeper variant for nested graphs |
| `extractWildJsonLd(html)` | Pull JSON-LD out of broken markup |
| `extractMicrodataRecipe($)` | Microdata instead of JSON-LD |
| `extractMainText($)` / `extractMainTextFull($)` | Readable main text |
| `extractDomBlocks($, maxBlocks)` | DOM blocks as a fallback |
| `resolveSchemaImage(...)` | Normalise a schema image URL |
| `extractImages($, baseUrl)` | Make `<img>` URLs absolute |

`src/fetchers/web.ts` is a thin re-export so older import paths keep working.

These helpers are exported deliberately broadly and are therefore excluded from
the gated knip categories — do not delete them because knip reports them as
unused exports.

## YouTube

`fetchYouTube(url, tempDir)` — `yt-dlp` downloads best audio plus subtitles.
`cleanVTT(vtt)` reduces the VTT to running text. Output: `subtitles`,
`imageUrls` (thumbnail), `audioPath`. Without subtitles, Whisper takes over.

## Instagram

Three stages, in this order:

1. `yt-dlp` — detects carousels via `media_count` / `children` and re-downloads
   with `--yes-playlist`
2. On failure: **Cobalt** (`fetchWithCobalt`, `downloadFirstCobaltMedia`); the
   result is merged with a parallel web scrape (images unioned, Cobalt audio
   preferred). Cobalt is used **only** here.
3. If Cobalt yields nothing: plain cheerio web scraping
   (`fetchInstagramWebScraping`)

Rate limits: exponential backoff 1 s / 2 s / 4 s, max 3 attempts.
Exports: `extractHashtags`, `detectCarousel`, `tempDirFromFilename`.

## TikTok

`fetchTikTok(url, tempDir, { apiKey })` — yt-dlp for the video, caption as text,
`prioritizeComments` promotes useful comments.

**Frame OCR:** if `TIKTOK_OCR_ENABLED` is not `false` and `ffmpeg` is present,
`extractTextFromVideoFrames` cuts up to `TIKTOK_MAX_OCR_FRAMES` (default 10)
frames and sends them to the vision model. Without `ffmpeg` the OCR is skipped
silently and the rest keeps working. The BYOK key is passed through.

## Cookidoo

The largest fetcher (576 lines). Login goes through the Vorwerk CIAM **web
form** — **not** OAuth2 ROPC, and no Playwright:

1. Get a CF clearance from the local scraper service (`CF_SCRAPER_URL`,
   default `http://localhost:3001`)
2. `POST https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login`,
   following redirects manually → session cookies
3. Authenticated HTML fetch against `cookidoo.de`
4. Parse the JSON-LD, plus dedicated selectors for ingredients, steps and equipment

**Session handling** is scope-bound: stored in `cookidoo_credentials.session_*`
(user or household), in-memory cache plus DB writeback
(`updateCookidooScopedSession`), invalidated on 401/403. The old on-disk store
has been removed. `password` and `session_cookies` are encrypted at rest
(AES-256-GCM via `src/credential-crypto.ts`, `v1:` format) — `db-react.ts`
encrypts on write and decrypts on read, so this fetcher only ever sees
plaintext in memory. `email` and `session_user_agent` are stored as plaintext.

**Known quirks:**
- Cookidoo is behind Cloudflare → the cf-clearance-scraper container is required
- Steps contain HTML tags and the PUA character `U+E003` (counter-rotation icon)
  and must be filtered
- The LLM is **disabled** for Cookidoo — it is unreliable on structured HTML
- `extractEquipment()` selectors only partially match; open issue

## Chefkoch

A dedicated fetcher, wired directly into `pipeline.ts` (not through the web
plugins). `classifyURL` only matches `chefkoch.de/rezepte/…`. Besides
schema.org it has its own selectors (`extractChefkochIngredients`,
`extractChefkochSteps`) and `parseGermanPortions` for "für 4 Portionen".
Test: `test/unit/pipeline-chefkoch.test.ts`.

## Pinterest

**Location:** `src/fetchers/pinterest.ts` (391 lines)

**Purpose:** find the recipe page a pin links to and hand off to `fetchWeb`.
A pin almost never carries the recipe itself.

**Strategy:**
1. DOM selectors (carousel link, `rel=noopener`, `og:see_also`)
2. `__PWS_DATA__` JSON — both the `<script type="application/json">` form
   Pinterest ships today and the older assignment form
3. `"link":"…"` regex over the raw HTML
4. Every candidate must pass `isUsableExternalUrl()` — host denylist
   (`pinterest.*`, `pinimg.com`) plus asset-extension and scheme checks
5. No outbound link → yt-dlp / `og:` metadata; nothing usable → **throw**

**Status:** 0% in practice. Measured 2026-08-07: an anonymous request returns a
~1.08 MB app shell — near-identical between two different pins — with no `og:`
tags and a `__PWS_DATA__` payload containing no pin data; yt-dlp gets a `403`.
There is no anonymous scraping path left to repair.

**Why it throws.** The old guard was `!url.includes("pinterest.")`, which let
`s.pinimg.com` through. Both test pins resolved to an `accessibility-<hash>.mjs`
CDN bundle, and `fetchWeb` then fed 6000 characters of minified JavaScript to
the LLM as recipe text — a successful-looking import producing nonsense. The
guard was duplicated in three places, so fixing only `findOriginalUrl` would
have left the JSON path able to return a CDN asset. Failing honestly is better;
`toUserFriendlyError` maps the error to a hint pointing at the linked article.

`extractImagesFromHtml` deliberately still allows `pinimg.com` — that is the
legitimate image CDN — and only rejects what cannot be an image.

> The global disk credentials (`data/pinterest-credentials.json`,
> `getPinterestCredentials`, `fetchFromPinterestApi`) were removed on
> 2026-08-07. They applied to **every** user: the multi-user hole `a6614e7`
> closed at the route level but not in the fetcher. `/api/v1/pinterest/*` still
> returns `501`.

## Facebook — read this before touching it

The fetcher **exists and is called by `pipeline.ts`**, but:

- `/api/v1/facebook/*` returns **`501`** since 2026-08; the credential routes
  were removed as orphaned code.
- `facebook.ts:12-15,88` still reads cookies from `data/facebook-cookies.txt`,
  a **global** file that applies to every user. It was deliberately left in
  place when Pinterest's equivalent was removed — deleting it would cut the
  only working route before the encrypted per-user path exists.
- The file is gitignored since 2026-08-07. It is a full Facebook session; do
  not commit it and do not copy it around.

`src/middleware/facebook-rate-limit.ts` limits the path to 1 request/minute.
Facebook changes its cookie format regularly, so even with a manual file the
path is brittle — and automated retrieval violates the Facebook ToS, which the
fetcher logs on every call.

Next step is queued in `TODO.md`: encrypted per-user credentials, then this
disk path goes away.

## Adding a New Fetcher

1. `src/fetchers/<source>.ts` with
   `export async function fetch<Source>(url, tempDir?): Promise<ContentBundle>`
2. Reuse the helpers from `web/base.ts` instead of writing new ones
3. Add the regex in `src/classifier.ts` — **order matters**
4. Extend `SourceType` in `src/types.ts`
5. Add the `case` in `pipeline.ts`
6. Add a test under `test/unit/<source>.test.ts`

## External Dependencies

`yt-dlp` must be installed on the host (included in the Docker image).
`ffmpeg` is optional and only relevant for TikTok OCR. Audio transcription runs
against the Groq Whisper API — no local `whisper-cpp`.

`npm run ytdlp:health` (runner: `scripts/ytdlp-health.ts`, logic:
`scripts/ytdlp-health-check.ts`) checks the installed yt-dlp version and probes
one test URL per platform. `ytdlp-health-check.ts` has no top-level side
effects — only constants, pure helpers and an exported `main()` — so it can be
unit-tested without ever shelling out to yt-dlp; the thin runner is what
actually calls `main()`. Platforms are tiered `required` / `advisory` /
`unsupported` (Pinterest is `unsupported` by design) and failures are
classified as `extractor` (actionable, fails the check) vs. `environment`
(IP blocks, login walls, rate limits — logged but not gating). An outdated
yt-dlp has repeatedly been the cause of "import suddenly stopped working";
the check also fails once the installed version is more than 180 days old
(warns past 90). Runs nightly in CI (`ytdlp-health` job, cron 02:00 UTC) or
on demand via `workflow_dispatch`.
