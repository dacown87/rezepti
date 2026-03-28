interface RateLimitEntry {
  lastRequest: number;
  blockedUntil: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MS = 60_000; // 1 minute
const RATE_LIMIT_WINDOW = 60_000; // 1 request per minute

export function checkFacebookRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  if (!entry) {
    rateLimitStore.set(ip, { lastRequest: now, blockedUntil: 0 });
    return { allowed: true, retryAfterMs: 0 };
  }
  
  if (now < entry.blockedUntil) {
    return { 
      allowed: false, 
      retryAfterMs: entry.blockedUntil - now 
    };
  }
  
  if (now - entry.lastRequest < RATE_LIMIT_WINDOW) {
    const blockedUntil = now + RATE_LIMIT_WINDOW;
    entry.blockedUntil = blockedUntil;
    return { 
      allowed: false, 
      retryAfterMs: RATE_LIMIT_WINDOW - (now - entry.lastRequest)
    };
  }
  
  entry.lastRequest = now;
  entry.blockedUntil = 0;
  return { allowed: true, retryAfterMs: 0 };
}

export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.blockedUntil + RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(ip);
    }
  }
}
