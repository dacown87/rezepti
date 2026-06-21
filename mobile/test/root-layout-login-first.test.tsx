import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  pathname: '/recipe/42',
  router: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
  },
  session: null as { user?: { email?: string | null } } | null,
}));

vi.mock('expo-font', () => ({
  useFonts: () => [true],
}));

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn(),
  hideAsync: vi.fn(),
}));

vi.mock('expo-router', () => {
  const Stack = ({ children }: { children: React.ReactNode }) => React.createElement('Stack', {}, children);
  Stack.Screen = ({ name }: { name: string }) => React.createElement('Screen', { name });
  return {
    Stack,
    usePathname: () => state.pathname,
    useRouter: () => state.router,
    ErrorBoundary: () => null,
  };
});

vi.mock('expo-router/react-navigation', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => React.createElement('ThemeProvider', {}, children),
  DarkTheme: {},
  DefaultTheme: {},
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
  };
});

vi.mock('@tanstack/react-query-persist-client', () => ({
  PersistQueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('PersistQueryClientProvider', {}, children),
}));

vi.mock('lucide-react-native', () => ({
  Bug: () => React.createElement('Icon'),
}));

vi.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

vi.mock('@/utils/use-theme', () => ({
  useThemeInit: vi.fn(),
}));

vi.mock('@/utils/query-client', () => ({
  queryClient: {},
  asyncStoragePersister: {},
  startAuthQueryCacheWatch: vi.fn(async () => () => undefined),
  getSessionRestoring: vi.fn(() => false),
  subscribeSessionRestoring: vi.fn(() => () => undefined),
}));

vi.mock('@/utils/auth', () => ({
  getAuthSession: vi.fn(async () => state.session),
  getSupabaseClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        callback('INITIAL_SESSION', state.session);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  })),
  registerAuthRedirectObserver: vi.fn(() => () => undefined),
}));

vi.mock('@/utils/login-first-routing', () => ({
  LOGIN_FIRST_ACCOUNT_GATE_ENABLED: true,
  isPublicLoginFirstPath: (pathname: string | null | undefined) => pathname === '/account' || pathname === '/+not-found',
  buildLoginFirstAccountHref: (returnTo: string | null | undefined) => ({
    pathname: '/account',
    params: {
      mode: 'signin',
      returnTo: returnTo === '/' || !returnTo ? '/(tabs)' : returnTo,
    },
  }),
}));

vi.mock('@/components/BugReportModal', () => ({
  default: () => null,
}));

vi.mock('@/components/BugReportHeaderAction', () => ({
  BugReportHeaderAction: () => null,
}));

vi.mock('@/utils/bug-reporting', () => ({
  openBugReportModal: vi.fn(),
  registerBugReportModalController: vi.fn(() => () => undefined),
}));

describe('RootLayout login-first guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.pathname = '/recipe/42';
    state.session = null;
  });

  it('replaces protected signed-out routes with /account including returnTo', async () => {
    const { default: RootLayout } = await import('@/app/_layout');
    render(React.createElement(RootLayout));

    await waitFor(() => {
      expect(state.router.replace).toHaveBeenCalledWith({
        pathname: '/account',
        params: {
          mode: 'signin',
          returnTo: '/recipe/42',
        },
      });
    });
  });

  it('does not redirect the public /account route', async () => {
    state.pathname = '/account';

    const { default: RootLayout } = await import('@/app/_layout');
    render(React.createElement(RootLayout));

    await waitFor(() => {
      expect(state.router.replace).not.toHaveBeenCalled();
    });
  });
});
