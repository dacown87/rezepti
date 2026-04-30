import type * as cheerio from "cheerio";
import type { WebScraperPlugin } from "./base.js";

// Chefkoch-specific selectors that aren't covered by the generic list.
// The generic selectors already catch schema.org microdata, so this plugin
// primarily provides the Chefkoch-native markup as a higher-priority path.
const CHEFKOCH_SELECTORS = [
  ".ds-recipe-meta",           // meta block (servings, time)
  ".ds-ingredients",           // ingredient list
  ".ds-instructions",          // step-by-step instructions
  ".recipe-ingredients",       // older Chefkoch markup
  ".recipe-instructions",      // older Chefkoch markup
  ".recipe-preparation",       // older Chefkoch markup
  ".recipe-container",         // wrapper on some pages
];

export const chefkochPlugin: WebScraperPlugin = {
  hostname: "chefkoch.de",

  extractMainText($: cheerio.CheerioAPI): string | null {
    for (const sel of CHEFKOCH_SELECTORS) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 100) {
        return el.text().trim().slice(0, 6000);
      }
    }
    return null; // fall back to generic extraction
  },
};
