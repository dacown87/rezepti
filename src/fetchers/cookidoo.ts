import * as cheerio from "cheerio";
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  clearCookidooScopedSession,
  resolveCookidooCredentials,
  updateCookidooScopedSession,
  type CookidooAuthContext,
  type CookidooResolvedCredential,
} from "../db-react.js";
import type { ContentBundle, SchemaOrgRecipe } from "../types.js";

// CF Clearance Scraper service (Docker, port 3001)
const CF_SCRAPER_URL = process.env.CF_SCRAPER_URL || "http://localhost:3001";
const CF_SESSION_TTL_MS = 25 * 60 * 1000;  // cf_clearance lasts ~30 min
const WEB_SESSION_TTL_MS = 55 * 60 * 1000; // session cookies ~1 h

interface WebSession {
  cookiesCookidoo: string; // Cookie header for cookidoo.de
  userAgent: string;
  expires_at: number;
}

interface CFResult {
  cookies: string; // Cookie header string
  userAgent: string;
  expires_at: number;
}

let cachedCF: CFResult | null = null;
const cachedSessions = new Map<string, WebSession>();
const LEGACY_SESSION_FILE = join(process.cwd(), "data", "cookidoo-session.json");
const LEGACY_CREDENTIALS_FILE = join(process.cwd(), "data", "cookidoo-credentials.json");

function scopeCacheKey(scope: Pick<CookidooResolvedCredential, "scopeType" | "userId" | "householdId">) {
  return scope.scopeType === "user" ? `user:${scope.userId}` : `household:${scope.householdId}`;
}

export function removeLegacyCookidooFiles(): void {
  for (const file of [LEGACY_SESSION_FILE, LEGACY_CREDENTIALS_FILE]) {
    if (!existsSync(file)) continue;
    try {
      unlinkSync(file);
    } catch {
      // best effort cleanup for deprecated singleton state
    }
  }
}

// ─── CF Clearance ──────────────────────────────────────────────────────────

