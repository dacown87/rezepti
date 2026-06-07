import type { Href } from 'expo-router';
import { ApiRequestError } from './api';

export interface ProtectedAccessState {
  code: 'auth_missing' | 'token_expired' | 'no_household' | 'bootstrap_failed';
  title: string;
  message: string;
  primaryLabel: string;
  primaryHref: Href;
}

export function buildAccountHref(returnTo: string, mode: 'signin' | 'signup' | 'reset' = 'signin'): Href {
  return {
    pathname: '/account',
    params: {
      mode,
      returnTo,
    },
  };
}

export function mapProtectedApiError(
  error: unknown,
  returnTo: string,
): ProtectedAccessState | null {
  if (!(error instanceof ApiRequestError) || !error.code) {
    return null;
  }

  switch (error.code) {
    case 'auth_missing':
      return {
        code: 'auth_missing',
        title: 'Anmeldung erforderlich',
        message: 'Melde dich an, um diesen Bereich zu nutzen.',
        primaryLabel: 'Zu Account & Workspace',
        primaryHref: buildAccountHref(returnTo, 'signin'),
      };
    case 'token_expired':
      return {
        code: 'token_expired',
        title: 'Session abgelaufen',
        message: 'Bitte melde dich erneut an, damit deine Session erneuert wird.',
        primaryLabel: 'Erneut anmelden',
        primaryHref: buildAccountHref(returnTo, 'signin'),
      };
    case 'no_household':
      return {
        code: 'no_household',
        title: 'Workspace wird eingerichtet',
        message: 'Dein Account ist da, aber dein erster Workspace ist noch nicht bereit.',
        primaryLabel: 'Account & Workspace prüfen',
        primaryHref: buildAccountHref(returnTo, 'signin'),
      };
    case 'bootstrap_failed':
      return {
        code: 'bootstrap_failed',
        title: 'Workspace konnte nicht eingerichtet werden',
        message: 'Der Account-Setup-Schritt ist fehlgeschlagen. Du kannst den Bootstrap dort erneut auslösen.',
        primaryLabel: 'Workspace erneut einrichten',
        primaryHref: buildAccountHref(returnTo, 'signin'),
      };
    default:
      return null;
  }
}
