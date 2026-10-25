import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LookupAddress } from "node:dns";
import { fetch as undiciFetch } from "undici";

const { assertSafeUrl, safeFetch, SsrfBlockedError, ResponseTooLargeError } = await import(
  "../../src/utils/safe-fetch.js"
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertSafeUrl", () => {
  it("accepts plain http/https URLs", () => {
    expect(assertSafeUrl("https://example.com/recipe").href).toBe("https://example.com/recipe");
    expect(assertSafeUrl("http://example.com").href).toBe("http://example.com/");
    expect(assertSafeUrl("http://1.1.1.1/").href).toBe("http://1.1.1.1/");
    expect(assertSafeUrl("http://[2606:4700:4700::1111]/").href).toBe("http://[2606:4700:4700::1111]/");
  });

  it("accepts port 80 and 443 (default ports)", () => {
    expect(() => assertSafeUrl("http://example.com:80/")).not.toThrow();
    expect(() => assertSafeUrl("https://example.com:443/")).not.toThrow();
  });

  it("rejects non-http(s) schemes", () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com/file", "gopher://example.com"]) {
      expect(() => assertSafeUrl(url), url).toThrow(SsrfBlockedError);
    }
  });

  it("rejects credentials in the URL", () => {
    expect(() => assertSafeUrl("http://user:pass@example.com/")).toThrow(SsrfBlockedError);
  });

  it("rejects non-80/443 ports", () => {
    expect(() => assertSafeUrl("http://example.com:8080/")).toThrow(SsrfBlockedError);
    expect(() => assertSafeUrl("https://example.com:8443/")).toThrow(SsrfBlockedError);
  });

  it("rejects reserved hostnames", () => {
    for (const host of [
      "localhost",
      "foo.localhost",
      "svc.internal",
      "printer.local",
      "metadata.google.internal",
    ]) {
      expect(() => assertSafeUrl(`http://${host}/`), host).toThrow(SsrfBlockedError);
    }
  });

  it("rejects private and link-local IP literals", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://169.254.169.254/",
      "http://192.168.1.1/",
      "http://[::1]/",
      "http://[fd00::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://[64:ff9b::7f00:1]/",
    ]) {
      expect(() => assertSafeUrl(url), url).toThrow(SsrfBlockedError);
    }
  });

  it("throws on unparseable URLs", () => {
    expect(() => assertSafeUrl("not a url")).toThrow(SsrfBlockedError);
  });
});

describe("safeFetch — SSRF guard", () => {
  // The connect-time guard lives inside the real undici Agent, so these tests
  // restore the real fetch (unit setup mocks `global.fetch` by default).
  beforeEach(() => {
    vi.stubGlobal("fetch", undiciFetch);
  });

  const resolveTo = (addresses: LookupAddress[]) =>
    (
      _hostname: string,
      _options: Record<string, unknown>,
      callback: (err: NodeJS.ErrnoException | null, addresses: string | LookupAddress[]) => void,
    ) => {
      callback(null, addresses);
    };

  it("blocks a hostname that resolves to a private address", async () => {
    await expect(
      safeFetch("http://example.com/", {}, { resolveDns: resolveTo([{ address: "10.0.0.1", family: 4 }]) }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks a hostname that resolves to a mix of public and private addresses", async () => {
    await expect(
      safeFetch("http://example.com/", {}, {
        resolveDns: resolveTo([
          { address: "8.8.8.8", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ]),
      }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects non-http(s), credentials and non-standard ports before any request", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch("http://user:pass@example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch("http://example.com:8080/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});

describe("safeFetch — redirects and body handling", () => {
  function stubFetch(handler: (url: string, init: RequestInit) => Response): void {
    vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => handler(url, init)));
  }

  it("rejects a redirect onto a private address", async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));

    await expect(safeFetch("https://example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects a https→http downgrade redirect", async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { location: "http://example.com/x" } }));

    await expect(safeFetch("https://example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("stops after the redirect hop limit", async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { location: "https://example.com/next" } }));

    await expect(safeFetch("https://example.com/")).rejects.toThrow(/Too many redirects/);
  });

  it("aborts the body once the size limit is exceeded", async () => {
    stubFetch(() => new Response("x".repeat(10_000), { status: 200 }));

    const response = await safeFetch("https://example.com/", {}, { maxBytes: 10 });
    await expect(response.arrayBuffer()).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("times out when the upstream never responds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
        });
      }),
    );

    await expect(safeFetch("https://example.com/", {}, { timeoutMs: 20 })).rejects.toThrow();
  });
});
