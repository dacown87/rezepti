/**
 * Phase 13 Sample-Test — 20 diverse URLs durch fetchWeb + JSON-LD-Analyse
 * Kategorisiert Failures: json-ld-ok | json-ld-partial | no-json-ld | css-fallback | error
 * Run: npx tsx scripts/sample-test.ts
 */

import * as cheerio from "cheerio";

const URLS = [
  // === REAL URLS FROM DB (known imports, expected to work) ===
  // Chefkoch — eigener Fetcher, aber web-Analyse-Verhalten dokumentieren
  "https://www.chefkoch.de/rezepte/2220831355433935/Philly-Cheese-Steak-Sandwich.html",
  "https://www.chefkoch.de/rezepte/3336651495556382/Marinierte-Spareribs.html",
  // BBC Good Food — aus DB + vorherigem Test bestätigt ✅
  "https://www.bbcgoodfood.com/recipes/chocolate-chunk-cookies",
  // Unbekannter deutscher Food Blog — aus DB
  "https://perfekterezepte.duasureayet.com/blitz-nudel-hackfleisch-pfanne/",

  // === GROSSE INTERNATIONALE PLATTFORMEN ===
  // Food Network — vorheriger Test: css-fallback (main)
  "https://www.foodnetwork.com/recipes/food-network-kitchen/perfect-scrambled-eggs-recipe-2109020",
  // Taste of Home — vorheriger Test: json-ld-full ✅
  "https://www.tasteofhome.com/recipes/banana-bread/",
  // Delish — vorheriger Test: json-ld-full ✅
  "https://www.delish.com/cooking/recipe-ideas/a19636089/classic-banana-bread-recipe/",
  // Spend with Pennies — vorheriger Test: json-ld-full ✅
  "https://www.spendwithpennies.com/banana-bread/",
  // Minimalist Baker — WPRM, real URL von Homepage
  "https://minimalistbaker.com/strawberry-chia-pudding/",
  "https://minimalistbaker.com/vegan-chickpea-taco-salad/",

  // === BOT-GESCHÜTZTE SITES (zum Dokumentieren des 403-Problems) ===
  // Allrecipes — bekannter 403 Bot-Schutz
  "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
  // Simply Recipes — bekannter 403
  "https://www.simplyrecipes.com/recipes/perfect_guacamole/",
  // Serious Eats — bekannter 403
  "https://www.seriouseats.com/the-best-chocolate-chip-cookies-recipe",

  // === DEUTSCHE / ÖSTERREICHISCHE / SCHWEIZER SITES ===
  // Ichkoche.at — echte URLs von Homepage
  "https://www.ichkoche.at/baerlauchpesto-rezept-13208",
  "https://www.ichkoche.at/spargelcremesuppe-rezept-13355",
  // Gutekueche.at — echte URLs von Homepage
  "https://www.gutekueche.at/nudelauflauf-mit-schinken-rezept-22672",
  "https://www.gutekueche.at/kraeutersuppe-rezept-12713",
  // Lecker.de — vorheriger Test zeigte json-ld-full, neues URL testen
  "https://www.lecker.de/spaghetti-carbonara-73542.html",
  // Lidl Kochen — vorheriger Test: no-json-ld body-fallback
  "https://www.lidl-kochen.de/rezeptwelt/spaghetti-carbonara-2841",
];

interface TestResult {
  url: string;
  domain: string;
  status: "json-ld-full" | "json-ld-partial" | "no-json-ld" | "css-fallback" | "error";
  hasIngredients: boolean;
  hasSteps: boolean;
  hasName: boolean;
  hasDuration: boolean;
  cssSelector?: string;
  errorMsg?: string;
  httpStatus?: number;
  note?: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
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
  if (type === "Recipe" || (Array.isArray(type) && (type as string[]).includes("Recipe"))) {
    return obj;
  }
  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    return findRecipeInJsonLd(obj["@graph"]);
  }
  return null;
}

const CSS_SELECTORS = [
  ".wprm-recipe-container",
  ".tasty-recipe",
  '[itemtype*="schema.org/Recipe"]',
  '[itemtype*="Recipe"]',
  ".recipe",
  ".recipe-content",
  ".recipe-card",
  "#recipe",
  "article",
  "main",
  ".post-content",
  ".entry-content",
];

