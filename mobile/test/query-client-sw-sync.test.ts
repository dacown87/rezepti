/**
 * Tests for the Service Worker sync wiring inside watchAuthQueryCache /
 * postToServiceWorker (mobile/utils/query-client.ts).
 *
 * Environment: node (no jsdom). navigator.serviceWorker is set up manually
 * and restored after every test so these tests don't pollute the ~200 other
 * mobile tests (in particular query-client-auth-cache.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AuthStateChangeCallback = (event: string, session: { user: { id: string } } | null) => void;

// ---------------------------------------------------------------------------
// Helpers — save/restore navigator.serviceWorker
// ---------------------------------------------------------------------------
let _savedNavigatorDescriptor: PropertyDescriptor | undefined;

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    writable: true,
    configurable: true,
  });
}

function makeControllerPostSpy() {
  return vi.fn();
}

function makeActiveSpy() {
  return vi.fn();
}

/**
 * Builds a fake navigator.serviceWorker with:
 *   .controller.postMessage  — the primary post path
 *   .ready                   — resolves to { active: { postMessage: activeSpy } }
 */
function makeFakeSWNamespace(opts: {
  controllerPostSpy: ReturnType<typeof vi.fn>;
  activeSpy: ReturnType<typeof vi.fn>;
  hasController?: boolean;
}) {
  const controller = opts.hasController !== false
    ? { postMessage: opts.controllerPostSpy }
    : null;

  const activeWorker = { postMessage: opts.activeSpy };
  const ready = Promise.resolve({ active: activeWorker });

  return { controller, ready };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  _savedNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  vi.resetModules();
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore navigator to whatever it was before this test
  if (_savedNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', _savedNavigatorDescriptor);
  } else {
    // navigator was not defined — remove the property we might have set
    try {
      // Setting to undefined is safest on node globalThis
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });
    } catch {
      // ignore if it cannot be changed back
    }
  }
  vi.resetModules();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Shared mock factory for the auth module
