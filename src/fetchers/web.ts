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

function extractMainText($: cheerio.CheerioAPI): string {
  // Remove script, style, nav, footer, header elements
  $("script, style, nav, footer, header, aside, .ad, .ads, .sidebar").remove();

  // Try common recipe content selectors
  const selectors = [
    '[itemtype*="schema.org/Recipe"]',
    ".recipe",
    ".recipe-content",
    "#recipe",
    "article",
    "main",
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

  const schemaRecipe = extractJsonLdRecipes($);
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
