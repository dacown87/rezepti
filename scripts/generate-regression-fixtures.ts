/**
 * Generates regression test fixtures from existing DB recipes.
 * Pulls source_url, name, ingredients, steps from Supabase and saves
 * them as JSON so web-regression.test.ts can re-extract and compare.
 *
 * Run once (or after major DB changes):
 *   npx tsx scripts/generate-regression-fixtures.ts
 */

import postgres from "postgres";
import { writeFile } from "node:fs/promises";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL environment variable is required");

const sql = postgres(DB_URL);

const rows = await sql<{ source_url: string; name: string; ingredients: string; steps: string }[]>`
  SELECT DISTINCT ON (source_url) source_url, name, ingredients, steps
  FROM recipes
  WHERE source_url IS NOT NULL
    AND source_url NOT LIKE '%youtube%'
    AND source_url NOT LIKE '%tiktok%'
    AND source_url NOT LIKE '%instagram%'
    AND source_url NOT LIKE '%facebook%'
    AND source_url NOT LIKE '%cookidoo%'
    AND source_url LIKE 'http%'
  ORDER BY source_url, created_at DESC
  LIMIT 40
`;

export interface RegressionFixture {
  url: string;
  domain: string;
  name: string;
  ingredientsCount: number;
  stepsCount: number;
}

const fixtures: RegressionFixture[] = rows
  .map((r) => {
    let ingredients: string[] = [];
    let steps: string[] = [];
    try { ingredients = JSON.parse(r.ingredients || "[]"); } catch { /* skip */ }
    try { steps = JSON.parse(r.steps || "[]"); } catch { /* skip */ }

    return {
      url: r.source_url,
      domain: new URL(r.source_url).hostname.replace("www.", ""),
      name: r.name,
      ingredientsCount: ingredients.length,
      stepsCount: steps.length,
    };
  })
  .filter((f) => f.ingredientsCount > 0 && f.stepsCount > 0);

const outPath = "test/fixtures/web-regression-fixtures.json";
await writeFile(outPath, JSON.stringify(fixtures, null, 2), "utf-8");

console.log(`✅ ${fixtures.length} Fixtures gespeichert → ${outPath}`);
for (const f of fixtures) {
  console.log(`   ${f.domain.padEnd(35)} ${f.ingredientsCount}Z / ${f.stepsCount}S  — ${f.name.slice(0, 50)}`);
}

await sql.end();
