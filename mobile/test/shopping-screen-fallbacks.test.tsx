import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const focusState = vi.hoisted(() => ({
  invoked: false,
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    if (!focusState.invoked) {
      focusState.invoked = true;
      cb();
    }
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ShoppingCart: icon,
    Trash2: icon,
    Check: icon,
    X: icon,
    Share2: icon,
    Plus: icon,
  };
});

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    FlatList: ({ data, renderItem, refreshControl }: Record<string, unknown>) => {
      const children: React.ReactNode[] = [];
      if (refreshControl) children.push(refreshControl as React.ReactNode);
      if (Array.isArray(data) && typeof renderItem === 'function') {
        children.push(
          ...data.map((item, index) =>
            (renderItem as (args: { item: unknown; index: number }) => React.ReactNode)({ item, index })
          )
        );
      }
      return React.createElement('FlatList', {}, children);
    },
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
    RefreshControl: wrap('RefreshControl'),
    TextInput: wrap('TextInput'),
    Modal: wrap('Modal'),
    Share: { share: vi.fn(async () => undefined) },
  };
});

describe('ShoppingScreen UI fallbacks', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    focusState.invoked = false;
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows header and skeleton shell immediately before data arrives', async () => {
    // fetch never resolves → component stays in loading state
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

    const { default: ShoppingScreen } = await import('@/app/(tabs)/shopping');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ShoppingScreen));
    });

    // Header text must be visible immediately
    const headerText = tree!.root.findAll(
      (node: { type: unknown; children: unknown[] }) =>
        node.type === 'Text' && node.children.includes('Einkaufsliste')
    );
    expect(headerText.length).toBeGreaterThan(0);

    // Skeleton placeholder container must be present
    const skeleton = tree!.root.findAll(
      (node: { type: unknown; props: Record<string, unknown> }) =>
        (node.props as { testID?: string }).testID === 'shopping-skeleton'
    );
    expect(skeleton.length).toBeGreaterThan(0);
  });

  it('shows error fallback and supports retry when shopping fetch fails', async () => {
    const { default: ShoppingScreen } = await import('@/app/(tabs)/shopping');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ShoppingScreen));
      await Promise.resolve();
    });

    const retryPressable = tree!.root.find(
      (node: { type: unknown; props: { onPress?: () => void }; findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[] }) =>
        node.type === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );
    await act(async () => {
      await (retryPressable.props as { onPress?: () => unknown }).onPress?.();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows mutation error, restores manual input, and retries manual add successfully', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 1, canonical_name: 'Milch', checked: 0 }],
        }),
      });

    const { default: ShoppingScreen } = await import('@/app/(tabs)/shopping');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ShoppingScreen));
      await Promise.resolve();
    });

    const input = tree!.root.find(
      (node: { type: unknown; props: { onChangeText?: (value: string) => void; onSubmitEditing?: () => unknown } }) =>
        node.type === 'TextInput' &&
        typeof node.props.onChangeText === 'function' &&
        typeof node.props.onSubmitEditing === 'function'
    );

    await act(async () => {
      (input.props as { onChangeText: (value: string) => void }).onChangeText('Milch');
    });

    await act(async () => {
      await (input.props as { onSubmitEditing: () => Promise<void> }).onSubmitEditing();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          node.type === 'Text' && node.children.includes('Artikel konnte nicht hinzugefügt werden.')
      ).length
    ).toBeGreaterThan(0);
    expect((input.props as { value?: string }).value).toBe('Milch');

    const retryPressable = tree!.root.find(
      (node: { type: unknown; props: { onPress?: () => unknown }; findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[] }) =>
        node.type === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );

    await act(async () => {
      await (retryPressable.props as { onPress?: () => Promise<void> }).onPress?.();
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) => node.type === 'Text' && node.children.includes('Milch')
      ).length
    ).toBeGreaterThan(0);
  });

  it('shows mutation error and retry for failed toggle without dropping the item', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 7, canonical_name: 'Tomaten', checked: 0 }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { default: ShoppingScreen } = await import('@/app/(tabs)/shopping');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ShoppingScreen));
      await Promise.resolve();
    });

    const itemPressable = tree!.root.find(
      (node: { type: unknown; props: { onPress?: () => unknown }; findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[] }) =>
        node.type === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Tomaten')).length > 0
    );

    await act(async () => {
      await (itemPressable.props as { onPress?: () => Promise<void> }).onPress?.();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          node.type === 'Text' && node.children.includes('Status konnte nicht aktualisiert werden.')
      ).length
    ).toBeGreaterThan(0);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) => node.type === 'Text' && node.children.includes('Tomaten')
      ).length
    ).toBeGreaterThan(0);

    const retryPressable = tree!.root.find(
      (node: { type: unknown; props: { onPress?: () => unknown }; findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[] }) =>
        node.type === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );

    await act(async () => {
      await (retryPressable.props as { onPress?: () => Promise<void> }).onPress?.();
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps cached shopping items visible when refresh fails (offline recovery path)', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 3, canonical_name: 'Brot', checked: 0 }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    const { default: ShoppingScreen } = await import('@/app/(tabs)/shopping');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ShoppingScreen));
      await Promise.resolve();
    });

    const refreshControl = tree!.root.find(
      (node: { type: unknown; props: { onRefresh?: () => Promise<void> } }) =>
        node.type === 'RefreshControl' && typeof node.props.onRefresh === 'function'
    );
    await act(async () => {
      await (refreshControl.props as { onRefresh: () => Promise<void> }).onRefresh();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) => node.type === 'Text' && node.children.includes('Brot')
      ).length
    ).toBeGreaterThan(0);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          node.type === 'Text' && node.children.includes('Einkaufsliste konnte nicht geladen werden')
      ).length
    ).toBe(0);
  });
});
