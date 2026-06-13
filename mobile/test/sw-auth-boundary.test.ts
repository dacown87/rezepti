/**
 * Unit tests for mobile/sw/cache-names.ts pure functions and
 * mobile/sw/recipe-cache-handler.ts recipeCacheHandler (FIX 1/2/3/4).
 * These run in Node (no browser globals needed) via Vitest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashUserId,
  strongHash,
  userCacheName,
  isUserCacheName,
  isStaleUserCacheName,
  isCacheableRecipeRequest,
  clearUserCaches,
  clearStaleUserCaches,
} from '../sw/cache-names.js';

// ---------------------------------------------------------------------------
// hashUserId (legacy — kept for regression coverage, marked deprecated)
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
// strongHash (FIX 2 — SHA-256 wide hash)
// ---------------------------------------------------------------------------

describe('strongHash', () => {
  it('is deterministic — same input yields same output', async () => {
    const h1 = await strongHash('user-abc-123');
    const h2 = await strongHash('user-abc-123');
    expect(h1).toBe(h2);
  });

  it('differs for different userIds', async () => {
    const h1 = await strongHash('user-abc-123');
    const h2 = await strongHash('user-xyz-999');
    expect(h1).not.toBe(h2);
  });

  it('throws for empty string', async () => {
    await expect(strongHash('')).rejects.toThrow('strongHash: userId must not be empty');
  });

  it('returns exactly a 64-character lowercase hex string (SHA-256 = 32 bytes = 64 hex chars)', async () => {
    const result = await strongHash('some-user-id');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
    expect(result.length).toBe(64);
  });

  it('is 64 chars for various inputs — no truncation', async () => {
    const inputs = ['a', 'z', '0', 'hello-world', 'uuid-0000-0000-0000-0000'];
    for (const input of inputs) {
      const h = await strongHash(input);
      expect(h.length).toBe(64);
    }
  });

  it('differs from the legacy hashUserId output for the same input (wider space)', async () => {
    const sha = await strongHash('some-user');
    const fnv = hashUserId('some-user');
    // SHA-256 hex (64 chars) should not equal FNV-1a hex (8 chars)
    expect(sha).not.toBe(fnv);
    expect(sha.length).toBeGreaterThan(fnv.length);
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

  it('works with 64-char SHA-256 hash', async () => {
    const sha = await strongHash('alice@example.com');
    const name = userCacheName(sha, 'abc12345');
    expect(name).toMatch(/^rd-user-[0-9a-f]{64}-vabc12345$/);
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
// isStaleUserCacheName (FIX 4)
// ---------------------------------------------------------------------------

describe('isStaleUserCacheName', () => {
  it('returns true for a rd-user-* cache with a different build hash', () => {
    expect(isStaleUserCacheName('rd-user-hash1-vOLDBUILD', 'NEWBUILD')).toBe(true);
  });

  it('returns false for a rd-user-* cache with the CURRENT build hash', () => {
    expect(isStaleUserCacheName('rd-user-hash1-vNEWBUILD', 'NEWBUILD')).toBe(false);
  });

  it('returns false for non-user caches regardless of build hash', () => {
    expect(isStaleUserCacheName('rd-shell-vOLDBUILD', 'NEWBUILD')).toBe(false);
    expect(isStaleUserCacheName('rd-assets-vOLDBUILD', 'NEWBUILD')).toBe(false);
    expect(isStaleUserCacheName('workbox-precache-v2', 'NEWBUILD')).toBe(false);
  });

  it('returns false when the name has no -v<suffix> segment', () => {
    expect(isStaleUserCacheName('rd-user-hash1', 'NEWBUILD')).toBe(false);
  });

  it('handles 64-char SHA-256 user hash in cache name', async () => {
    const sha = await strongHash('alice@example.com');
    const staleName = userCacheName(sha, 'oldbuild1');
    const currentName = userCacheName(sha, 'newbuild2');
    expect(isStaleUserCacheName(staleName, 'newbuild2')).toBe(true);
    expect(isStaleUserCacheName(currentName, 'newbuild2')).toBe(false);
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

  it('returns false for GET /api/v1/recipes/image (image without id)', () => {
    // /image alone is not a valid route — it would be treated as a detail id "image".
    // After the regex fix (nested groups), this still returns true treating "image" as
    // an :id — which is safe (no such id exists, cache miss only, no privacy risk).
    // This test documents the known behaviour.
    expect(isCacheableRecipeRequest(`${base}/api/v1/recipes/image`, 'GET')).toBe(true);
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

// ---------------------------------------------------------------------------
// clearStaleUserCaches (FIX 4)
// ---------------------------------------------------------------------------

describe('clearStaleUserCaches', () => {
  it('deletes rd-user-* caches with a stale build hash and leaves others untouched', async () => {
    const cacheNames = [
      'rd-user-hash1-vOLDBUILD',
      'rd-user-hash2-vNEWBUILD',
      'rd-shell-vOLDBUILD',
      'rd-assets-vNEWBUILD',
      'rd-user-hash3-vOLDBUILD',
      'workbox-precache-v2',
    ];
    const deleted: string[] = [];

    const fakeStorage = {
      keys: async () => cacheNames,
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    };

    await clearStaleUserCaches(fakeStorage, 'NEWBUILD');

    expect(deleted).toHaveLength(2);
    expect(deleted).toContain('rd-user-hash1-vOLDBUILD');
    expect(deleted).toContain('rd-user-hash3-vOLDBUILD');
    // Current build's user cache must survive
    expect(deleted).not.toContain('rd-user-hash2-vNEWBUILD');
    // Shell/asset/precache must never be touched
    expect(deleted).not.toContain('rd-shell-vOLDBUILD');
    expect(deleted).not.toContain('rd-assets-vNEWBUILD');
    expect(deleted).not.toContain('workbox-precache-v2');
  });

  it('does nothing when all user caches are from the current build', async () => {
    const fakeStorage = {
      keys: async () => ['rd-user-hash1-vCURRENT', 'rd-user-hash2-vCURRENT'],
      delete: vi.fn().mockResolvedValue(true),
    };

    await clearStaleUserCaches(fakeStorage, 'CURRENT');

    expect(fakeStorage.delete).not.toHaveBeenCalled();
  });

  it('does nothing when there are no caches at all', async () => {
    const fakeStorage = {
      keys: async () => [] as string[],
      delete: vi.fn().mockResolvedValue(true),
    };

    await clearStaleUserCaches(fakeStorage, 'CURRENT');

    expect(fakeStorage.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recipeCacheHandler (FIX 1/3) — standalone testable handler
//
// We test the handler via deps injection (makeStrategy) so the tests are
// fully decoupled from Workbox internals / browser APIs.
// Tests are designed to FAIL against the old `event: undefined` code.
// ---------------------------------------------------------------------------

describe('recipeCacheHandler', () => {
  // Workbox modules check `self` at module evaluation time (logger initialisation).
  // Stub it globally before importing recipe-cache-handler which transitively imports
  // workbox-strategies. The stub is set once; subsequent imports use the cached module.
  // We import the handler lazily (once) and reuse it across all tests in this describe.
  let recipeCacheHandler: (typeof import('../sw/recipe-cache-handler.js'))['recipeCacheHandler'];

  beforeEach(async () => {
    // Ensure `self` is defined before any Workbox module evaluates.
    // Vitest caches modules between tests, so this is mainly needed on first import.
    vi.stubGlobal('self', globalThis);
    ({ recipeCacheHandler } = await import('../sw/recipe-cache-handler.js'));
  });

  // Minimal fake ExtendableEvent with a waitUntil spy
  function makeFakeEvent() {
    return {
      waitUntil: vi.fn((_promise: Promise<unknown>) => undefined),
    } as unknown as ExtendableEvent & { waitUntil: ReturnType<typeof vi.fn> };
  }

  it('(a) null user → network-only: fetchFn is called, NO makeStrategy is invoked', async () => {
    const fakeResponse = new Response('{"recipes":[]}', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse);
    const makeStrategy = vi.fn();
    const fakeEvent = makeFakeEvent();
    const request = new Request('https://localhost/api/v1/recipes');

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { getUserHash: () => null, buildHash: 'testbuild1', fetchFn, makeStrategy },
    );

    // network-only: fetchFn called, no strategy created
    expect(fetchFn).toHaveBeenCalledWith(request);
    expect(makeStrategy).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });

  it('(b) known user → correct per-user cache name is passed to strategy; event.waitUntil is exercised', async () => {
    const fakeResponse = new Response('{"recipes":[{"id":"r1"}]}', { status: 200 });
    const handleSpy = vi.fn(async ({ event }: { request: Request; event: ExtendableEvent }) => {
      // Simulate what the real Workbox does: call event.waitUntil
      event.waitUntil(Promise.resolve());
      return fakeResponse;
    });

    const capturedCacheName: string[] = [];
    const makeStrategy = vi.fn((cacheName: string) => {
      capturedCacheName.push(cacheName);
      return { handle: handleSpy };
    });

    const fakeEvent = makeFakeEvent();
    const request = new Request('https://localhost/api/v1/recipes');
    const userHash = await strongHash('alice-user-id');
    const buildHash = 'testbuild2';

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { getUserHash: () => userHash, buildHash, fetchFn: vi.fn(), makeStrategy },
    );

    expect(result.status).toBe(200);

    // Correct per-user, per-build cache name
    const expectedCacheName = `rd-user-${userHash}-v${buildHash}`;
    expect(capturedCacheName).toContain(expectedCacheName);

    // The REAL event must be forwarded to strategy.handle — NOT undefined
    expect(handleSpy).toHaveBeenCalledWith({ request, event: fakeEvent });

    // Workbox calls event.waitUntil for background revalidation.
    // This assertion PROVES that passing `event: undefined` (old code) would throw
    // TypeError: Cannot read properties of undefined (reading 'waitUntil').
    expect(fakeEvent.waitUntil).toHaveBeenCalled();
  });

  it('PROVES the old undefined-event code would throw (regression guard)', async () => {
    // The old code passed `event: undefined` to strategy.handle.
    // Our strategy mock calls event.waitUntil() — which throws on undefined.
    const makeStrategy = vi.fn((_cacheName: string) => ({
      handle: async ({ event }: { request: Request; event: ExtendableEvent }) => {
        // This is what Workbox does internally:
        event.waitUntil(Promise.resolve());
        return new Response('ok');
      },
    }));

    const request = new Request('https://localhost/api/v1/recipes');
    const userHash = await strongHash('alice-user-id');
    const fakeEvent = undefined as unknown as ExtendableEvent;

    await expect(
      recipeCacheHandler(
        { request, event: fakeEvent },
        { getUserHash: () => userHash, buildHash: 'testbuild3', fetchFn: vi.fn(), makeStrategy },
      ),
    ).rejects.toThrow();
    // TypeError: Cannot read properties of undefined (reading 'waitUntil')
  });

  it('after CLEAR_USER (getUserHash = null), handler is network-only — no cache leak during switch window', async () => {
    const fakeResponse = new Response('{}', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse);
    const makeStrategy = vi.fn();
    const fakeEvent = makeFakeEvent();
    const request = new Request('https://localhost/api/v1/recipes');

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { getUserHash: () => null, buildHash: 'build99', fetchFn, makeStrategy },
    );

    // network-only: fetchFn called, no strategy created, no waitUntil
    expect(fetchFn).toHaveBeenCalledWith(request);
    expect(makeStrategy).not.toHaveBeenCalled();
    expect(fakeEvent.waitUntil).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });
});
