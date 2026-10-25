import { Agent } from "undici";
import type { Dispatcher } from "undici";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { isPublicAddress } from "./ip-guard.js";

/** Thrown when a request target is rejected by the SSRF guard. */
export class SsrfBlockedError extends Error {
  constructor(
    readonly host: string,
    readonly reason: string,
  ) {
    // Neutral message — the target must never leak into a user-facing response.
    super("This address cannot be loaded");
    this.name = "SsrfBlockedError";
  }
}

/** Thrown when a response body exceeds the configured size limit. */
export class ResponseTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super("Response body exceeds the size limit");
    this.name = "ResponseTooLargeError";
  }
}

export interface SafeFetchOptions {
  /** Total timeout for the request (redirects included). Default 15 s. */
  timeoutMs?: number;
  /** Body size limit enforced while streaming. Default 5 MB. */
  maxBytes?: number;
  /** Maximum number of redirects to follow. Default 5. */
  maxRedirects?: number;
  /**
   * Test hook: override the DNS resolver the guard runs on top of (defaults to
   * `dns.lookup`). Only the unit tests inject a fake resolver; the guard itself
   * still checks every resolved address.
   */
  resolveDns?: ResolveAll;
}

type ResolveAll = (
  hostname: string,
  options: Record<string, unknown>,
  callback: (err: NodeJS.ErrnoException | null, addresses: string | LookupAddress[]) => void,
) => void;

type SafeFetchInit = RequestInit & { dispatcher?: Dispatcher };

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

/**
 * DNS lookup that verifies every resolved address against the public-address
 * guard *at connection time*. Because the check happens inside `connect`, it
 * closes DNS-rebinding windows and also applies to redirect targets — without
 * duplicating the pre-fetch check.
 */
function makeGuardedLookup(resolve: ResolveAll): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) {
        callback(err, "");
        return;
      }
      const list: LookupAddress[] = Array.isArray(addresses)
        ? addresses
        : [{ address: addresses as string, family: 4 }];
      for (const entry of list) {
        if (!isPublicAddress(entry.address)) {
          callback(new SsrfBlockedError(hostname, "non-public address"), "");
          return;
        }
      }
      const first = list[0];
      callback(null, first.address, first.family);
    });
  };
}

/**
 * Cheap first line of defense: rejects obviously unsafe URLs before any request
 * is made. Throws {@link SsrfBlockedError} with a host + reason (no full URL, no
 * resolved IP) on failure. Returns the parsed URL otherwise.
 */
export function assertSafeUrl(input: URL | string): URL {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    throw new SsrfBlockedError(typeof input === "string" ? input : String(input), "invalid-url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError(url.hostname || url.href, `unsupported-scheme:${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new SsrfBlockedError(url.hostname, "credentials-in-url");
  }

  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    throw new SsrfBlockedError(url.hostname, `port:${url.port}`);
  }

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host.endsWith(".metadata.google.internal")
  ) {
    throw new SsrfBlockedError(host, "reserved-hostname");
  }

  // URL.hostname keeps the brackets around IPv6 literals (`[::1]`); strip them
  // so `isIP`/`isPublicAddress` see the bare address.
  const hostForIp = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (isIP(hostForIp) !== 0 && !isPublicAddress(hostForIp)) {
    throw new SsrfBlockedError(host, "non-public-ip-literal");
  }

  return url;
}

/**
 * Entry-point validation for user-supplied import URLs. Throws
 * {@link SsrfBlockedError} for anything unsafe; callers map that to a generic
 * `400` without leaking the reason. Runs before the classifier and before any
 * job is created, so a blocked URL never reaches `fetch` or `yt-dlp`.
 */
export function validateImportUrl(input: URL | string): URL {
  return assertSafeUrl(input);
}

function extractSsrfError(error: unknown): SsrfBlockedError | null {
  if (error instanceof SsrfBlockedError) return error;
  if (error instanceof Error && error.cause instanceof SsrfBlockedError) {
    return error.cause;
  }
  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      const found = extractSsrfError(nested);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Wraps a response body so that reading it fails once `maxBytes` is exceeded,
 * without buffering the whole body first. The returned object stays
 * `Response`-compatible, so existing `.text()`/`.json()`/`.arrayBuffer()` call
 * sites keep working unchanged.
 */
function limitResponseSize(response: Response, maxBytes: number): Response {
  const body = response.body;
  if (!body) return response;

  let received = 0;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > maxBytes) {
            await reader.cancel().catch(() => {});
            controller.error(new ResponseTooLargeError(maxBytes));
            return;
          }
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await body.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Fetch with SSRF protection: scheme/credential/port/hostname checks up front,
 * a per-call undici Agent whose connect-time lookup blocks non-public addresses
 * (including redirects), manual redirect following (max 5 hops, https→http
 * rejected), a timeout and a streaming body-size limit.
 */
export async function safeFetch(
  input: URL | string,
  init: RequestInit = {},
  options: SafeFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let url = assertSafeUrl(input);

  const agent = new Agent({ connect: { lookup: makeGuardedLookup(options.resolveDns ?? (dnsLookup as unknown as ResolveAll)) } });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; ; hop++) {
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          redirect: "manual",
          signal: controller.signal,
          dispatcher: agent,
        } as SafeFetchInit);
      } catch (error) {
        const blocked = extractSsrfError(error);
        if (blocked) {
          console.warn(`[safe-fetch] blocked ${blocked.host} (${blocked.reason})`);
          throw blocked;
        }
        throw error;
      }

      const status = response.status;
      if (status >= 300 && status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => {});
        if (!location) {
          throw new Error(`Redirect without location (HTTP ${status})`);
        }
        if (hop >= maxRedirects) {
          throw new Error(`Too many redirects (${maxRedirects})`);
        }
        const next = assertSafeUrl(new URL(location, url));
        if (url.protocol === "https:" && next.protocol === "http:") {
          throw new SsrfBlockedError(next.hostname, "https-to-http-redirect");
        }
        url = next;
        continue;
      }

      return limitResponseSize(response, maxBytes);
    }
  } finally {
    clearTimeout(timer);
  }
}
