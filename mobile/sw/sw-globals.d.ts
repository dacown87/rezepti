/**
 * Minimal type declarations for ServiceWorker globals used by sw/recipe-cache-handler.ts.
 * These are needed because the mobile tsconfig uses DOM/ESNext libs, not WebWorker.
 * The full SW source (sw.ts) is excluded from the mobile typecheck and uses sw/tsconfig.json.
 */

declare class ExtendableEvent extends Event {
  waitUntil(f: Promise<unknown>): void;
}
