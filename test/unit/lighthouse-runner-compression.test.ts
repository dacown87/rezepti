import { describe, expect, it } from 'vitest';
import { isLighthouseWarmupEnabled, shouldGzipResponse } from '../../scripts/performance/lighthouse-runner.mjs';

// The audit server must mirror production's `hono/compress` behaviour, otherwise
// Lighthouse's simulated throttling replays uncompressed JS transfer sizes and
// inflates LCP/TTI (see docs/performance/throttling-analysis.md, 2026-09-27).
describe('lighthouse runner static server compression', () => {
  const js = 'application/javascript; charset=utf-8';

  it('gzips compressible payloads when the client accepts gzip', () => {
    expect(shouldGzipResponse('gzip, deflate, br', js, 5_000_000)).toBe(true);
    expect(shouldGzipResponse('deflate, gzip;q=0.5', 'text/css; charset=utf-8', 4096)).toBe(true);
    expect(shouldGzipResponse('*', 'text/html; charset=utf-8', 4096)).toBe(true);
  });

  it('serves identity when gzip is not accepted', () => {
    expect(shouldGzipResponse(undefined, js, 5_000_000)).toBe(false);
    expect(shouldGzipResponse('br', js, 5_000_000)).toBe(false);
    expect(shouldGzipResponse('gzip;q=0', js, 5_000_000)).toBe(false);
  });

  it('skips binary types and tiny payloads like hono/compress', () => {
    expect(shouldGzipResponse('gzip', 'image/png', 50_000)).toBe(false);
    expect(shouldGzipResponse('gzip', js, 512)).toBe(false);
  });
});

describe('lighthouse runner warm-up', () => {
  it('runs the discarded warm-up pass unless explicitly disabled', () => {
    expect(isLighthouseWarmupEnabled({})).toBe(true);
    expect(isLighthouseWarmupEnabled({ PERF_LIGHTHOUSE_WARMUP: '1' })).toBe(true);
    expect(isLighthouseWarmupEnabled({ PERF_LIGHTHOUSE_WARMUP: '0' })).toBe(false);
  });
});
