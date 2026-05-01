import * as cheerio from "cheerio";
import type { ContentBundle } from "../../types.js";
import { config } from "../../config.js";
import {
  extractJsonLdRecipes,
  extractMicrodataRecipe,
  extractWildJsonLd,
  extractMainTextFull,
  extractDomBlocks,
  resolveSchemaImage,
  extractImages,
  type WebScraperPlugin,
} from "./base.js";
import { chefkochPlugin } from "./chefkoch.js";

// ─── Plugin registry ──────────────────────────────────────────────────────────

const PLUGINS: WebScraperPlugin[] = [chefkochPlugin];

function getPlugin(url: string): WebScraperPlugin | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return PLUGINS.find((p) => hostname === p.hostname || hostname.endsWith(`.${p.hostname}`)) ?? null;
  } catch {
    return null;
  }
}

// ─── fetchWeb ─────────────────────────────────────────────────────────────────

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

  const schemaRecipe =
    extractJsonLdRecipes($) ?? extractMicrodataRecipe($) ?? extractWildJsonLd(html);

  const title = $("title").text().trim() || $("h1").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";

  const plugin = getPlugin(url);
  let textContent: string;
  const pluginText = plugin?.extractMainText?.($);
  if (pluginText != null) {
    textContent = pluginText;
  } else {
    const { text, usedBodyFallback } = extractMainTextFull($);
    textContent =
      usedBodyFallback && config.web.mlFallback ? extractDomBlocks($) : text;
  }

  return {
    url,
    type: "web",
    title,
    description,
    textContent,
    imageUrls: extractImages($, url, resolveSchemaImage(schemaRecipe?.image)),
    schemaRecipe,
  };
}
