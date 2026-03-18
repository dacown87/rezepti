# Cookidoo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add support for extracting recipes from cookidoo.de via HTTP login and session-cookie caching.

**Architecture:** A new `cookidoo` SourceType is added. A dedicated fetcher handles login (credentials from `.env`), persists the session cookie to `data/cookidoo-session.json`, and returns a standard `ContentBundle` — the rest of the pipeline runs unchanged.

**Tech Stack:** Node.js fetch API, cheerio, fs (cookie persistence), TypeScript

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `"cookidoo"` to `SourceType` union |
| `src/classifier.ts` | Modify | Add cookidoo URL pattern |
| `src/config.ts` | Modify | Add cookidoo credentials from env |
| `.env.example` | Modify | Document new env vars |
| `.gitignore` | Modify | Ignore session cookie file |
| `src/pipeline.ts` | Modify | Add cookidoo case + import |
| `src/fetchers/cookidoo.ts` | Create | Login, session management, scraping |

---

## Task 1: Reverse-Engineer the Cookidoo Login Endpoint

**This is a manual step — no code yet.**

- [ ] **Step 1: Open browser DevTools**

  Open cookidoo.de in Chrome/Firefox. Open DevTools → Network tab. Filter by "Fetch/XHR".

- [ ] **Step 2: Log in and observe the network requests**

  Log in with your Cookidoo account. Look for a POST request with your email/password in the request body.

  Note down:
  - The full endpoint URL (e.g. `https://accounts.cookidoo.de/...`)
  - The request body format (JSON? Form data?)
  - The response: which `Set-Cookie` header(s) appear?
  - The cookie name(s) that are sent on subsequent recipe page requests

- [ ] **Step 3: Test cookie access to a recipe page**

  In DevTools, find a recipe request and note which cookie header it sends. Confirm which cookie name grants access to protected content.

- [ ] **Step 4: Write down the findings**

  You need these exact values to fill in Task 5:
  - Login URL
  - Request body fields
  - Session cookie name(s)

---

## Task 2: Add `"cookidoo"` to Types and Classifier

**Files:**
- Modify: `src/types.ts:5`
- Modify: `src/classifier.ts:3-7`

- [ ] **Step 1: Extend SourceType in `src/types.ts`**

  Change line 5 from:
  ```typescript
  export type SourceType = "youtube" | "instagram" | "tiktok" | "web";
  ```
  To:
  ```typescript
  export type SourceType = "youtube" | "instagram" | "tiktok" | "cookidoo" | "web";
  ```

