import * as cheerio from "cheerio";
import type { SchemaOrgRecipe } from "../../types.js";

// ─── Plugin Interface ──────────────────────────────────────────────────────────

export interface WebScraperPlugin {
  /** Matched against hostname with www. stripped, e.g. "chefkoch.de" */
  hostname: string;
  /** Override the generic text-extraction logic for this domain */
  extractMainText?($: cheerio.CheerioAPI): string | null;
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

export function extractJsonLdRecipes($: cheerio.CheerioAPI): SchemaOrgRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const found = findRecipeInJsonLd(JSON.parse(raw));
      if (found) return found;
    } catch {
      // skip invalid JSON-LD
    }
  }
  return null;
}

export function findRecipeInJsonLd(data: unknown): SchemaOrgRecipe | null {
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

// ─── Microdata ────────────────────────────────────────────────────────────────

export function extractMicrodataRecipe($: cheerio.CheerioAPI): SchemaOrgRecipe | null {
  const recipeEl = $('[itemtype*="schema.org/Recipe"], [itemtype*="/Recipe"]').first();
  if (!recipeEl.length) return null;

  function getProp(prop: string): string {
    const el = recipeEl.find(`[itemprop="${prop}"]`).first();
    if (!el.length) return "";
    return el.attr("content") || el.attr("datetime") || el.attr("href") || el.text().trim();
  }

  function getProps(prop: string): string[] {
    return recipeEl
      .find(`[itemprop="${prop}"]`)
      .toArray()
      .filter((el) => !$(el).attr("itemscope"))
      .map((el) => {
        const $el = $(el);
        return $el.attr("content") || $el.attr("href") || $el.attr("src") || $el.text().trim();
      })
      .filter(Boolean);
  }

  const name = getProp("name");
  if (!name) return null;

  const instructions: string[] = [];
  recipeEl.find('[itemprop="recipeInstructions"]').each((_, el) => {
    const $el = $(el);
    const nestedText = $el.find('[itemprop="text"]').first();
    if (nestedText.length) {
      const t = nestedText.attr("content") || nestedText.text().trim();
      if (t) instructions.push(t);
    } else {
      const t = $el.attr("content") || $el.text().trim();
      if (t) instructions.push(t);
    }
  });

  const imageEl = recipeEl.find('[itemprop="image"]').first();
  const image = imageEl.attr("src") || imageEl.attr("content") || imageEl.attr("href");

  const recipe: SchemaOrgRecipe = {
    name,
    description: getProp("description") || undefined,
    image: image || undefined,
    recipeIngredient: getProps("recipeIngredient"),
    recipeInstructions: instructions.length ? instructions : undefined,
    totalTime: getProp("totalTime") || undefined,
    prepTime: getProp("prepTime") || undefined,
    cookTime: getProp("cookTime") || undefined,
    recipeYield: getProp("recipeYield") || undefined,
    recipeCategory: getProp("recipeCategory") || undefined,
    recipeCuisine: getProp("recipeCuisine") || undefined,
  };

  if (!recipe.recipeIngredient?.length && !recipe.recipeInstructions?.length) return null;
  return recipe;
}

// ─── Wild JSON-LD ─────────────────────────────────────────────────────────────

export function deepFindRecipe(data: unknown): SchemaOrgRecipe | null {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = deepFindRecipe(item);
      if (found) return found;
    }
    return null;
  }
  const obj = data as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
    return obj as unknown as SchemaOrgRecipe;
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object") {
      const found = deepFindRecipe(val);
      if (found) return found;
    }
  }
  return null;
}

export function extractWildJsonLd(html: string): SchemaOrgRecipe | null {
  const slice = html.slice(0, 100_000);
  const scriptRe = /<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(slice)) !== null) {
    const content = match[1];
    if (!content) continue;
    if (!content.includes("Recipe") && !content.includes("recipeIngredient")) continue;

    const inlinePatterns = [
      /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*)/,
      /window\.__NUXT__\s*=\s*(\{[\s\S]*)/,
      /window\.__STATE__\s*=\s*(\{[\s\S]*)/,
    ];
    for (const pat of inlinePatterns) {
      const m = pat.exec(content);
      if (!m) continue;
      try {
        const found = deepFindRecipe(JSON.parse(m[1].replace(/;\s*$/, "").trim()));
        if (found) return found;
      } catch { /* not valid JSON */ }
    }

    try {
      const found = deepFindRecipe(JSON.parse(content.trim()));
      if (found) return found;
    } catch { /* not valid JSON */ }
  }

  return null;
}

