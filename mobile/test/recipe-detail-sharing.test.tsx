import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const routerState = vi.hoisted(() => ({ pushMock: vi.fn(), backMock: vi.fn() }));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '99' }),
  router: { push: routerState.pushMock, replace: vi.fn(), back: routerState.backMock },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('SafeAreaView', props, children as React.ReactNode),
}));

vi.mock('@/utils/server-url', () => ({ getServerUrl: vi.fn(async () => 'http://localhost:3000') }));
vi.mock('react-native-qrcode-svg', () => ({ default: () => React.createElement('QRCode') }));
vi.mock('expo-linking', () => ({ openURL: vi.fn(async () => undefined) }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) },
}));
vi.mock('@/components/ImagePickerModal', () => ({ ImagePickerModal: () => React.createElement('ImagePickerModal') }));
vi.mock('@/components/StepText', () => ({
  StepText: ({ children }: { children: React.ReactNode }) => React.createElement('StepText', {}, children),
}));
vi.mock('@/utils/scaling', () => ({
  parseServingsNumber: vi.fn(() => 1),
  scaleIngredient: vi.fn((v: string) => v),
  parseIngredientNumber: vi.fn(() => null),
}));
vi.mock('@/utils/pdf-export', () => ({ shareRecipePDF: vi.fn(async () => undefined) }));
vi.mock('@/utils/shopping-service', () => ({ addIngredients: vi.fn(async () => undefined) }));
vi.mock('@/utils/recipe-qr', () => ({ encodeRecipeToCompactJSON: vi.fn(() => 'encoded') }));

// Stub the collection picker modal so this test focuses on detail-screen CTAs.
vi.mock('@/components/AddToCollectionModal', () => ({
  AddToCollectionModal: ({ visible }: { visible: boolean }) =>
    visible ? React.createElement('AddToCollectionModalStub', { testID: 'collection-modal-open' }) : null,
}));

class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
vi.mock('@/utils/api', () => ({
  ApiRequestError,
  apiFetch: (...args: unknown[]) => (globalThis.fetch as (...a: unknown[]) => unknown)(...args),
  assertApiOk: async (res: { ok: boolean; status: number }, msg: string) => {
    if (!res.ok) throw new ApiRequestError(res.status, msg);
  },
}));
vi.mock('@/utils/protected-access', () => ({ mapProtectedApiError: () => null }));

// 3a hook mocks
const hookState = vi.hoisted(() => ({
  toggleMutateAsync: vi.fn(),
  shareMutateAsync: vi.fn(),
}));
vi.mock('@/hooks/useCollections', () => ({
  useToggleFavorite: () => ({ mutateAsync: hookState.toggleMutateAsync, isPending: false }),
  useShareRecipe: () => ({ mutateAsync: hookState.shareMutateAsync, isPending: false }),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ArrowLeft: icon, Star: icon, Clock: icon, Users: icon, Flame: icon, ExternalLink: icon,
    Edit: icon, Save: icon, X: icon, Trash2: icon, UtensilsCrossed: icon, ChevronLeft: icon,
    ChevronRight: icon, Download: icon, Plus: icon, Minus: icon, Pencil: icon, RotateCcw: icon,
    CheckSquare: icon, Square: icon, ShoppingCart: icon, QrCode: icon, WifiOff: icon,
    Heart: icon, FolderPlus: icon, Home: icon, Copy: icon, Lock: icon,
  };
});

vi.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }));
vi.mock('@/components/ProtectedAccessNotice', () => ({ ProtectedAccessNotice: () => React.createElement('ProtectedAccessNotice') }));

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    ScrollView: wrap('ScrollView'),
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
    TextInput: wrap('TextInput'),
    Modal: wrap('Modal'),
    Image: wrap('Image'),
    Share: { share: vi.fn(async () => undefined) },
  };
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => { await fireEvent.press(target); });
}

function recipePayload(extra: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 99,
      name: 'Geteiltes Rezept',
      ingredients: '["Nudeln"]',
      steps: '["Kochen"]',
      tags: '[]',
      ...extra,
    }),
  };
}

describe('RecipeDetailScreen — sharing & favorites CTAs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, writable: true, configurable: true,
    });
  });

  it('shows the favorite as off then reflects on-state after toggle (gotcha #1: local state update)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({ isFavorite: false, scope: 'private' })));
    hookState.toggleMutateAsync.mockResolvedValueOnce(true);

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    const heart = await waitFor(() => screen.getByTestId('favorite-toggle'));
    expect(heart.props.accessibilityState.selected).toBe(false);

    await press(heart);

    await waitFor(() => {
      expect(hookState.toggleMutateAsync).toHaveBeenCalledWith({ id: 99, on: true });
      expect(screen.getByTestId('favorite-toggle').props.accessibilityState.selected).toBe(true);
    });
  });

  it('shows the private scope badge from recipe.scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({ scope: 'private' })));
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await waitFor(() => expect(screen.getByTestId('scope-badge')).toBeTruthy());
    expect(screen.getByText('Privat')).toBeTruthy();
  });

  it('shows "In Haushalt kopieren" only when canShareToHousehold is true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({ canShareToHousehold: true, canCopyToPrivate: false })));
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await waitFor(() => expect(screen.getByTestId('copy-to-household-cta')).toBeTruthy());
    expect(screen.queryByTestId('copy-to-private-cta')).toBeNull();
  });

  it('shows "Private Kopie erstellen" only when canCopyToPrivate is true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({ canShareToHousehold: false, canCopyToPrivate: true })));
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await waitFor(() => expect(screen.getByTestId('copy-to-private-cta')).toBeTruthy());
    expect(screen.queryByTestId('copy-to-household-cta')).toBeNull();
  });

  it('hides both copy CTAs when neither capability is granted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({})));
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await waitFor(() => expect(screen.getByTestId('add-to-collection-cta')).toBeTruthy());
    expect(screen.queryByTestId('copy-to-household-cta')).toBeNull();
    expect(screen.queryByTestId('copy-to-private-cta')).toBeNull();
  });

  it('copies to household and shows confirmation with an open-copy action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({ canShareToHousehold: true })));
    hookState.shareMutateAsync.mockResolvedValueOnce({ id: 123, name: 'Kopie', ingredients: '[]', steps: '[]' });

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await press(await waitFor(() => screen.getByTestId('copy-to-household-cta')));

    await waitFor(() => {
      expect(hookState.shareMutateAsync).toHaveBeenCalledWith({ id: 99, target: 'household' });
      expect(screen.getByTestId('share-feedback')).toBeTruthy();
    });
  });

  it('surfaces a share error inline instead of crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({ canCopyToPrivate: true })));
    hookState.shareMutateAsync.mockRejectedValueOnce(new ApiRequestError(400, 'Nicht erlaubt'));

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await press(await waitFor(() => screen.getByTestId('copy-to-private-cta')));

    await waitFor(() => expect(screen.getByTestId('share-error')).toBeTruthy());
  });

  it('opens the add-to-collection modal from its CTA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(recipePayload({})));
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await press(await waitFor(() => screen.getByTestId('add-to-collection-cta')));
    await waitFor(() => expect(screen.getByTestId('collection-modal-open')).toBeTruthy());
  });
});
