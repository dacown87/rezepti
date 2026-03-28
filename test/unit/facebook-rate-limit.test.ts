import { describe, it, expect, beforeEach } from 'vitest';
import { checkFacebookRateLimit, cleanupRateLimitStore } from '../../src/middleware/facebook-rate-limit.js';

describe('Facebook Rate Limit Middleware', () => {
  beforeEach(() => {
    cleanupRateLimitStore();
  });
  
  it('should allow first request', () => {
    const result = checkFacebookRateLimit('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });
  
  it('should block second request within 1 minute', () => {
    checkFacebookRateLimit('192.168.1.1');
    const result = checkFacebookRateLimit('192.168.1.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });
  
  it('should allow request after 1 minute', async () => {
    const ip = '192.168.1.1';
    checkFacebookRateLimit(ip);
    
    // Simulate time passing
    const original = Date.now;
    Date.now = () => original() + 65_000;
    
    const result = checkFacebookRateLimit(ip);
    expect(result.allowed).toBe(true);
    
    Date.now = original;
  });

  it('should allow different IPs independently', () => {
    const result1 = checkFacebookRateLimit('192.168.1.1');
    const result2 = checkFacebookRateLimit('192.168.1.2');
    
    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });

  it('should track separate rate limits per IP', () => {
    checkFacebookRateLimit('192.168.1.1');
    
    // Second request from same IP should be blocked
    const blocked = checkFacebookRateLimit('192.168.1.1');
    expect(blocked.allowed).toBe(false);
    
    // But different IP should still be allowed
    const allowed = checkFacebookRateLimit('192.168.1.2');
    expect(allowed.allowed).toBe(true);
  });
});
