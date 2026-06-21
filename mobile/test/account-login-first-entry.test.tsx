import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  params: {} as Record<string, string | undefined>,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  session: null as { user: { email?: string | null } } | null,
  bootstrapAccount: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: state.router,
  useLocalSearchParams: () => state.params,
}));

vi.mock('@/utils/login-first-routing', () => ({
  LOGIN_FIRST_ACCOUNT_GATE_ENABLED: true,
  DEFAULT_AUTHENTICATED_PATH: '/(tabs)',
  normalizeReturnTo: (value: string | undefined) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/(tabs)'),
  isSafeInternalReturnTo: (value: string | undefined) => Boolean(value && value.startsWith('/') && !value.startsWith('//')),
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
  requestPasswordReset: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUpWithPassword: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('@/utils/account-bootstrap', () => ({
  bootstrapAccount: state.bootstrapAccount,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ArrowLeft: icon,
    CheckCircle2: icon,
    LogIn: icon,
    LogOut: icon,
    Mail: icon,
    RefreshCcw: icon,
    UserPlus: icon,
  };
});

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    TextInput: wrap('TextInput'),
    ScrollView: wrap('ScrollView'),
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
    Platform: { OS: 'android' },
  };
});

describe('AccountScreen login-first entry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.params = { returnTo: '/recipe/42' };
    state.session = null;
    state.bootstrapAccount.mockResolvedValue({
      status: 'ready',
      result: 'created',
      profile: { ready: true, userId: 'u1', email: 'patrick@example.com', appRole: 'user' },
      workspace: { ready: true, id: 'w1', name: 'Mein Workspace', isDefault: true },
      membership: { ready: true, householdId: 'w1', role: 'owner' },
      warnings: [],
    });
  });

  it('shows the guarded resume hint and hides the back button while signed out', async () => {
    const { default: AccountScreen } = await import('@/app/account');
    render(React.createElement(AccountScreen));

    await waitFor(() => {
      expect(screen.getByText('Nach erfolgreicher Anmeldung geht es direkt weiter zu deinem angeforderten Bereich.')).toBeTruthy();
    });
    expect(screen.getByText('Zielroute: /recipe/42')).toBeTruthy();
    expect(screen.queryByLabelText('Zurück')).toBeNull();
  });

  it('lets signed-in users jump back to the requested route', async () => {
    state.session = { user: { email: 'patrick@example.com' } };

    const { default: AccountScreen } = await import('@/app/account');
    render(React.createElement(AccountScreen));

    await waitFor(() => {
      expect(screen.getByText('Zur App zurück')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Zur App zurück'));
    });
    expect(state.router.replace).toHaveBeenCalledWith('/recipe/42');
  });
});
