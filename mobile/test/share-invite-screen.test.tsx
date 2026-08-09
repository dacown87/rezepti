import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  params: { token: 'tok-1' } as Record<string, string | undefined>,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  },
  session: null as { user: { email?: string | null } } | null,
  invite: {
    status: 'pending' as 'pending' | 'accepted' | 'revoked' | 'expired',
    recipeName: 'Kartoffelsuppe',
    senderEmail: 'sender@example.com',
    recipientEmail: 'empfaenger@example.com',
    expiresAt: '2026-09-01T00:00:00.000Z',
    acceptedRecipeId: null,
  },
  inviteQueryState: { isLoading: false, isError: false },
  acceptMutateAsync: vi.fn(),
  acceptPending: false,
}));

vi.mock('expo-router', () => ({
  router: state.router,
  useLocalSearchParams: () => state.params,
}));

class ApiRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}
vi.mock('@/utils/api', () => ({ ApiRequestError }));

vi.mock('@/utils/auth', () => ({
  getAuthSession: vi.fn(async () => state.session),
}));

vi.mock('@/hooks/useCollections', () => ({
  useRecipeShareInvite: () => ({
    data: state.invite,
    isLoading: state.inviteQueryState.isLoading,
    isError: state.inviteQueryState.isError,
  }),
  useAcceptRecipeShareInvite: () => ({
    mutateAsync: state.acceptMutateAsync,
    isPending: state.acceptPending,
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('SafeAreaView', props, children as React.ReactNode),
}));

vi.mock('lucide-react-native', () => {
  const icon = () => React.createElement('Icon');
  return {
    ArrowLeft: icon,
    Check: icon,
    Mail: icon,
    X: icon,
  };
});

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

describe('RecipeShareInviteScreen — account detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.params = { token: 'tok-1' };
    state.session = null;
    state.invite = {
      status: 'pending',
      recipeName: 'Kartoffelsuppe',
      senderEmail: 'sender@example.com',
      recipientEmail: 'empfaenger@example.com',
      expiresAt: '2026-09-01T00:00:00.000Z',
      acceptedRecipeId: null,
    };
    state.inviteQueryState = { isLoading: false, isError: false };
    state.acceptPending = false;
  });

  it('shows both auth CTAs and hides the accept button while signed out', async () => {
    const { default: RecipeShareInviteScreen } = await import('@/app/share-invite/[token]');
    render(React.createElement(RecipeShareInviteScreen));

    await waitFor(() => {
      expect(screen.getByTestId('share-invite-signed-out')).toBeTruthy();
    });
    expect(screen.getByText('Account erstellen')).toBeTruthy();
    expect(screen.getByText('Anmelden')).toBeTruthy();
    expect(screen.queryByTestId('accept-recipe-share-invite')).toBeNull();
  });

  it('navigates to signup with returnTo and the prefilled recipient email', async () => {
    const { default: RecipeShareInviteScreen } = await import('@/app/share-invite/[token]');
    render(React.createElement(RecipeShareInviteScreen));

    await waitFor(() => {
      expect(screen.getByTestId('share-invite-signup-cta')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('share-invite-signup-cta'));
    });

    expect(state.router.push).toHaveBeenCalledWith({
      pathname: '/account',
      params: {
        mode: 'signup',
        returnTo: '/share-invite/tok-1',
        email: 'empfaenger@example.com',
      },
    });
  });

  it('shows the accept button when signed in', async () => {
    state.session = { user: { email: 'empfaenger@example.com' } };

    const { default: RecipeShareInviteScreen } = await import('@/app/share-invite/[token]');
    render(React.createElement(RecipeShareInviteScreen));

    await waitFor(() => {
      expect(screen.getByTestId('accept-recipe-share-invite')).toBeTruthy();
    });
    expect(screen.queryByTestId('share-invite-signed-out')).toBeNull();
  });

  it('shows the email-mismatch message after a failed accept', async () => {
    state.session = { user: { email: 'falsch@example.com' } };
    state.acceptMutateAsync.mockRejectedValue(new ApiRequestError('email_mismatch', 'mismatch'));

    const { default: RecipeShareInviteScreen } = await import('@/app/share-invite/[token]');
    render(React.createElement(RecipeShareInviteScreen));

    await waitFor(() => {
      expect(screen.getByTestId('accept-recipe-share-invite')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('accept-recipe-share-invite'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('recipe-share-invite-accept-error')).toBeTruthy();
    });
    expect(screen.getByText('Diese Einladung ist fuer eine andere E-Mail-Adresse bestimmt.')).toBeTruthy();
  });

  it.each([
    ['accepted', 'Diese Einladung wurde bereits angenommen.'],
    ['revoked', 'Diese Einladung wurde widerrufen.'],
    ['expired', 'Diese Einladung ist abgelaufen.'],
  ] as const)('replaces the button with the %s status message', async (status, message) => {
    state.invite = { ...state.invite, status };

    const { default: RecipeShareInviteScreen } = await import('@/app/share-invite/[token]');
    render(React.createElement(RecipeShareInviteScreen));

    await waitFor(() => {
      expect(screen.getByText(message)).toBeTruthy();
    });
    expect(screen.queryByTestId('accept-recipe-share-invite')).toBeNull();
    expect(screen.queryByTestId('share-invite-signed-out')).toBeNull();
  });
});
