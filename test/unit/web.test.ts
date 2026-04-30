/**
 * Tests for src/fetchers/web.ts — Microdata extraction (13b).
 * Uses inline HTML fixtures to test extractMicrodataRecipe via fetchWeb mock.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as cheerio from "cheerio";

// We test the private extractMicrodataRecipe indirectly by calling fetchWeb
// with a mocked fetch that returns known HTML.
import { fetchWeb } from "../../src/fetchers/web.js";

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
