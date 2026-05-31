import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
    React.createElement('ScannerCamera', { onScan, onClose, testID: 'planner-qr-scanner' }),
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

type Rendered = ReturnType<typeof render>;

function addButtons(view: Rendered) {
  return Array.from({ length: 7 }, (_unused, index) => view.getByTestId(`planner-add-day-${index}`));
}

function pressableByText(view: Rendered, text: string) {
  let node: { parent?: unknown; props?: { onPress?: unknown } } | null = view.getByText(text);
  while (node && typeof node.props?.onPress !== 'function') {
    node = (node.parent ?? null) as typeof node;
  }
  return node;
}

async function openAddMethod(view: Rendered) {
  await waitFor(() => {
    expect(fetch).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(addButtons(view).length).toBeGreaterThan(0);
  });
  await fireEvent.press(addButtons(view)[0]!);
}

async function openRecipePicker(view: Rendered) {
  await openAddMethod(view);
  await fireEvent.press(screen.getByText('Rezept auswählen'));
}

async function press(target: ReactTestTarget) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

type ReactTestTarget = Parameters<typeof fireEvent.press>[0];

describe('PlannerScreen UI fallbacks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading fallback while week data is still loading', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    const view = render(React.createElement(PlannerScreen));

    expect(screen.getByTestId('planner-loading')).toBeTruthy();
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
    const view = render(React.createElement(PlannerScreen));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(addButtons(view).length).toBe(7);
    });
    expect(screen.queryByText('Einkaufsliste')).toBeNull();
  });

  it('shows load error fallback and retries planner week loading visibly', async () => {
    let plannerFetchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          plannerFetchCalls += 1;
          if (plannerFetchCalls === 1) throw new Error('Network request failed');
          return jsonResponse([]);
        }
        if (url.endsWith('/api/v1/recipes')) return jsonResponse([]);
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    const view = render(React.createElement(PlannerScreen));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Wochenplan konnte nicht geladen werden.')).toBeTruthy();
    });

    await press(screen.getByText('Erneut versuchen'));

    await waitFor(() => {
      expect(plannerFetchCalls).toBe(2);
      expect(screen.queryByText('Wochenplan konnte nicht geladen werden.')).toBeNull();
    });
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
    const view = render(React.createElement(PlannerScreen));

    await openAddMethod(view);
    await press(screen.getByText('QR-Code scannen'));

    const scanner = screen.getByTestId('planner-qr-scanner');
    await fireEvent(scanner!, 'scan', 'invalid-qr-content');

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
          return jsonResponse([{ id: 1, recipe_id: 7, day_of_week: 0, week_start: 1_715_200_000 }]);
        }
        if (url.endsWith('/api/v1/recipes')) {
          recipesFetchCalls += 1;
          if (recipesFetchCalls === 2) throw new Error('Network request failed');
          return jsonResponse([{ id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' }]);
        }
        return jsonResponse({});
      })
    );

    state.addIngredientsMock.mockResolvedValue(undefined);

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    const view = render(React.createElement(PlannerScreen));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Suppe')).toBeTruthy();
    });

    await press(screen.getByText('Einkaufsliste'));

    await waitFor(() => {
      expect(screen.getByText('Einkaufsliste konnte nicht erstellt werden.')).toBeTruthy();
    });

    await press(screen.getByText('Erneut versuchen'));

    await waitFor(() => {
      expect(state.router.navigate).toHaveBeenCalledWith('/(tabs)/shopping');
    });
    expect(pressableByText(view, 'Einkaufsliste')).toBeTruthy();
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
          if (recipesFetchCalls === 1) throw new Error('Network request failed');
          return jsonResponse([{ id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' }]);
        }
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    const view = render(React.createElement(PlannerScreen));

    await openRecipePicker(view);

    await waitFor(() => {
      expect(screen.getByText('Rezepte konnten nicht geladen werden.')).toBeTruthy();
    });
    expect(screen.queryByText('Keine Rezepte gefunden.')).toBeNull();

    await press(screen.getByText('Erneut versuchen'));

    await waitFor(() => {
      expect(recipesFetchCalls).toBe(2);
      expect(screen.queryByText('Rezepte konnten nicht geladen werden.')).toBeNull();
      expect(screen.getByText('Suppe')).toBeTruthy();
    });
  });

  it('keeps planner fallback visible and switches retry label while a retry is pending', async () => {
    const retryGate: { release?: () => void } = {};
    let plannerFetchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/v1/planner?week=')) {
          plannerFetchCalls += 1;
          if (plannerFetchCalls === 1) throw new Error('Network request failed');
          await new Promise<void>((resolve) => {
            retryGate.release = resolve;
          });
          return jsonResponse([]);
        }
        if (url.endsWith('/api/v1/recipes')) return jsonResponse([]);
        return jsonResponse({});
      })
    );

    const { default: PlannerScreen } = await import('@/app/(tabs)/planner');
    const view = render(React.createElement(PlannerScreen));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Wochenplan konnte nicht geladen werden.')).toBeTruthy();
    });

    // Pending-state assertion needs the in-flight handler; fireEvent.press awaits the whole async action.
    const retryAction = pressableByText(view, 'Erneut versuchen');
    expect(retryAction).toBeTruthy();
    let retryPromise: Promise<void> | undefined;
    await act(async () => {
      retryPromise = (retryAction!.props as { onPress?: () => Promise<void> }).onPress?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Wochenplan konnte nicht geladen werden.')).toBeTruthy();
      expect(screen.getByText('Wird versucht…')).toBeTruthy();
    });

    retryGate.release?.();
    await act(async () => {
      await retryPromise;
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
          return jsonResponse([{ id: 1, recipe_id: 7, day_of_week: 0, week_start: 1_715_200_000 }]);
        }
        if (url.endsWith('/api/v1/recipes')) {
          return jsonResponse([{ id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' }]);
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
    const view = render(React.createElement(PlannerScreen));

    await openRecipePicker(view);

    await waitFor(() => {
      expect(screen.getByText('Suppe')).toBeTruthy();
    });
    await press(screen.getByText('Suppe'));

    await waitFor(() => {
      expect(screen.getByText('Rezept konnte nicht zum Wochenplan hinzugefügt werden.')).toBeTruthy();
    });

    await press(screen.getByText('Erneut versuchen'));

    await waitFor(() => {
      expect(plannerPostCalls).toBe(2);
      expect(screen.getByText('Suppe')).toBeTruthy();
    });
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
            return jsonResponse([{ id: 1, recipe_id: 7, day_of_week: 0, week_start: 1_715_200_000 }]);
          }
          return jsonResponse([]);
        }
        if (url.endsWith('/api/v1/recipes')) {
          return jsonResponse([{ id: 7, name: 'Suppe', ingredients: '["Wasser"]', steps: '["Kochen"]' }]);
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
    const view = render(React.createElement(PlannerScreen));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Suppe')).toBeTruthy();
    });

    const removeAction = screen.getByTestId('planner-remove-entry-1');
    expect(removeAction).toBeTruthy();
    await press(removeAction!);

    const alertButtons = state.alertMock.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => Promise<void> }>;
    const confirmAction = alertButtons.find((button) => button.text === 'Entfernen');
    await act(async () => {
      await confirmAction?.onPress?.();
    });

    await waitFor(() => {
      expect(deleteCalls).toBe(1);
      expect(screen.getByText('Rezept konnte nicht entfernt werden.')).toBeTruthy();
    });

    await press(screen.getByText('Erneut versuchen'));

    await waitFor(() => {
      expect(deleteCalls).toBe(2);
      expect(state.alertMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Suppe')).toBeNull();
    });
  });
});
