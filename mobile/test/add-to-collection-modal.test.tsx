import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return { X: icon, Plus: icon, Check: icon, FolderPlus: icon, Star: icon };
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
    ScrollView: wrap('ScrollView'),
  };
});

// Real ApiRequestError so instanceof checks work
class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
vi.mock('@/utils/api', () => ({ ApiRequestError }));

const hookState = vi.hoisted(() => ({
  collectionsResult: { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() },
  createMutateAsync: vi.fn(),
  addMutateAsync: vi.fn(),
}));

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => hookState.collectionsResult,
  useCreateCollection: () => ({ mutateAsync: hookState.createMutateAsync, isPending: false }),
  useAddRecipeToCollection: () => ({ mutateAsync: hookState.addMutateAsync, isPending: false }),
}));

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { await fireEvent.press(target); });
}

const FAVORITES = { id: 'fav', kind: 'favorites', name: 'Favoriten', owner_type: 'user', item_count: 1, is_system: true };
const CUSTOM = { id: 'c1', kind: 'custom', name: 'Wochenende', owner_type: 'user', item_count: 2, is_system: false };

async function renderModal() {
  const { AddToCollectionModal } = await import('@/components/AddToCollectionModal');
  render(React.createElement(AddToCollectionModal, { visible: true, recipeId: 42, onClose: vi.fn() }));
}

describe('AddToCollectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.collectionsResult = { data: [FAVORITES, CUSTOM], isLoading: false, isError: false, refetch: vi.fn() };
  });

  it('renders the picker with the user collections', async () => {
    await renderModal();
    expect(screen.getByText('Favoriten')).toBeTruthy();
    expect(screen.getByText('Wochenende')).toBeTruthy();
  });

  it('adds the recipe to a tapped collection', async () => {
    hookState.addMutateAsync.mockResolvedValueOnce({ added: true });
    await renderModal();

    await press(screen.getByTestId('collection-row-c1'));

    await waitFor(() => {
      expect(hookState.addMutateAsync).toHaveBeenCalledWith({ collectionId: 'c1', recipeId: 42 });
    });
    // success feedback
    await waitFor(() => expect(screen.getByText('Hinzugefügt')).toBeTruthy());
  });

  it('surfaces "already in collection" (added:false) as a friendly note, not an error', async () => {
    hookState.addMutateAsync.mockResolvedValueOnce({ added: false });
    await renderModal();

    await press(screen.getByTestId('collection-row-c1'));

    await waitFor(() => expect(screen.getByText('Bereits enthalten')).toBeTruthy());
    // No error surface
    expect(screen.queryByText(/schiefgelaufen/)).toBeNull();
  });

  it('surfaces a not-found ApiRequestError inline without crashing', async () => {
    hookState.addMutateAsync.mockRejectedValueOnce(new ApiRequestError(404, 'nope'));
    await renderModal();

    await press(screen.getByTestId('collection-row-c1'));

    await waitFor(() => expect(screen.getByText('Sammlung oder Rezept nicht gefunden.')).toBeTruthy());
  });

  it('creates a new collection then adds the recipe to it', async () => {
    hookState.createMutateAsync.mockResolvedValueOnce({ ...CUSTOM, id: 'c2', name: 'Neu' });
    hookState.addMutateAsync.mockResolvedValueOnce({ added: true });
    await renderModal();

    await press(screen.getByTestId('new-collection-open'));
    fireEvent.changeText(screen.getByTestId('new-collection-input'), 'Neu');
    await press(screen.getByTestId('create-collection-confirm'));

    await waitFor(() => {
      expect(hookState.createMutateAsync).toHaveBeenCalledWith({ name: 'Neu' });
      expect(hookState.addMutateAsync).toHaveBeenCalledWith({ collectionId: 'c2', recipeId: 42 });
    });
  });
});
