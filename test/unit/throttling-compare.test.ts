import { describe, expect, it } from 'vitest';

import {
  aggregateComparisonData,
  buildComparisonOutput,
  computeDeltaMetrics,
  createLighthouseInvocation,
  METRIC_KEYS,
  percentile,
  summarizeMetricSamples,
} from '../../scripts/performance/throttling-compare.mjs';

function createMetrics(overrides: Record<string, number | null> = {}) {
  return {
    performanceScore: 0.5,
    fcp: 1000,
    lcp: 1200,
    speedIndex: 1500,
    tbt: 200,
    cls: 0.02,
    inp: 180,
    ...overrides,
  };
}

function createSample(route: string, viewport: string, overrides: Record<string, number | null> = {}) {
  return {
    route,
    viewport,
    metrics: createMetrics(overrides),
  };
}

describe('percentile', () => {
  it('computes nearest-rank p50 and p75 deterministically', () => {
    expect(percentile([40, 10, 20, 30], 0.5)).toBe(20);
    expect(percentile([40, 10, 20, 30], 0.75)).toBe(30);
  });

  it('returns null for empty input', () => {
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe('createLighthouseInvocation', () => {
  it('passes LIGHTHOUSE_THROTTLING as an environment variable', () => {
    const invocation = createLighthouseInvocation('devtools');
    expect(invocation.cmd).toBe('npm');
    expect(invocation.args).toEqual(['run', 'perf:lighthouse']);
    expect(invocation.options.env.LIGHTHOUSE_THROTTLING).toBe('devtools');
  });
});

describe('summarizeMetricSamples', () => {
  it('calculates p50 and p75 for all metrics', () => {
    const samples = [
      createSample('/', 'mobile', { lcp: 1000, cls: 0.01 }),
      createSample('/', 'mobile', { lcp: 1100, cls: 0.03 }),
      createSample('/', 'mobile', { lcp: 1300, cls: 0.02 }),
      createSample('/', 'mobile', { lcp: 1500, cls: 0.04 }),
    ];

    const summary = summarizeMetricSamples(samples);
    expect(summary.sampleCount).toBe(4);
    expect(summary.p50.lcp).toBe(1100);
    expect(summary.p75.lcp).toBe(1300);
    expect(summary.p50.cls).toBe(0.02);
    expect(summary.p75.cls).toBe(0.03);
  });
});

describe('computeDeltaMetrics', () => {
  it('computes simulate-minus-devtools deltas', () => {
    const delta = computeDeltaMetrics(
      createMetrics({ lcp: 1400, cls: 0.031, inp: 250 }),
      createMetrics({ lcp: 1000, cls: 0.011, inp: 200 }),
    );

    expect(delta.lcp).toBe(400);
    expect(delta.cls).toBe(0.02);
    expect(delta.inp).toBe(50);
  });
});

describe('aggregateComparisonData', () => {
  it('handles missing methods and partial runs without inventing deltas', () => {
    const runMatrix = [
      {
        method: 'simulate',
        status: 'ok',
        samples: [
          createSample('/', 'mobile', { lcp: 1100, performanceScore: 0.62 }),
          createSample('/', 'desktop', { lcp: 900, performanceScore: 0.71 }),
        ],
      },
      {
        method: 'simulate',
        status: 'partial',
        samples: [
          createSample('/', 'mobile', { lcp: 1300, performanceScore: 0.58 }),
        ],
      },
      {
        method: 'devtools',
        status: 'failed',
        samples: [],
      },
    ];

    const comparisons = aggregateComparisonData(runMatrix);
    const mobileEntry = comparisons.find((entry) => entry.route === '/' && entry.viewport === 'mobile');
    const desktopEntry = comparisons.find((entry) => entry.route === '/' && entry.viewport === 'desktop');

    expect(mobileEntry).toBeDefined();
    expect(mobileEntry?.methods.simulate.totalRuns).toBe(2);
    expect(mobileEntry?.methods.simulate.okRuns).toBe(1);
    expect(mobileEntry?.methods.simulate.partialRuns).toBe(1);
    expect(mobileEntry?.methods.simulate.sampleCount).toBe(2);
    expect(mobileEntry?.methods.simulate.percentiles.p50.lcp).toBe(1100);
    expect(mobileEntry?.methods.devtools.failedRuns).toBe(1);
    expect(mobileEntry?.methods.devtools.sampleCount).toBe(0);
    expect(mobileEntry?.delta.available).toBe(false);
    expect(mobileEntry?.delta.p50.lcp).toBeNull();

    expect(desktopEntry?.methods.simulate.sampleCount).toBe(1);
    expect(desktopEntry?.methods.devtools.sampleCount).toBe(0);
  });

  it('tracks failed and skipped runs while aggregating successful samples only', () => {
    const runMatrix = [
      {
        method: 'simulate',
        status: 'skipped',
        samples: [],
      },
      {
        method: 'simulate',
        status: 'failed',
        samples: [],
      },
      {
        method: 'simulate',
        status: 'ok',
        samples: [
          createSample('/shopping', 'tablet', { lcp: 1800, cls: 0.05 }),
        ],
      },
      {
        method: 'devtools',
        status: 'ok',
        samples: [
          createSample('/shopping', 'tablet', { lcp: 1500, cls: 0.02 }),
        ],
      },
    ];

    const comparison = aggregateComparisonData(runMatrix)[0];

    expect(comparison.route).toBe('/shopping');
    expect(comparison.viewport).toBe('tablet');
    expect(comparison.methods.simulate.totalRuns).toBe(3);
    expect(comparison.methods.simulate.skippedRuns).toBe(1);
    expect(comparison.methods.simulate.failedRuns).toBe(1);
    expect(comparison.methods.simulate.sampleCount).toBe(1);
    expect(comparison.methods.devtools.sampleCount).toBe(1);
    expect(comparison.delta.available).toBe(true);
    expect(comparison.delta.p50.lcp).toBe(300);
    expect(comparison.delta.p50.cls).toBe(0.03);
  });
});

describe('buildComparisonOutput', () => {
  it('produces the expected output schema', () => {
    const runMatrix = [
      {
        method: 'simulate',
        runIndex: 1,
        status: 'ok',
        exitCode: 0,
        samples: [createSample('/recipe/1', 'desktop', { lcp: 2100, inp: null })],
      },
      {
        method: 'devtools',
        runIndex: 1,
        status: 'ok',
        exitCode: 0,
        samples: [createSample('/recipe/1', 'desktop', { lcp: 1700, inp: null })],
      },
    ];

    const output = buildComparisonOutput({
      generatedAt: '2026-05-11T00:00:00.000Z',
      runMatrix,
    });

    expect(output.generatedAt).toBe('2026-05-11T00:00:00.000Z');
    expect(output.methods).toEqual(['simulate', 'devtools']);
    expect(output.runsPerCombo).toBe(3);
    expect(output.metrics).toEqual(METRIC_KEYS);
    expect(output.runMatrix).toHaveLength(2);
    expect(output.comparisons).toHaveLength(1);
    expect(output.comparisons[0]).toMatchObject({
      route: '/recipe/1',
      viewport: 'desktop',
      delta: {
        direction: 'simulate-minus-devtools',
        available: true,
      },
    });
    expect(output.comparisons[0].methods.simulate.percentiles.p50.lcp).toBe(2100);
    expect(output.comparisons[0].methods.devtools.percentiles.p50.lcp).toBe(1700);
    expect(output.comparisons[0].delta.p50.lcp).toBe(400);
    expect(output.comparisons[0].delta.p50.inp).toBeNull();
  });
});
