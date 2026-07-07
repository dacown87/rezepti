import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const routerState = vi.hoisted(() => ({
  backMock: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '99' }),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: routerState.backMock,
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('SafeAreaView', props, children as React.ReactNode),
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
}));

vi.mock('react-native-qrcode-svg', () => ({
  default: () => React.createElement('QRCode'),
}));

vi.mock('expo-linking', () => ({
  openURL: vi.fn(async () => undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock('@/components/ImagePickerModal', () => ({
  ImagePickerModal: () => React.createElement('ImagePickerModal'),
}));

vi.mock('@/components/StepText', () => ({
  StepText: ({ children }: { children: React.ReactNode }) => React.createElement('StepText', {}, children),
}));

vi.mock('@/utils/scaling', () => ({
  parseServingsNumber: vi.fn(() => 1),
  scaleIngredient: vi.fn((value: string) => value),
  parseIngredientNumber: vi.fn(() => null),
}));

vi.mock('@/utils/pdf-export', () => ({
  shareRecipePDF: vi.fn(async () => undefined),
}));

vi.mock('@/utils/shopping-service', () => ({
  addIngredients: vi.fn(async () => undefined),
}));

vi.mock('@/utils/recipe-qr', () => ({
  encodeRecipeToCompactJSON: vi.fn(() => 'encoded'),
}));

vi.mock('@/hooks/useCollections', () => ({
  useToggleFavorite: () => ({ mutateAsync: vi.fn(async () => true), isPending: false }),
  useShareRecipe: () => ({ mutateAsync: vi.fn(async () => ({ id: 1 })), isPending: false }),
  useCreateRecipeShareInvite: () => ({ mutateAsync: vi.fn(async () => ({ token: 'token-1' })), isPending: false }),
}));

vi.mock('@/components/AddToCollectionModal', () => ({
  AddToCollectionModal: () => null,
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ArrowLeft: icon,
    Star: icon,
    Clock: icon,
    Users: icon,
    Flame: icon,
    ExternalLink: icon,
    Edit: icon,
    Save: icon,
    X: icon,
    Trash2: icon,
    UtensilsCrossed: icon,
    ChevronLeft: icon,
    ChevronRight: icon,
    Download: icon,
    Plus: icon,
    Minus: icon,
    Pencil: icon,
    RotateCcw: icon,
    CheckSquare: icon,
    Square: icon,
    ShoppingCart: icon,
    QrCode: icon,
    WifiOff: icon,
    Heart: icon,
    FolderPlus: icon,
    Home: icon,
    Copy: icon,
    Lock: icon,
    Mail: icon,
    Send: icon,
  };
});

vi.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: ({ offlineMessage }: { offlineMessage?: string; isError?: boolean }) => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (isOnline) return null;
    return React.createElement(
      'OfflineBanner',
      { testID: 'offline-banner' },
      offlineMessage ?? 'Offline — zuletzt geladene Rezepte werden angezeigt',
    );
  },
}));

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

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

describe('RecipeDetailScreen UI fallbacks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    routerState.backMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  });

  it('shows header shell and skeleton content immediately before data arrives', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    expect(screen.getByLabelText('Zurück')).toBeTruthy();
    expect(screen.getByTestId('recipe-skeleton')).toBeTruthy();
  });

  it('shows loading fallback while detail request is still pending', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    expect(screen.getByTestId('recipe-skeleton')).toBeTruthy();
  });

  it('shows not-found fallback and supports back navigation', async () => {
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await waitFor(() => {
      expect(screen.getByText('Rezept nicht gefunden.')).toBeTruthy();
    });

    await press(screen.getByText('Zurück'));
    expect(routerState.backMock).toHaveBeenCalled();
  });

  it('shows request-error fallback and can recover via retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 99,
          name: 'Retry Pasta',
          ingredients: '["Nudeln"]',
          steps: '["Kochen"]',
          tags: '["Schnell"]',
          duration: '20 min',
          rating: 4,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    render(React.createElement(RecipeDetailScreen));

    await waitFor(() => {
      expect(screen.getByText('Rezept konnte nicht geladen werden.')).toBeTruthy();
    });

    await press(screen.getByText('Erneut versuchen'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.getAllByText('Retry Pasta').length).toBeGreaterThan(0);
    });
  });

  describe('offline states', () => {
    beforeEach(() => {
      // Simulate offline by making navigator.onLine return false
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'window', {
        value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });
    });

    it('offline + cached recipe: renders recipe content and offline banner', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 99,
          name: 'Pasta vom Cache',
          ingredients: '["Nudeln","Tomaten"]',
          steps: '["Kochen","Servieren"]',
          tags: '[]',
          duration: '15 min',
          rating: null,
        }),
      }));

      const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
      render(React.createElement(RecipeDetailScreen));

      await waitFor(() => {
        expect(screen.getAllByText('Pasta vom Cache').length).toBeGreaterThan(0);
      });

      // OfflineBanner should be present with cache-hit message (testID from mock)
      const banner = screen.getByTestId('offline-banner');
      expect(banner).toBeTruthy();

      // Exact cache-hit message must be shown (text is a direct child of the mock element)
      expect(screen.getByTestId('offline-banner').props.children).toBe('Offline — Rezept aus Cache');

      // No skeleton, no terminal error — recipe is fully rendered
      expect(screen.queryByTestId('recipe-skeleton')).toBeNull();
      expect(screen.queryByTestId('offline-cache-miss')).toBeNull();
    });

    it('online + cached recipe: banner is NOT shown (sanity check against always-rendering banner)', async () => {
      // Restore online state for this test
      Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        writable: true,
        configurable: true,
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 99,
          name: 'Pasta online',
          ingredients: '["Nudeln"]',
          steps: '["Kochen"]',
          tags: '[]',
          duration: '10 min',
          rating: null,
        }),
      }));

      const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
      render(React.createElement(RecipeDetailScreen));

      await waitFor(() => {
        expect(screen.getAllByText('Pasta online').length).toBeGreaterThan(0);
      });

      // Banner must NOT appear when online
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    });

    it('offline + no cached recipe: shows terminal offline error, not a spinner', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

      const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
      render(React.createElement(RecipeDetailScreen));

      await waitFor(() => {
        expect(screen.getByTestId('offline-cache-miss')).toBeTruthy();
      });

      // Clear offline-unavailable message
      expect(screen.getByText('Rezept ist offline nicht verfügbar')).toBeTruthy();

      // Must NOT show skeleton (no perpetual loading)
      expect(screen.queryByTestId('recipe-skeleton')).toBeNull();
    });
  });
});
