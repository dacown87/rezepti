import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const routerState = vi.hoisted(() => ({ backMock: vi.fn() }));

vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn(), back: routerState.backMock },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('SafeAreaView', props, children as React.ReactNode),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ArrowLeft: icon, Plus: icon, Star: icon, FolderOpen: icon, Pencil: icon, Trash2: icon, X: icon,
  };
});

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    Pressable: wrap('Pressable'),
    TextInput: wrap('TextInput'),
    ActivityIndicator: wrap('ActivityIndicator'),
    Modal: wrap('Modal'),
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
  collectionsResult: { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() },
  createMutateAsync: vi.fn(),
  renameMutateAsync: vi.fn(),
  deleteMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => hookState.collectionsResult,
  useCreateCollection: () => ({ mutateAsync: hookState.createMutateAsync, isPending: false }),
  useRenameCollection: () => ({ mutateAsync: hookState.renameMutateAsync, isPending: false }),
  useDeleteCollection: () => ({ mutateAsync: hookState.deleteMutateAsync, isPending: false }),
}));

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { await fireEvent.press(target); });
}

const FAVORITES = { id: 'fav', kind: 'favorites', name: 'Favoriten', owner_type: 'user', item_count: 3, is_system: true };
const CUSTOM = { id: 'c1', kind: 'custom', name: 'Wochenende', owner_type: 'user', item_count: 2, is_system: false };

describe('CollectionsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.collectionsResult = { data: [FAVORITES, CUSTOM], isLoading: false, isError: false, refetch: vi.fn() };
  });

  it('lists collections with item counts and marks the system favorites collection', async () => {
    const { default: CollectionsScreen } = await import('@/app/collections');
    render(React.createElement(CollectionsScreen));

    expect(screen.getByText('Favoriten')).toBeTruthy();
    expect(screen.getByText('Wochenende')).toBeTruthy();
    expect(screen.getByText('2 Rezepte')).toBeTruthy();
    // System badge appended to favorites count line
    expect(screen.getByText('3 Rezepte · System')).toBeTruthy();
  });

  it('hides rename/delete controls for the system favorites collection but shows them for custom', async () => {
    const { default: CollectionsScreen } = await import('@/app/collections');
    render(React.createElement(CollectionsScreen));

    expect(screen.queryByTestId('rename-fav')).toBeNull();
    expect(screen.queryByTestId('delete-fav')).toBeNull();
    expect(screen.getByTestId('rename-c1')).toBeTruthy();
    expect(screen.getByTestId('delete-c1')).toBeTruthy();
  });

  it('creates a new collection via the inline form', async () => {
    hookState.createMutateAsync.mockResolvedValueOnce({ ...CUSTOM, id: 'c2', name: 'Neu' });
    const { default: CollectionsScreen } = await import('@/app/collections');
    render(React.createElement(CollectionsScreen));

    await press(screen.getByTestId('create-collection-open'));
    fireEvent.changeText(screen.getByTestId('create-collection-input'), 'Neu');
    await press(screen.getByTestId('create-collection-confirm'));

    await waitFor(() => {
      expect(hookState.createMutateAsync).toHaveBeenCalledWith({ name: 'Neu' });
    });
  });

  it('renames a custom collection', async () => {
    hookState.renameMutateAsync.mockResolvedValueOnce(undefined);
    const { default: CollectionsScreen } = await import('@/app/collections');
    render(React.createElement(CollectionsScreen));

    await press(screen.getByTestId('rename-c1'));
    fireEvent.changeText(screen.getByTestId('rename-input'), 'Umbenannt');
    await press(screen.getByTestId('rename-confirm'));

    await waitFor(() => {
      expect(hookState.renameMutateAsync).toHaveBeenCalledWith({ id: 'c1', name: 'Umbenannt' });
    });
  });

  it('deletes a custom collection after confirm', async () => {
    hookState.deleteMutateAsync.mockResolvedValueOnce(undefined);
    const { default: CollectionsScreen } = await import('@/app/collections');
    render(React.createElement(CollectionsScreen));

    await press(screen.getByTestId('delete-c1'));
    await press(screen.getByTestId('delete-confirm'));

    await waitFor(() => {
      expect(hookState.deleteMutateAsync).toHaveBeenCalledWith('c1');
    });
  });

  it('shows an empty-state when there are no collections', async () => {
    hookState.collectionsResult = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    const { default: CollectionsScreen } = await import('@/app/collections');
    render(React.createElement(CollectionsScreen));

    expect(screen.getByText(/Noch keine Collections/)).toBeTruthy();
  });
});
