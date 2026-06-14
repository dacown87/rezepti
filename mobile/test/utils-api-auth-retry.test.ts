import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Regression: a long extraction in a backgrounded PWA suspends Supabase's
// auto-refresh timer, so the access token expires and every API call returns
// 401 until the user manually logs out/in. apiFetch must, on a 401, force one
// token refresh and retry exactly once before surfacing the error.

const state = vi.hoisted(() => ({
  getAuthHeaders: vi.fn(),
  refreshAuthSession: vi.fn(),
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn().mockResolvedValue('https://api.test'),
}));

vi.mock('@/utils/auth', () => ({
  getAuthHeaders: state.getAuthHeaders,
  refreshAuthSession: state.refreshAuthSession,
}));

function res(status: number): Response {
  return new Response(status === 204 ? null : 'body', { status });
}

describe('apiFetch 401 recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getAuthHeaders.mockResolvedValue(new Headers({ Authorization: 'Bearer stale' }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the session and retries exactly once on 401, returning the retry response', async () => {
    state.refreshAuthSession.mockResolvedValue({ access_token: 'fresh' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('@/utils/api');
    const out = await apiFetch('/api/v1/recipes');

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.refreshAuthSession).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the refresh fails (refresh token also dead)', async () => {
    state.refreshAuthSession.mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue(res(401));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('@/utils/api');
    const out = await apiFetch('/api/v1/recipes');

    expect(out.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.refreshAuthSession).toHaveBeenCalledTimes(1);
  });

  it('does not loop: a second 401 after a successful refresh is returned as-is', async () => {
    state.refreshAuthSession.mockResolvedValue({ access_token: 'fresh' });
    const fetchMock = vi.fn().mockResolvedValue(res(401));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('@/utils/api');
    const out = await apiFetch('/api/v1/recipes');

    expect(out.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.refreshAuthSession).toHaveBeenCalledTimes(1);
  });

  it('does not refresh or retry on a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('@/utils/api');
    const out = await apiFetch('/api/v1/recipes');

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.refreshAuthSession).not.toHaveBeenCalled();
  });

  it('does not retry non-401 errors (e.g. 500)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(500));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('@/utils/api');
    const out = await apiFetch('/api/v1/recipes');

    expect(out.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.refreshAuthSession).not.toHaveBeenCalled();
  });
});
