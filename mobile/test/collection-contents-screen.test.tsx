import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const routerState = vi.hoisted(() => ({ backMock: vi.fn(), pushMock: vi.fn() }));

vi.mock('expo-router', () => ({
  router: { push: routerState.pushMock, replace: vi.fn(), back: routerState.backMock },
  useLocalSearchParams: () => ({ id: 'c1', name: 'Wochenende' }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('SafeAreaView', props, children as React.ReactNode),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return { ArrowLeft: icon, FolderOpen: icon, Trash2: icon };
});

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
    Modal: wrap('Modal'),
    Image: wrap('Image'),
    FlatList: ({ data, renderItem, ListEmptyComponent }: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
      ListEmptyComponent?: React.ReactNode;
    }) =>
      React.createElement(
        'FlatList',
        {},
        data.length === 0
          ? ListEmptyComponent
          : data.map((item, i) => React.createElement(React.Fragment, { key: i }, renderItem({ item }))),
      ),
  };
});

// ── Hook mocks ────────────────────────────────────────────────────────────────
const hookState = vi.hoisted(() => ({
  itemsResult: { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() },
  removeMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/useCollections', () => ({
  useCollectionItems: () => hookState.itemsResult,
  useRemoveRecipeFromCollection: () => ({ mutateAsync: hookState.removeMutateAsync, isPending: false }),
}));

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { await fireEvent.press(target); });
}

const RECIPE_A = { id: 1, name: 'Pasta', emoji: '🍝', ingredients: '[]', steps: '[]', scope: 'private' };
const RECIPE_B = { id: 2, name: 'Suppe', emoji: '🍲', ingredients: '[]', steps: '[]', scope: 'household' };

describe('CollectionContentsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.itemsResult = { data: [RECIPE_A, RECIPE_B], isLoading: false, isError: false, refetch: vi.fn() };
  });

  it('lists the collection recipes with the collection name in the header', async () => {
    const { default: Screen } = await import('@/app/collection/[id]');
    render(React.createElement(Screen));

    expect(screen.getByText('Wochenende')).toBeTruthy();
    expect(screen.getByText('Pasta')).toBeTruthy();
    expect(screen.getByText('Suppe')).toBeTruthy();
  });

  it('opens a recipe detail when its row is tapped', async () => {
    const { default: Screen } = await import('@/app/collection/[id]');
    render(React.createElement(Screen));

    await press(screen.getByTestId('open-recipe-1'));
    expect(routerState.pushMock).toHaveBeenCalledWith('/recipe/1');
  });

  it('removes a recipe via the remove confirm, calling the hook with the right args', async () => {
    hookState.removeMutateAsync.mockResolvedValueOnce(undefined);
    const { default: Screen } = await import('@/app/collection/[id]');
    render(React.createElement(Screen));

    await press(screen.getByTestId('remove-recipe-2'));
    await press(screen.getByTestId('remove-confirm'));

    await waitFor(() => {
      expect(hookState.removeMutateAsync).toHaveBeenCalledWith({ collectionId: 'c1', recipeId: 2 });
    });
  });

  it('shows the empty state when the collection has no recipes', async () => {
    hookState.itemsResult = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    const { default: Screen } = await import('@/app/collection/[id]');
    render(React.createElement(Screen));

    expect(screen.getByText(/Noch keine Rezepte in dieser Sammlung/)).toBeTruthy();
  });
});
