declare module 'workbox-strategies' {
  export class StaleWhileRevalidate {
    constructor(options?: {
      cacheName?: string;
      plugins?: unknown[];
    });
    handle(options: { request: Request; event: ExtendableEvent }): Promise<Response>;
  }
}

declare module 'workbox-expiration' {
  export class ExpirationPlugin {
    constructor(options?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
      purgeOnQuotaError?: boolean;
    });
  }
}

declare module 'fake-indexeddb/auto';
