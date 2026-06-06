import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiRequestError,
  assertApiOk,
  deleteRecipe,
  fetchRecipeById,
  fetchRecipes,
  patchRecipe,
  readApiError,
} from '@/utils/api';

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn().mockResolvedValue('https://api.test'),
}));

describe('utils/api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchRecipes returns array payload directly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: 1, name: 'A', ingredients: '[]', steps: '[]' }]),
    }));

    const data = await fetchRecipes();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(1);
  });

  it('fetchRecipes falls back to data.recipes when response is an object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ recipes: [{ id: 2, name: 'B', ingredients: '[]', steps: '[]' }] }),
    }));

    const data = await fetchRecipes();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(2);
  });

  it('fetchRecipes throws on non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchRecipes()).rejects.toThrow('Server-Fehler 503');
  });

  it('fetchRecipes preserves auth_missing for login-required recipe reads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'auth_missing',
        message: 'Missing Authorization Bearer token',
        fix: 'Sign in and retry with the session access token',
      },
    }), { status: 401 })));

    await expect(fetchRecipes()).rejects.toMatchObject({
      status: 401,
      code: 'auth_missing',
      message: 'Missing Authorization Bearer token (auth_missing)',
    });
  });

  it('readApiError preserves stable auth error codes from the server envelope', async () => {
    const response = new Response(JSON.stringify({
      error: {
        code: 'no_household',
        message: 'User has no active household',
        cause: 'Shopping and planner endpoints are household-scoped',
        fix: 'Create a default household and membership for this user',
      },
    }), { status: 403 });

    const error = await readApiError(response, 'Fallback');
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(403);
    expect(error.code).toBe('no_household');
    expect(error.causeText).toBe('Shopping and planner endpoints are household-scoped');
    expect(error.fix).toBe('Create a default household and membership for this user');
    expect(error.message).toBe('User has no active household (no_household)');
  });

  it('assertApiOk falls back when the response is not a JSON error envelope', async () => {
    const response = new Response('Service unavailable', { status: 503 });
    await expect(assertApiOk(response, 'Server-Fehler 503')).rejects.toMatchObject({
      status: 503,
      message: 'Server-Fehler 503',
    });
  });

  it('fetchRecipes returns empty array for malformed successful payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ recipes: null }),
    }));

    const data = await fetchRecipes();
    expect(data).toEqual([]);
  });

  it('fetchRecipes propagates JSON parse errors from response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON payload')),
    }));

    await expect(fetchRecipes()).rejects.toThrow('Invalid JSON payload');
  });

  it('fetchRecipeById throws with id-specific error when response is non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchRecipeById(99)).rejects.toThrow('Rezept nicht gefunden (404)');
  });

  it('fetchRecipeById returns parsed recipe on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 7, name: 'Suppe', ingredients: '[]', steps: '[]' }),
    }));

    const recipe = await fetchRecipeById(7);
    expect(recipe.id).toBe(7);
    expect(recipe.name).toBe('Suppe');
  });

  it('patchRecipe sends PATCH and throws on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(patchRecipe(5, { rating: 4 })).rejects.toThrow('PATCH fehlgeschlagen (500)');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/recipes/5',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 4 }),
      })
    );
  });

  it('patchRecipe resolves successfully on ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(patchRecipe(5, { notes: 'ok' })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/recipes/5',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ notes: 'ok' }),
      })
    );
  });

  it('deleteRecipe sends DELETE and throws on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteRecipe(8)).rejects.toThrow('DELETE fehlgeschlagen (409)');
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/recipes/8', { method: 'DELETE' });
  });

  it('deleteRecipe resolves successfully on ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteRecipe(8)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('https://api.test/api/v1/recipes/8', { method: 'DELETE' });
  });
});
