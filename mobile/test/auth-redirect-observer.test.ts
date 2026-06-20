import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// G1 — registerAuthRedirectObserver: onConfirmationSuccess + onLinkError
//
// Strategy:
//   1. Mock @supabase/supabase-js so createClient returns a controlled stub.
//   2. Set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY env
//      vars so that getSupabaseClient() doesn't bail out early with null.
//   3. Mock expo-linking per test to control getInitialURL and addEventListener.
//   4. The real registerAuthRedirectObserver implementation runs unmodified —
//      we only control the side-effects (Supabase client + Linking).
// ---------------------------------------------------------------------------

describe('registerAuthRedirectObserver — onConfirmationSuccess callback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Provide env vars so getSupabaseClient() proceeds past the null-guard.
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  it('calls onConfirmationSuccess when syncAuthSessionFromUrl succeeds with no extra mode', async () => {
    const unsubscribe = vi.fn();
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe } },
          })),
          exchangeCodeForSession,
        },
      })),
    }));

    // expo-linking: deliver a URL with ?code= through getInitialURL
    vi.doMock('expo-linking', () => ({
      getInitialURL: vi.fn().mockResolvedValue('recipedeck://account?code=abc'),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      createURL: vi.fn((p: string) => `recipedeck://${p.replace(/^\//, '')}`),
    }));

    // Mock auth-storage to avoid Platform dependencies
    vi.doMock('@/utils/auth-storage', () => ({
      authStorage: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => undefined),
        removeItem: vi.fn(async () => undefined),
      },
    }));

    const { registerAuthRedirectObserver } = await import('@/utils/auth');

    const onConfirmationSuccess = vi.fn();
    const onLinkError = vi.fn();

    const cleanup = registerAuthRedirectObserver({ onConfirmationSuccess, onLinkError });

    // Allow the getInitialURL promise chain to fully settle
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(onConfirmationSuccess).toHaveBeenCalledTimes(1);
    expect(onLinkError).not.toHaveBeenCalled();

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('calls onConfirmationSuccess with mode=signup when URL contains mode=signup', async () => {
    const unsubscribe = vi.fn();
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe } },
          })),
          exchangeCodeForSession,
        },
      })),
    }));

    vi.doMock('expo-linking', () => ({
      getInitialURL: vi.fn().mockResolvedValue('recipedeck://account?code=xyz&mode=signup'),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      createURL: vi.fn((p: string) => `recipedeck://${p.replace(/^\//, '')}`),
    }));

    vi.doMock('@/utils/auth-storage', () => ({
      authStorage: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => undefined),
        removeItem: vi.fn(async () => undefined),
      },
    }));

    const { registerAuthRedirectObserver } = await import('@/utils/auth');

    const onConfirmationSuccess = vi.fn();
    const onLinkError = vi.fn();

    const cleanup = registerAuthRedirectObserver({ onConfirmationSuccess, onLinkError });
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(onConfirmationSuccess).toHaveBeenCalledTimes(1);
    expect(onConfirmationSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'signup' }),
    );
    expect(onLinkError).not.toHaveBeenCalled();

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('registerAuthRedirectObserver — onLinkError callback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key');
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  it('calls onLinkError with German message when exchangeCodeForSession returns an error', async () => {
    const unsubscribe = vi.fn();

    // exchangeCodeForSession returns { error } → syncAuthSessionFromUrl throws
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: new Error('Token expired'),
    });

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe } },
          })),
          exchangeCodeForSession,
        },
      })),
    }));

    vi.doMock('expo-linking', () => ({
      getInitialURL: vi.fn().mockResolvedValue('recipedeck://account?code=expired'),
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
      createURL: vi.fn((p: string) => `recipedeck://${p.replace(/^\//, '')}`),
    }));

    vi.doMock('@/utils/auth-storage', () => ({
      authStorage: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => undefined),
        removeItem: vi.fn(async () => undefined),
      },
    }));

    const { registerAuthRedirectObserver } = await import('@/utils/auth');

    const onConfirmationSuccess = vi.fn();
    const onLinkError = vi.fn();

    const cleanup = registerAuthRedirectObserver({ onConfirmationSuccess, onLinkError });
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(onLinkError).toHaveBeenCalledTimes(1);
    expect(onLinkError).toHaveBeenCalledWith(
      'Der Bestätigungs-Link ist abgelaufen oder ungültig. Bitte neu anfordern.',
    );
    expect(onConfirmationSuccess).not.toHaveBeenCalled();

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('calls onLinkError when the addEventListener url event fires and throws', async () => {
    const unsubscribe = vi.fn();
    const urlListeners: Array<(event: { url: string }) => void> = [];

    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: new Error('Invalid code'),
    });

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe } },
          })),
          exchangeCodeForSession,
        },
      })),
    }));

    vi.doMock('expo-linking', () => ({
      // No initial URL — the callback arrives via the event listener
      getInitialURL: vi.fn().mockResolvedValue(null),
      addEventListener: vi.fn(
        (_event: string, listener: (event: { url: string }) => void) => {
          urlListeners.push(listener);
          return { remove: vi.fn() };
        },
      ),
      createURL: vi.fn((p: string) => `recipedeck://${p.replace(/^\//, '')}`),
    }));

    vi.doMock('@/utils/auth-storage', () => ({
      authStorage: {
        getItem: vi.fn(async () => null),
        setItem: vi.fn(async () => undefined),
        removeItem: vi.fn(async () => undefined),
      },
    }));

    const { registerAuthRedirectObserver } = await import('@/utils/auth');

    const onConfirmationSuccess = vi.fn();
    const onLinkError = vi.fn();

    registerAuthRedirectObserver({ onConfirmationSuccess, onLinkError });
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    // Simulate the OS delivering a deep-link URL via the event listener
    for (const listener of urlListeners) {
      listener({ url: 'recipedeck://account?code=bad_code' });
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    expect(onLinkError).toHaveBeenCalledTimes(1);
    expect(onLinkError).toHaveBeenCalledWith(
      'Der Bestätigungs-Link ist abgelaufen oder ungültig. Bitte neu anfordern.',
    );
    expect(onConfirmationSuccess).not.toHaveBeenCalled();
  });
});
