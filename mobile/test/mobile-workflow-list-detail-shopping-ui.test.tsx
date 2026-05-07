import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
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
  useFocusEffect: (cb: () => void) => cb(),
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
        return React.createElement(
          'FlatList',
          {},
          data.map((item, index) =>
            (renderItem as (args: { item: unknown; index: number }) => React.ReactNode)({ item, index })
          )
        );
      }
      return React.createElement('FlatList', {}, (ListEmptyComponent as React.ReactNode) ?? null);
    },
    Pressable: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('Pressable', props, children as React.ReactNode),
  };
});

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
    let listTree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      listTree = TestRenderer.create(React.createElement(RecipeListScreen));
    });

    const recipeCardPressable = listTree!.root.find(
      (node: { type: unknown; props: { onPress?: () => void; className?: string }; findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[] }) =>
        node.type === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('rounded-2xl mb-3') &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Pasta')).length > 0
    );

    await act(async () => {
      (recipeCardPressable.props as { onPress?: () => unknown }).onPress?.();
    });

    expect(state.router.push).toHaveBeenCalledWith('/recipe/11');
    listTree!.unmount();

    const { default: RecipeDetailScreen } = await import('@/app/recipe/[id]');
    let detailTree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      detailTree = TestRenderer.create(React.createElement(RecipeDetailScreen));
      await Promise.resolve();
    });

    const shoppingButton = detailTree!.root.find(
      (node: { type: unknown; props: { onPress?: () => void }; findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[] }) =>
        node.type === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Einkauf')).length > 0
    );

    await act(async () => {
      await (shoppingButton.props as { onPress?: () => Promise<void> }).onPress?.();
    });

    await act(async () => {
      expect(state.addIngredientsMock).toHaveBeenCalledWith(['Nudeln', 'Tomaten'], 11);
      expect(state.router.navigate).toHaveBeenCalledWith('/(tabs)/shopping');
    });
    detailTree!.unmount();
  });
});
