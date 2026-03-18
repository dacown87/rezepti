import * as cheerio from "cheerio";
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { config } from "../config.js";
import type { ContentBundle, SchemaOrgRecipe } from "../types.js";

// OAuth endpoint for Vorwerk/Cookidoo
const AUTH_URL = "https://eu.tmmobile.vorwerk-digital.com/ciam/auth/token";
// Basic auth header reverse-engineered from Vorwerk mobile app
const BASIC_AUTH =
  "Basic a3VwZmVyd2Vyay1jbGllbnQtbndvdDpMczUwT04xd295U3FzMWRDZEpnZQ==";

const SESSION_FILE = join(process.cwd(), "data", "cookidoo-session.json");

// 60-second buffer before token expiry
const EXPIRY_BUFFER_MS = 60_000;

interface SessionData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Module-level session cache
let cachedSession: SessionData | null = null;

// --- Session persistence ---

function loadSessionFromDisk(): SessionData | null {
  if (!existsSync(SESSION_FILE)) return null;
  try {
    const raw = readFileSync(SESSION_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "access_token" in parsed &&
      "refresh_token" in parsed &&
      "expires_at" in parsed &&
      typeof (parsed as SessionData).access_token === "string" &&
      typeof (parsed as SessionData).refresh_token === "string" &&
      typeof (parsed as SessionData).expires_at === "number"
    ) {
      return parsed as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSessionToDisk(data: SessionData): void {
  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function clearSession(): void {
  cachedSession = null;
  if (existsSync(SESSION_FILE)) {
    try {
      unlinkSync(SESSION_FILE);
    } catch {
      // best effort
    }
  }
}

function isTokenExpired(session: SessionData): boolean {
  return Date.now() + EXPIRY_BUFFER_MS >= session.expires_at;
}

// --- OAuth login and refresh ---

async function doLogin(): Promise<SessionData> {
  if (!config.cookidoo.email || !config.cookidoo.password) {
    throw new Error(
      "Cookidoo credentials missing: set COOKIDOO_EMAIL and COOKIDOO_PASSWORD"
    );
  }

  const body = new URLSearchParams({
    grant_type: "password",
    username: config.cookidoo.email,
    password: config.cookidoo.password,
  });

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: BASIC_AUTH,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(
      `Cookidoo login failed: ${json.error ?? response.status} — ${json.error_description ?? ""}`
    );
  }

  const session: SessionData = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? "",
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };

  cachedSession = session;
  saveSessionToDisk(session);
  return session;
}

async function doRefresh(refreshToken: string): Promise<SessionData> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      Authorization: BASIC_AUTH,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(`Cookidoo token refresh failed: ${json.error ?? response.status}`);
  }

  const session: SessionData = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };

  cachedSession = session;
  saveSessionToDisk(session);
  return session;
}

async function getValidToken(): Promise<string> {
  // 1. Use cached session if valid
  if (cachedSession && !isTokenExpired(cachedSession)) {
    return cachedSession.access_token;
  }

  // 2. Try loading from disk
  if (!cachedSession) {
    const disk = loadSessionFromDisk();
    if (disk) {
      cachedSession = disk;
    }
  }

  // 3. Refresh if we have a refresh token and the token is expired
  if (cachedSession && cachedSession.refresh_token) {
    if (!isTokenExpired(cachedSession)) {
      return cachedSession.access_token;
    }
    try {
      const refreshed = await doRefresh(cachedSession.refresh_token);
      return refreshed.access_token;
    } catch {
      // Refresh failed — fall through to full login
    }
  }

  // 4. Full login
  const session = await doLogin();
  return session.access_token;
}

// --- Authenticated fetch with 401/403 retry ---

async function fetchWithAuth(url: string, retry = true): Promise<Response> {
  const token = await getValidToken();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    clearSession();
    return fetchWithAuth(url, false);
  }

  return response;
}

// --- Cheerio helpers (following web.ts patterns) ---

function extractJsonLdRecipes($: cheerio.CheerioAPI): SchemaOrgRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const json = JSON.parse(raw);
      const found = findRecipeInJsonLd(json);
      if (found) return found;
    } catch {
      // skip invalid JSON-LD
    }
  }
  return null;
}

function findRecipeInJsonLd(data: unknown): SchemaOrgRecipe | null {
  if (!data || typeof data !== "object") return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
    return obj as unknown as SchemaOrgRecipe;
  }

  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"]);
  }

  return null;
}

function extractMainText($: cheerio.CheerioAPI): string {
  $("script, style, nav, footer, header, aside, .ad, .ads, .sidebar").remove();

  // Cookidoo-specific selectors first (most precise), then generic fallbacks
  const selectors = [
    ".recipe-card",
    ".recipe-detail",
    ".recipe-content",
    ".recipe",
    "#recipe",
    "main",
    "article",
    ".post-content",
    ".entry-content",
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      return el.text().trim().slice(0, 10000);
    }
  }

  return $("body").text().trim().slice(0, 10000);
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try {
      const absoluteUrl = new URL(src, baseUrl).href;
      images.push(absoluteUrl);
    } catch {
      // skip invalid URLs
    }
  });
  return [...new Set(images)].slice(0, 5);
}

// --- Main export ---

export async function fetchCookidoo(url: string): Promise<ContentBundle> {
  const response = await fetchWithAuth(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} beim Abrufen von ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const schemaRecipe = extractJsonLdRecipes($);
  const title = $("title").text().trim() || $("h1").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  return {
    url,
    type: "cookidoo",
    title,
    description,
    textContent: extractMainText($),
    imageUrls: extractImages($, url),
    schemaRecipe,
  };
}
