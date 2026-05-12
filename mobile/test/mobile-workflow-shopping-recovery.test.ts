import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiToRecipe } from '@/utils/recipe-mapper';
import type { ApiRecipe } from '@/utils/api';

let useRecipes: () => unknown;
let useRecipe: (id: number) => unknown;
let addIngredients: (ingredients: string[], recipeId?: number, options?: { concurrency?: number }) => Promise<void>;
let fetchRecipes: () => Promise<unknown>;
let fetchRecipeById: (id: number) => Promise<unknown>;

const reactQueryMocks = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: reactQueryMocks.useQueryMock,
  };
});

vi.mock('@/utils/api', () => ({
  fetchRecipes: vi.fn(),
  fetchRecipeById: vi.fn(),
  patchRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
}));

vi.mock('react-native', () => ({
  View: () => null,
  Text: () => null,
  FlatList: () => null,
  Pressable: () => null,
  ActivityIndicator: () => null,
  RefreshControl: () => null,
  TextInput: () => null,
  Modal: () => null,
  Share: { share: vi.fn() },
}));

vi.mock('lucide-react-native', () => ({
  ShoppingCart: () => null,
  Trash2: () => null,
  Check: () => null,
  X: () => null,
  Share2: () => null,
  Plus: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

vi.mock('expo-router', () => ({
  useFocusEffect: vi.fn(),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    navigate: vi.fn(),
  },
}));

describe('mobile workflow: list -> detail -> shopping with recovery', () => {
  beforeAll(async () => {
    ({ useRecipes } = await import('@/hooks/useRecipes'));
    ({ useRecipe } = await import('@/hooks/useRecipe'));
    ({ addIngredients } = await import('@/utils/shopping-service'));
    ({ fetchRecipes, fetchRecipeById } = await import('@/utils/api'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flows selected recipe id from list/search into detail fetch', async () => {
    const queryFns: Array<() => Promise<unknown>> = [];
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryFn: () => Promise<unknown> }) => {
      queryFns.push(config.queryFn);
      return { data: undefined, error: undefined };
    });

    vi.mocked(fetchRecipes).mockResolvedValueOnce([
      { id: 11, name: 'Pasta', ingredients: '["Nudeln"]', steps: '["Kochen"]' },
      { id: 12, name: 'Salat', ingredients: '["Salat"]', steps: '["Mischen"]' },
    ]);
    vi.mocked(fetchRecipeById).mockResolvedValueOnce({
      id: 11,
      name: 'Pasta',
      ingredients: '["Nudeln"]',
      steps: '["Kochen"]',
    });

    useRecipes();
    const rawList = await queryFns[0]!();
    const mappedList = (rawList as ApiRecipe[]).map(apiToRecipe);
    const selected = mappedList.find((recipe) => recipe.name === 'Pasta');
    useRecipe(selected!.id);
    await queryFns[1]!();

    expect(selected?.id).toBe(11);
    expect(fetchRecipeById).toHaveBeenCalledWith(11);
  });

  it('propagates list fetch errors so UI can enter error/offline fallback state', async () => {
    const queryFns: Array<() => Promise<unknown>> = [];
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryFn: () => Promise<unknown> }) => {
      queryFns.push(config.queryFn);
      return { data: undefined, error: undefined };
    });
    vi.mocked(fetchRecipes).mockRejectedValueOnce(new Error('Server-Fehler 503'));

    useRecipes();

    await expect(queryFns[0]!()).rejects.toThrow('Server-Fehler 503');
  });

  it('supports list recovery after an initial fetch failure (retry path)', async () => {
    const queryFns: Array<() => Promise<unknown>> = [];
    reactQueryMocks.useQueryMock.mockImplementation((config: { queryFn: () => Promise<unknown> }) => {
      queryFns.push(config.queryFn);
      return { data: undefined, error: undefined };
    });
    vi.mocked(fetchRecipes)
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce([
        { id: 99, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' },
      ]);

    useRecipes();
    await expect(queryFns[0]!()).rejects.toThrow('Network request failed');
    await expect(queryFns[0]!()).resolves.toEqual([
      { id: 99, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' },
    ]);
  });

  it('addIngredients posts each ingredient with recipe linkage', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await addIngredients(['Nudeln', 'Tomaten'], 11);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/shopping',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalName: 'Nudeln', recipeId: 11 }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/shopping',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalName: 'Tomaten', recipeId: 11 }),
      })
    );
  });

  it('supports offline failure then successful retry for shopping add flow', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue({ ok: true } as Response);

    await expect(addIngredients(['Milch'], 11)).rejects.toThrow('Network request failed');
    await expect(addIngredients(['Milch'], 11)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails when shopping API responds with non-ok status', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(addIngredients(['Milch'], 11)).rejects.toThrow('Shopping add failed (500)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails whole batch when one ingredient POST returns non-ok', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 201 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 409 } as Response);

    await expect(addIngredients(['Milch', 'Brot'], 11)).rejects.toThrow('Shopping add failed (409)');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses bounded concurrency for ingredient fanout', async () => {
    const fetchMock = vi.mocked(fetch);
    let inFlight = 0;
    let maxInFlight = 0;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          setTimeout(() => {
            inFlight -= 1;
            resolve({ ok: true, status: 201 } as Response);
          }, 0);
        }) as Promise<Response>
    );

    await addIngredients(['A', 'B', 'C', 'D'], 11, { concurrency: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
