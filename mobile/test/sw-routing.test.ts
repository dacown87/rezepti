/**
 * Unit tests for mobile/sw/routing.ts pure functions.
 * These run in Node (no browser globals needed) via Vitest.
 */
import { describe, it, expect } from 'vitest';
import { isNavigationRequest, isHashAsset } from '../sw/routing.js';

// ---------------------------------------------------------------------------
// isNavigationRequest
// ---------------------------------------------------------------------------

/**
 * Helper: build a minimal Request-like object. Node's `Request` rejects
 * `mode: 'navigate'` as invalid, so we use a cast for SW-specific modes.
 */
function makeRequest(url: string, init?: { mode?: RequestMode; headers?: Record<string, string> }): Request {
  // For modes that Node's Request constructor rejects (e.g. 'navigate'),
  // we construct a plain object that satisfies the shape our predicate reads.
  if (init?.mode === 'navigate') {
    const headers = new Headers(init.headers ?? {});
    return { url, mode: 'navigate', headers } as unknown as Request;
  }
  return new Request(url, init);
}

describe('isNavigationRequest', () => {
  it('returns true when mode is navigate', () => {
    const req = makeRequest('https://example.com/', { mode: 'navigate' });
    expect(isNavigationRequest(req)).toBe(true);
  });

  it('returns true when Accept header includes text/html (no navigate mode)', () => {
    const req = makeRequest('https://example.com/', {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
    });
    expect(isNavigationRequest(req)).toBe(true);
  });

  it('returns true when Accept header is exactly text/html', () => {
    const req = makeRequest('https://example.com/recipe/42', {
      headers: { Accept: 'text/html' },
    });
    expect(isNavigationRequest(req)).toBe(true);
  });

  it('returns false for a JSON API request (no navigate mode, no html accept)', () => {
    const req = makeRequest('https://example.com/api/v1/recipes', {
      headers: { Accept: 'application/json' },
    });
    expect(isNavigationRequest(req)).toBe(false);
  });

  it('returns false for a script/asset fetch (mode cors, no html accept)', () => {
    const req = makeRequest('https://example.com/_expo/static/js/web/entry-abc123.js', {
      headers: { Accept: '*/*' },
    });
    expect(isNavigationRequest(req)).toBe(false);
  });

  it('returns false for a request with no Accept header and default mode', () => {
    const req = makeRequest('https://example.com/api/v1/health');
    expect(isNavigationRequest(req)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isHashAsset
// ---------------------------------------------------------------------------

describe('isHashAsset', () => {
  it('returns true for a JS chunk under /_expo/static/js/web/', () => {
    expect(
      isHashAsset('https://example.com/_expo/static/js/web/entry-8dd103be87393f56c7b89979b5833c3c.js'),
    ).toBe(true);
  });

  it('returns true for a CSS file under /_expo/static/css/', () => {
    expect(
      isHashAsset('https://example.com/_expo/static/css/web-494e08cf39d4823eb86d8edf085fdf41.css'),
    ).toBe(true);
  });

  it('returns true when passed a URL object', () => {
    const url = new URL('https://example.com/_expo/static/js/web/purify-b034a622e758f0104e7d086910c777af.js');
    expect(isHashAsset(url)).toBe(true);
  });

  it('returns false for the root path', () => {
    expect(isHashAsset('https://example.com/')).toBe(false);
  });

  it('returns false for an API path', () => {
    expect(isHashAsset('https://example.com/api/v1/recipes')).toBe(false);
  });

  it('returns false for /index.html (not a hashed asset)', () => {
    expect(isHashAsset('https://example.com/index.html')).toBe(false);
  });

  it('returns false for a path that merely contains _expo but is not under /_expo/static/', () => {
    expect(isHashAsset('https://example.com/about/_expo/something')).toBe(false);
  });
});
