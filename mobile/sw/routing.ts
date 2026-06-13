/**
 * Pure, side-effect-free routing predicates for the RecipeDeck Service Worker.
 *
 * These functions have NO dependencies on service-worker globals, Workbox, or
 * browser APIs — they only operate on plain Request / URL objects from the
 * standard Fetch API types, so they are safe to import in Vitest (Node env).
 */

/**
 * Returns true when the request is an HTML navigation (top-level page load).
 *
 * Two signals are checked so the predicate works both in a real SW context
 * (mode === 'navigate') and in synthetic test requests that set an Accept
 * header but leave mode at the default 'no-cors'.
 */
export function isNavigationRequest(request: Request): boolean {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('Accept') ?? '';
  return accept.includes('text/html');
}

/**
 * Returns true when the URL points to an immutable, content-hashed static
 * asset under the Expo web export path `/_expo/static/`.
 *
 * These files carry their content hash in the filename and are safe to
 * serve forever from a CacheFirst strategy.
 */
export function isHashAsset(url: string | URL): boolean {
  const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname;
  return pathname.startsWith('/_expo/static/');
}
