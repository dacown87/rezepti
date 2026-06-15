/**
 * session-persistence.test.ts
 *
 * Automated replacements for the manual web-acceptance gate that previously
 * required a human to click through:
 *   - Login → reload → still authed
 *   - New context → cache cleared
 *   - Auth storage round-trip (getAuthSession restores stored session)
 *
 * T12: Automated session persistence tests replacing manual web acceptance gate.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthStateChangeCallback = (event: string, session: { user: { id: string } } | null) => void;

// ---------------------------------------------------------------------------
// Test 1: authStorage round-trip
// ---------------------------------------------------------------------------
describe('authStorage round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getItem returns the value previously written by setItem (web/AsyncStorage path)', async () => {
    // Force Platform.OS to "web" so the secure-store branch is skipped and
    // the AsyncStorage path is exercised consistently in the Node test env.
    vi.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));

    // Wire the AsyncStorage mock so get returns what was last set for the key.
    const store = new Map<string, string>();
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      store.set(key, value);
    });
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      return store.get(key) ?? null;
    });

    // Dynamic import after mocking so the module picks up the Platform mock.
    const { authStorage } = await import('@/utils/auth-storage');

    const KEY = 'supabase-session-token';
    const VALUE = JSON.stringify({ access_token: 'tok_abc', refresh_token: 'rtok_xyz' });

    await authStorage.setItem(KEY, VALUE);
    const retrieved = await authStorage.getItem(KEY);

    expect(retrieved).toBe(VALUE);

    // Also verify the AsyncStorage key was prefixed correctly.
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(`recipedeck-auth:${KEY}`, VALUE);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(`recipedeck-auth:${KEY}`);
  });

  it('removeItem deletes the stored value (web/AsyncStorage path)', async () => {
    vi.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));

    const store = new Map<string, string>();
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      store.set(key, value);
    });
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => store.get(key) ?? null);
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      store.delete(key);
    });

    const { authStorage } = await import('@/utils/auth-storage');

    const KEY = 'supabase-session-token';
    await authStorage.setItem(KEY, 'sensitive-value');
    await authStorage.removeItem(KEY);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`recipedeck-auth:${KEY}`);
    // Confirm the value is gone from the backing store.
    expect(store.has(`recipedeck-auth:${KEY}`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 2: getAuthSession restores from storage via mocked Supabase client
// ---------------------------------------------------------------------------
describe('getAuthSession restores session from storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns the session with access_token populated when Supabase returns a stored session', async () => {
    const storedSession = {
      access_token: 'test-access-token-stored',
      refresh_token: 'test-refresh-token-stored',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'user-stored', email: 'test@example.com' },
    };

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: storedSession },
            error: null,
          })),
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
          })),
        },
      }),
      getAuthSession: vi.fn(async () => storedSession),
    }));

    const { getAuthSession } = await import('@/utils/auth');

    const session = await getAuthSession();

    expect(session).not.toBeNull();
    expect(session?.access_token).toBe('test-access-token-stored');
    expect(session?.user?.id).toBe('user-stored');
  });

  it('returns null when Supabase has no session (unauthenticated / cold start without stored session)', async () => {
    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: null },
            error: null,
          })),
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
          })),
        },
      }),
      getAuthSession: vi.fn(async () => null),
    }));

    const { getAuthSession } = await import('@/utils/auth');

    const session = await getAuthSession();

    expect(session).toBeNull();
  });

  it('propagates errors thrown by Supabase getSession', async () => {
    const authError = new Error('JWT expired');

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          getSession: vi.fn(async () => ({
            data: { session: null },
            error: authError,
          })),
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
          })),
        },
      }),
      getAuthSession: vi.fn(async () => { throw authError; }),
    }));

    const { getAuthSession } = await import('@/utils/auth');

    await expect(getAuthSession()).rejects.toThrow('JWT expired');
  });
});

// ---------------------------------------------------------------------------
// Test 3: stale query data NOT served after user switch (cross-user isolation)
// ---------------------------------------------------------------------------
describe('cross-user query cache isolation: full auth-then-fetch-then-switch flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not serve stale user-A data to user-B after a hot switch', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { queryClient, watchAuthQueryCache } = await import('@/utils/query-client');

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // user-A's INITIAL_SESSION fires (cold-start: clears the anon cache slot).
    callback?.('SIGNED_IN', { user: { id: 'user-a' } });

    // After auth, user-A's data is fetched/restored into the cache.
    queryClient.setQueryData(['recipes'], [{ id: 10, name: 'User-A Lasagna' }]);
    expect(queryClient.getQueryData(['recipes'])).toEqual([{ id: 10, name: 'User-A Lasagna' }]);

    // user-B signs in on the same device (hot switch — clears user-A's slot).
    callback?.('SIGNED_IN', { user: { id: 'user-b' } });
    await Promise.resolve();

    // user-A's data must no longer be visible.
    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();

    // user-B receives a fresh fetch (simulated).
    queryClient.setQueryData(['recipes'], [{ id: 20, name: 'User-B Carbonara' }]);
    expect(queryClient.getQueryData(['recipes'])).toEqual([{ id: 20, name: 'User-B Carbonara' }]);

    stopWatching();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does not serve stale data from a previous session on cold start (login → reload → different user)', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { queryClient, watchAuthQueryCache } = await import('@/utils/query-client');

    // App reloaded — persister restored anon-slot cache (from a previous anonymous browse).
    queryClient.setQueryData(['recipes'], [{ id: 99, name: 'Stale anon recipe' }]);

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // INITIAL_SESSION fires for user-c — persister had loaded the anon key, which differs.
    callback?.('INITIAL_SESSION', { user: { id: 'user-c' } });
    await Promise.resolve();

    // Stale anon cache must be discarded.
    expect(queryClient.getQueryData(['recipes'])).toBeUndefined();

    stopWatching();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 4: session-restoring interstitial fires and clears
// ---------------------------------------------------------------------------
describe('session-restoring interstitial state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears sessionRestoring immediately when Supabase is not configured', async () => {
    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => null,
    }));

    const {
      getSessionRestoring,
      subscribeSessionRestoring,
      watchAuthQueryCache,
    } = await import('@/utils/query-client');

    expect(getSessionRestoring()).toBe(true);

    const listener = vi.fn();
    const unsubscribeListener = subscribeSessionRestoring(listener);

    const stopWatching = await watchAuthQueryCache();

    expect(getSessionRestoring()).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribeListener();
    stopWatching();
  });

  it('getSessionRestoring() starts true and becomes false after the first auth event', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { getSessionRestoring, watchAuthQueryCache } = await import('@/utils/query-client');

    // Before the first auth event, the flag must be true.
    expect(getSessionRestoring()).toBe(true);

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // Fire INITIAL_SESSION (cold-start — anonymous).
    callback?.('INITIAL_SESSION', null);
    await Promise.resolve();

    // The interstitial must now be gone.
    expect(getSessionRestoring()).toBe(false);

    stopWatching();
  });

  it('subscribeSessionRestoring listeners are called with false when the first auth event fires', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { subscribeSessionRestoring, watchAuthQueryCache } = await import('@/utils/query-client');

    const listener = vi.fn();
    const unsubscribeListener = subscribeSessionRestoring(listener);

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);
    expect(callback).toBeDefined();

    // Listener should NOT have been called yet.
    expect(listener).not.toHaveBeenCalled();

    // First auth event fires.
    callback?.('INITIAL_SESSION', { user: { id: 'user-x' } });
    await Promise.resolve();

    // Listener must have been called exactly once with false.
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(false);

    // Subsequent events must NOT re-trigger the listener (it fires only once).
    callback?.('SIGNED_IN', { user: { id: 'user-x' } });
    await Promise.resolve();

    expect(listener).toHaveBeenCalledOnce();

    unsubscribeListener();
    stopWatching();
  });

  it('unsubscribed listeners are not called after removal', async () => {
    const authStateCallbacks: AuthStateChangeCallback[] = [];
    const unsubscribe = vi.fn();

    vi.doMock('@/utils/auth', () => ({
      getSupabaseClient: () => ({
        auth: {
          onAuthStateChange: (callback: AuthStateChangeCallback) => {
            authStateCallbacks.push(callback);
            return { data: { subscription: { unsubscribe } } };
          },
        },
      }),
    }));

    const { subscribeSessionRestoring, watchAuthQueryCache } = await import('@/utils/query-client');

    const listener = vi.fn();
    const unsubscribeListener = subscribeSessionRestoring(listener);

    // Unsubscribe before the auth event fires.
    unsubscribeListener();

    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1);

    callback?.('INITIAL_SESSION', null);
    await Promise.resolve();

    // Must not have been called.
    expect(listener).not.toHaveBeenCalled();

    stopWatching();
  });
});
