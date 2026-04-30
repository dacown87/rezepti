import * as cheerio from "cheerio";
import type { ContentBundle, SchemaOrgRecipe } from "../types.js";

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

  // Check @type
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
    return obj as unknown as SchemaOrgRecipe;
  }

  // Check @graph
  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"]);
  }

  return null;
}

function extractMicrodataRecipe($: cheerio.CheerioAPI): SchemaOrgRecipe | null {
  const recipeEl = $('[itemtype*="schema.org/Recipe"], [itemtype*="/Recipe"]').first();
  if (!recipeEl.length) return null;

  // Single itemprop value: prefer content/datetime attrs, fall back to text
  function getProp(prop: string): string {
    const el = recipeEl.find(`[itemprop="${prop}"]`).first();
    if (!el.length) return "";
    return el.attr("content") || el.attr("datetime") || el.attr("href") || el.text().trim();
  }

  // Multiple itemprop values — skip nested microdata containers (have itemscope)
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

  // Instructions: HowToStep containers have nested itemprop="text"
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

  // Image: <img src>, <meta content>, or <link href>
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

  // Only return if we have at least name + one of ingredients/steps
  if (!recipe.recipeIngredient?.length && !recipe.recipeInstructions?.length) return null;
  return recipe;
}

// Deep recursive search — used for wild JSON where structure is unknown
function deepFindRecipe(data: unknown): SchemaOrgRecipe | null {
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

function extractWildJsonLd(html: string): SchemaOrgRecipe | null {
  // ReDoS protection: only scan first 100 KB
  const slice = html.slice(0, 100_000);

  // Match <script> tags that are NOT type="application/ld+json"
  // and contain Recipe-like content
  const scriptRe = /<script(?![^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(slice)) !== null) {
    const content = match[1];
    if (!content) continue;

    // Quick pre-filter: must contain "Recipe" or "recipeIngredient"
    if (!content.includes("Recipe") && !content.includes("recipeIngredient")) continue;

    // Try __NEXT_DATA__ / __NUXT__ / __STATE__ inline JSON patterns first
    const inlinePatterns = [
      /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*)/,
      /window\.__NUXT__\s*=\s*(\{[\s\S]*)/,
      /window\.__STATE__\s*=\s*(\{[\s\S]*)/,
    ];
    for (const pat of inlinePatterns) {
      const m = pat.exec(content);
      if (!m) continue;
      try {
        const jsonStr = m[1].replace(/;\s*$/, "").trim();
        const found = deepFindRecipe(JSON.parse(jsonStr));
        if (found) return found;
      } catch {
        // not valid JSON at that position
      }
    }

    // Try to parse entire script content as JSON (some sites embed bare JSON-LD
    // without the correct type attribute)
    try {
      const found = deepFindRecipe(JSON.parse(content.trim()));
      if (found) return found;
    } catch {
      // not valid JSON
    }
  }

  return null;
}

function extractMainText($: cheerio.CheerioAPI): string {
  // Remove noise: ads, comments, social widgets, nav chrome
  $(
    "script, style, nav, footer, header, aside, " +
    ".ad, .ads, .sidebar, " +
    ".advertisement, [class*='ad-'], [id*='ad-'], " +
    ".related, .related-posts, " +
    "[class*='comment'], .comments, #comments, " +
    ".social-share, .share-buttons, [class*='share-'], " +
    ".newsletter, [class*='newsletter'], " +
    "noscript, iframe"
  ).remove();

  // Priority: specific recipe plugins first, then generic containers, then full-page fallbacks
  const selectors = [
    // WordPress recipe plugins
    ".wprm-recipe-container",
    ".tasty-recipe",
    ".mv-create-card",          // Mediavine Create
    ".mv-recipe-card",          // Mediavine alternative
    ".recipe-card-full-width",  // Pinch of Yum / Foodie Pro
    ".recipe-card-container",
    ".simple-recipe-pro",
    // Schema.org microdata containers
    '[itemtype*="schema.org/Recipe"]',
    '[itemtype*="Recipe"]',
    // Site-specific recipe containers (RecipeClipper sources)
    ".o-AssetRecipe",           // Food Network
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
    ".hrecipe",                 // old microformat
    // Generic recipe selectors
    ".recipe",
    ".recipe-content",
    ".recipe-card",
    "#recipe",
    "[class*='recipe-card']",
    "[class*='recipe-block']",
    "[class*='recipe-container']",
    // Ingredient/step area selectors (grab surrounding context)
    ".ingredients-instructions",
    ".ingredients-and-instructions",
    ".recipe-directions",
    ".recipe-method",
    // Broad fallbacks
    "article",
    "main",
    ".post-content",
    ".entry-content",
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      return el.text().trim().slice(0, 6000);
    }
  }

  return $("body").text().trim().slice(0, 6000);
}

function resolveSchemaImage(image: string | string[] | { url?: string } | { url?: string }[] | undefined): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (!first) return undefined;
    return typeof first === "string" ? first : (first as { url?: string }).url;
  }
  return (image as { url?: string }).url;
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string, schemaImage?: string): string[] {
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

export async function fetchWeb(url: string): Promise<ContentBundle> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} beim Abrufen von ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const schemaRecipe = extractJsonLdRecipes($) ?? extractMicrodataRecipe($) ?? extractWildJsonLd(html);
  const title = $("title").text().trim() || $("h1").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  return {
    url,
    type: "web",
    title,
    description,
    textContent: extractMainText($),
    imageUrls: extractImages($, url, resolveSchemaImage(schemaRecipe?.image)),
    schemaRecipe,
  };
}
