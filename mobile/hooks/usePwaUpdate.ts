import { useEffect, useRef, useState } from 'react';

export interface PwaUpdateState {
  updateReady: boolean;
  applyUpdate: () => void;
}

/**
 * Detects when a new Service Worker is waiting to take control and exposes
 * a function to apply the update. Safe no-op when SW is not supported.
 */
export function usePwaUpdate(): PwaUpdateState {
  const [updateReady, setUpdateReady] = useState(false);
  // Guard against reload loops: only reload once per applyUpdate() call.
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Capture the container reference immediately so cleanup closures don't
    // re-read navigator.serviceWorker (which may have changed in tests).
    const swContainer = navigator.serviceWorker;

    let registration: ServiceWorkerRegistration | null = null;
    let newWorker: ServiceWorker | null = null;
    let aborted = false;

    // Called whenever we have a registration — checks waiting immediately and
    // also wires up the updatefound → statechange path.
    function watchRegistration(reg: ServiceWorkerRegistration) {
      registration = reg;

      // Fast path: a waiting worker already exists right now.
      if (reg.waiting) {
        if (!aborted) setUpdateReady(true);
        newWorker = reg.waiting;
      }

      // Slow path: new worker arrives after we already have a controller.
      reg.addEventListener('updatefound', handleUpdateFound);

      // Without this, update detection depends entirely on the browser's own
      // implicit check-on-navigation. An installed/standalone PWA is a
      // long-lived process the user foregrounds rather than reloads, so it
      // never re-triggers that implicit check and can run a stale build
      // indefinitely. Proactively ask right away, then again whenever the
      // app is brought back to the foreground (see visibilitychange below).
      void reg.update().catch(() => {});
    }

    function checkForUpdateIfVisible() {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        registration?.update().catch(() => {});
      }
    }

    function handleUpdateFound() {
      if (!registration) return;
      const installing = registration.installing;
      if (!installing) return;

      // Only report an update when there is already a controller (i.e. this is
      // a true update, not the very first install).
      if (!swContainer.controller) return;

      newWorker = installing;
      installing.addEventListener('statechange', handleStateChange);
    }

    function handleStateChange() {
      if (newWorker?.state === 'installed') {
        if (!aborted) setUpdateReady(true);
      }
    }

    // Wire controllerchange so applyUpdate() can detect when the new SW took over.
    function handleControllerChange() {
      if (reloadingRef.current) {
        window.location.reload();
      }
    }

    swContainer.addEventListener('controllerchange', handleControllerChange);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', checkForUpdateIfVisible);
    }

    swContainer
      .getRegistration()
      .then((reg) => {
        if (aborted || !reg) return;
        watchRegistration(reg);
      })
      .catch(() => {
        // getRegistration can fail in some browsers/origins — treat as no SW.
      });

    return () => {
      aborted = true;
      registration?.removeEventListener('updatefound', handleUpdateFound);
      newWorker?.removeEventListener('statechange', handleStateChange);
      swContainer.removeEventListener('controllerchange', handleControllerChange);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', checkForUpdateIfVisible);
      }
    };
  }, []);

  function applyUpdate() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg?.waiting) return;
      reloadingRef.current = true;
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  return { updateReady, applyUpdate };
}
