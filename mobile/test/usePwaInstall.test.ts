/**
 * Tests for usePwaInstall hook.
 *
 * Environment: node (no jsdom). All browser globals are set up manually and
 * restored after each test to keep suites isolated.
 */
import { renderHook, act } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

let originalNavigatorDescriptor: PropertyDescriptor | undefined;
let originalWindowDescriptor: PropertyDescriptor | undefined;

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    writable: true,
    configurable: true,
  });
}

function setWindow(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    value,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
});

afterEach(() => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  }
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  }
  vi.resetModules();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeInstallPromptEvent {
  type: string;
  preventDefault: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
}

function makeInstallPromptEvent(): FakeInstallPromptEvent {
  return {
    type: 'beforeinstallprompt',
    preventDefault: vi.fn(),
    prompt: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
  };
}

function makeWindow(opts: {
  userAgent?: string;
  standalone?: boolean;
  listeners?: Map<string, Array<(e: Event) => void>>;
}) {
  const listeners = opts.listeners ?? new Map<string, Array<(e: Event) => void>>();
  return {
    addEventListener: vi.fn((type: string, cb: (e: Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: (e: Event) => void) => {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(cb);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }),
    matchMedia: vi.fn((_query: string) => ({
      matches: opts.standalone ?? false,
    })),
    _listeners: listeners,
    _dispatch(type: string, event: Event) {
      const arr = listeners.get(type) ?? [];
      for (const cb of arr) cb(event);
    },
  };
}

function makeNavigator(userAgent: string) {
  return { userAgent };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePwaInstall', () => {
  it('canInstall is false initially (no beforeinstallprompt fired yet)', async () => {
    const win = makeWindow({});
    setWindow(win);
    setNavigator(makeNavigator('Mozilla/5.0 (Windows NT 10.0) Chrome/124'));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.canInstall).toBe(false);
  });

  it('canInstall becomes true after a beforeinstallprompt event fires', async () => {
    const listeners = new Map<string, Array<(e: Event) => void>>();
    const win = makeWindow({ listeners });
    setWindow(win);
    setNavigator(makeNavigator('Mozilla/5.0 (Windows NT 10.0) Chrome/124'));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    const promptEvent = makeInstallPromptEvent();

    await act(async () => {
      (win as unknown as { _dispatch: (type: string, event: Event) => void })._dispatch('beforeinstallprompt', promptEvent as unknown as Event);
    });

    expect(promptEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(true);
  });

  it('install() calls prompt() on the deferred event and clears canInstall', async () => {
    const listeners = new Map<string, Array<(e: Event) => void>>();
    const win = makeWindow({ listeners });
    setWindow(win);
    setNavigator(makeNavigator('Mozilla/5.0 (Windows NT 10.0) Chrome/124'));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    const promptEvent = makeInstallPromptEvent();

    await act(async () => {
      (win as unknown as { _dispatch: (type: string, event: Event) => void })._dispatch('beforeinstallprompt', promptEvent as unknown as Event);
    });

    expect(result.current.canInstall).toBe(true);

    await act(async () => {
      await result.current.install();
    });

    expect(promptEvent.prompt).toHaveBeenCalled();
    expect(result.current.canInstall).toBe(false);
  });

  it('showIOSHint is true on iOS user-agent and not standalone', async () => {
    const win = makeWindow({ standalone: false });
    setWindow(win);
    // iOS user-agent, no MSStream
    setNavigator(makeNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    ));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    // Let the useEffect run
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showIOSHint).toBe(true);
  });

  it('showIOSHint is false on non-iOS user-agent', async () => {
    const win = makeWindow({ standalone: false });
    setWindow(win);
    setNavigator(makeNavigator('Mozilla/5.0 (Linux; Android 12) Chrome/124'));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showIOSHint).toBe(false);
  });

  it('showIOSHint is false when iOS but already in standalone (installed)', async () => {
    // standalone = true → already installed, no hint needed
    const win = makeWindow({ standalone: true });
    setWindow(win);
    setNavigator(makeNavigator(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    ));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showIOSHint).toBe(false);
  });

  it('is a no-op when window is undefined (SSR / native)', async () => {
    // Remove window entirely
    setWindow(undefined);
    setNavigator(makeNavigator('Node.js'));

    const { usePwaInstall } = await import('@/hooks/usePwaInstall');
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.canInstall).toBe(false);
    expect(result.current.showIOSHint).toBe(false);
    await expect(result.current.install()).resolves.toBeUndefined();
  });
});
