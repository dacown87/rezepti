/**
 * Regression tests for web extraction using real DB recipes as fixtures.
 *
 * Guards against regressions in src/fetchers/web.ts after Phase 13 changes.
 * For each fixture: re-fetches the source URL and checks that schema.org
 * extraction still yields name + ingredients + steps (or at least extractable text).
 *
 * Skipped unless TEST_NETWORK=1 is set — never runs in CI.
 * Generate/refresh fixtures with: npx tsx scripts/generate-regression-fixtures.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fetch as undiciFetch } from "undici";
import { fetchWeb } from "../../src/fetchers/web.js";
import type { RegressionFixture } from "../../scripts/generate-regression-fixtures.js";

const TEST_NETWORK = !!process.env.TEST_NETWORK;
const FIXTURE_PATH = "test/fixtures/web-regression-fixtures.json";

let fixtures: RegressionFixture[] = [];
if (existsSync(FIXTURE_PATH)) {
  try {
    fixtures = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
  } catch {
    /* fixture file broken — tests will be skipped */
  }
}

describe.skipIf(!TEST_NETWORK || fixtures.length === 0)(
  "Web extraction regression (DB recipes)",
  () => {
    beforeAll(() => {
      // test/setup.ts mocks global.fetch — restore real fetch for network tests
      (global as Record<string, unknown>).fetch = undiciFetch;
    });

    afterAll(() => {
      (global as Record<string, unknown>).fetch = vi.fn();
    });

    for (const fixture of fixtures) {
      it(
        `${fixture.domain}: "${fixture.name.slice(0, 45)}" — ${fixture.ingredientsCount}Z/${fixture.stepsCount}S`,
        async () => {
          let bundle;
          try {
            bundle = await fetchWeb(fixture.url);
          } catch (err: unknown) {
            const msg = String(err);
            // 403/401 Bot-Schutz und Timeouts sind bekannte Failures — kein Testfehler
            if (/HTTP 4\d\d|timeout|abort/i.test(msg)) {
              console.warn(`  ⚠ skipped (${msg.slice(0, 60)})`);
              return;
            }
            throw err;
          }

          if (bundle.schemaRecipe) {
            // JSON-LD vorhanden: vollständige Extraktion prüfen
            expect(bundle.schemaRecipe.name, "name leer").toBeTruthy();
            expect(
              bundle.schemaRecipe.recipeIngredient?.length ?? 0,
              `erwartet ≥${fixture.ingredientsCount} Zutaten, bekam 0`
            ).toBeGreaterThan(0);
            expect(
              (bundle.schemaRecipe.recipeInstructions as unknown[])?.length ?? 0,
              `erwartet ≥${fixture.stepsCount} Schritte, bekam 0`
            ).toBeGreaterThan(0);
          } else {
            // Kein JSON-LD: wenigstens extrahierbarer Text für LLM muss vorhanden sein
            expect(
              bundle.textContent?.length ?? 0,
              "kein extrahierbarer Text (wäre für LLM verloren)"
            ).toBeGreaterThan(200);
          }
        },
        30_000
      );
    }
  }
);
