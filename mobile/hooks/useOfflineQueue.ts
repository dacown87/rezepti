import { useCallback, useEffect, useRef, useState } from 'react';
import { offlineQueue, flushOnce } from '@/offline/queue-singleton';
import { onReconnect, isOnline } from '@/offline/network-status';

export type SyncState = 'idle' | 'syncing' | 'synced';

export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastDropped, setLastDropped] = useState(0);
  const onFlushedRef = useRef<(() => void | Promise<void>) | null>(null);

  // Screens register their reconciliation (e.g. load()) here.
  const setOnFlushed = useCallback((cb: (() => void | Promise<void>) | null) => {
    onFlushedRef.current = cb;
  }, []);

  const refresh = useCallback(async () => {
    setPending(await offlineQueue.size());
    setOnline(isOnline());
  }, []);

  const flush = useCallback(async () => {
    const before = await offlineQueue.size();
    if (before === 0) { setOnline(isOnline()); return; }
    setSyncState('syncing');
    const summary = await flushOnce();
    setLastDropped(summary.dropped);
    await refresh();
    if (summary.sent > 0 && onFlushedRef.current) { await onFlushedRef.current(); }
    if (summary.remaining === 0) {
      setSyncState('synced');
      // auto-dismiss after ~2s; hook flips back to idle
      setTimeout(() => setSyncState('idle'), 2000);
    } else {
      setSyncState('idle');
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    // online + offline + reconnect → keep `online` fresh and auto-flush on reconnect
    const off = onReconnect(() => { void flush(); });
    let offOffline = () => {};
    if (typeof window !== 'undefined') {
      const h = () => setOnline(isOnline());
      window.addEventListener('online', h);
      window.addEventListener('offline', h);
      offOffline = () => { window.removeEventListener('online', h); window.removeEventListener('offline', h); };
    }
    return () => { off(); offOffline(); };
  }, [refresh, flush]);

  return { pending, online, syncState, lastDropped, flush, refresh, setOnFlushed };
}
