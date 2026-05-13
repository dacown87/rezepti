import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    navigate: vi.fn(),
  },
  addIngredientsMock: vi.fn(async () => undefined),
  alertMock: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: state.router,
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
}));

vi.mock('@/utils/shopping-service', () => ({
  addIngredients: state.addIngredientsMock,
}));

vi.mock('@/components/ScannerCamera', () => ({
  default: ({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) =>
    React.createElement('ScannerCamera', { onScan, onClose }),
}));

vi.mock('@/utils/recipe-qr', () => ({
  isRecipeJSONQR: vi.fn(() => false),
  decodeRecipeFromCompactJSON: vi.fn(() => null),
  parseCompactRecipeToFull: vi.fn(() => null),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ChevronLeft: icon,
    ChevronRight: icon,
    Plus: icon,
    Trash2: icon,
    Calendar: icon,
    X: icon,
    Search: icon,
    BookOpen: icon,
    QrCode: icon,
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
    Pressable: wrap('Pressable'),
    TextInput: wrap('TextInput'),
    ActivityIndicator: wrap('ActivityIndicator'),
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
    Modal: ({ visible = true, children, ...props }: Record<string, unknown>) =>
      visible ? React.createElement('Modal', props, children as React.ReactNode) : null,
    StyleSheet: { absoluteFillObject: {} },
    Platform: { OS: 'ios' },
    Alert: {
      alert: state.alertMock,
    },
  };
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('PlannerScreen UI fallbacks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading fallback while week data is still loading', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
    });

    expect(
      tree!.root.findAll((node: { type: unknown }) => String(node.type) === 'ActivityIndicator').length
    ).toBeGreaterThan(0);
  });

  it('renders empty week state without shopping action and keeps add affordance visible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) return jsonResponse([]);
        if (url.endsWith('/api/v1/recipes')) return jsonResponse([]);
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const shoppingActions = tree!.root.findAll(
      (node: { type: unknown; children: unknown[] }) =>
        String(node.type) === 'Text' && node.children.includes('Einkaufsliste')
    );
    const addButtons = tree!.root.findAll(
      (node: { type: unknown; props: { className?: string; onPress?: () => unknown } }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('border-dashed')
    );

    expect(shoppingActions.length).toBe(0);
    expect(addButtons.length).toBe(7);
  });

  it('shows load error fallback and retries planner week loading visibly', async () => {
    let plannerFetchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          plannerFetchCalls += 1;
          if (plannerFetchCalls === 1) {
            throw new Error('Network request failed');
          }
          return jsonResponse([]);
        }
        if (url.endsWith('/api/v1/recipes')) return jsonResponse([]);
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Wochenplan konnte nicht geladen werden.')
      ).length
    ).toBeGreaterThan(0);

    const retryAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );
    await act(async () => {
      await (retryAction.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(plannerFetchCalls).toBe(2);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Wochenplan konnte nicht geladen werden.')
      ).length
    ).toBe(0);
  });

  it('shows QR import failure message for non-recipe QR payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) return jsonResponse([]);
        if (url.endsWith('/api/v1/recipes')) return jsonResponse([]);
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const addButtons = tree!.root.findAll(
      (node: { type: unknown; props: { className?: string; onPress?: () => unknown } }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('border-dashed')
    );
    await act(async () => {
      await (addButtons[0]!.props as { onPress?: () => void }).onPress?.();
    });

    const qrSelect = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('QR-Code scannen')).length > 0
    );
    await act(async () => {
      await (qrSelect.props as { onPress?: () => void }).onPress?.();
    });

    const scanner = tree!.root.find((node: { type: unknown }) => String(node.type) === 'ScannerCamera');
    await act(async () => {
      (scanner.props as { onScan: (value: string) => void }).onScan('invalid-qr-content');
      await Promise.resolve();
    });

    expect(state.alertMock).toHaveBeenCalledWith(
      'Kein Rezept-QR',
      'Dieser QR-Code enthält kein RecipeDeck-Rezept.'
    );
  });

  it('shows shopping aggregation error and allows retry from visible planner fallback', async () => {
    let recipesFetchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          return jsonResponse([
            { id: 1, recipe_id: 7, day_of_week: 0, week_start: 1_715_200_000 },
          ]);
        }
        if (url.endsWith('/api/v1/recipes')) {
          recipesFetchCalls += 1;
          if (recipesFetchCalls === 2) {
            throw new Error('Network request failed');
          }
          return jsonResponse([
            { id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' },
          ]);
        }
        return jsonResponse({});
      })
    );

    state.addIngredientsMock.mockResolvedValue(undefined);

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const shoppingAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Einkaufsliste')).length > 0
    );
    await act(async () => {
      await (shoppingAction.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Einkaufsliste konnte nicht erstellt werden.')
      ).length
    ).toBeGreaterThan(0);

    const retryAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );
    await act(async () => {
      await (retryAction.props as { onPress?: () => Promise<void> }).onPress?.();
    });

    expect(state.router.navigate).toHaveBeenCalledWith('/(tabs)/shopping');
  });

  it('shows visible recipe picker load error with local retry instead of empty state', async () => {
    let recipesFetchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) return jsonResponse([]);
        if (url.endsWith('/api/v1/recipes')) {
          recipesFetchCalls += 1;
          if (recipesFetchCalls === 1) {
            throw new Error('Network request failed');
          }
          return jsonResponse([
            { id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' },
          ]);
        }
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const addButtons = tree!.root.findAll(
      (node: { type: unknown; props: { className?: string; onPress?: () => unknown } }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('border-dashed')
    );
    await act(async () => {
      await (addButtons[0]!.props as { onPress?: () => void }).onPress?.();
    });

    const pickRecipeAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Rezept auswählen')).length > 0
    );
    await act(async () => {
      await (pickRecipeAction.props as { onPress?: () => void }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Rezepte konnten nicht geladen werden.')
      ).length
    ).toBeGreaterThan(0);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Keine Rezepte gefunden.')
      ).length
    ).toBe(0);

    const retryAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );
    await act(async () => {
      await (retryAction.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recipesFetchCalls).toBe(2);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Rezepte konnten nicht geladen werden.')
      ).length
    ).toBe(0);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Suppe')
      ).length
    ).toBeGreaterThan(0);
  });

  it('keeps planner fallback visible and switches retry label while a retry is pending', async () => {
    let releaseRetry: (() => void) | null = null;
    let plannerFetchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          plannerFetchCalls += 1;
          if (plannerFetchCalls === 1) {
            throw new Error('Network request failed');
          }
          await new Promise<void>((resolve) => {
            releaseRetry = resolve;
          });
          return jsonResponse([]);
        }
        if (url.endsWith('/api/v1/recipes')) return jsonResponse([]);
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const retryAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );

    await act(async () => {
      void (retryAction.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Wochenplan konnte nicht geladen werden.')
      ).length
    ).toBeGreaterThan(0);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Wird versucht…')
      ).length
    ).toBeGreaterThan(0);

    await act(async () => {
      releaseRetry?.();
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('shows visible rescue fallback for add mutation failures and retries successfully', async () => {
    let plannerPostCalls = 0;
    let plannerListCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          plannerListCalls += 1;
          if (plannerListCalls === 1) return jsonResponse([]);
          return jsonResponse([
            { id: 1, recipe_id: 7, day_of_week: 0, week_start: 1_715_200_000 },
          ]);
        }
        if (url.endsWith('/api/v1/recipes')) {
          return jsonResponse([
            { id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' },
          ]);
        }
        if (url.endsWith('/api/v1/planner') && init?.method === 'POST') {
          plannerPostCalls += 1;
          if (plannerPostCalls === 1) return jsonResponse({}, false, 503);
          return jsonResponse({}, true, 201);
        }
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const addButtons = tree!.root.findAll(
      (node: { type: unknown; props: { className?: string; onPress?: () => unknown } }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('border-dashed')
    );
    await act(async () => {
      await (addButtons[0]!.props as { onPress?: () => void }).onPress?.();
    });

    const pickRecipeAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Rezept auswählen')).length > 0
    );
    await act(async () => {
      await (pickRecipeAction.props as { onPress?: () => void }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const recipeOption = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Suppe')).length > 0
    );
    await act(async () => {
      await (recipeOption.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Rezept konnte nicht zum Wochenplan hinzugefügt werden.')
      ).length
    ).toBeGreaterThan(0);

    const retryAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );
    await act(async () => {
      await (retryAction.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(plannerPostCalls).toBe(2);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Suppe')
      ).length
    ).toBeGreaterThan(0);
  });

  it('shows visible rescue fallback for remove mutation failures and retries without a second confirm dialog', async () => {
    let deleteCalls = 0;
    let plannerListCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          plannerListCalls += 1;
          if (plannerListCalls === 1) {
            return jsonResponse([
              { id: 1, recipe_id: 7, day_of_week: 0, week_start: 1_715_200_000 },
            ]);
          }
          return jsonResponse([]);
        }
        if (url.endsWith('/api/v1/recipes')) {
          return jsonResponse([
            { id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' },
          ]);
        }
        if (url.endsWith('/api/v1/planner/1') && init?.method === 'DELETE') {
          deleteCalls += 1;
          if (deleteCalls === 1) return jsonResponse({}, false, 500);
          return jsonResponse({}, true, 200);
        }
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    let tree: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(PlannerScreen));
      await Promise.resolve();
      await Promise.resolve();
    });

    const removeAction = tree!.root.find(
      (node: { type: unknown; props: { hitSlop?: unknown; onPress?: () => unknown } }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.props.hitSlop === 8
    );
    await act(async () => {
      await (removeAction.props as { onPress?: () => void }).onPress?.();
    });

    const alertButtons = state.alertMock.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => Promise<void> }>;
    const confirmAction = alertButtons.find((button) => button.text === 'Entfernen');
    await act(async () => {
      await confirmAction?.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Rezept konnte nicht entfernt werden.')
      ).length
    ).toBeGreaterThan(0);

    const retryAction = tree!.root.find(
      (node: {
        type: unknown;
        props: { onPress?: () => unknown };
        findAll: (fn: (child: { type: unknown; children: unknown[] }) => boolean) => unknown[];
      }) =>
        String(node.type) === 'Pressable' &&
        typeof node.props.onPress === 'function' &&
        node.findAll((child: { type: unknown; children: unknown[] }) => child.type === 'Text' && child.children.includes('Erneut versuchen')).length > 0
    );
    await act(async () => {
      await (retryAction.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteCalls).toBe(2);
    expect(state.alertMock).toHaveBeenCalledTimes(1);
    expect(
      tree!.root.findAll(
        (node: { type: unknown; children: unknown[] }) =>
          String(node.type) === 'Text' && node.children.includes('Suppe')
      ).length
    ).toBe(0);
  });
});
