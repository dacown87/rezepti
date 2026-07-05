/**
 * Unit tests for the collections / sharing / favorites API service functions.
 * Follows the pattern established in mobile/test/utils-api.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  invalidateCachedRecipeReads,
  shareRecipe,
  setRecipeFavorite,
  fetchCollections,
  fetchCollectionItems,
  createCollection,
  renameCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  type Collection,
  type ApiRecipe,
} from '@/utils/api';

const state = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  refreshAuthSession: vi.fn(),
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn().mockResolvedValue('https://api.test'),
}));

vi.mock('@/utils/auth', () => ({
  getAuthSession: state.getAuthSession,
  refreshAuthSession: state.refreshAuthSession,
}));

function getHeader(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

function okJson(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

function errorResponse(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body ? JSON.stringify(body) : '', { status }),
  );
}

const RECIPE_FIXTURE: ApiRecipe = {
  id: 42,
  name: 'Pasta',
  ingredients: '[]',
  steps: '[]',
  scope: 'household',
  isFavorite: false,
  canShareToHousehold: false,
  canCopyToPrivate: true,
};

const COLLECTION_FIXTURE: Collection = {
  id: 'coll-1',
  kind: 'custom',
  name: 'Favoriten',
  owner_type: 'user',
  item_count: 3,
  is_system: false,
};

describe('collections / sharing / favorites API service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getAuthSession.mockResolvedValue({
      access_token: 'token-x',
      user: { id: 'user-x' },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── shareRecipe ─────────────────────────────────────────────────────────────

  describe('shareRecipe', () => {
    it('sends POST to /api/v1/recipes/:id/share with correct body and returns new recipe', async () => {
      const fetchMock = okJson({ recipe: RECIPE_FIXTURE }, 201);
      vi.stubGlobal('fetch', fetchMock);

      const result = await shareRecipe(42, 'household');

      expect(result).toEqual(RECIPE_FIXTURE);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipes/42/share');
      expect(init.method).toBe('POST');
      expect(getHeader(init, 'Content-Type')).toBe('application/json');
      expect(getHeader(init, 'Authorization')).toBe('Bearer token-x');
      expect(JSON.parse(init.body as string)).toEqual({ target: { type: 'household' } });
    });

    it('sends target.type="user" when target is "user"', async () => {
      const fetchMock = okJson({ recipe: RECIPE_FIXTURE }, 201);
      vi.stubGlobal('fetch', fetchMock);

      await shareRecipe(7, 'user');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ target: { type: 'user' } });
    });

    it('throws ApiRequestError on 404 (foreign recipe)', async () => {
      vi.stubGlobal('fetch', errorResponse(404, { error: { code: 'not_found', message: 'Not found' } }));
      await expect(shareRecipe(99, 'household')).rejects.toBeInstanceOf(ApiRequestError);
      await expect(shareRecipe(99, 'household')).rejects.toMatchObject({ status: 404 });
    });

    it('throws ApiRequestError on 400 (no active household)', async () => {
      vi.stubGlobal('fetch', errorResponse(400, { error: { code: 'no_household', message: 'No active household' } }));
      await expect(shareRecipe(1, 'household')).rejects.toBeInstanceOf(ApiRequestError);
      await expect(shareRecipe(1, 'household')).rejects.toMatchObject({ status: 400, code: 'no_household' });
    });
  });

  describe('invalidateCachedRecipeReads', () => {
    it('removes list/search variants while preserving unrelated recipe details', async () => {
      const requests = [
        new Request('https://api.test/api/v1/recipes'),
        new Request('https://api.test/api/v1/recipes?ingredients=tomato'),
        new Request('https://api.test/api/v1/recipes/42'),
      ];
      const deleteMock = vi.fn().mockResolvedValue(true);
      const openMock = vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue(requests),
        delete: deleteMock,
      });
      vi.stubGlobal('caches', { open: openMock });

      await invalidateCachedRecipeReads();

      expect(openMock).toHaveBeenCalledWith(expect.stringMatching(/^rd-user-[0-9a-f]{64}$/));
      expect(deleteMock).toHaveBeenCalledTimes(2);
      expect(deleteMock).toHaveBeenCalledWith(requests[0]);
      expect(deleteMock).toHaveBeenCalledWith(requests[1]);
    });

    it('also removes the mutated detail but preserves its cached image', async () => {
      const requests = [
        new Request('https://api.test/api/v1/recipes'),
        new Request('https://api.test/api/v1/recipes/42'),
        new Request('https://api.test/api/v1/recipes/42/image'),
        new Request('https://api.test/api/v1/recipes/43'),
      ];
      const deleteMock = vi.fn().mockResolvedValue(true);
      vi.stubGlobal('caches', {
        open: vi.fn().mockResolvedValue({
          keys: vi.fn().mockResolvedValue(requests),
          delete: deleteMock,
        }),
      });

      await invalidateCachedRecipeReads(42);

      const deletedUrls = deleteMock.mock.calls.map(([request]) => (request as Request).url);
      expect(deletedUrls).toEqual([
        'https://api.test/api/v1/recipes',
        'https://api.test/api/v1/recipes/42',
      ]);
    });
  });

  // ── setRecipeFavorite ────────────────────────────────────────────────────────

  describe('setRecipeFavorite', () => {
    it('sends POST to /api/v1/recipes/:id/favorite when on=true and returns isFavorite', async () => {
      const fetchMock = okJson({ success: true, isFavorite: true });
      vi.stubGlobal('fetch', fetchMock);

      const result = await setRecipeFavorite(5, true);

      expect(result).toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipes/5/favorite');
      expect(init.method).toBe('POST');
    });

    it('sends DELETE to /api/v1/recipes/:id/favorite when on=false and returns isFavorite', async () => {
      const fetchMock = okJson({ success: true, isFavorite: false });
      vi.stubGlobal('fetch', fetchMock);

      const result = await setRecipeFavorite(5, false);

      expect(result).toBe(false);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipes/5/favorite');
      expect(init.method).toBe('DELETE');
    });

    it('throws ApiRequestError on 404', async () => {
      vi.stubGlobal('fetch', errorResponse(404));
      await expect(setRecipeFavorite(99, true)).rejects.toBeInstanceOf(ApiRequestError);
      await expect(setRecipeFavorite(99, true)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── fetchCollections ─────────────────────────────────────────────────────────

  describe('fetchCollections', () => {
    it('sends GET to /api/v1/recipe-collections and returns collections array', async () => {
      const fetchMock = okJson({ collections: [COLLECTION_FIXTURE] });
      vi.stubGlobal('fetch', fetchMock);

      const result = await fetchCollections();

      expect(result).toEqual([COLLECTION_FIXTURE]);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections');
      expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    });

    it('throws ApiRequestError on non-ok responses', async () => {
      vi.stubGlobal('fetch', errorResponse(500));
      await expect(fetchCollections()).rejects.toBeInstanceOf(ApiRequestError);
      await expect(fetchCollections()).rejects.toMatchObject({ status: 500 });
    });
  });

  // ── fetchCollectionItems ─────────────────────────────────────────────────────

  describe('fetchCollectionItems', () => {
    it('sends GET to /api/v1/recipe-collections/:id/items and returns recipes array', async () => {
      const fetchMock = okJson({ recipes: [RECIPE_FIXTURE] });
      vi.stubGlobal('fetch', fetchMock);

      const result = await fetchCollectionItems('coll-1');

      expect(result).toEqual([RECIPE_FIXTURE]);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections/coll-1/items');
      expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    });

    it('returns [] when the payload has no recipes field', async () => {
      const fetchMock = okJson({});
      vi.stubGlobal('fetch', fetchMock);
      await expect(fetchCollectionItems('coll-1')).resolves.toEqual([]);
    });

    it('throws ApiRequestError on 404 (invisible/foreign collection)', async () => {
      vi.stubGlobal('fetch', errorResponse(404));
      await expect(fetchCollectionItems('coll-x')).rejects.toBeInstanceOf(ApiRequestError);
      await expect(fetchCollectionItems('coll-x')).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── createCollection ─────────────────────────────────────────────────────────

  describe('createCollection', () => {
    it('sends POST with name and returns the new collection', async () => {
      const fetchMock = okJson({ collection: COLLECTION_FIXTURE }, 201);
      vi.stubGlobal('fetch', fetchMock);

      const result = await createCollection({ name: 'Favoriten' });

      expect(result).toEqual(COLLECTION_FIXTURE);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toMatchObject({ name: 'Favoriten' });
    });

    it('sends ownerType and householdId when provided', async () => {
      const fetchMock = okJson({ collection: COLLECTION_FIXTURE }, 201);
      vi.stubGlobal('fetch', fetchMock);

      await createCollection({ name: 'Family', ownerType: 'household', householdId: 'hh-1' });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        name: 'Family',
        ownerType: 'household',
        householdId: 'hh-1',
      });
    });

    it('throws ApiRequestError on 400 (invalid input)', async () => {
      vi.stubGlobal('fetch', errorResponse(400, { error: { message: 'name is required' } }));
      await expect(createCollection({ name: '' })).rejects.toBeInstanceOf(ApiRequestError);
      await expect(createCollection({ name: '' })).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── renameCollection ─────────────────────────────────────────────────────────

  describe('renameCollection', () => {
    it('sends PATCH with name and resolves on success', async () => {
      const fetchMock = okJson({ success: true });
      vi.stubGlobal('fetch', fetchMock);

      await expect(renameCollection('coll-1', 'Neue Sammlung')).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections/coll-1');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'Neue Sammlung' });
    });

    it('throws ApiRequestError on 400 (favorites cannot be renamed)', async () => {
      vi.stubGlobal('fetch', errorResponse(400, { error: { message: 'Favorites collection cannot be renamed' } }));
      await expect(renameCollection('fav-id', 'New')).rejects.toBeInstanceOf(ApiRequestError);
      await expect(renameCollection('fav-id', 'New')).rejects.toMatchObject({ status: 400 });
    });

    it('throws ApiRequestError on 404 (collection not found)', async () => {
      vi.stubGlobal('fetch', errorResponse(404));
      await expect(renameCollection('missing', 'X')).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── deleteCollection ─────────────────────────────────────────────────────────

  describe('deleteCollection', () => {
    it('sends DELETE and resolves on success', async () => {
      const fetchMock = okJson({ success: true });
      vi.stubGlobal('fetch', fetchMock);

      await expect(deleteCollection('coll-1')).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections/coll-1');
      expect(init.method).toBe('DELETE');
    });

    it('throws ApiRequestError on 400 (favorites cannot be deleted)', async () => {
      vi.stubGlobal('fetch', errorResponse(400, { error: { message: 'Favorites collection cannot be deleted' } }));
      await expect(deleteCollection('fav-id')).rejects.toMatchObject({ status: 400 });
    });

    it('throws ApiRequestError on 404', async () => {
      vi.stubGlobal('fetch', errorResponse(404));
      await expect(deleteCollection('gone')).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── addRecipeToCollection ─────────────────────────────────────────────────────

  describe('addRecipeToCollection', () => {
    it('sends POST to /items with recipeId and returns { added }', async () => {
      const fetchMock = okJson({ success: true, added: true });
      vi.stubGlobal('fetch', fetchMock);

      const result = await addRecipeToCollection('coll-1', 7);

      expect(result).toEqual({ added: true });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections/coll-1/items');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ recipeId: 7 });
    });

    it('returns { added: false } when recipe was already in the collection', async () => {
      vi.stubGlobal('fetch', okJson({ success: true, added: false }));
      const result = await addRecipeToCollection('coll-1', 7);
      expect(result).toEqual({ added: false });
    });

    it('throws ApiRequestError on 404 (invisible collection or recipe)', async () => {
      vi.stubGlobal('fetch', errorResponse(404));
      await expect(addRecipeToCollection('coll-99', 1)).rejects.toMatchObject({ status: 404 });
    });

    it('throws ApiRequestError on 400 (illegal recipe reference)', async () => {
      vi.stubGlobal('fetch', errorResponse(400, { error: { message: 'Recipe is not a legal reference for this collection' } }));
      await expect(addRecipeToCollection('coll-1', 99)).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── removeRecipeFromCollection ────────────────────────────────────────────────

  describe('removeRecipeFromCollection', () => {
    it('sends DELETE to /items/:recipeId and resolves on success', async () => {
      const fetchMock = okJson({ success: true });
      vi.stubGlobal('fetch', fetchMock);

      await expect(removeRecipeFromCollection('coll-1', 7)).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test/api/v1/recipe-collections/coll-1/items/7');
      expect(init.method).toBe('DELETE');
    });

    it('throws ApiRequestError on 404', async () => {
      vi.stubGlobal('fetch', errorResponse(404));
      await expect(removeRecipeFromCollection('coll-99', 1)).rejects.toMatchObject({ status: 404 });
    });
  });
});
