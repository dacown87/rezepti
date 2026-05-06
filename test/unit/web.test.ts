/**
 * Tests for src/fetchers/web.ts — Microdata (13b) and Wild-Mode JSON-LD (13e).
 * Uses inline HTML fixtures to test extractMicrodataRecipe / extractWildJsonLd via fetchWeb mock.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as cheerio from "cheerio";

// We test the private extractMicrodataRecipe indirectly by calling fetchWeb
// with a mocked fetch that returns known HTML.
import { fetchWeb } from "../../src/fetchers/web.js";
import { extractDomBlocks } from "../../src/fetchers/web/base.js";

function mockFetch(html: string) {
  (global as Record<string, unknown>).fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => html,
  });
}

const realFetch = global.fetch;
afterAll(() => { (global as Record<string, unknown>).fetch = realFetch; });

// ─── Microdata Fixtures ───────────────────────────────────────────────────────

const ICHKOCHE_STYLE = `
<html><body>
<div itemscope itemtype="http://schema.org/Recipe">
  <span itemprop="name">Bärlauch-Pesto</span>
  <meta itemprop="description" content="Ein würziges Frühlingspesto." />
  <meta itemprop="prepTime" content="PT15M" />
  <meta itemprop="cookTime" content="PT5M" />
  <meta itemprop="totalTime" content="PT20M" />
  <meta itemprop="recipeYield" content="4 Portionen" />
  <img itemprop="image" src="https://example.com/pesto.jpg" />
  <ul>
    <li itemprop="recipeIngredient">100 g Bärlauch</li>
    <li itemprop="recipeIngredient">50 g Pinienkerne</li>
    <li itemprop="recipeIngredient">80 ml Olivenöl</li>
    <li itemprop="recipeIngredient">40 g Parmesan</li>
    <li itemprop="recipeIngredient">1 Prise Salz</li>
  </ul>
  <div itemprop="recipeInstructions" itemscope itemtype="http://schema.org/HowToStep">
    <span itemprop="text">Bärlauch waschen und grob hacken.</span>
  </div>
  <div itemprop="recipeInstructions" itemscope itemtype="http://schema.org/HowToStep">
    <span itemprop="text">Alle Zutaten im Mixer pürieren.</span>
  </div>
  <div itemprop="recipeInstructions" itemscope itemtype="http://schema.org/HowToStep">
    <span itemprop="text">Mit Salz abschmecken und in Gläser füllen.</span>
  </div>
</div>
</body></html>
`;

const SIMPLE_MICRODATA = `
<html><body>
<article itemscope itemtype="https://schema.org/Recipe">
  <h1 itemprop="name">Einfache Tomatensuppe</h1>
  <p itemprop="recipeIngredient">500 g Tomaten</p>
  <p itemprop="recipeIngredient">1 Zwiebel</p>
  <p itemprop="recipeIngredient">2 EL Olivenöl</p>
  <p itemprop="recipeInstructions">Zwiebeln andünsten, Tomaten zugeben, 20 Minuten köcheln.</p>
  <p itemprop="recipeInstructions">Mit Salz und Pfeffer würzen.</p>
  <meta itemprop="totalTime" content="PT30M" />
</article>
</body></html>
`;

const NO_MICRODATA = `
<html><body>
<article>
  <h1>Kein Rezept</h1>
  <p>Nur ein normaler Artikel ohne Schema.org-Daten.</p>
</article>
</body></html>
`;

const NAME_ONLY_MICRODATA = `
<html><body>
<div itemscope itemtype="http://schema.org/Recipe">
  <span itemprop="name">Rezept ohne Zutaten</span>
</div>
</body></html>
`;

// ─── Wild-Mode Fixtures (13e) ─────────────────────────────────────────────────

const NEXT_DATA_RECIPE = `
<html><head>
<script>window.__NEXT_DATA__ = {"props":{"pageProps":{"recipe":{"@type":"Recipe","name":"Pasta Carbonara","recipeIngredient":["200g Spaghetti","100g Speck","2 Eier","50g Parmesan"],"recipeInstructions":[{"@type":"HowToStep","text":"Spaghetti kochen."},{"@type":"HowToStep","text":"Speck anbraten."},{"@type":"HowToStep","text":"Alles vermengen."}]}}}}</script>
</head><body><h1>Pasta Carbonara</h1></body></html>
`;

const WRONG_TYPE_JSONLD = `
<html><head>
<script>
{"@type":"Recipe","name":"Zwiebelsuppe","recipeIngredient":["500g Zwiebeln","1L Brühe","2 EL Butter"],"recipeInstructions":["Zwiebeln in Butter anbraten.","Brühe zugeben, 30 Minuten köcheln."]}
</script>
</head><body></body></html>
`;

const NUXT_RECIPE = `
<html><head>
<script>window.__NUXT__ = {"state":{"recipe":{"@type":"Recipe","name":"Käsefondue","recipeIngredient":["400g Gruyère","200ml Weißwein","1 Knoblauchzehe"],"recipeInstructions":["Knoblauch einreiben.","Käse reiben und mit Wein schmelzen."]}}}</script>
</head><body></body></html>
`;

const WILD_NO_RECIPE = `
<html><head>
<script type="text/javascript">
var pageData = {"title":"Kein Rezept","content":"Normaler Artikel"};
</script>
</head><body><h1>Kein Rezept</h1></body></html>
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("extractMicrodataRecipe (via fetchWeb)", () => {
  it("parst HowToStep-Microdata wie ichkoche.at: name, ingredients, steps", async () => {
    mockFetch(ICHKOCHE_STYLE);
    const bundle = await fetchWeb("https://example.com/recipe");

    expect(bundle.schemaRecipe).not.toBeNull();
    expect(bundle.schemaRecipe?.name).toBe("Bärlauch-Pesto");
    expect(bundle.schemaRecipe?.recipeIngredient).toHaveLength(5);
    expect(bundle.schemaRecipe?.recipeIngredient?.[0]).toBe("100 g Bärlauch");
    expect(bundle.schemaRecipe?.recipeInstructions).toHaveLength(3);
    expect((bundle.schemaRecipe?.recipeInstructions as string[])?.[1]).toBe(
      "Alle Zutaten im Mixer pürieren."
    );
  });

  it("liest meta-Attribute für Zeiten aus", async () => {
    mockFetch(ICHKOCHE_STYLE);
    const bundle = await fetchWeb("https://example.com/recipe");

    expect(bundle.schemaRecipe?.totalTime).toBe("PT20M");
    expect(bundle.schemaRecipe?.prepTime).toBe("PT15M");
    expect(bundle.schemaRecipe?.recipeYield).toBe("4 Portionen");
  });

  it("liest img src als image aus", async () => {
    mockFetch(ICHKOCHE_STYLE);
    const bundle = await fetchWeb("https://example.com/recipe");
    expect(bundle.schemaRecipe?.image).toBe("https://example.com/pesto.jpg");
  });

  it("parst einfaches Microdata ohne HowToStep-Container", async () => {
    mockFetch(SIMPLE_MICRODATA);
    const bundle = await fetchWeb("https://example.com/recipe");

    expect(bundle.schemaRecipe).not.toBeNull();
    expect(bundle.schemaRecipe?.name).toBe("Einfache Tomatensuppe");
    expect(bundle.schemaRecipe?.recipeIngredient).toHaveLength(3);
    expect(bundle.schemaRecipe?.recipeInstructions).toHaveLength(2);
  });

  it("gibt null zurück wenn kein Schema.org/Recipe vorhanden", async () => {
    mockFetch(NO_MICRODATA);
    const bundle = await fetchWeb("https://example.com/article");
    expect(bundle.schemaRecipe).toBeNull();
  });

  it("gibt null zurück wenn nur name aber keine ingredients/steps vorhanden", async () => {
    mockFetch(NAME_ONLY_MICRODATA);
    const bundle = await fetchWeb("https://example.com/recipe");
    expect(bundle.schemaRecipe).toBeNull();
  });
});

describe("extractWildJsonLd (via fetchWeb, 13e)", () => {
  it("findet Rezept in window.__NEXT_DATA__", async () => {
    mockFetch(NEXT_DATA_RECIPE);
    const bundle = await fetchWeb("https://example.com/recipe");

    expect(bundle.schemaRecipe).not.toBeNull();
    expect(bundle.schemaRecipe?.name).toBe("Pasta Carbonara");
    expect(bundle.schemaRecipe?.recipeIngredient).toHaveLength(4);
  });

  it("findet Rezept in script-Tag ohne korrekten type", async () => {
    mockFetch(WRONG_TYPE_JSONLD);
    const bundle = await fetchWeb("https://example.com/recipe");

    expect(bundle.schemaRecipe).not.toBeNull();
    expect(bundle.schemaRecipe?.name).toBe("Zwiebelsuppe");
    expect(bundle.schemaRecipe?.recipeIngredient).toHaveLength(3);
  });

  it("findet Rezept in window.__NUXT__", async () => {
    mockFetch(NUXT_RECIPE);
    const bundle = await fetchWeb("https://example.com/recipe");

    expect(bundle.schemaRecipe).not.toBeNull();
    expect(bundle.schemaRecipe?.name).toBe("Käsefondue");
    expect(bundle.schemaRecipe?.recipeIngredient).toHaveLength(3);
  });

  it("gibt null zurück wenn kein Rezept in Script-Tags", async () => {
    mockFetch(WILD_NO_RECIPE);
    const bundle = await fetchWeb("https://example.com/article");
    expect(bundle.schemaRecipe).toBeNull();
  });
});

describe("fetchWeb Chefkoch plugin removal", () => {
  it("does not use the old Chefkoch web plugin selectors", async () => {
    mockFetch(`
      <html><body>
        <main>
          Generic Rezepttext mit Zutaten und Zubereitung, der lang genug fuer
          die generische Web-Extraktion ist. Dieser Text soll verwendet werden,
          weil Chefkoch ueber den dedizierten Fetcher laeuft.
        </main>
        <div class="ds-ingredients">
          PLUGIN_ONLY_MARKER 100 g alter Plugin-Pfad
        </div>
      </body></html>
    `);

    const bundle = await fetchWeb("https://www.chefkoch.de/rezepte/123456/test.html");

    expect(bundle.textContent).toContain("Generic Rezepttext");
    expect(bundle.textContent).not.toContain("PLUGIN_ONLY_MARKER");
  });
});

describe("extractDomBlocks (13h)", () => {
  it("extrahiert relevante Blöcke mit Rezept-Keywords", () => {
    const html = `<html><body>
      <p>Willkommen auf meinem Blog!</p>
      <ul><li>200 g Mehl</li><li>3 Eier</li><li>150 ml Milch</li></ul>
      <p>Schritt 1: Alle Zutaten mischen.</p>
      <p>Schritt 2: Den Teig backen.</p>
      <p>Folgt mir auf Instagram!</p>
    </body></html>`;
    const $ = cheerio.load(html);
    const result = extractDomBlocks($, 10);
    expect(result).toContain("200 g Mehl");
    expect(result).toContain("Zutaten mischen");
    expect(result).not.toContain("Folgt mir auf Instagram");
  });

  it("respektiert den maxBlocks-Parameter", () => {
    const items = Array.from(
      { length: 20 },
      (_, i) => `<li>${i + 1} g Zutat${i + 1}</li>`
    ).join("");
    const html = `<html><body><ul>${items}</ul></body></html>`;
    const $ = cheerio.load(html);
    const result = extractDomBlocks($, 5);
    const lines = result.split("\n").filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(5);
  });

  it("gibt leeren String zurück wenn keine relevanten Blöcke gefunden", () => {
    const html = `<html><body><p>Willkommen auf unserem Blog!</p><p>Impressum und Datenschutz.</p></body></html>`;
    const $ = cheerio.load(html);
    const result = extractDomBlocks($, 10);
    expect(result).toBe("");
  });

  it("dedupliziert überlappende Blöcke", () => {
    const html = `<html><body>
      <ul>
        <li>200 g Mehl, 3 Eier, 150 ml Milch</li>
        <li>200 g Mehl</li>
      </ul>
    </body></html>`;
    const $ = cheerio.load(html);
    const result = extractDomBlocks($, 10);
    // "200 g Mehl" is contained in the longer item, should not appear twice
    const count = (result.match(/200 g Mehl/g) || []).length;
    expect(count).toBe(1);
  });
});
