import type { Href } from 'expo-router';

export const LOGIN_FIRST_ACCOUNT_GATE_ENABLED =
  process.env.EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE === '1'
  || process.env.EXPO_PUBLIC_LOGIN_FIRST_ACCOUNT_GATE === 'true';

export const DEFAULT_AUTHENTICATED_PATH = '/(tabs)';

export function isSafeInternalReturnTo(value: string | null | undefined): value is string {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('://');
}

export function normalizeReturnTo(
  value: string | null | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (!isSafeInternalReturnTo(value) || value === '/') {
    return fallback;
  }

  return value;
}

export function isPublicLoginFirstPath(pathname: string | null | undefined): boolean {
  return pathname === '/account' || pathname === '/+not-found';
}

export function buildLoginFirstAccountHref(
  returnTo: string | null | undefined,
  mode: 'signin' | 'signup' | 'reset' = 'signin',
): Href {
  return {
    pathname: '/account',
    params: {
      mode,
      returnTo: normalizeReturnTo(returnTo),
    },
  };
}
