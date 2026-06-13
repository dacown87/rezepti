/**
 * Unit tests for mobile/sw/cache-names.ts pure functions.
 * These run in Node (no browser globals needed) via Vitest.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  hashUserId,
  userCacheName,
  isUserCacheName,
  isCacheableRecipeRequest,
  clearUserCaches,
} from '../sw/cache-names.js';

// ---------------------------------------------------------------------------
// hashUserId
// ---------------------------------------------------------------------------

describe('hashUserId', () => {
  it('is deterministic — same input yields same output', () => {
    expect(hashUserId('user-abc-123')).toBe(hashUserId('user-abc-123'));
  });

  it('differs for different userIds', () => {
    expect(hashUserId('user-abc-123')).not.toBe(hashUserId('user-xyz-999'));
  });

  it('throws for empty string', () => {
    expect(() => hashUserId('')).toThrow('hashUserId: userId must not be empty');
  });

  it('returns an 8-character lowercase hex string', () => {
    const result = hashUserId('some-user-id');
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it('always returns exactly 8 chars (zero-padded)', () => {
    // Use a range of inputs to stress-test padding
    const inputs = ['a', 'z', '0', 'hello-world', 'uuid-0000-0000-0000-0000'];
    for (const input of inputs) {
      expect(hashUserId(input).length).toBe(8);
    }
  });
});

// ---------------------------------------------------------------------------
// userCacheName
// ---------------------------------------------------------------------------

describe('userCacheName', () => {
  it('formats as rd-user-${hash}-v${buildHash}', () => {
    const hash = hashUserId('test-user');
    const result = userCacheName(hash, '42bc22a2');
    expect(result).toBe(`rd-user-${hash}-v42bc22a2`);
  });

  it('works with known values', () => {
    expect(userCacheName('aabbccdd', 'deadbeef')).toBe('rd-user-aabbccdd-vdeadbeef');
  });
});

// ---------------------------------------------------------------------------
// isUserCacheName
// ---------------------------------------------------------------------------

describe('isUserCacheName', () => {
  it('returns true for rd-user-abc123-v42bc22a2', () => {
    expect(isUserCacheName('rd-user-abc123-v42bc22a2')).toBe(true);
  });

  it('returns true for rd-user-anything-vanything', () => {
    expect(isUserCacheName('rd-user-anything-vanything')).toBe(true);
  });

  it('returns false for rd-shell-v42bc22a2', () => {
    expect(isUserCacheName('rd-shell-v42bc22a2')).toBe(false);
  });

  it('returns false for rd-assets-v42bc22a2', () => {
    expect(isUserCacheName('rd-assets-v42bc22a2')).toBe(false);
  });

  it('returns false for workbox-precache-v2', () => {
    expect(isUserCacheName('workbox-precache-v2')).toBe(false);
  });

  it('returns false for an arbitrary string', () => {
    expect(isUserCacheName('some-random-cache-name')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCacheableRecipeRequest
// ---------------------------------------------------------------------------

describe('isCacheableRecipeRequest', () => {
  const base = 'https://example.com';

  // Positive cases
  it('returns true for GET /api/v1/recipes', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes`, 'GET')).toBe(true);
  });

  it('returns true for GET /api/v1/recipes with query string', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes?tag=italian`, 'GET')).toBe(true);
  });

  it('returns true for GET /api/v1/recipes/abc-123', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes/abc-123`, 'GET')).toBe(true);
  });

  it('returns true for GET /api/v1/recipes/abc-123/image', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes/abc-123/image`, 'GET')).toBe(true);
  });

  // Negative: wrong HTTP method
  it('returns false for POST /api/v1/recipes', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes`, 'POST')).toBe(false);
  });

  it('returns false for PATCH /api/v1/recipes/abc-123', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes/abc-123`, 'PATCH')).toBe(false);
  });

  it('returns false for DELETE /api/v1/recipes/abc-123', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes/abc-123`, 'DELETE')).toBe(false);
  });

  // Negative: non-recipe paths
  it('returns false for GET /api/v1/shopping', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/shopping`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/planner', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/planner`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/auth/bootstrap', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/auth/bootstrap`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/extract/react', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/extract/react`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/keys/validate', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/keys/validate`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/dictionary', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/dictionary`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/health', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/health`, 'GET')).toBe(false);
  });

  it('returns false for GET /api/v1/recipes/abc-123/other (extra segment)', () => {
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes/abc-123/other`, 'GET')).toBe(false);
  });

  // Also works with URL objects
  it('accepts a URL object', () => {
    expect(isCacheableRecipeRequest(new URL(`${base}/api/v1/recipes`), 'GET')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// clearUserCaches
// ---------------------------------------------------------------------------

describe('clearUserCaches', () => {
  it('deletes only rd-user-* caches and leaves others untouched', async () => {
    const cacheNames = [
      'rd-user-hash1-vabc',
      'rd-shell-vabc',
      'rd-assets-vabc',
      'rd-user-hash2-vdef',
    ];
    const deleted: string[] = [];

    const fakeStorage = {
      keys: async () => cacheNames,
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    };

    await clearUserCaches(fakeStorage);

    expect(deleted).toHaveLength(2);
    expect(deleted).toContain('rd-user-hash1-vabc');
    expect(deleted).toContain('rd-user-hash2-vdef');
    expect(deleted).not.toContain('rd-shell-vabc');
    expect(deleted).not.toContain('rd-assets-vabc');
  });

  it('does nothing when there are no user caches', async () => {
    const fakeStorage = {
      keys: async () => ['rd-shell-vabc', 'rd-assets-vabc'],
      delete: vi.fn().mockResolvedValue(true),
    };

    await clearUserCaches(fakeStorage);

    expect(fakeStorage.delete).not.toHaveBeenCalled();
  });

  it('handles an empty cache storage', async () => {
    const fakeStorage = {
      keys: async () => [] as string[],
      delete: vi.fn().mockResolvedValue(true),
    };

    await clearUserCaches(fakeStorage);

    expect(fakeStorage.delete).not.toHaveBeenCalled();
  });
});