async function getCFResult(): Promise<CFResult> {
  if (cachedCF && Date.now() < cachedCF.expires_at) return cachedCF;

  const res = await fetch(`${CF_SCRAPER_URL}/cf-clearance-scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://cookidoo.de/foundation/de-DE/explore", mode: "waf-session" }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new Error(`CF scraper error: HTTP ${res.status}`);

  const data = (await res.json()) as {
    code: number;
    headers: Record<string, string>;
    cookies: Array<{ name: string; value: string }>;
  };

  if (data.code !== 200) throw new Error(`CF scraper returned code ${data.code}`);

  const cookieStr = data.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const userAgent = data.headers?.["user-agent"] ?? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  cachedCF = { cookies: cookieStr, userAgent, expires_at: Date.now() + CF_SESSION_TTL_MS };
  return cachedCF;
}

// ─── Cookie helpers ────────────────────────────────────────────────────────

function parseSetCookies(headers: Headers): Map<string, string> {
  const jar = new Map<string, string>();
  const raw = headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const nameVal = line.split(";")[0].trim();
    const eq = nameVal.indexOf("=");
    if (eq > 0) jar.set(nameVal.slice(0, eq), nameVal.slice(eq + 1));
  }
  return jar;
}

function jarToHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ─── Manual redirect follower ──────────────────────────────────────────────

async function fetchManual(
  url: string,
  options: RequestInit,
  jar: Map<string, string>,
  maxRedirects = 8
): Promise<{ response: Response; finalUrl: string }> {
  let current = url;

  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(current, {
      ...options,
      headers: {
        ...(options.headers as Record<string, string>),
        Cookie: jarToHeader(jar),
      },
      redirect: "manual",
    });

    // Merge Set-Cookie
    const newCookies = parseSetCookies(res.headers);
    for (const [k, v] of newCookies) jar.set(k, v);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      current = new URL(location, current).href;
      // Switch to GET after redirect (standard browser behaviour)
      options = { headers: options.headers };
      continue;
    }

    return { response: res, finalUrl: current };
  }

  throw new Error("Cookidoo login: zu viele Redirects");
}

// ─── Web Login Flow ────────────────────────────────────────────────────────

async function doWebLogin(credentials: CookidooResolvedCredential): Promise<WebSession> {
  const cf = await getCFResult();
  const baseHeaders = {
    "User-Agent": cf.userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9",
    "sec-ch-ua": '"Chromium";v="120", "Not-A.Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "upgrade-insecure-requests": "1",
  };

  // Single jar for the full flow — cookies from all domains accumulate here
  const jar = new Map<string, string>();

  // Seed with CF clearance cookies
  for (const part of cf.cookies.split("; ")) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }

  // Step 1: GET cookidoo.de/profile/de-DE/login → redirects to eu.login.vorwerk.com
  const { finalUrl: vorwerkLoginUrl } = await fetchManual(
    "https://cookidoo.de/profile/de-DE/login?redirectAfterLogin=%2F",
    { method: "GET", headers: baseHeaders },
    jar
  );

  // Extract requestId
  const requestId = new URL(vorwerkLoginUrl).searchParams.get("requestId");
  if (!requestId) throw new Error("Cookidoo login: requestId nicht gefunden");

  // Step 2: GET the vorwerk login page to collect its cookies (cidaas_dr etc.)
  await fetchManual(
    vorwerkLoginUrl,
    { method: "GET", headers: { ...baseHeaders, Referer: "https://cookidoo.de/" } },
    jar
  );

  // Step 3: POST credentials → CIAM redirects to cookidoo.de/oauth2/callback
  // Form action is https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login
  const postBody = new URLSearchParams({
    requestId,
    username: credentials.email,
    password: credentials.password,
  }).toString();

  await fetchManual(
    "https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login",
    {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://eu.login.vorwerk.com",
        "Referer": vorwerkLoginUrl,
        "sec-fetch-site": "cross-site",
      },
      body: postBody,
    },
    jar
  );

  if (!jar.has("v-authenticated")) {
    throw new Error("Cookidoo login: keine Session-Cookies erhalten — Login fehlgeschlagen");
  }

  const session: WebSession = {
    cookiesCookidoo: jarToHeader(jar),
    userAgent: cf.userAgent,
    expires_at: Date.now() + WEB_SESSION_TTL_MS,
  };

  cachedSessions.set(scopeCacheKey(credentials), session);
  await updateCookidooScopedSession(credentials, {
    sessionCookies: session.cookiesCookidoo,
    sessionUserAgent: session.userAgent,
    sessionExpiresAt: new Date(session.expires_at),
  });
  return session;
}

async function getWebSession(credentials: CookidooResolvedCredential): Promise<WebSession> {
  const cacheKey = scopeCacheKey(credentials);
  const cachedSession = cachedSessions.get(cacheKey);
  if (cachedSession && Date.now() < cachedSession.expires_at) return cachedSession;

  if (
    credentials.sessionCookies &&
    credentials.sessionUserAgent &&
    credentials.sessionExpiresAt &&
    Date.now() < credentials.sessionExpiresAt.getTime()
  ) {
    const restoredSession: WebSession = {
      cookiesCookidoo: credentials.sessionCookies,
      userAgent: credentials.sessionUserAgent,
      expires_at: credentials.sessionExpiresAt.getTime(),
    };
    cachedSessions.set(cacheKey, restoredSession);
    return restoredSession;
  }

  // Login with one automatic retry (CF scraper may need time to warm up on first call)
  try {
    return await doWebLogin(credentials);
  } catch (firstErr) {
    console.warn("Cookidoo login attempt 1 failed, retrying in 4s:", (firstErr as Error).message);
    await new Promise(r => setTimeout(r, 4000));
    return doWebLogin(credentials);
  }
}

async function clearSession(credentials: CookidooResolvedCredential): Promise<void> {
  cachedSessions.delete(scopeCacheKey(credentials));
  cachedCF = null;
  await clearCookidooScopedSession(credentials);
}

// ─── Authenticated fetch ───────────────────────────────────────────────────

async function fetchAuthenticated(url: string, credentials: CookidooResolvedCredential, retry = true): Promise<Response> {
  const session = await getWebSession(credentials);
  const cf = await getCFResult();

  // Merge session cookies with fresh CF cookies (cf_clearance may rotate)
  const mergedCookies = [session.cookiesCookidoo, cf.cookies]
    .filter(Boolean)
    .join("; ");

  const response = await fetch(url, {
    headers: {
      "User-Agent": session.userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9",
      "Cookie": mergedCookies,
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
    },
    redirect: "follow",
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    await clearSession(credentials);
    return fetchAuthenticated(url, credentials, false);
  }

  return response;
}

// ─── HTML entity decoding ──────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "&frac12;": "½", "&frac14;": "¼", "&frac34;": "¾",
  "&frac13;": "⅓", "&frac23;": "⅔", "&frac15;": "⅕", "&frac25;": "⅖",
  "&frac35;": "⅗", "&frac45;": "⅘", "&frac16;": "⅙", "&frac56;": "⅚",
  "&frac18;": "⅛", "&frac38;": "⅜", "&frac58;": "⅝", "&frac78;": "⅞",
  "&amp;": "&", "&nbsp;": " ", "&lt;": "<", "&gt;": ">",
};

function decodeHtmlEntities(s: string): string {
  return s.replace(/&[a-zA-Z0-9#]+;/g, m => HTML_ENTITIES[m] ?? m);
}

// ─── Cheerio helpers ───────────────────────────────────────────────────────

function extractJsonLdRecipes($: cheerio.CheerioAPI): SchemaOrgRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const json = JSON.parse(raw);
      const found = findRecipeInJsonLd(json);
      if (found) return found;
    } catch { /* skip */ }
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

/** Build map: ingredient name (lowercase) → preparation description */
function extractDescriptions($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $("recipe-ingredient").each((_, el) => {
    const name = $(el).find(".recipe-ingredient__name").text().trim();
    const desc = $(el).find(".recipe-ingredient__description").text().trim();
    if (name && desc) map.set(name.toLowerCase(), desc);
  });
  return map;
}

/** Build map: ingredient name (lowercase) → alternative text */
function extractAlternatives($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $("recipe-ingredient").each((_, el) => {
    const name = $(el).find(".recipe-ingredient__name").text().trim();
    const alt  = $(el).find(".recipe-ingredient__alternative").text().replace(/\s+/g, " ").trim();
    if (name && alt) map.set(name.toLowerCase(), alt);
  });
  return map;
}

/** Patch a SchemaOrgRecipe's ingredients: decode HTML entities + append alternatives and descriptions.
 *
 * Format: "main ingredient (oder: alternative)\npreparation description"
 * - (oder: ...) on the main line → renderer shows ↺ sub-line
 * - \n separator      → renderer shows gray description sub-line
 */
function patchIngredients(
  recipe: SchemaOrgRecipe,
  alternatives: Map<string, string>,
  descriptions: Map<string, string>,
): SchemaOrgRecipe {
  if (!recipe.recipeIngredient?.length) return recipe;
  const patched = recipe.recipeIngredient.map(raw => {
    const decoded = decodeHtmlEntities(raw);
    const lc = decoded.toLowerCase();

    // Find alternative (searched against clean ingredient string)
    let altText: string | null = null;
    if (alternatives.size > 0) {
      for (const [name, alt] of alternatives) {
        if (lc.includes(name)) { altText = alt; break; }
      }
    }

    // Find preparation description (searched against clean ingredient string)
    let descText: string | null = null;
    if (descriptions.size > 0) {
      for (const [name, desc] of descriptions) {
        if (lc.includes(name)) { descText = desc; break; }
      }
    }

    // Build: "main (oder: alt)\ndesc"
    let result = altText ? `${decoded} (oder: ${altText})` : decoded;
    if (descText) result += `\n${descText}`;
    return result;
  });
  return { ...recipe, recipeIngredient: patched };
}

function extractMainText($: cheerio.CheerioAPI): string {
  $("script, style, nav, footer, header, aside, .ad, .ads, .sidebar").remove();
  const selectors = [".recipe-card", ".recipe-detail", ".recipe-content", ".recipe", "#recipe", "main", "article"];
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) return el.text().trim().slice(0, 10000);
  }
  return $("body").text().trim().slice(0, 10000);
}

// Known Thermomix accessories to detect in page text
const KNOWN_ACCESSORIES = [
  "Varoma", "Schmetterling", "Garkorb", "Rühraufsatz",
  "Messbecher", "Spatel", "Mixtopf", "Deckel",
];

function extractEquipment($: cheerio.CheerioAPI): string[] {
  const items = new Set<string>();

  // 1. Cookidoo uses <rdp-badges> with core-chip-button elements for inline equipment chips
  //    (TM versions like "TM7" + accessories like "Varoma" appear here on authenticated pages)
  $('rdp-badges .core-chip-button, rdp-badges button').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 60) items.add(text);
  });

  // NOTE: Step 2 (`.rdp-tm-versions__name`) removed — it duplicates rdp-badges chips
  //       (rdp-badges gives "TM7", rdp-tm-versions__name gives "Thermomix® TM7" → same device)

  // 2. "Notwendiges Zubehör" — actual accessories as bullet list (separate section on auth pages)
  $('h2, h3, h4, span, p').each((_, el) => {
    const heading = $(el).text().trim().toLowerCase();
    if (heading === 'notwendiges zubehör') {
      // Only look at the immediately following sibling list — avoids pulling in Nährwerte etc.
      $(el).nextAll('ul, ol, div').first().find('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t && t.length < 80) items.add(t);
      });
    }
  });

  // 3. "Geräte und Zubehör" modal — device names (TM7, TM6, TM5, Backofen etc.)
  //    Walk UP to modal container to reach the content section (it's a sibling of the header)
  //    NOTE: `.rdp-tm-versions__name` intentionally excluded here — already covered by rdp-badges
  $('h2, h3, h4').each((_, el) => {
    const heading = $(el).text().trim().toLowerCase();
    if (
      heading === 'utensilien' || heading === 'zubehör' ||
      heading === 'geräte & zubehör' || heading === 'geräte und zubehör'
    ) {
      const container = $(el).closest('[class*="modal__container"], [class*="modal__wrapper"]');
      const target = container.length ? container : $(el).parent().parent();
      target.find('.core-chip-button, li').each((_, child) => {
        const t = $(child).text().trim();
        if (t && t.length < 60 && t.toLowerCase() !== heading) items.add(t);
      });
    }
  });

  // 4. Fallback: scan full page text for known Thermomix accessories
  if (items.size === 0) {
    const bodyText = $("body").text();
    for (const acc of KNOWN_ACCESSORIES) {
      if (bodyText.includes(acc)) items.add(acc);
    }
  }

  return [...items].filter(s => s.length > 0 && s.length < 80);
}

function extractIngredientGroups($: cheerio.CheerioAPI): { heading: string; items: string[] }[] | undefined {
  const groups: { heading: string; items: string[] }[] = [];

  // Cookidoo authenticated pages use rdp-ingredient-group components with a title
  $("rdp-ingredient-group, recipe-ingredient-group").each((_, groupEl) => {
    const heading = $(groupEl).find(".rdp-ingredient-group__title, .recipe-ingredient-group__title").first().text().trim();
    const items: string[] = [];
    $(groupEl).find("recipe-ingredient").each((_, ingEl) => {
      const text = $(ingEl).text().replace(/\s+/g, " ").trim();
      if (text) items.push(text);
    });
    if (items.length > 0) groups.push({ heading: heading || `Gruppe ${groups.length + 1}`, items });
  });

  return groups.length >= 2 ? groups : undefined;
}

/** Extract nutrition values from HTML that are missing from JSON-LD (e.g. Ballaststoffe / fiber) */
function extractNutritionFromHtml($: cheerio.CheerioAPI): Record<string, string> {
  const extra: Record<string, string> = {};
  $(".rdp-nutritious__item").each((_, el) => {
    const name  = $(el).find(".rdp-nutritious__name").text().trim().toLowerCase();
    const value = $(el).find(".rdp-nutritious__value").text().trim();
    if (!name || !value) return;
    if (name === "ballaststoffe") extra["fiberContent"] = value;
  });
  return extra;
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try { images.push(new URL(src, baseUrl).href); } catch { /* skip */ }
  });
  return [...new Set(images)].slice(0, 5);
}

// ─── Main export ───────────────────────────────────────────────────────────

export async function fetchCookidoo(url: string, auth?: CookidooAuthContext): Promise<ContentBundle> {
  removeLegacyCookidooFiles();
  const resolvedCredentials = auth ? await resolveCookidooCredentials(auth) : null;
  const scraperReachable = !!resolvedCredentials && await fetch(`${CF_SCRAPER_URL}/health`, { signal: AbortSignal.timeout(2000) })
    .then(() => true).catch(() => false);

  let html: string;

  if (scraperReachable) {
    // Authenticated path: get real recipe steps
    const response = await fetchAuthenticated(url, resolvedCredentials!);
    if (!response.ok) throw new Error(`HTTP ${response.status} beim Abrufen von ${url}`);
    html = await response.text();
  } else {
    // Unauthenticated fallback: schema.org data only (no steps)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} beim Abrufen von ${url}`);
    html = await response.text();
  }

  // Debug: set COOKIDOO_DEBUG_HTML=1 to save raw HTML for selector inspection
  if (process.env.COOKIDOO_DEBUG_HTML) {
    const debugPath = join(process.cwd(), "data", `cookidoo-debug-${Date.now()}.html`);
    mkdirSync(dirname(debugPath), { recursive: true });
    writeFileSync(debugPath, html, "utf-8");
    console.log(`[cookidoo] debug HTML saved to ${debugPath}`);
  }

  const $ = cheerio.load(html);
  const alternatives = extractAlternatives($);
  const descriptions = extractDescriptions($);
  const rawSchema = extractJsonLdRecipes($);
  const htmlNutrition = extractNutritionFromHtml($);
  let patched = rawSchema ? patchIngredients(rawSchema, alternatives, descriptions) : null;
  if (patched && Object.keys(htmlNutrition).length > 0) {
    patched = { ...patched, nutrition: { ...(patched.nutrition ?? {}), ...htmlNutrition } as SchemaOrgRecipe["nutrition"] };
  }
  const schemaRecipe = patched;
  const title = $("title").text().trim() || $("h1").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";
  const equipment = extractEquipment($);
  const ingredientGroups = extractIngredientGroups($);

  return {
    url,
    type: "cookidoo",
    title,
    description,
    textContent: extractMainText($),
    imageUrls: extractImages($, url),
    schemaRecipe,
    equipment: equipment.length > 0 ? equipment : undefined,
    ingredientGroups,
  };
}
