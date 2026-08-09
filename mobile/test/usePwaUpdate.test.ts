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
    update: vi.fn().mockResolvedValue(undefined),
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

type FakeDocument = {
  visibilityState: 'visible' | 'hidden';
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _dispatch: (type: string) => void;
};

function makeFakeDocument(visibilityState: 'visible' | 'hidden' = 'visible'): FakeDocument {
  const listeners: Map<string, Array<EventListenerOrEventListenerObject>> = new Map();
  const doc: FakeDocument = {
    visibilityState,
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
    _dispatch(type: string) {
      const arr = listeners.get(type) ?? [];
      const evt = { type } as Event;
      for (const l of arr) {
        if (typeof l === 'function') l(evt);
        else l.handleEvent(evt);
      }
    },
  };
  return doc;
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
let originalDocumentDescriptor: PropertyDescriptor | undefined;

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

function setDocument(value: unknown) {
  Object.defineProperty(globalThis, 'document', {
    value,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
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
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
  } else {
    delete (globalThis as { document?: unknown }).document;
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

  it('removes updatefound listener from registration on unmount', async () => {
    const installingWorker = makeFakeWorker('installing');
    const reg = makeFakeRegistration({ installing: installingWorker });
    const existingController = makeFakeWorker('activated');
    const swContainer = makeFakeSWContainer(reg, existingController as unknown as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { unmount } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(reg.removeEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function));
  });

  it('removes statechange listener from new worker on unmount', async () => {
    const installingWorker = makeFakeWorker('installing');
    const reg = makeFakeRegistration({ installing: installingWorker });
    const existingController = makeFakeWorker('activated');
    const swContainer = makeFakeSWContainer(reg, existingController as unknown as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { unmount } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    // Simulate updatefound so the statechange listener is added to the new worker
    await act(async () => {
      reg.dispatchEvent({ type: 'updatefound' } as Event);
    });

    unmount();

    expect(installingWorker.removeEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
  });

  it('calls window.location.reload() exactly once after applyUpdate() + controllerchange fires', async () => {
    const waitingWorker = makeFakeWorker('installed');
    const reg = makeFakeRegistration({ waiting: waitingWorker });
    // Provide two independent getRegistration results: one for the effect, one for applyUpdate()
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);
    // applyUpdate() also calls getRegistration — keep the same mock returning the same reg
    swContainer.getRegistration.mockResolvedValue(reg);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { result } = renderHook(() => usePwaUpdate());

    // Let the useEffect getRegistration() promise resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.updateReady).toBe(true);

    // Call applyUpdate() — this posts SKIP_WAITING and sets reloadingRef.current = true
    await act(async () => {
      result.current.applyUpdate();
      // Flush the applyUpdate getRegistration promise
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    // Simulate the SW firing controllerchange (new SW took control)
    await act(async () => {
      swContainer._dispatch('controllerchange');
    });

    // window.location.reload must have been called exactly once
    expect((window.location.reload as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('does NOT call window.location.reload() on controllerchange without a prior applyUpdate()', async () => {
    const waitingWorker = makeFakeWorker('installed');
    const reg = makeFakeRegistration({ waiting: waitingWorker });
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    // Fire controllerchange WITHOUT calling applyUpdate() first
    await act(async () => {
      swContainer._dispatch('controllerchange');
    });

    // reload must NOT have been called
    expect((window.location.reload as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('proactively calls registration.update() once a registration is found, instead of relying only on the browser implicit check', async () => {
    const reg = makeFakeRegistration({});
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);

    setNavigator({ serviceWorker: swContainer });

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it('calls registration.update() again when the document becomes visible (installed PWA brought to foreground)', async () => {
    const reg = makeFakeRegistration({});
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);
    setNavigator({ serviceWorker: swContainer });

    const doc = makeFakeDocument('visible');
    setDocument(doc);

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    expect(reg.update).toHaveBeenCalledTimes(1);

    await act(async () => {
      doc._dispatch('visibilitychange');
    });

    expect(reg.update).toHaveBeenCalledTimes(2);
  });

  it('does not call registration.update() on visibilitychange while the document is hidden', async () => {
    const reg = makeFakeRegistration({});
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);
    setNavigator({ serviceWorker: swContainer });

    const doc = makeFakeDocument('hidden');
    setDocument(doc);

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    expect(reg.update).toHaveBeenCalledTimes(1);

    await act(async () => {
      doc._dispatch('visibilitychange');
    });

    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it('removes the visibilitychange listener from document on unmount', async () => {
    const reg = makeFakeRegistration({});
    const swContainer = makeFakeSWContainer(reg, {} as ServiceWorker);
    setNavigator({ serviceWorker: swContainer });

    const doc = makeFakeDocument('visible');
    setDocument(doc);

    const { usePwaUpdate } = await import('@/hooks/usePwaUpdate');
    const { unmount } = renderHook(() => usePwaUpdate());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
