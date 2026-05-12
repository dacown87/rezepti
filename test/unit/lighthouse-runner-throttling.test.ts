import { describe, expect, it } from 'vitest';
import {
  normalizeLighthouseThrottling,
  VALID_LIGHTHOUSE_THROTTLING_METHODS,
} from '../../scripts/performance/lighthouse-runner.mjs';

describe('lighthouse runner throttling configuration', () => {
  it('defaults to simulate when no method is provided', () => {
    expect(normalizeLighthouseThrottling(undefined)).toBe('simulate');
    expect(normalizeLighthouseThrottling('')).toBe('simulate');
  });

  it('accepts the supported Lighthouse throttling methods', () => {
    expect(VALID_LIGHTHOUSE_THROTTLING_METHODS).toEqual(['simulate', 'devtools']);
    expect(normalizeLighthouseThrottling('simulate')).toBe('simulate');
    expect(normalizeLighthouseThrottling('devtools')).toBe('devtools');
  });

  it('rejects invalid throttling methods before a Lighthouse run starts', () => {
    expect(() => normalizeLighthouseThrottling('provided')).toThrow(
      /Invalid LIGHTHOUSE_THROTTLING: provided/,
    );
  });
});
