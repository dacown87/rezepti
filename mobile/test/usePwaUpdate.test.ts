/**
 * Tests for usePwaUpdate hook.
 *
 * Environment: node (no jsdom). All browser globals are set up manually and
 * restored after each test to keep suites isolated.
 */
import { renderHook, act } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake ServiceWorker primitives
// ---------------------------------------------------------------------------

function makeFakeWorker(state: ServiceWorkerState = 'installing') {
  const listeners: Map<string, Array<EventListenerOrEventListenerObject>> = new Map();
  const worker = {
    state,
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }),
    dispatchEvent: vi.fn((event: Event) => {
      const arr = listeners.get(event.type) ?? [];
      for (const l of arr) {
        if (typeof l === 'function') l(event);
        else l.handleEvent(event);
      }
      return true;
    }),
  } as unknown as ServiceWorker & {
    postMessage: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
    _listeners: Map<string, Array<EventListenerOrEventListenerObject>>;
  };
  (worker as unknown as { _listeners: typeof listeners })._listeners = listeners;
  return worker;
}

function makeFakeRegistration(opts: {
  waiting?: ServiceWorker | null;
  installing?: ServiceWorker | null;
  controller?: ServiceWorker | null;
} = {}) {
  const listeners: Map<string, Array<EventListenerOrEventListenerObject>> = new Map();
  const reg = {
    waiting: opts.waiting ?? null,
    installing: opts.installing ?? null,
    active: null,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }),
    dispatchEvent: vi.fn((event: Event) => {
      const arr = listeners.get(event.type) ?? [];
      for (const l of arr) {
        if (typeof l === 'function') l(event);
        else l.handleEvent(event);
      }
      return true;
    }),
    _listeners: listeners,
  } as unknown as ServiceWorkerRegistration & {
    dispatchEvent: ReturnType<typeof vi.fn>;
    _listeners: Map<string, Array<EventListenerOrEventListenerObject>>;
  };
  return reg;
}

type FakeSWContainer = {
  controller: ServiceWorker | null;
  getRegistration: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: Map<string, Array<EventListenerOrEventListenerObject>>;
  _dispatch: (type: string) => void;
};

function makeFakeSWContainer(reg: ReturnType<typeof makeFakeRegistration>, controller: ServiceWorker | null = null): FakeSWContainer {
  const listeners: Map<string, Array<EventListenerOrEventListenerObject>> = new Map();
  const container: FakeSWContainer = {
    controller,
    getRegistration: vi.fn().mockResolvedValue(reg),
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const arr = listeners.get(type);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx !== -1) arr.splice(idx, 1);
      }
    }),
    _listeners: listeners,
    _dispatch(type: string) {
      const arr = listeners.get(type) ?? [];
      const evt = { type } as Event;
      for (const l of arr) {
        if (typeof l === 'function') l(evt);
        else l.handleEvent(evt);
      }
    },
  };
  return container;
}

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
  // Provide a minimal window with location.reload
  setWindow({
    location: { reload: vi.fn() },
  });
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
// Tests
// ---------------------------------------------------------------------------

describe('usePwaUpdate', () => {
  it('returns updateReady=false and applyUpdate noop when serviceWorker not in navigator', async () => {
    // No serviceWorker on navigator
    setNavigator({});

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { result } = renderHook(() => usePwaUpdate());

    expect(result.current.updateReady).toBe(false);
    // applyUpdate should be callable without throwing
    expect(() => result.current.applyUpdate()).not.toThrow();
  });

  it('sets updateReady=true when registration already has a waiting worker', async () => {
    const waitingWorker = makeFakeWorker('installed');
    const reg = makeFakeRegistration({ waiting: waitingWorker });
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker /* existing controller */);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { result } = renderHook(() => usePwaUpdate());

    // Wait for the getRegistration promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.updateReady).toBe(true);
  });

  it('sets updateReady=true via updatefound → statechange=installed when controller exists', async () => {
    const installingWorker = makeFakeWorker('installing');
    const reg = makeFakeRegistration({ installing: installingWorker });
    // Provide an existing controller so the update path triggers
    const existingController = makeFakeWorker('activated');
    const swContainer = makeFakeSWContainer(reg, existingController as unknown as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { result } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    // Simulate updatefound firing on the registration
    await act(async () => {
      reg.dispatchEvent({ type: 'updatefound' } as Event);
    });

    // Simulate the installing worker reaching 'installed'
    await act(async () => {
      (installingWorker as unknown as { state: string }).state = 'installed';
      installingWorker.dispatchEvent({ type: 'statechange' } as Event);
    });

    expect(result.current.updateReady).toBe(true);
  });

  it('applyUpdate posts SKIP_WAITING to the waiting worker', async () => {
    const waitingWorker = makeFakeWorker('installed');
    const reg = makeFakeRegistration({ waiting: waitingWorker });
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { result } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.updateReady).toBe(true);

    await act(async () => {
      result.current.applyUpdate();
      // Let the getRegistration promise in applyUpdate resolve
      await Promise.resolve();
    });

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('cleans up event listeners on unmount', async () => {
    const waitingWorker = makeFakeWorker('installed');
    const reg = makeFakeRegistration({ waiting: waitingWorker });
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { unmount } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(swContainer.removeEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
  });
});
