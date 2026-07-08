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
  authMe: {
    activeHouseholdId: 'hh1',
    memberships: [{ householdId: 'hh1', role: 'owner' }],
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: hookState.authMe }),
}));
vi.mock('@/utils/admin', () => ({ fetchAuthMe: vi.fn() }));

vi.mock('@/hooks/useCollections', () => ({
  useCollections: () => hookState.collectionsResult,
  useCreateCollection: () => ({ mutateAsync: hookState.createMutateAsync, isPending: false }),
  useAddRecipeToCollection: () => ({ mutateAsync: hookState.addMutateAsync, isPending: false }),
}));

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { await fireEvent.press(target); });
}

const FAVORITES = { id: 'fav', kind: 'favorites', name: 'Favoriten', owner_type: 'user', household_id: null, item_count: 1, is_system: true };
const CUSTOM = { id: 'c1', kind: 'custom', name: 'Wochenende', owner_type: 'user', household_id: null, item_count: 2, is_system: false };
const HOUSEHOLD = { id: 'h1', kind: 'custom', name: 'Familie', owner_type: 'household', household_id: 'hh1', item_count: 4, is_system: false };
const HOUSEHOLD_2 = { id: 'h2', kind: 'custom', name: 'WG', owner_type: 'household', household_id: 'hh2', item_count: 1, is_system: false };

async function renderModal(props: { recipeScope?: 'private' | 'household' } = {}) {
  const { AddToCollectionModal } = await import('@/components/AddToCollectionModal');
  render(React.createElement(AddToCollectionModal, { visible: true, recipeId: 42, onClose: vi.fn(), ...props }));
}

describe('AddToCollectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.collectionsResult = { data: [FAVORITES, CUSTOM], isLoading: false, isError: false, refetch: vi.fn() };
    hookState.authMe = {
      activeHouseholdId: 'hh1',
      memberships: [{ householdId: 'hh1', role: 'owner' }],
    };
  });

  it('renders the picker with the custom collections only (excludes system favorites)', async () => {
    await renderModal();
    // Favorites are managed by the dedicated heart toggle — excluded from the add-list.
    expect(screen.queryByText('Favoriten')).toBeNull();
    expect(screen.queryByTestId('collection-row-fav')).toBeNull();
    expect(screen.getByText('Wochenende')).toBeTruthy();
  });

  it('adds the recipe to a tapped collection', async () => {
    hookState.addMutateAsync.mockResolvedValueOnce({ added: true });
    await renderModal();

    await press(screen.getByTestId('collection-row-c1'));

    await waitFor(() => {
      expect(hookState.addMutateAsync).toHaveBeenCalledWith({ collectionId: 'c1', recipeId: 42, targetHouseholdId: undefined });
    });
    // success feedback
    await waitFor(() => expect(screen.getByText('Hinzugefügt')).toBeTruthy());
  });

  it('labels private recipe into household collection as household copy', async () => {
    hookState.collectionsResult = { data: [HOUSEHOLD], isLoading: false, isError: false, refetch: vi.fn() };
    await renderModal({ recipeScope: 'private' });

    expect(screen.getByText('Familie')).toBeTruthy();
    expect(screen.getByText('Als Haushaltskopie in Haushalt 1 hinzufügen')).toBeTruthy();
  });

  it('shows a household picker for multiple memberships and sends the selected target', async () => {
    hookState.authMe = {
      activeHouseholdId: 'hh1',
      memberships: [
        { householdId: 'hh1', role: 'owner' },
        { householdId: 'hh2', role: 'owner' },
      ],
    };
    hookState.collectionsResult = { data: [CUSTOM, HOUSEHOLD, HOUSEHOLD_2], isLoading: false, isError: false, refetch: vi.fn() };
    hookState.addMutateAsync.mockResolvedValueOnce({ added: true, recipeId: 77, copied: true });
    await renderModal({ recipeScope: 'private' });

    expect(screen.getByTestId('household-target-hh1').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText('WG')).toBeNull();

    await press(screen.getByTestId('household-target-hh2'));
    expect(screen.getByText('WG')).toBeTruthy();
    expect(screen.queryByText('Familie')).toBeNull();

    await press(screen.getByTestId('collection-row-h2'));

    await waitFor(() => {
      expect(hookState.addMutateAsync).toHaveBeenCalledWith({ collectionId: 'h2', recipeId: 42, targetHouseholdId: 'hh2' });
    });
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
      expect(hookState.addMutateAsync).toHaveBeenCalledWith({ collectionId: 'c2', recipeId: 42, targetHouseholdId: undefined });
    });
  });
});
