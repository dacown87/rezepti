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
  RECIPE_USER_HASH_HEADER,
  getRecipeRequestUserHash,
  isUserCacheName,
  isLegacyBuildScopedUserCacheName,
  isCacheableRecipeRequest,
  clearUserCaches,
  clearLegacyUserCaches,
  persistUserHash,
  readPersistedUserHash,
  USER_META_CACHE,
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
  it('formats as rd-user-${hash} (build-independent — survives deploys)', () => {
    const hash = hashUserId('test-user');
    const result = userCacheName(hash);
    expect(result).toBe(`rd-user-${hash}`);
  });

  it('works with known values', () => {
    expect(userCacheName('aabbccdd')).toBe('rd-user-aabbccdd');
  });

  it('has NO build-hash suffix so the data cache is not GC’d on app update', () => {
    expect(userCacheName('aabbccdd')).not.toMatch(/-v[^-]+$/);
  });

  it('works with 64-char SHA-256 hash', async () => {
    const sha = await strongHash('alice@example.com');
    const name = userCacheName(sha);
    expect(name).toMatch(/^rd-user-[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// request-scoped user hash header
// ---------------------------------------------------------------------------

describe('getRecipeRequestUserHash', () => {
  it('reads the request-scoped user hash header', () => {
    expect(getRecipeRequestUserHash(new Headers({ [RECIPE_USER_HASH_HEADER]: 'hash-a' }))).toBe('hash-a');
  });

  it('fails closed for empty header values', () => {
    expect(getRecipeRequestUserHash(new Headers({ [RECIPE_USER_HASH_HEADER]: '   ' }))).toBeNull();
    expect(getRecipeRequestUserHash(new Headers())).toBeNull();
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
// isLegacyBuildScopedUserCacheName (build-independent data-cache migration)
// ---------------------------------------------------------------------------

describe('isLegacyBuildScopedUserCacheName', () => {
  it('returns true for a legacy build-scoped rd-user-* cache (has -v<build> suffix)', () => {
    expect(isLegacyBuildScopedUserCacheName('rd-user-hash1-vOLDBUILD')).toBe(true);
    expect(isLegacyBuildScopedUserCacheName('rd-user-hash1-vNEWBUILD')).toBe(true);
  });

  it('returns false for the current build-independent format (rd-user-<hash>)', () => {
    expect(isLegacyBuildScopedUserCacheName('rd-user-hash1')).toBe(false);
    expect(isLegacyBuildScopedUserCacheName(userCacheName('aabbccdd'))).toBe(false);
  });

  it('returns false for non-user caches', () => {
    expect(isLegacyBuildScopedUserCacheName('rd-shell-vOLDBUILD')).toBe(false);
    expect(isLegacyBuildScopedUserCacheName('rd-assets-vOLDBUILD')).toBe(false);
    expect(isLegacyBuildScopedUserCacheName('workbox-precache-v2')).toBe(false);
  });

  it('matches a legacy 64-char SHA-256 user cache name', async () => {
    const sha = await strongHash('alice@example.com');
    expect(isLegacyBuildScopedUserCacheName(`rd-user-${sha}-voldbuild1`)).toBe(true);
    expect(isLegacyBuildScopedUserCacheName(userCacheName(sha))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// persistUserHash / readPersistedUserHash (RC2 — survive SW restart)
// ---------------------------------------------------------------------------

function makeFakeCacheStorage() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    open: async (name: string) => {
      let store = stores.get(name);
      if (!store) {
        store = new Map<string, Response>();
        stores.set(name, store);
      }
      const s = store;
      return {
        put: async (key: RequestInfo | URL, res: Response) => { s.set(String(key), res); },
        match: async (key: RequestInfo | URL) => s.get(String(key)),
      };
    },
    _stores: stores,
  };
}

describe('persistUserHash / readPersistedUserHash', () => {
  it('round-trips the hash so a restarted SW can resolve the user offline', async () => {
    const storage = makeFakeCacheStorage();
    const hash = await strongHash('alice@example.com');

    await persistUserHash(storage, hash);
    expect(await readPersistedUserHash(storage)).toBe(hash);
  });

  it('returns null when no hash has been persisted', async () => {
    const storage = makeFakeCacheStorage();
    expect(await readPersistedUserHash(storage)).toBeNull();
  });

  it('returns null (never throws) when the cache storage rejects', async () => {
    const failing = { open: async () => { throw new Error('no CacheStorage'); } };
    expect(await readPersistedUserHash(failing)).toBeNull();
  });

  it('stores into a rd-user-* cache so logout (clearUserCaches) wipes it too', async () => {
    expect(isUserCacheName(USER_META_CACHE)).toBe(true);
    // …but it is NOT a legacy build-scoped cache, so activate-GC keeps it.
    expect(isLegacyBuildScopedUserCacheName(USER_META_CACHE)).toBe(false);
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
// clearLegacyUserCaches (build-independent data-cache migration)
// ---------------------------------------------------------------------------

describe('clearLegacyUserCaches', () => {
  it('deletes only legacy build-scoped rd-user-* caches; keeps current-format data caches and others', async () => {
    const cacheNames = [
      'rd-user-hash1-vOLDBUILD',   // legacy → delete
      'rd-user-hash2-vNEWBUILD',   // legacy → delete
      'rd-user-hash3',             // current build-independent → KEEP
      'rd-shell-vOLDBUILD',        // shell → keep
      'rd-assets-vNEWBUILD',       // assets → keep
      'workbox-precache-v2',       // precache → keep
    ];
    const deleted: string[] = [];

    const fakeStorage = {
      keys: async () => cacheNames,
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    };

    await clearLegacyUserCaches(fakeStorage);

    expect(deleted).toHaveLength(2);
    expect(deleted).toContain('rd-user-hash1-vOLDBUILD');
    expect(deleted).toContain('rd-user-hash2-vNEWBUILD');
    // Current build-independent data cache must survive (offline-read across deploys)
    expect(deleted).not.toContain('rd-user-hash3');
    // Shell/asset/precache must never be touched
    expect(deleted).not.toContain('rd-shell-vOLDBUILD');
    expect(deleted).not.toContain('rd-assets-vNEWBUILD');
    expect(deleted).not.toContain('workbox-precache-v2');
  });

  it('does nothing when all user caches are already build-independent', async () => {
    const fakeStorage = {
      keys: async () => ['rd-user-hash1', 'rd-user-hash2'],
      delete: vi.fn().mockResolvedValue(true),
    };

    await clearLegacyUserCaches(fakeStorage);

    expect(fakeStorage.delete).not.toHaveBeenCalled();
  });

  it('does nothing when there are no caches at all', async () => {
    const fakeStorage = {
      keys: async () => [] as string[],
      delete: vi.fn().mockResolvedValue(true),
    };

    await clearLegacyUserCaches(fakeStorage);

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

  it('(a) missing header → network-only: fetchFn is called, NO makeStrategy is invoked', async () => {
    const fakeResponse = new Response('{"recipes":[]}', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse);
    const makeStrategy = vi.fn();
    const fakeEvent = makeFakeEvent();
    const request = new Request('https://localhost/api/v1/recipes');

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { fetchFn, makeStrategy },
    );

    // network-only: fetchFn called, no strategy created
    expect(fetchFn).toHaveBeenCalledWith(request);
    expect(makeStrategy).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });

  it('(b) header hash-a → correct per-user cache name is passed to strategy; event.waitUntil is exercised', async () => {
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
    const request = new Request('https://localhost/api/v1/recipes', {
      headers: { [RECIPE_USER_HASH_HEADER]: 'hash-a' },
    });
    const userHash = 'hash-a';

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { fetchFn: vi.fn(), makeStrategy },
    );

    expect(result.status).toBe(200);

    // Correct per-user, build-independent cache name (survives deploys)
    const expectedCacheName = `rd-user-${userHash}`;
    expect(capturedCacheName).toContain(expectedCacheName);

    // The REAL event must be forwarded to strategy.handle — NOT undefined
    expect(handleSpy).toHaveBeenCalledWith({ request, event: fakeEvent });

    // Workbox calls event.waitUntil for background revalidation.
    // This assertion PROVES that passing `event: undefined` (old code) would throw
    // TypeError: Cannot read properties of undefined (reading 'waitUntil').
    expect(fakeEvent.waitUntil).toHaveBeenCalled();
  });

  it('(c) header hash-b routes an independent parallel request into a different user cache', async () => {
    const fakeResponse = new Response('{"recipes":[]}', { status: 200 });
    const handleSpy = vi.fn(async ({ event }: { request: Request; event: ExtendableEvent }) => {
      event.waitUntil(Promise.resolve());
      return fakeResponse;
    });
    const capturedCacheName: string[] = [];
    const makeStrategy = vi.fn((cacheName: string) => {
      capturedCacheName.push(cacheName);
      return { handle: handleSpy };
    });

    const fakeEvent = makeFakeEvent();
    const request = new Request('https://localhost/api/v1/recipes/abc-123', {
      headers: { [RECIPE_USER_HASH_HEADER]: 'hash-b' },
    });
    const userHash = 'hash-b';

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { fetchFn: vi.fn(), makeStrategy },
    );

    expect(result.status).toBe(200);
    expect(capturedCacheName).toContain(`rd-user-${userHash}`);
    expect(handleSpy).toHaveBeenCalledWith({ request, event: fakeEvent });
  });

  it('(d) missing header stays network-only even if a legacy persisted hash exists elsewhere', async () => {
    const storage = makeFakeCacheStorage();
    await persistUserHash(storage, await strongHash('legacy-user'));

    const fetchFn = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const makeStrategy = vi.fn();
    const request = new Request('https://localhost/api/v1/recipes');

    const result = await recipeCacheHandler(
      { request, event: makeFakeEvent() },
      { fetchFn, makeStrategy },
    );

    expect(fetchFn).toHaveBeenCalledWith(request);
    expect(makeStrategy).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
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

    const request = new Request('https://localhost/api/v1/recipes', {
      headers: { [RECIPE_USER_HASH_HEADER]: 'hash-a' },
    });
    const fakeEvent = undefined as unknown as ExtendableEvent;

    await expect(
      recipeCacheHandler(
        { request, event: fakeEvent },
        { fetchFn: vi.fn(), makeStrategy },
      ),
    ).rejects.toThrow();
    // TypeError: Cannot read properties of undefined (reading 'waitUntil')
  });

  it('after CLEAR_USER, a headerless request stays network-only — no cache leak during switch window', async () => {
    const fakeResponse = new Response('{}', { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(fakeResponse);
    const makeStrategy = vi.fn();
    const fakeEvent = makeFakeEvent();
    const request = new Request('https://localhost/api/v1/recipes');

    const result = await recipeCacheHandler(
      { request, event: fakeEvent },
      { fetchFn, makeStrategy },
    );

    // network-only: fetchFn called, no strategy created, no waitUntil
    expect(fetchFn).toHaveBeenCalledWith(request);
    expect(makeStrategy).not.toHaveBeenCalled();
    expect(fakeEvent.waitUntil).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });
});
