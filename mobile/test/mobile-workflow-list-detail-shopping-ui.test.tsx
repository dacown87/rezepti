import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  useRecipesMock: vi.fn(),
  recipeIdParam: '11',
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    navigate: vi.fn(),
  },
  addIngredientsMock: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/useRecipes', () => ({
  useRecipes: state.useRecipesMock,
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: state.recipeIdParam }),
  useFocusEffect: (cb: () => void) => queueMicrotask(cb),
  router: state.router,
}));

vi.mock('@/utils/shopping-service', () => ({
  addIngredients: state.addIngredientsMock,
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
}));

vi.mock('@/utils/pdf-export', () => ({
  shareRecipePDF: vi.fn(async () => undefined),
  shareRecipeCardsPDF: vi.fn(async () => undefined),
}));

vi.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: ({ isError }: { isError: boolean }) => React.createElement('OfflineBanner', { isError }),
}));

vi.mock('react-native-qrcode-svg', () => ({
  default: () => React.createElement('QRCode'),
}));

vi.mock('expo-linking', () => ({
  openURL: vi.fn(async () => undefined),
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

vi.mock('@/utils/recipe-qr', () => ({
  encodeRecipeToCompactJSON: vi.fn(() => 'encoded'),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => 'list'),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    Search: icon,
    X: icon,
    ChefHat: icon,
    Clock: icon,
    Star: icon,
    Plus: icon,
    LayoutGrid: icon,
    List: icon,
    Tag: icon,
    FileText: icon,
    Refrigerator: icon,
    QrCode: icon,
    ArrowLeft: icon,
    Users: icon,
    Flame: icon,
    ExternalLink: icon,
    Edit: icon,
    Save: icon,
    Trash2: icon,
    UtensilsCrossed: icon,
    ChevronLeft: icon,
    ChevronRight: icon,
    Download: icon,
    Minus: icon,
    Pencil: icon,
    RotateCcw: icon,
    CheckSquare: icon,
    Square: icon,
    ShoppingCart: icon,
  };
});

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);

  return {
    View: wrap('View'),
    Text: wrap('Text'),
    ScrollView: wrap('ScrollView'),
    TextInput: wrap('TextInput'),
    ActivityIndicator: wrap('ActivityIndicator'),
    RefreshControl: wrap('RefreshControl'),
    Modal: wrap('Modal'),
    Image: wrap('Image'),
    Share: { share: vi.fn(async () => undefined) },
    FlatList: ({ data, renderItem, ListEmptyComponent }: Record<string, unknown>) => {
      if (Array.isArray(data) && data.length > 0 && typeof renderItem === 'function') {
        const children = data.map((item, index) =>
          (renderItem as (args: { item: unknown; index: number }) => React.ReactNode)({ item, index })
        );
        return React.createElement(
          'FlatList',
          {},
          children.map((child, index) =>
            React.isValidElement(child)
              ? React.cloneElement(child, { key: child.key ?? `flat-list-item-${index}` })
              : child
          )
        );
      }
      return React.createElement('FlatList', {}, (ListEmptyComponent as React.ReactNode) ?? null);
    },
    Pressable: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('Pressable', props, children as React.ReactNode),
  };
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

describe('mobile ui workflow: list -> detail -> shopping', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.recipeIdParam = '11';

    state.useRecipesMock.mockReturnValue({
      data: [
        {
          id: 11,
          name: 'Pasta',
          ingredients: '["Nudeln","Tomaten"]',
          steps: '["Kochen"]',
          tags: '["Abendessen"]',
          duration: '20 min',
          rating: 4,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(async () => undefined),
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: 11,
          name: 'Pasta',
          ingredients: '["Nudeln","Tomaten"]',
          steps: '["Kochen"]',
          tags: '["Abendessen"]',
          duration: '20 min',
          rating: 4,
        }),
      }))
    );
  });

  it('navigates from list to detail and adds recipe ingredients to shopping list', async () => {
    const { default: RecipeListScreen } = await import('@/app/(tabs)/index');
    const listRender = render(React.createElement(RecipeListScreen));

    expect(screen.getByText('Alle Rezepte')).toBeTruthy();
    await press(screen.getByText('Alle Rezepte'));

    await waitFor(() => {
      expect(screen.getByTestId('recipe-card-11')).toBeTruthy();
    });
    await press(screen.getByTestId('recipe-card-11'));

    expect(state.router.push).toHaveBeenCalledWith('/recipe/11');
    listRender.unmount();

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    const detailRender = render(React.createElement(RecipeDetailScreen));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getAllByText('Pasta').length).toBeGreaterThan(0);
    });

    await press(screen.getByText('Einkauf'));

    await waitFor(() => {
      expect(state.addIngredientsMock).toHaveBeenCalledWith(['Nudeln', 'Tomaten'], 11);
      expect(state.router.navigate).toHaveBeenCalledWith('/(tabs)/shopping');
    });
    detailRender.unmount();
  });
});
