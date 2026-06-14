const SYNC_TAG = 'flush-mutations';

/** Registers a one-off Background Sync so the SW can wake the page to flush the queue. */
export async function registerBackgroundFlush(container?: ServiceWorkerContainer): Promise<void> {
  const sw = container ?? (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
  if (!sw) return;
  try {
    const reg = await sw.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
    if (!sync) return; // Background Sync unsupported (e.g. Safari) — online listener covers it.
    await sync.register(SYNC_TAG);
  } catch {
    // Best-effort — the foreground online listener is the reliable fallback.
  }
}
