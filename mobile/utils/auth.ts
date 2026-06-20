import * as Linking from 'expo-linking';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authStorage } from './auth-storage';

declare const require: (id: string) => unknown;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null | undefined;

export type SignUpResult =
  | { status: 'session_ready'; session: Session }
  | { status: 'confirmation_required'; email: string }
  | { status: 'signup_failed'; message: string };

export interface AuthRedirectOptions {
  mode?: 'signin' | 'signup' | 'reset' | 'update-password';
  returnTo?: string;
}

export function readAuthRedirectOptions(url: string): AuthRedirectOptions {
  const params = collectUrlParams(url);
  const mode = params.get('mode');
  const returnTo = params.get('returnTo');

  return {
    mode:
      mode === 'signin' || mode === 'signup' || mode === 'reset' || mode === 'update-password'
        ? mode
        : undefined,
    returnTo: returnTo || undefined,
  };
}

function ensureUrlPolyfill(): void {
  try {
    require('react-native-url-polyfill/auto');
  } catch {
    // Test/web environments can already provide URL without the React Native polyfill.
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient;

  if (!supabaseUrl || !supabaseKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  // Expo static web export renders routes in a Node environment first.
  // Supabase auth storage touches browser-only globals there, so skip client
  // initialization during SSR and let hydration create it in the browser.
  if (Platform.OS === 'web' && typeof window === 'undefined') {
    return null;
  }

  ensureUrlPolyfill();

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

export async function getAuthSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function getAuthAccessToken(): Promise<string | null> {
  return (await getAuthSession())?.access_token ?? null;
}

/**
 * Forces a Supabase token refresh and returns the new session, or null when
 * the client is unconfigured or the refresh token is also expired/invalid.
 *
 * Used by apiFetch's 401-recovery path: an installed PWA backgrounded during a
 * long extraction suspends Supabase's auto-refresh timer, so the access token
 * can lapse silently. A forced refresh + single retry recovers without making
 * the user manually sign out and back in.
 */
export async function refreshAuthSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.refreshSession();
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
}

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const client = requireSupabaseClient();

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Login hat keine Session geliefert.');
  }
  return data.session;
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth ist nicht konfiguriert.');
  }

  return client;
}

export function buildAuthRedirectUrl(
  path = '/account',
  options?: AuthRedirectOptions,
): string {
  const search = new URLSearchParams();
  if (options?.mode) {
    search.set('mode', options.mode);
  }
  if (options?.returnTo) {
    search.set('returnTo', options.returnTo);
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return Linking.createURL(`${path}${suffix}`);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  options?: AuthRedirectOptions,
): Promise<SignUpResult> {
  try {
    const client = requireSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthRedirectUrl('/account', options),
      },
    });

    if (error) {
      return {
        status: 'signup_failed',
        message: error.message,
      };
    }

    if (data.session) {
      return {
        status: 'session_ready',
        session: data.session,
      };
    }

    return {
      status: 'confirmation_required',
      email,
    };
  } catch (error) {
    return {
      status: 'signup_failed',
      message: error instanceof Error ? error.message : 'Account konnte nicht erstellt werden.',
    };
  }
}

export async function resendSignupConfirmation(email: string, options?: AuthRedirectOptions): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: buildAuthRedirectUrl('/account', options),
    },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string, options?: AuthRedirectOptions): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthRedirectUrl('/account', { ...options, mode: 'update-password' }),
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

function collectUrlParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

export async function syncAuthSessionFromUrl(url: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const params = collectUrlParams(url);
  const code = params.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return true;
  }

  return false;
}

export function registerAuthRedirectObserver(options?: {
  onPasswordRecovery?: (redirect?: AuthRedirectOptions) => void;
  onConfirmationSuccess?: (redirect?: AuthRedirectOptions) => void;
  onLinkError?: (message: string) => void;
}): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  let lastRedirect: AuthRedirectOptions | undefined;

  const handleUrl = async (url: string) => {
    try {
      const synced = await syncAuthSessionFromUrl(url);
      if (!synced) {
        return;
      }

      lastRedirect = readAuthRedirectOptions(url);
      if (lastRedirect.mode === 'update-password') {
        options?.onPasswordRecovery?.(lastRedirect);
      } else if (lastRedirect.mode === 'signin' || lastRedirect.mode === 'signup' || lastRedirect.mode === undefined) {
        options?.onConfirmationSuccess?.(lastRedirect);
      }
    } catch (error) {
      console.warn('auth.redirect.failed', error);
      options?.onLinkError?.(
        'Der Bestätigungs-Link ist abgelaufen oder ungültig. Bitte neu anfordern.',
      );
    }
  };

  void Linking.getInitialURL().then((url) => {
    if (url) {
      void handleUrl(url);
    }
  });

  const urlSubscription = Linking.addEventListener('url', ({ url }) => {
    void handleUrl(url);
  });

  const { data } = client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      options?.onPasswordRecovery?.(lastRedirect);
    }
  });

  return () => {
    urlSubscription.remove();
    data.subscription.unsubscribe();
  };
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getAuthHeaders(headers?: HeadersInit): Promise<HeadersInit | undefined> {
  const accessToken = await getAuthAccessToken();
  if (!accessToken) {
    return headers;
  }

  const merged = new Headers(headers);
  merged.set('Authorization', `Bearer ${accessToken}`);
  return merged;
}
