import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { authStorage } from './auth-storage';

declare const require: (id: string) => unknown;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null | undefined;

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

export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Auth ist nicht konfiguriert.');
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Login hat keine Session geliefert.');
  }
  return data.session;
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