// ─── Text & Images ────────────────────────────────────────────────────────────

const TEXT_SELECTORS = [
  ".wprm-recipe-container",
  ".tasty-recipe",
  ".mv-create-card",
  ".mv-recipe-card",
  ".recipe-card-full-width",
  ".recipe-card-container",
  ".simple-recipe-pro",
  '[itemtype*="schema.org/Recipe"]',
  '[itemtype*="Recipe"]',
  ".o-AssetRecipe",
  ".recipe-detail-container",
  ".recipe-page",
  ".recipe-page-content",
  ".recipe-body",
  ".recipe-frame",
  ".recipe-box",
  ".recipe-wrapper",
  ".recipe__body",
  ".recipe__container",
  ".recipe-main",
  ".hrecipe",
  ".recipe",
  ".recipe-content",
  ".recipe-card",
  "#recipe",
  "[class*='recipe-card']",
  "[class*='recipe-block']",
  "[class*='recipe-container']",
  ".ingredients-instructions",
  ".ingredients-and-instructions",
  ".recipe-directions",
  ".recipe-method",
  "article",
  "main",
  ".post-content",
  ".entry-content",
];

const NOISE_SELECTOR =
  "script, style, nav, footer, header, aside, " +
  ".ad, .ads, .sidebar, " +
  ".advertisement, [class*='ad-'], [id*='ad-'], " +
  ".related, .related-posts, " +
  "[class*='comment'], .comments, #comments, " +
  ".social-share, .share-buttons, [class*='share-'], " +
  ".newsletter, [class*='newsletter'], " +
  "noscript, iframe";

export function extractMainText($: cheerio.CheerioAPI): string {
  $(NOISE_SELECTOR).remove();
  for (const sel of TEXT_SELECTORS) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      return el.text().trim().slice(0, 6000);
    }
  }
  return $("body").text().trim().slice(0, 6000);
}

export function extractMainTextFull($: cheerio.CheerioAPI): { text: string; usedBodyFallback: boolean } {
  $(NOISE_SELECTOR).remove();
  for (const sel of TEXT_SELECTORS) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      return { text: el.text().trim().slice(0, 6000), usedBodyFallback: false };
    }
  }
  return { text: $("body").text().trim().slice(0, 6000), usedBodyFallback: true };
}

const RECIPE_KEYWORDS =
  /zutaten|ingredient|instruction|zubereitung|schritt|step|rezept|recipe|portionen|serving|kcal|kalorien|\b\d+\s*(?:g|ml|el|tl|cup|tbsp|tsp|kg)\b|backen|kochen|braten|mischen|rühren/gi;

export function extractDomBlocks($: cheerio.CheerioAPI, maxBlocks = 10): string {
  const scored: { text: string; score: number }[] = [];

  $("p, li, h1, h2, h3, h4, dt, dd").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length < 8 || text.length > 1000) return;
    const matches = text.match(RECIPE_KEYWORDS);
    const score = matches ? matches.length : 0;
    if (score > 0) scored.push({ text, score });
  });

  scored.sort((a, b) => b.score - a.score);

  const result: string[] = [];
  for (const { text } of scored) {
    if (result.length >= maxBlocks) break;
    if (!result.some((prev) => prev.includes(text) || text.includes(prev))) {
      result.push(text);
    }
  }

  return result.join("\n").slice(0, 6000);
}

export function resolveSchemaImage(
  image: string | string[] | { url?: string } | { url?: string }[] | undefined
): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (!first) return undefined;
    return typeof first === "string" ? first : (first as { url?: string }).url;
  }
  return (image as { url?: string }).url;
}

export function extractImages(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  schemaImage?: string
): string[] {
  const images: string[] = [];
  if (schemaImage) images.push(schemaImage);

  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    try { images.push(new URL(ogImage, baseUrl).href); } catch { /* skip */ }
  }

  const twitterImage =
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[name="twitter:image:src"]').attr("content");
  if (twitterImage) {
    try { images.push(new URL(twitterImage, baseUrl).href); } catch { /* skip */ }
  }

  $("img[src], img[data-src]").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src || src.startsWith("data:")) return;
    try { images.push(new URL(src, baseUrl).href); } catch { /* skip */ }
  });

  return [...new Set(images)].slice(0, 5);
}
