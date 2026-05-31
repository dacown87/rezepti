import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  useRecipesMock: vi.fn(),
  refetchMock: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/useRecipes', () => ({
  useRecipes: state.useRecipesMock,
}));

vi.mock('@/utils/pdf-export', () => ({
  shareRecipePDF: vi.fn(async () => undefined),
  shareRecipeCardsPDF: vi.fn(async () => undefined),
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
}));

vi.mock('@/components/OfflineBanner', () => ({
  OfflineBanner: ({ isError }: { isError: boolean }) =>
    isError ? React.createElement('Text', { testID: 'offline-banner' }, 'Offline cached recipes') : null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  useFocusEffect: (cb: () => void) => cb(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => 'list'),
    setItem: vi.fn(async () => undefined),
  },
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
  };
});

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
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
    TextInput: wrap('TextInput'),
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
    RefreshControl: wrap('RefreshControl'),
    Image: wrap('Image'),
    Modal: wrap('Modal'),
    ScrollView: wrap('ScrollView'),
    Share: { share: vi.fn(async () => undefined) },
  };
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

describe('RecipeListScreen UI fallbacks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.refetchMock.mockResolvedValue(undefined);
  });

  it('shows loading fallback while initial recipes query is loading', async () => {
    state.useRecipesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: state.refetchMock,
    });

    const { default: RecipeListScreen } = await import('@/app/(tabs)/index');
    render(React.createElement(RecipeListScreen));

    expect(screen.getByTestId('recipe-list-loading')).toBeTruthy();
    expect(screen.queryByText('Rezepte konnten nicht geladen werden')).toBeNull();
  });

  it('shows error fallback and triggers refetch via retry action', async () => {
    state.useRecipesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: state.refetchMock,
    });

    const { default: RecipeListScreen } = await import('@/app/(tabs)/index');
    render(React.createElement(RecipeListScreen));

    await press(screen.getByText('Erneut versuchen'));

    expect(state.refetchMock).toHaveBeenCalled();
  });

  it('keeps cached recipes visible when fetch errors occur (offline recovery path)', async () => {
    state.useRecipesMock.mockReturnValue({
      data: [
        {
          id: 7,
          name: 'Cached Pasta',
          ingredients: '["Nudeln"]',
          steps: '["Kochen"]',
          tags: '["Schnell"]',
        },
      ],
      isLoading: false,
      isError: true,
      refetch: state.refetchMock,
    });

    const { default: RecipeListScreen } = await import('@/app/(tabs)/index');
    render(React.createElement(RecipeListScreen));

    expect(screen.getByText('Cached Pasta')).toBeTruthy();
    expect(screen.queryByText('Rezepte konnten nicht geladen werden')).toBeNull();
    expect(screen.queryByText('Erneut versuchen')).toBeNull();
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });
});
