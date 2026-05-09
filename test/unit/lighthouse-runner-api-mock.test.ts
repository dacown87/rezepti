/**
 * Unit tests for matchApiRoute() in scripts/performance/lighthouse-runner.mjs.
 *
 * Covers all explicitly matched route patterns so that regressions in the
 * API-mock layer (which directly affect Lighthouse LCP measurements) are
 * caught before they land on the branch.
 */
import { describe, it, expect } from 'vitest';
import { matchApiRoute } from '../../scripts/performance/lighthouse-runner.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Assert that the returned body is a non-null object with the given keys. */
function expectObject(result: unknown, keys: string[]) {
  expect(result).not.toBeNull();
  expect(typeof result).toBe('object');
  for (const key of keys) {
    expect(result).toHaveProperty(key);
  }
}

// ── Collection routes ─────────────────────────────────────────────────────────

describe('matchApiRoute — collection routes', () => {
  it('GET /api/v1/recipes returns an array', () => {
    const result = matchApiRoute('/api/v1/recipes');
    expect(Array.isArray(result)).toBe(true);
  });

  it('GET /api/v1/recipes with query string returns an array', () => {
    const result = matchApiRoute('/api/v1/recipes?page=1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('GET /api/v1/planner returns an array', () => {
    const result = matchApiRoute('/api/v1/planner');
    expect(Array.isArray(result)).toBe(true);
  });

  it('GET /api/v1/shopping returns { items: [] }', () => {
    const result = matchApiRoute('/api/v1/shopping') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.items).toEqual([]);
  });

  it('GET /api/v1/health returns { status: "ok" }', () => {
    const result = matchApiRoute('/api/v1/health') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.status).toBe('ok');
  });
});

// ── Parametrised recipe route ─────────────────────────────────────────────────

describe('matchApiRoute — /api/v1/recipes/:id', () => {
  it('returns a recipe stub with all normalizeRecipe() fields', () => {
    const result = matchApiRoute('/api/v1/recipes/1');
    expectObject(result, [
      'id', 'name', 'emoji', 'source_url', 'image_url',
      'ingredients', 'steps', 'tags', 'servings', 'duration',
      'calories', 'rating', 'notes', 'category', 'equipment',
      'nutrition_info', 'ingredient_groups', 'transcript',
      'tried', 'pdf_created', 'created_at',
    ]);
  });

  it('ingredients and steps are valid JSON strings', () => {
    const result = matchApiRoute('/api/v1/recipes/42') as Record<string, unknown>;
    expect(() => JSON.parse(result.ingredients as string)).not.toThrow();
    expect(() => JSON.parse(result.steps as string)).not.toThrow();
    expect(JSON.parse(result.ingredients as string)).toEqual([]);
    expect(JSON.parse(result.steps as string)).toEqual([]);
  });

  it('works with string-style IDs', () => {
    const result = matchApiRoute('/api/v1/recipes/abc-slug');
    expect(result).not.toBeNull();
  });

  it('does NOT match the collection route /api/v1/recipes', () => {
    // Collection must return array, not stub object
    const result = matchApiRoute('/api/v1/recipes');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Shopping sub-routes ───────────────────────────────────────────────────────

describe('matchApiRoute — /api/v1/shopping sub-routes', () => {
  it('DELETE /api/v1/shopping/checked returns { ok: true }', () => {
    const result = matchApiRoute('/api/v1/shopping/checked') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.ok).toBe(true);
  });

  it('DELETE /api/v1/shopping/all returns { ok: true }', () => {
    const result = matchApiRoute('/api/v1/shopping/all') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.ok).toBe(true);
  });

  it('PATCH /api/v1/shopping/7 (toggle) returns { ok: true }', () => {
    const result = matchApiRoute('/api/v1/shopping/7') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.ok).toBe(true);
  });

  it('DELETE /api/v1/shopping/99 (delete item) returns { ok: true }', () => {
    const result = matchApiRoute('/api/v1/shopping/99') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.ok).toBe(true);
  });

  it('does NOT match the collection route /api/v1/shopping', () => {
    // Collection must return { items: [] }, not { ok: true }
    const result = matchApiRoute('/api/v1/shopping') as Record<string, unknown>;
    expect(result.items).toBeDefined();
    expect(result.ok).toBeUndefined();
  });
});

// ── Fallback ──────────────────────────────────────────────────────────────────

describe('matchApiRoute — unknown routes return null (fallback)', () => {
  it('unknown /api/v1/xyz returns null', () => {
    expect(matchApiRoute('/api/v1/xyz')).toBeNull();
  });

  it('deeply nested unknown path returns null', () => {
    expect(matchApiRoute('/api/v1/extract/react/some-job-id')).toBeNull();
  });

  it('/api/v1/keys/validate returns null (not mocked — non-critical for LCP)', () => {
    expect(matchApiRoute('/api/v1/keys/validate')).toBeNull();
  });
});
