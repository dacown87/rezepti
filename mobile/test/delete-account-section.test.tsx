import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { React?: typeof React }).React = React;

const state = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOutLocal: vi.fn(),
  deleteAccount: vi.fn(),
  queueClear: vi.fn(),
  deleteSecret: vi.fn(),
  online: true,
}));

vi.mock('react-native', () => {
  const wrap = (type: string) => ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(type, props, children as React.ReactNode);
  return {
    View: wrap('View'),
    Text: wrap('Text'),
    TextInput: wrap('TextInput'),
    Pressable: wrap('Pressable'),
    ActivityIndicator: wrap('ActivityIndicator'),
    Platform: { OS: 'android' },
  };
});

vi.mock('lucide-react-native', () => ({ Trash2: () => React.createElement('Icon') }));

vi.mock('@/utils/auth', () => ({
  signInWithPassword: state.signInWithPassword,
  signOutLocal: state.signOutLocal,
}));

vi.mock('@/utils/api', () => {
  class ApiRequestError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
    }
  }
  return { ApiRequestError, deleteAccount: state.deleteAccount };
});

vi.mock('@/offline/queue-singleton', () => ({ offlineQueue: { clear: state.queueClear } }));
vi.mock('@/offline/network-status', () => ({ isOnline: () => state.online }));
vi.mock('expo-secure-store', () => ({ deleteItemAsync: state.deleteSecret }));

const { DeleteAccountSection, DELETE_CONFIRMATION_WORD } = await import('@/components/DeleteAccountSection');
const { ApiRequestError } = await import('@/utils/api');

function openForm(onDeleted = vi.fn()) {
  render(<DeleteAccountSection email="a@example.test" onDeleted={onDeleted} />);
  fireEvent.press(screen.getByText('Konto löschen'));
  return onDeleted;
}

function fill(password: string, word: string) {
  fireEvent.changeText(screen.getByLabelText('Passwort zur Bestätigung'), password);
  fireEvent.changeText(screen.getByLabelText('Bestätigungswort'), word);
}

const submit = () => fireEvent.press(screen.getAllByText('Konto endgültig löschen')[1]);

describe('DeleteAccountSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.online = true;
    state.signInWithPassword.mockResolvedValue({});
    state.signOutLocal.mockResolvedValue(undefined);
    state.deleteAccount.mockResolvedValue(undefined);
    state.queueClear.mockResolvedValue(undefined);
  });

  it('shows nothing destructive until the user opens the form', () => {
    render(<DeleteAccountSection email="a@example.test" onDeleted={vi.fn()} />);
    expect(screen.queryByLabelText('Passwort zur Bestätigung')).toBeNull();
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it('does not delete without the confirmation word', async () => {
    openForm();
    fill('geheim123', 'löschen nein');
    submit();
    await Promise.resolve();
    expect(state.signInWithPassword).not.toHaveBeenCalled();
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it('keeps the account when the password is wrong', async () => {
    state.signInWithPassword.mockRejectedValue(new Error('Invalid login credentials'));
    openForm();
    fill('falsch', DELETE_CONFIRMATION_WORD);
    submit();

    await waitFor(() => expect(screen.getByText('Das Passwort ist nicht korrekt.')).toBeTruthy());
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it('refuses while offline and does not call the server', async () => {
    state.online = false;
    openForm();
    fill('geheim123', DELETE_CONFIRMATION_WORD);
    submit();

    await waitFor(() => expect(screen.getByText(/Internetverbindung/)).toBeTruthy());
    expect(state.signInWithPassword).not.toHaveBeenCalled();
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes, wipes local data, signs out locally and reports back', async () => {
    const onDeleted = openForm();
    fill('geheim123', DELETE_CONFIRMATION_WORD);
    submit();

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(state.signInWithPassword).toHaveBeenCalledWith('a@example.test', 'geheim123');
    expect(state.deleteAccount).toHaveBeenCalledTimes(1);
    expect(state.queueClear).toHaveBeenCalledTimes(1);
    expect(state.deleteSecret).toHaveBeenCalledWith('groq_key');
    expect(state.signOutLocal).toHaveBeenCalledTimes(1);
  });

  it('explains the shared-household refusal and stays signed in', async () => {
    state.deleteAccount.mockRejectedValue(new ApiRequestError(409, 'x'));
    const onDeleted = openForm();
    fill('geheim123', DELETE_CONFIRMATION_WORD);
    submit();

    await waitFor(() => expect(screen.getByText(/weitere Mitglieder/)).toBeTruthy());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(state.signOutLocal).not.toHaveBeenCalled();
  });
});
