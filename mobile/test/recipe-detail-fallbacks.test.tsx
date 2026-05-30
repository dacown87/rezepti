import React from 'react';
import { fireEvent, render, renderAsync, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
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
  };
});

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
    const { UNSAFE_queryAllByType } = render(React.createElement(RecipeDetailScreen));

    // Back button in header must be present immediately (structural shell)
    const backPressables = UNSAFE_queryAllByType('Pressable').filter(
      (node) =>
        typeof (node.props as { onPress?: unknown }).onPress === 'function' &&
        node.findAll((child) => String(child.type) === 'Icon').length > 0
    );
    expect(backPressables.length).toBeGreaterThan(0);

    // Skeleton placeholder container must be present
    expect(screen.getByTestId('recipe-skeleton')).toBeTruthy();
  });

  it('shows loading fallback while detail request is still pending', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    const { UNSAFE_queryAllByType } = render(React.createElement(RecipeDetailScreen));

    expect(UNSAFE_queryAllByType('ActivityIndicator').length).toBeGreaterThan(0);
  });

  it('shows not-found fallback and supports back navigation', async () => {
    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    await renderAsync(React.createElement(RecipeDetailScreen));

    await waitFor(() => {
      expect(screen.getByText('Rezept nicht gefunden.')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Zurück'));
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
    await renderAsync(React.createElement(RecipeDetailScreen));

    await waitFor(() => {
      expect(screen.getByText('Rezept konnte nicht geladen werden.')).toBeTruthy();
    });

    await fireEvent.press(screen.getByText('Erneut versuchen'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(screen.getByText('Retry Pasta')).toBeTruthy();
    });
  });
});
