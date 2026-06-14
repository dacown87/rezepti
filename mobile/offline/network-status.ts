export function onReconnect(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onlineHandler = () => cb();
  const visibilityHandler = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) cb();
  };
  window.addEventListener('online', onlineHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  return () => {
    window.removeEventListener('online', onlineHandler);
    document.removeEventListener('visibilitychange', visibilityHandler);
  };
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