async function testUrl(url: string): Promise<TestResult> {
  const domain = extractDomain(url);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    const httpStatus = response.status;

    if (!response.ok) {
      return {
        url,
        domain,
        status: "error",
        hasIngredients: false,
        hasSteps: false,
        hasName: false,
        hasDuration: false,
        httpStatus,
        errorMsg: `HTTP ${httpStatus}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try JSON-LD
    let schemaRecipe: Record<string, unknown> | null = null;
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      try {
        const raw = $(scripts[i]).html();
        if (!raw) continue;
        const json = JSON.parse(raw);
        const found = findRecipeInJsonLd(json);
        if (found) {
          schemaRecipe = found;
          break;
        }
      } catch {
        // skip invalid JSON-LD
      }
    }

    if (schemaRecipe) {
      const ingredients = schemaRecipe["recipeIngredient"] as string[] | undefined;
      const instructions = schemaRecipe["recipeInstructions"];
      const name = schemaRecipe["name"] as string | undefined;
      const duration = schemaRecipe["totalTime"] || schemaRecipe["cookTime"] || schemaRecipe["prepTime"];

      const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0;
      const hasSteps = !!instructions && (Array.isArray(instructions) ? instructions.length > 0 : String(instructions).length > 0);
      const hasName = !!name && name.length > 0;
      const hasDuration = !!duration;

      const isFull = hasName && hasIngredients && hasSteps;

      return {
        url,
        domain,
        status: isFull ? "json-ld-full" : "json-ld-partial",
        hasIngredients,
        hasSteps,
        hasName,
        hasDuration,
        httpStatus,
        note: !isFull ? `missing: ${[!hasName && "name", !hasIngredients && "ingredients", !hasSteps && "steps"].filter(Boolean).join(", ")}` : undefined,
      };
    }

    // No JSON-LD — check which CSS selector matches
    let matchedSelector: string | undefined;
    for (const sel of CSS_SELECTORS) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 100) {
        matchedSelector = sel;
        break;
      }
    }

    // Check for Microdata
    const hasMicrodata = $('[itemtype*="schema.org/Recipe"]').length > 0 || $('[itemtype*="/Recipe"]').length > 0;
    // Check for JSON-LD in wrong script tags
    const hasWildJsonLd = $("script:not([type])").toArray().some((el) => {
      const text = $(el).html() || "";
      return text.includes('"Recipe"') || text.includes("recipeIngredient");
    });

    const status = matchedSelector ? "css-fallback" : "no-json-ld";

    return {
      url,
      domain,
      status,
      hasIngredients: false,
      hasSteps: false,
      hasName: false,
      hasDuration: false,
      cssSelector: matchedSelector,
      httpStatus,
      note: [
        hasMicrodata && "has-microdata",
        hasWildJsonLd && "wild-jsonld-possible",
        !matchedSelector && "body-fallback",
      ].filter(Boolean).join(", ") || undefined,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      url,
      domain,
      status: "error",
      hasIngredients: false,
      hasSteps: false,
      hasName: false,
      hasDuration: false,
      errorMsg: msg.includes("timeout") || msg.includes("abort") ? "TIMEOUT" : msg.slice(0, 80),
    };
  }
}

async function main() {
  console.log("Phase 13 Sample-Test — " + new Date().toISOString());
  console.log("=".repeat(80));

  const results: TestResult[] = [];

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const domain = extractDomain(url);
    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/${URLS.length}] ${domain.padEnd(35)} ... `);

    const result = await testUrl(url);
    results.push(result);

    const icon = {
      "json-ld-full": "✅",
      "json-ld-partial": "⚠️ ",
      "css-fallback": "🔶",
      "no-json-ld": "❌",
      "error": "💥",
    }[result.status];

    console.log(`${icon} ${result.status}${result.note ? ` (${result.note})` : ""}${result.errorMsg ? ` [${result.errorMsg}]` : ""}`);
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("ZUSAMMENFASSUNG");
  console.log("=".repeat(80));

  const byStatus = {
    "json-ld-full": results.filter((r) => r.status === "json-ld-full"),
    "json-ld-partial": results.filter((r) => r.status === "json-ld-partial"),
    "css-fallback": results.filter((r) => r.status === "css-fallback"),
    "no-json-ld": results.filter((r) => r.status === "no-json-ld"),
    "error": results.filter((r) => r.status === "error"),
  };

  console.log(`✅ JSON-LD vollständig:  ${byStatus["json-ld-full"].length} / ${URLS.length}`);
  console.log(`⚠️  JSON-LD unvollst.:   ${byStatus["json-ld-partial"].length} / ${URLS.length}`);
  console.log(`🔶 CSS-Fallback nötig:  ${byStatus["css-fallback"].length} / ${URLS.length}`);
  console.log(`❌ Kein JSON-LD/CSS:    ${byStatus["no-json-ld"].length} / ${URLS.length}`);
  console.log(`💥 Fehler/Timeout:      ${byStatus["error"].length} / ${URLS.length}`);

  console.log("\n--- ROI-Einschätzung ---");
  const needsLLM = byStatus["json-ld-partial"].length + byStatus["css-fallback"].length + byStatus["no-json-ld"].length;
  console.log(`Ohne LLM nutzbar (json-ld-full): ${byStatus["json-ld-full"].length} Sites`);
  console.log(`Braucht LLM/Fallback: ${needsLLM} Sites`);
  console.log(`→ 13b Microdata: ${results.filter((r) => r.note?.includes("has-microdata")).length} Kandidaten`);
  console.log(`→ 13e Wild-Mode: ${results.filter((r) => r.note?.includes("wild-jsonld-possible")).length} Kandidaten`);
  console.log(`→ 13a CSS-Erweiterung: ${byStatus["css-fallback"].length} nutzen bereits CSS-Fallback`);
  console.log(`→ Body-Fallback (schlecht): ${results.filter((r) => r.note?.includes("body-fallback")).length} Sites`);

  if (byStatus["error"].length > 0) {
    console.log("\n--- Fehler ---");
    for (const r of byStatus["error"]) {
      console.log(`  ${r.domain}: ${r.errorMsg}`);
    }
  }

  if (byStatus["css-fallback"].length > 0 || byStatus["no-json-ld"].length > 0) {
    console.log("\n--- Details zu CSS/No-JSON-LD ---");
    for (const r of [...byStatus["css-fallback"], ...byStatus["no-json-ld"]]) {
      console.log(`  ${r.domain.padEnd(35)} css=${r.cssSelector || "(none)"} ${r.note ? `| ${r.note}` : ""}`);
    }
  }

  // Machine-readable results for later cross-check
  const outputPath = "scripts/sample-test-results.json";
  const fs = await import("node:fs/promises");
  await fs.writeFile(
    outputPath,
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
    "utf-8"
  );
  console.log(`\n💾 Ergebnisse gespeichert: ${outputPath}`);
}

main().catch(console.error);
