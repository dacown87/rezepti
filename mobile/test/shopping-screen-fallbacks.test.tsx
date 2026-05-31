import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
      queueMicrotask(cb);
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
      if (React.isValidElement(refreshControl)) {
        const refreshElement = refreshControl as React.ReactElement<{ onRefresh?: () => void }>;
        children.push(
          React.createElement(
            'Pressable',
            { key: 'refresh-control', testID: 'shopping-refresh-control', onPress: refreshElement.props.onRefresh },
            React.createElement('Text', {}, 'Refresh shopping list')
          )
        );
      }
      if (Array.isArray(data) && typeof renderItem === 'function') {
        children.push(
          ...data.map((item, index) => {
            const child = (renderItem as (args: { item: unknown; index: number }) => React.ReactNode)({ item, index });
            return React.isValidElement(child)
              ? React.cloneElement(child, { key: child.key ?? `flat-list-item-${index}` })
              : child;
          })
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

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

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

    render(React.createElement(ShoppingScreen));

    expect(screen.getByText('Einkaufsliste')).toBeTruthy();
    expect(screen.getByTestId('shopping-skeleton')).toBeTruthy();
  });

  it('shows error fallback and supports retry when shopping fetch fails', async () => {
    const { default: ShoppingScreen } = await import('@/app/(tabs)/shopping');
    render(React.createElement(ShoppingScreen));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Einkaufsliste konnte nicht geladen werden')).toBeTruthy();
    });

    await press(screen.getByText('Erneut versuchen'));

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
    render(React.createElement(ShoppingScreen));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('shopping-skeleton')).toBeNull();
    });

    const input = screen.getByPlaceholderText('Artikel hinzufügen…');

    await fireEvent.changeText(input, 'Milch');
    await waitFor(() => {
      expect((input.props as { value?: string }).value).toBe('Milch');
    });
    await act(async () => {
      await fireEvent(input, 'submitEditing');
    });

    await waitFor(() => {
      expect(screen.getByText('Artikel konnte nicht hinzugefügt werden.')).toBeTruthy();
    });
    expect((input.props as { value?: string }).value).toBe('Milch');

    await press(screen.getByText('Erneut versuchen'));

    expect(fetchMock).toHaveBeenCalledTimes(4);
    await waitFor(() => {
      expect(screen.getByText('Milch')).toBeTruthy();
    });
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
    render(React.createElement(ShoppingScreen));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Tomaten')).toBeTruthy();
    });

    await press(screen.getByText('Tomaten'));

    await waitFor(() => {
      expect(screen.getByText('Status konnte nicht aktualisiert werden.')).toBeTruthy();
    });
    expect(screen.getByText('Tomaten')).toBeTruthy();

    await press(screen.getByText('Erneut versuchen'));

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
    render(React.createElement(ShoppingScreen));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Brot')).toBeTruthy();
    });

    await press(screen.getByTestId('shopping-refresh-control'));

    expect(screen.getByText('Brot')).toBeTruthy();
    expect(screen.queryByText('Einkaufsliste konnte nicht geladen werden')).toBeNull();
  });
});
