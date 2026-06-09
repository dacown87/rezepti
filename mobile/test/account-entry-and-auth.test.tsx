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
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
  bootstrapAccount: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: state.router,
  useLocalSearchParams: () => state.params,
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
  signInWithPassword: state.signInWithPassword,
  signUpWithPassword: state.signUpWithPassword,
  resendSignupConfirmation: state.resendSignupConfirmation,
  requestPasswordReset: state.requestPasswordReset,
  updatePassword: state.updatePassword,
  signOut: state.signOut,
}));

vi.mock('@/utils/account-bootstrap', () => ({
  bootstrapAccount: state.bootstrapAccount,
}));

vi.mock('@/utils/server-url', () => ({
  getServerUrl: vi.fn(async () => 'http://localhost:3000'),
  PRODUCTION_URL: 'https://app.example.test',
  SERVER_URL_KEY: 'server-url',
}));

vi.mock('@/utils/use-theme', () => ({
  useTheme: () => ({ isDark: false, setTheme: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => React.createElement('SafeAreaView', {}, children),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    Eye: icon,
    EyeOff: icon,
    Key: icon,
    Server: icon,
    Info: icon,
    Trash2: icon,
    Save: icon,
    ScrollText: icon,
    Map: icon,
    HelpCircle: icon,
    X: icon,
    ExternalLink: icon,
    Sun: icon,
    Moon: icon,
    User: icon,
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
    TouchableOpacity: wrap('TouchableOpacity'),
    ScrollView: wrap('ScrollView'),
    ActivityIndicator: wrap('ActivityIndicator'),
    Modal: ({ visible = true, children, ...props }: Record<string, unknown>) =>
      visible ? React.createElement('Modal', props, children as React.ReactNode) : null,
    Switch: wrap('Switch'),
    Pressable: wrap('Pressable'),
    Alert: { alert: vi.fn() },
    Platform: { OS: 'android', select: (spec: Record<string, unknown>) => spec.android ?? spec.default },
  };
});

async function press(target: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(target);
  });
}

function lastByText(text: string) {
  const nodes = screen.getAllByText(text);
  return nodes[nodes.length - 1]!;
}

describe('account entry and auth flows', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.params = {};
    state.session = null;
    state.signInWithPassword.mockResolvedValue({ user: { email: 'patrick@example.com' } });
    state.signUpWithPassword.mockResolvedValue({ status: 'confirmation_required', email: 'patrick@example.com' });
    state.resendSignupConfirmation.mockResolvedValue(undefined);
    state.requestPasswordReset.mockResolvedValue(undefined);
    state.updatePassword.mockResolvedValue(undefined);
    state.signOut.mockResolvedValue(undefined);
    state.bootstrapAccount.mockResolvedValue({
      status: 'ready',
      result: 'created',
      profile: { ready: true, userId: 'u1', email: 'patrick@example.com', appRole: 'user' },
      workspace: { ready: true, id: 'w1', name: 'Mein Workspace', isDefault: true },
      membership: { ready: true, householdId: 'w1', role: 'owner' },
      warnings: [],
    });
  });

  it('settings links to the dedicated account screen', async () => {
    const { default: SettingsScreen } = await import('@/app/(tabs)/settings');
    render(React.createElement(SettingsScreen));

    await waitFor(() => {
      expect(screen.getByText('Anmelden oder Account erstellen')).toBeTruthy();
    });
    await press(screen.getByText('Anmelden oder Account erstellen'));

    expect(state.router.push).toHaveBeenCalledWith('/account');
  });

  it('sign-in bootstraps and returns to the guarded route', async () => {
    state.params = { returnTo: '/(tabs)/planner' };

    const { default: AccountScreen } = await import('@/app/account');
    render(React.createElement(AccountScreen));

    fireEvent.changeText(screen.getByPlaceholderText('E-Mail'), 'patrick@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Passwort'), 'secret123');

    await press(lastByText('Anmelden'));

    await waitFor(() => {
      expect(state.signInWithPassword).toHaveBeenCalledWith('patrick@example.com', 'secret123');
      expect(state.bootstrapAccount).toHaveBeenCalledTimes(1);
      expect(state.router.replace).toHaveBeenCalledWith('/(tabs)/planner');
    });
  });

  it('shows confirmation-required state and resends signup confirmation', async () => {
    state.params = { returnTo: '/(tabs)/shopping' };

    const { default: AccountScreen } = await import('@/app/account');
    render(React.createElement(AccountScreen));

    await press(lastByText('Account erstellen'));
    fireEvent.changeText(screen.getByPlaceholderText('E-Mail'), 'patrick@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Passwort'), 'secret123');
    fireEvent.changeText(screen.getByPlaceholderText('Passwort bestätigen'), 'secret123');

    await press(lastByText('Account erstellen'));

    await waitFor(() => {
      expect(state.signUpWithPassword).toHaveBeenCalledWith('patrick@example.com', 'secret123', {
        mode: 'signup',
        returnTo: '/(tabs)/shopping',
      });
      expect(screen.getByText('Bestätige deine E-Mail und öffne danach den Link erneut in der App.')).toBeTruthy();
    });

    await press(screen.getByText('Bestätigungs-E-Mail erneut senden'));

    expect(state.resendSignupConfirmation).toHaveBeenCalledWith('patrick@example.com', {
      mode: 'signup',
      returnTo: '/(tabs)/shopping',
    });
  });

  it('requests a password reset from the account screen', async () => {
    state.params = { returnTo: '/(tabs)/index' };

    const { default: AccountScreen } = await import('@/app/account');
    render(React.createElement(AccountScreen));

    await press(screen.getByText('Passwort zurücksetzen'));
    fireEvent.changeText(screen.getByPlaceholderText('E-Mail'), 'patrick@example.com');

    await press(screen.getByText('Reset-Link anfordern'));

    expect(state.requestPasswordReset).toHaveBeenCalledWith('patrick@example.com', {
      returnTo: '/(tabs)/index',
    });
  });
});
