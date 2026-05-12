import { describe, expect, it } from 'vitest';

import {
  buildStabilityVerification,
  createStabilityInvocations,
  normalizePositiveInteger,
  resolveStabilityConfig,
  summarizeStabilityResults,
} from '../../scripts/performance/stability-seed.mjs';

describe('stability seed configuration', () => {
  it('defaults to ten simulate runs with bundle and a discarded warmup step', () => {
    const config = resolveStabilityConfig({});
    const invocations = createStabilityInvocations(config);

    expect(config).toEqual({ runs: 10, method: 'simulate', runBundle: true, runWarmup: true });
    expect(invocations).toHaveLength(22);
    expect(invocations[0]).toMatchObject({
      label: 'bundle',
      args: ['run', 'perf:bundle'],
      writesHistory: false,
    });
    expect(invocations[1]).toMatchObject({
      label: 'warmup',
      args: ['run', 'perf:lighthouse'],
      env: { LIGHTHOUSE_THROTTLING: 'simulate' },
      writesHistory: false,
    });
    expect(invocations[2]).toMatchObject({
      label: 'lighthouse-1',
      args: ['run', 'perf:lighthouse'],
      env: { LIGHTHOUSE_THROTTLING: 'simulate' },
      writesHistory: false,
    });
    expect(invocations[3]).toMatchObject({
      label: 'validate-1',
      args: ['run', 'perf:validate'],
      env: { LIGHTHOUSE_THROTTLING: 'simulate' },
      writesHistory: true,
    });
  });

  it('supports short smoke runs and skipping bundle plus warmup', () => {
    const config = resolveStabilityConfig({
      PERF_STABILITY_RUNS: '2',
      PERF_STABILITY_METHOD: 'devtools',
      PERF_STABILITY_SKIP_BUNDLE: '1',
      PERF_STABILITY_SKIP_WARMUP: '1',
    });
    const invocations = createStabilityInvocations(config);

    expect(config).toEqual({ runs: 2, method: 'devtools', runBundle: false, runWarmup: false });
    expect(invocations.map((step) => step.label)).toEqual([
      'lighthouse-1',
      'validate-1',
      'lighthouse-2',
      'validate-2',
    ]);
  });

  it('rejects invalid run counts', () => {
    expect(() => normalizePositiveInteger('0', 10, 'PERF_STABILITY_RUNS')).toThrow(
      'PERF_STABILITY_RUNS must be a positive integer',
    );
  });
});

describe('stability seed result summary', () => {
  it('tracks failed steps and history write count without editing history itself', () => {
    const summary = summarizeStabilityResults({
      generatedAt: '2026-05-11T00:00:00.000Z',
      config: { runs: 1, method: 'simulate', runBundle: false, runWarmup: false },
      results: [
        { label: 'lighthouse-1', exitCode: 0, writesHistory: false },
        { label: 'validate-1', exitCode: 1, writesHistory: true },
      ],
    });

    expect(summary.status).toBe('failed');
    expect(summary.totalSteps).toBe(2);
    expect(summary.failedSteps).toBe(1);
    expect(summary.historyWrites).toBe(1);
  });

  it('verifies the warmup sequence and history-write integrity explicitly', () => {
    const verification = buildStabilityVerification({
      config: { runs: 2, method: 'simulate', runBundle: true, runWarmup: true },
      results: [
        { label: 'bundle', writesHistory: false },
        { label: 'warmup', writesHistory: false },
        { label: 'lighthouse-1', writesHistory: false },
        { label: 'validate-1', writesHistory: true },
        { label: 'lighthouse-2', writesHistory: false },
        { label: 'validate-2', writesHistory: true },
      ],
    });

    expect(verification).toMatchObject({
      orderOk: true,
      sequenceComplete: true,
      bundlePresent: true,
      warmupPresent: true,
      historyWritesOnlyValidate: true,
      expectedHistoryWrites: 2,
      actualHistoryWrites: 2,
      historyWritesMatchExpected: true,
      warmupHistoryWriteDetected: false,
      ready: true,
    });
  });
});