- [ ] **Step 2: Add classifier pattern in `src/classifier.ts`**

  Add `"cookidoo"` entry to the `patterns` array before `tiktok` (or after — order only matters if URLs could match multiple patterns, which they won't here):
  ```typescript
  const patterns: [SourceType, RegExp][] = [
    ["youtube", /(?:youtube\.com|youtu\.be)\//i],
    ["instagram", /instagram\.com\//i],
    ["tiktok", /tiktok\.com\//i],
    ["cookidoo", /cookidoo\.de\//i],
  ];
  ```

- [ ] **Step 3: Type-check**

  ```bash
  cd /home/patrick/Projekte/rezepti && npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/types.ts src/classifier.ts
  git commit -m "feat: add cookidoo as classified source type"
  ```

---

## Task 3: Add Configuration and Update `.env.example`

**Files:**
- Modify: `src/config.ts`
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add cookidoo section to `src/config.ts`**

  Insert the `cookidoo` block before `port`:
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

- [ ] **Step 2: Document in `.env.example`**

  Append to the file:
  ```
  # Cookidoo (cookidoo.de)
  COOKIDOO_EMAIL=deine@email.de
  COOKIDOO_PASSWORD=deinPasswort
  ```

- [ ] **Step 3: Add session file to `.gitignore`**

  Add this line to `.gitignore`:
  ```
  data/cookidoo-session.json
  ```

- [ ] **Step 4: Add credentials to your local `.env`**

  Add your actual credentials to `.env` (not `.env.example`).

- [ ] **Step 5: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/config.ts .env.example .gitignore
  git commit -m "feat: add cookidoo credentials to config"
  ```

---

## Task 4: Create the Cookidoo Fetcher

**Files:**
- Create: `src/fetchers/cookidoo.ts`

This task depends on Task 1 (you need the login endpoint). Fill in the placeholders marked with `// TODO` based on your DevTools findings.

- [ ] **Step 1: Create `src/fetchers/cookidoo.ts`**

  ```typescript
  import * as cheerio from "cheerio";
  import { readFileSync, writeFileSync, existsSync } from "node:fs";
  import { join } from "node:path";
  import { config } from "../config.js";
  import type { ContentBundle, SchemaOrgRecipe } from "../types.js";

  // TODO: Fill in from Task 1 reverse-engineering
  const LOGIN_URL = "https://...";          // e.g. "https://accounts.cookidoo.de/login"
  const COOKIE_NAME = "...";               // e.g. "session" or "access_token"

  const SESSION_FILE = join(process.cwd(), "data", "cookidoo-session.json");

  // Module-level session cache
  let cachedCookie: string | null = loadSessionFromDisk();

  function loadSessionFromDisk(): string | null {
    if (!existsSync(SESSION_FILE)) return null;
    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
      return data.cookie ?? null;
    } catch {
      return null;
    }
  }

  function saveSessionToDisk(cookie: string): void {
    writeFileSync(SESSION_FILE, JSON.stringify({ cookie }), "utf-8");
  }

  function clearSession(): void {
    cachedCookie = null;
    try { writeFileSync(SESSION_FILE, JSON.stringify({ cookie: null }), "utf-8"); } catch { /* ignore */ }
  }

  async function login(): Promise<string> {
    const { email, password } = config.cookidoo;
    if (!email || !password) {
      throw new Error("Cookidoo-Zugangsdaten fehlen. Bitte COOKIDOO_EMAIL und COOKIDOO_PASSWORD in .env setzen.");
    }

    // TODO: Adjust body format based on Task 1 findings (JSON or form-data)
    const response = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Cookidoo-Login fehlgeschlagen: HTTP ${response.status}`);
    }

    // TODO: Adjust cookie extraction based on Task 1 findings
    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (!match) {
      throw new Error("Cookidoo-Login: Kein Session-Cookie in der Antwort gefunden.");
    }

    const cookie = `${COOKIE_NAME}=${match[1]}`;
    cachedCookie = cookie;
    saveSessionToDisk(cookie);
    return cookie;
  }

  async function getSession(): Promise<string> {
    if (!cachedCookie) {
      cachedCookie = await login();
    }
    return cachedCookie;
  }

  function extractJsonLd($: cheerio.CheerioAPI): SchemaOrgRecipe | null {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      try {
        const raw = $(scripts[i]).html();
        if (!raw) continue;
        const json = JSON.parse(raw);
        const obj = Array.isArray(json) ? json : [json];
        for (const item of obj) {
          if (item?.["@type"] === "Recipe") return item as SchemaOrgRecipe;
        }
      } catch { /* skip invalid JSON-LD */ }
    }
    return null;
  }

  function extractFallbackText($: cheerio.CheerioAPI): string {
    // TODO: Adjust selectors based on actual Cookidoo DOM structure
    const selectors = [".recipe-card", ".recipe-detail", "main", "article"];
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 100) {
        return el.text().trim().slice(0, 10000);
      }
    }
    return $("body").text().trim().slice(0, 10000);
  }

  async function fetchWithSession(url: string, retry = true): Promise<Response> {
    const cookie = await getSession();
    const response = await fetch(url, {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if ((response.status === 401 || response.status === 403) && retry) {
      clearSession();
      cachedCookie = await login();
      return fetchWithSession(url, false);
    }

    return response;
  }

  export async function fetchCookidoo(url: string): Promise<ContentBundle> {
    const response = await fetchWithSession(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} beim Abrufen von ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const schemaRecipe = extractJsonLd($);
    const title = $("title").text().trim() || $("h1").first().text().trim();
    const description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "";

    const imageUrls: string[] = [];
    $("img[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      try { imageUrls.push(new URL(src, url).href); } catch { /* skip */ }
    });

    return {
      url,
      type: "cookidoo",
      title,
      description,
      textContent: schemaRecipe ? undefined : extractFallbackText($),
      imageUrls: [...new Set(imageUrls)].slice(0, 5),
      schemaRecipe,
    };
  }
  ```

- [ ] **Step 2: Fill in the TODOs**

  Replace the placeholder values for `LOGIN_URL` and `COOKIE_NAME` with what you found in Task 1.

  If the login body format is not JSON but form-data, change:
  ```typescript
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
  ```
  to:
  ```typescript
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ email, password }).toString(),
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/fetchers/cookidoo.ts
  git commit -m "feat: add Cookidoo fetcher with session-cookie auth"
  ```

---

## Task 5: Wire into the Pipeline

**Files:**
- Modify: `src/pipeline.ts`

- [ ] **Step 1: Add import at the top of `src/pipeline.ts`**

  After the existing fetcher imports (around line 5), add:
  ```typescript
  import { fetchCookidoo } from "./fetchers/cookidoo.js";
  ```

- [ ] **Step 2: Add case to the switch (before `case "web":` on line 60)**

  ```typescript
  case "cookidoo":
    bundle = await fetchCookidoo(classified.url);
    break;
  case "web":
  default:
    bundle = await fetchWeb(classified.url);
    break;
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/pipeline.ts
  git commit -m "feat: wire Cookidoo fetcher into pipeline"
  ```

---

## Task 6: Manual End-to-End Test

No automated test suite exists in this project — test manually.

- [ ] **Step 1: Start the server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Open the UI in the browser**

  Navigate to `http://localhost:3000`. Paste a Cookidoo recipe URL (e.g. `https://cookidoo.de/recipes/recipe/de-DE/r123456`).

- [ ] **Step 3: Verify SSE events stream correctly**

  Expected sequence in the UI:
  - "URL wird analysiert..." → `Erkannt als: cookidoo`
  - "Inhalte werden abgerufen (cookidoo)..."
  - "Schema.org-Rezept gefunden..." or "Rezept wird aus Text extrahiert..."
  - Recipe appears in the result panel

- [ ] **Step 4: Verify cookie file was created**

  ```bash
  cat data/cookidoo-session.json
  ```
  Expected: `{"cookie":"<name>=<value>"}` — the session is persisted.

- [ ] **Step 5: Restart server and test again**

  Stop and restart `npm run dev`, then extract another recipe. Confirm no login step occurs (session reused from disk).

- [ ] **Step 6: Verify recipe appears in "Meine Rezepte"**

  Scroll down on the UI to the recipe library and confirm the new recipe is listed.

- [ ] **Step 7: Commit any fixes found during testing**

  ```bash
  git add -p
  git commit -m "fix: <describe what was adjusted>"
  ```