// ---------------------------------------------------------------------------
function setupAuthMock(authStateCallbacks: AuthStateChangeCallback[]) {
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
  return { unsubscribe };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('postToServiceWorker — SW cache sync wiring', () => {
  it('posts SET_USER on sign-in (first auth event with a user)', async () => {
    const controllerPostSpy = makeControllerPostSpy();
    const activeSpy = makeActiveSpy();
    setNavigator({
      serviceWorker: makeFakeSWNamespace({ controllerPostSpy, activeSpy }),
    });

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');
    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1)!;

    // Cold-start INITIAL_SESSION / SIGNED_IN with a user
    callback('SIGNED_IN', { user: { id: 'user-a' } });
    // postToServiceWorker is fire-and-forget (void), allow microtasks to settle
    await Promise.resolve();
    await Promise.resolve();

    expect(controllerPostSpy).toHaveBeenCalledWith({ type: 'SET_USER', userId: 'user-a' });
    expect(controllerPostSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'CLEAR_USER' }));

    stopWatching();
  });

  it('posts CLEAR_USER on sign-out (session null)', async () => {
    const controllerPostSpy = makeControllerPostSpy();
    const activeSpy = makeActiveSpy();
    setNavigator({
      serviceWorker: makeFakeSWNamespace({ controllerPostSpy, activeSpy }),
    });

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');
    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1)!;

    // First sign-in to prime activeAuthUserId
    callback('SIGNED_IN', { user: { id: 'user-a' } });
    await Promise.resolve();
    await Promise.resolve();
    controllerPostSpy.mockClear();

    // Sign-out
    callback('SIGNED_OUT', null);
    await Promise.resolve();
    await Promise.resolve();

    expect(controllerPostSpy).toHaveBeenCalledWith({ type: 'CLEAR_USER' });
    expect(controllerPostSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_USER' }));

    stopWatching();
  });

  it('posts CLEAR_USER then SET_USER (in that order) on hot user switch A→B', async () => {
    const controllerPostSpy = makeControllerPostSpy();
    const activeSpy = makeActiveSpy();
    setNavigator({
      serviceWorker: makeFakeSWNamespace({ controllerPostSpy, activeSpy }),
    });

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');
    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1)!;

    // First event: user-a signs in
    callback('SIGNED_IN', { user: { id: 'user-a' } });
    await Promise.resolve();
    await Promise.resolve();
    controllerPostSpy.mockClear();

    // Hot switch: user-b takes over
    callback('SIGNED_IN', { user: { id: 'user-b' } });
    await Promise.resolve();
    await Promise.resolve();

    // Both messages must have been sent
    expect(controllerPostSpy).toHaveBeenCalledWith({ type: 'CLEAR_USER' });
    expect(controllerPostSpy).toHaveBeenCalledWith({ type: 'SET_USER', userId: 'user-b' });

    // CLEAR must come before SET — verify call order
    const calls = controllerPostSpy.mock.calls as Array<[{ type: string; userId?: string }]>;
    const clearIdx = calls.findIndex(([msg]) => msg.type === 'CLEAR_USER');
    const setIdx   = calls.findIndex(([msg]) => msg.type === 'SET_USER' && msg.userId === 'user-b');
    expect(clearIdx).not.toBe(-1);
    expect(setIdx).not.toBe(-1);
    expect(clearIdx).toBeLessThan(setIdx);

    stopWatching();
  });

  it('is a no-op and does NOT throw when navigator.serviceWorker is absent', async () => {
    // navigator exists but has no serviceWorker property
    setNavigator({});

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');

    let stopWatching!: () => void;
    await expect(
      watchAuthQueryCache().then((s) => { stopWatching = s; }),
    ).resolves.not.toThrow();

    const callback = authStateCallbacks.at(-1)!;

    // Firing auth events must not throw
    expect(() => {
      callback('SIGNED_IN', { user: { id: 'user-x' } });
    }).not.toThrow();

    // Let async tasks settle
    await Promise.resolve();
    await Promise.resolve();

    stopWatching();
  });

  it('is a no-op when navigator itself is undefined', async () => {
    // Remove navigator entirely from globalThis
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');

    let stopWatching!: () => void;
    await expect(
      watchAuthQueryCache().then((s) => { stopWatching = s; }),
    ).resolves.not.toThrow();

    const callback = authStateCallbacks.at(-1)!;
    expect(() => {
      callback('SIGNED_IN', { user: { id: 'user-y' } });
    }).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    stopWatching();
  });

  it('falls back to ready.active.postMessage when controller is null', async () => {
    const controllerPostSpy = makeControllerPostSpy(); // won't be called
    const activeSpy = makeActiveSpy();
    // controller: null → code awaits navigator.serviceWorker.ready then uses active
    setNavigator({
      serviceWorker: makeFakeSWNamespace({ controllerPostSpy, activeSpy, hasController: false }),
    });

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');
    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1)!;

    callback('SIGNED_IN', { user: { id: 'user-fallback' } });
    // Need to flush the microtask queue a few more times for the awaited ready promise
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // controller was null → must have used active.postMessage
    expect(activeSpy).toHaveBeenCalledWith({ type: 'SET_USER', userId: 'user-fallback' });
    expect(controllerPostSpy).not.toHaveBeenCalled();

    stopWatching();
  });

  it('swallows a throw from postMessage (silent catch)', async () => {
    const controllerPostSpy = vi.fn().mockImplementation(() => {
      throw new Error('SW postMessage failed');
    });
    const activeSpy = makeActiveSpy();
    setNavigator({
      serviceWorker: makeFakeSWNamespace({ controllerPostSpy, activeSpy }),
    });

    const authStateCallbacks: AuthStateChangeCallback[] = [];
    setupAuthMock(authStateCallbacks);

    const { watchAuthQueryCache } = await import('@/utils/query-client');
    const stopWatching = await watchAuthQueryCache();
    const callback = authStateCallbacks.at(-1)!;

    // This must not propagate the throw
    expect(() => {
      callback('SIGNED_IN', { user: { id: 'user-throw' } });
    }).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    stopWatching();
  });
});
