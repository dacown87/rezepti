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

  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
    return obj as unknown as SchemaOrgRecipe;
  }

  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"]);
  }

  return null;
}

function parseGermanPortions(yieldText: string | undefined): string | undefined {
  if (!yieldText) return undefined;

  // "für 4 Personen", "für 4 Personen (ca. 40 Stück)"
  const personMatch = yieldText.match(/für\s*(\d+)\s*Personen?/i);
  if (personMatch) return personMatch[1];

  // "ca. 6 Stück", "etwa 8 Stück"
  const stückMatch = yieldText.match(/(?:ca\.|etwa|ca)\s*(\d+)\s*Stück/i);
  if (stückMatch) return stückMatch[1];

  // "4 Portionen", "6 Stück"
  const portionMatch = yieldText.match(/(\d+)\s*(?:Portionen|Stück)/i);
  if (portionMatch) return portionMatch[1];

  // Standalone number: "4"
  const numMatch = yieldText.match(/^(\d+)$/);
  if (numMatch) return numMatch[1];

  return yieldText;
}

function extractMainText($: cheerio.CheerioAPI): string {
  $("script, style, nav, footer, header, aside, .ad, .ads, .sidebar, .recipe-banner, .recipe-teaser").remove();

  const selectors = [
    '[itemtype*="schema.org/Recipe"]',
    ".recipe-ingredients",
    ".recipe-content",
    ".recipe-detail",
    ".recipe-intro",
    ".recipe-steps",
    "article",
    "main",
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      return el.text().trim().slice(0, 10000);
    }
  }

  return $("body").text().trim().slice(0, 10000);
}

function extractChefkochIngredients($: cheerio.CheerioAPI): string[] {
  const ingredients: string[] = [];

  const selectors = [
    ".recipe-ingredients-list li",
    ".recipe-ingredients li",
    ".ingredients-list li",
    '[itemprop="recipeIngredient"]',
    ".ingredient-list li",
  ];

  for (const sel of selectors) {
    const els = $(sel);
    if (els.length > 0) {
      els.each((_, el) => {
        const text = $(el).text().trim();
        if (text) ingredients.push(text);
      });
      if (ingredients.length > 0) break;
    }
  }

  return ingredients;
}

function extractChefkochSteps($: cheerio.CheerioAPI): string[] {
  const steps: string[] = [];

  const selectors = [
    ".recipe-steps li",
    ".recipe-steps p",
    ".recipe-instructions li",
    ".recipe-instructions p",
    '[itemprop="recipeInstructions"] li',
    '[itemprop="recipeInstructions"] p',
    ".instructions li",
  ];

  for (const sel of selectors) {
    const els = $(sel);
    if (els.length > 0) {
      els.each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10) steps.push(text);
      });
      if (steps.length > 0) break;
    }
  }

  return steps;
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

  // Schema.org image is most reliable — prepend it
  if (schemaImage) images.push(schemaImage);

  // og:image fallback
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) {
    try { images.push(new URL(ogImage, baseUrl).href); } catch { /* skip */ }
  }

  // img[src] and img[data-src] (lazy-loaded images)
  $("img[src], img[data-src]").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src || src.startsWith("data:")) return;
    try { images.push(new URL(src, baseUrl).href); } catch { /* skip */ }
  });

  return [...new Set(images)].slice(0, 5);
}

export async function fetchChefkoch(url: string): Promise<ContentBundle> {
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
  if (schemaRecipe?.recipeYield) {
    schemaRecipe.recipeYield = parseGermanPortions(schemaRecipe.recipeYield) ?? schemaRecipe.recipeYield;
  }

  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    schemaRecipe?.name ||
    "";

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  let textContent = extractMainText($);
  if (textContent.length < 100 && (schemaRecipe?.recipeIngredient || schemaRecipe?.recipeInstructions)) {
    const ingredients = schemaRecipe?.recipeIngredient ?? [];
    const steps: string[] = [];
    if (schemaRecipe?.recipeInstructions) {
      for (const step of schemaRecipe.recipeInstructions) {
        if (typeof step === "string") steps.push(step);
        else if ("itemListElement" in step && Array.isArray(step.itemListElement)) {
          for (const sub of step.itemListElement) {
            if (sub.text) steps.push(sub.text.trim());
          }
        } else if ("text" in step && step.text) {
          steps.push(step.text.trim());
        }
      }
    }
    textContent = [...ingredients, ...steps].join("\n");
  }

  const chefkochIngredients = extractChefkochIngredients($);
  const chefkochSteps = extractChefkochSteps($);

  let finalIngredients = schemaRecipe?.recipeIngredient ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalSteps: any[] = schemaRecipe?.recipeInstructions ?? [];

  if (finalIngredients.length === 0 && chefkochIngredients.length > 0) {
    finalIngredients = chefkochIngredients;
  }
  if ((finalSteps.length === 0 || (typeof finalSteps[0] === "string" && finalSteps.length < 3)) && chefkochSteps.length > 0) {
    finalSteps = chefkochSteps;
  }

  const finalSchema: SchemaOrgRecipe | null = schemaRecipe
    ? { ...schemaRecipe, recipeIngredient: finalIngredients, recipeInstructions: finalSteps }
    : null;

  return {
    url,
    type: "chefkoch",
    title,
    description,
    textContent,
    imageUrls: extractImages($, url, resolveSchemaImage(schemaRecipe?.image)),
    schemaRecipe: finalSchema,
  };
}
